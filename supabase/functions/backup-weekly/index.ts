import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v29.203.0 — Backup semanal do banco (pedido do Juliano, 17/09/2026: "monta o backup sim").
//
// O plano Free do Supabase não faz backup automático. Este cron (domingo 04h00 de Brasília,
// migration 164) despeja TODAS as tabelas do schema public em um JSON comprimido (gzip), guarda no
// bucket privado `backups` (mantém as 12 últimas semanas) e manda o mesmo arquivo em anexo pro
// e-mail do Juliano pelo Zoho (a cópia fora do Supabase — cai no Gmail dele, que é Google). Se o
// anexo falhar, o e-mail vai com um link assinado de 7 dias. Avisa por push no fim.
//
// Restaurar: o arquivo é { generated_at, tables: { nome_da_tabela: [linhas...] } }. Cada linha é a
// linha do banco como o PostgREST devolve (json), então dá pra reinserir tabela a tabela com
// insert ... select from jsonb_to_recordset(...). Nunca restaurar em cima do banco vivo sem antes
// conferir o que mudou depois do backup.
//
// Só a tabela customer_area_otp fica de fora (códigos de acesso, lixo em 2 dias).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 60000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const SKIP = new Set(['customer_area_otp'])
const KEEP_LAST = 12
const PAGE = 1000

