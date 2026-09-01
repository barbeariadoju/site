// v29.33.0 — Recibo de quitação do repasse semanal.
//
// Pedido do Juliano em 16/08/2026: "caso ele venha a alegar que não o pagamos". O
// comprovante do Pix prova que saiu dinheiro da conta; não prova que aquele dinheiro se
// refere àquela semana e àquele extrato. Quem fecha essa lacuna é a quitação dada pelo
// próprio profissional, com o extrato à vista.
//
// Três operações numa function só:
//   emitir  (admin)  → gera o token, congela o extrato, manda o link no WhatsApp dele
//   ver     (público, por token) → o que a página recibo.html mostra no celular
//   quitar  (público, por token) → registra a confirmação com data, hora, IP e navegador
//
// O token vai no link e só o HASH fica no banco: link vazado não é link reutilizável para
// quem tiver acesso ao banco, e quem tem o link é quem recebeu a mensagem.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers })

const sha256 = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
const money = (v: unknown) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : ''
const toWhats = (phone: string) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Configuração ausente.' }, 500)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = String(body?.action || '')

  // ---------------------------------------------------------------- ver / quitar
  // Ambas são públicas por token, porque o profissional abre o link no celular dele sem
  // login nenhum. O token é o segredo; sem ele, nada é devolvido.
  if (action === 'ver' || action === 'quitar') {
    const token = String(body?.token || '').trim()
    if (!token) return json({ error: 'Recibo não encontrado.' }, 404)
    const tokenHash = await sha256(token)

    if (action === 'quitar') {
      // IP e navegador entram como evidência da confirmação. É o mesmo conjunto já usado
      // no aceite do contrato — não identifica pessoa, situa o ato.
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
      const ua = req.headers.get('user-agent') || null
      const { data, error } = await admin.rpc('acknowledge_settlement_receipt', {
        p_token_hash: tokenHash, p_ip: ip, p_user_agent: ua,
      })
      if (error) return json({ error: error.message }, 500)
      const row = Array.isArray(data) ? data[0] : data
      if (!row?.ok) return json({ error: 'Recibo não encontrado.' }, 404)
      return json({ ok: true, acknowledged_at: row.acknowledged_at, receipt_number: row.receipt_number })
    }

    const { data, error } = await admin.rpc('get_receipt_by_token', { p_token_hash: tokenHash })
    if (error) return json({ error: error.message }, 500)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return json({ error: 'Recibo não encontrado.' }, 404)
    return json({ ok: true, receipt: row })
  }

  // ---------------------------------------------------------------- emitir (admin)
  if (action !== 'emitir') return json({ error: 'Ação inválida.' }, 400)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ') || !anonKey) return json({ error: 'Não autorizado.' }, 401)
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return json({ error: 'Não autorizado.' }, 401)
  const { data: isAdmin } = await authClient.rpc('is_admin')
  if (!isAdmin) return json({ error: 'Não autorizado.' }, 403)

  const settlementId = String(body?.settlement_id || '')
  if (!settlementId) return json({ error: 'Fechamento não informado.' }, 400)

  const { data: settlement, error: sErr } = await admin
    .from('professional_settlements')
    .select('*, professionals(name, display_name, phone, cnpj, cpf)')
    .eq('id', settlementId)
    .maybeSingle()
  if (sErr || !settlement) return json({ error: 'Fechamento não encontrado.' }, 404)

  const prof = (settlement as Record<string, unknown>).professionals as Record<string, unknown> | null
  const nome = String(prof?.display_name || prof?.name || 'Profissional')

  // Congela o extrato do período no recibo. Depois disso, o documento não depende mais de
  // consultar o banco: ele carrega o que foi conferido, e é isso que o hash sela.
  const { data: linhas } = await admin
    .from('professional_ledger')
    .select('entry_date, kind, description, amount, gross_amount, fee_amount, cost_amount, base_amount, share_percent')
    .eq('settlement_id', settlementId)
    .order('entry_date')

  const snapshot = {
    profissional: nome,
    documento: prof?.cnpj || prof?.cpf || null,
    periodo: { inicio: settlement.period_start, fim: settlement.period_end },
    creditos: settlement.total_credits,
    descontos: settlement.total_debits,
    liquido: settlement.net_amount,
    pago_em: settlement.paid_at,
    forma: settlement.paid_method,
    referencia: settlement.paid_reference,
    lancamentos: linhas || [],
    emitido_em: new Date().toISOString(),
  }

  // O hash cobre o conteúdo do recibo, e é o que impede a alegação de que o extrato mudou
  // depois da quitação. Chaves ordenadas para o mesmo conteúdo gerar sempre o mesmo hash.
  const receiptHash = await sha256(JSON.stringify(snapshot, Object.keys(snapshot).sort()))

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const tokenHash = await sha256(token)

  const { data: numero, error: regErr } = await admin.rpc('register_settlement_receipt', {
    p_settlement_id: settlementId,
    p_token_hash: tokenHash,
    p_snapshot: snapshot,
    p_receipt_hash: receiptHash,
  })
  if (regErr) return json({ error: regErr.message }, 500)

  const link = `https://www.barbeariadoju.com.br/recibo.html?t=${token}`

  // Envio pelo WhatsApp. Se falhar, o recibo JÁ existe e o link volta na resposta — o
  // Juliano manda na mão. Emitir e enviar são coisas separadas de propósito: o documento
  // não pode depender de a Evolution estar de pé.
  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')
  const phone = toWhats(String(prof?.phone || ''))
  let enviado = false
  let erroEnvio = ''

  if (evolutionUrl && evolutionKey && evolutionInstance && phone.length >= 12) {
    const texto = [
      `Olá, ${nome}! Segue o recibo do repasse 💈`,
      '',
      `*Recibo ${numero}*`,
      `Período: ${dia(String(settlement.period_start))} a ${dia(String(settlement.period_end))}`,
      `Cota-parte: ${money(settlement.total_credits)}`,
      ...(Number(settlement.total_debits) > 0 ? [`Descontos: ${money(settlement.total_debits)}`] : []),
      `*Valor pago: ${money(settlement.net_amount)}*`,
      '',
      'Confira o extrato completo e confirme o recebimento aqui:',
      link,
      '',
      'A confirmação vale como quitação deste repasse.',
    ].join('\n')

    try {
      const res = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
        body: JSON.stringify({ number: phone, text: semEmoji(texto) }),
      })
      enviado = res.ok
      if (!res.ok) erroEnvio = `Evolution respondeu ${res.status}`
    } catch (e) {
      erroEnvio = String(e)
    }
  } else {
    erroEnvio = phone.length >= 12 ? 'WhatsApp não configurado.' : 'Profissional sem telefone cadastrado.'
  }

  return json({
    ok: true,
    receipt_number: numero,
    receipt_hash: receiptHash,
    link,
    whatsapp_sent: enviado,
    whatsapp_error: erroEnvio || undefined,
  })
})