const gzip = async (text: string) => {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const startedAt = Date.now()

  // 1) Tabelas do schema public (função SECURITY DEFINER só pro service_role).
  const { data: tableRows, error: tablesError } = await admin.rpc('backup_list_tables')
  if (tablesError) return json({ error: `backup_list_tables: ${tablesError.message}` }, 500)
  const tables = (tableRows || []).map((r: any) => String(r.table_name)).filter((t: string) => !SKIP.has(t))

  // 2) Despejo tabela a tabela, paginado (PostgREST devolve no máximo 1000 por chamada).
  const dump: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  const errors: Record<string, string> = {}
  for (const table of tables) {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1)
      if (error) { errors[table] = error.message; break }
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    dump[table] = rows
    counts[table] = rows.length
  }

  const generatedAt = new Date()
  const dateSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(generatedAt)
  const fileName = `backup-barbearia-do-ju-${dateSP}.json.gz`
  const storagePath = `semanal/${fileName}`
  const payload = JSON.stringify({ generated_at: generatedAt.toISOString(), project: 'rpkqluaxhqsxnewunhfm', tables: dump, counts, errors }, null, 0)
  const bytes = await gzip(payload)

  // 3) Storage privado + poda das mais antigas.
  const { error: uploadError } = await admin.storage.from('backups').upload(storagePath, bytes, { contentType: 'application/gzip', upsert: true })
  if (uploadError) return json({ error: `storage: ${uploadError.message}`, counts, errors }, 500)
  let pruned = 0
  try {
    const { data: files } = await admin.storage.from('backups').list('semanal', { limit: 200, sortBy: { column: 'name', order: 'desc' } })
    const old = (files || []).map(f => f.name).filter(n => n.startsWith('backup-')).sort().reverse().slice(KEEP_LAST)
    if (old.length) { await admin.storage.from('backups').remove(old.map(n => `semanal/${n}`)); pruned = old.length }
  } catch (e) { console.error('[backup-weekly] poda', e) }

  // 4) E-mail pro Juliano com o arquivo em anexo (Zoho). Fallback: link assinado de 7 dias.
  const to = Deno.env.get('BACKUP_EMAIL_TO')?.trim() || 'julianoblpadilha@gmail.com'
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0)
  const resumoLinhas = ['bookings', 'customer_profiles', 'loyalty_accounts', 'payments', 'finance_entries', 'whatsapp_messages']
    .filter(t => counts[t] !== undefined).map(t => `${t}: ${counts[t]}`).join(' · ')
  let emailStatus = 'nao_enviado'
  let signedUrl = ''
  try {
    const { data: signed } = await admin.storage.from('backups').createSignedUrl(storagePath, 7 * 24 * 3600)
    signedUrl = signed?.signedUrl || ''
  } catch { signedUrl = '' }
  try {
    const clientId = requiredSecret('ZOHO_CLIENT_ID')
    const clientSecret = requiredSecret('ZOHO_CLIENT_SECRET')
    const refreshToken = requiredSecret('ZOHO_REFRESH_TOKEN')
    const accountId = requiredSecret('ZOHO_ACCOUNT_ID')
    const fromAddress = requiredSecret('ZOHO_FROM_ADDRESS')
    const accountsBase = Deno.env.get('ZOHO_ACCOUNTS_BASE_URL')?.trim() || 'https://accounts.zoho.com'
    const mailBase = Deno.env.get('ZOHO_MAIL_BASE_URL')?.trim() || 'https://mail.zoho.com'
    const tokenResponse = await fetchWithTimeout(`${accountsBase}/oauth/v2/token`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret }),
    })
    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData?.access_token) throw new Error(`Zoho OAuth: ${JSON.stringify(tokenData)}`)
    const auth = { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` }

    let attachments: unknown[] = []
    try {
      const up = await fetchWithTimeout(`${mailBase}/api/accounts/${encodeURIComponent(accountId)}/messages/attachments?fileName=${encodeURIComponent(fileName)}`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/octet-stream' }, body: bytes,
      })
      const upData = await up.json().catch(() => ({}))
      const d = upData?.data
      if (up.ok && d && d.storeName && d.attachmentPath) attachments = [{ storeName: d.storeName, attachmentPath: d.attachmentPath, attachmentName: d.attachmentName || fileName }]
      else console.error('[backup-weekly] anexo zoho', up.status, JSON.stringify(upData).slice(0, 300))
    } catch (e) { console.error('[backup-weekly] anexo zoho', e) }

    const kb = Math.round(bytes.length / 1024)
    const html = [
      `<p>Backup semanal do sistema da Barbearia do Ju, gerado em ${dateSP} (Brasília).</p>`,
      `<p><b>${tables.length} tabelas, ${totalRows} linhas, ${kb} KB comprimido.</b><br>${resumoLinhas}</p>`,
      attachments.length ? `<p>O arquivo está em anexo (<code>${fileName}</code>). Guarde: é a sua cópia fora do Supabase.</p>` : (signedUrl ? `<p>Não foi possível anexar o arquivo; baixe por este link (vale 7 dias): <a href="${signedUrl}">${fileName}</a></p>` : '<p>Não foi possível anexar nem gerar o link; o arquivo está no Storage do projeto (bucket backups).</p>'),
      Object.keys(errors).length ? `<p>Tabelas com erro na exportação: ${Object.entries(errors).map(([t, e]) => `${t} (${e})`).join('; ')}</p>` : '',
      '<p>Como restaurar está descrito no CHANGELOG do repositório (v29.203.0). Nunca restaure em cima do banco vivo sem conferir o que mudou depois desta data.</p>',
    ].join('')
    const send = await fetchWithTimeout(`${mailBase}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
      method: 'POST', headers: { ...auth, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAddress, toAddress: to, subject: `Backup semanal — Barbearia do Ju — ${dateSP}`, content: html, mailFormat: 'html', encoding: 'UTF-8', askReceipt: 'no', attachments }),
    })
    const sendData = await send.json().catch(() => ({}))
    const code = Number(sendData?.status?.code || send.status)
    if (!send.ok || code >= 400) throw new Error(`Zoho Mail: ${JSON.stringify(sendData).slice(0, 300)}`)
    emailStatus = attachments.length ? 'enviado_com_anexo' : 'enviado_com_link'
  } catch (e) {
    console.error('[backup-weekly] email', e)
    emailStatus = `falhou: ${String((e as Error)?.message || e).slice(0, 200)}`
  }

  // 5) Push pro Juliano.
  try {
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret) await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title: 'Backup semanal feito', body: `${tables.length} tabelas, ${totalRows} linhas. E-mail: ${emailStatus === 'enviado_com_anexo' ? 'enviado com o arquivo em anexo' : emailStatus}.`.slice(0, 180), url: '/admin.html?app=1', tag: `backup-${dateSP}` } }),
    })
  } catch (e) { console.error('[backup-weekly] push', e) }

  return json({ ok: true, file: storagePath, bytes: bytes.length, tables: tables.length, rows: totalRows, counts, errors, pruned, email: emailStatus, ms: Date.now() - startedAt })
})
