import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { textoLembreteAniversario, textoConviteIndicacao, textoCreditoIndicador } from '../_shared/beneficios.ts'

// v29.209.0 — rotina diária dos benefícios (presente de aniversário + indicação), 19/09/2026.
// Cron bdj-benefits-dispatch, 10h05 de terça a sábado, só fora do silêncio da JuIA (migração
// 169). Quatro passos, nesta ordem:
//   1. vence o que passou do prazo (expire_customer_benefits);
//   2. avisa quem indicou que ganhou o crédito (indicacao_indicador sem notified_at);
//   3. lembra o aniversariante 7 dias antes do fim do presente, uma vez (reminded_at) — é o que
//      garante que o cliente goze do benefício em vez de esquecer;
//   4. convida para indicar quem já é da casa (2+ atendimentos), uma vez na vida, até 10/dia.
// Mensagens sem emoji (semEmoji na saída) e sem pergunta numerada. Textos em _shared/beneficios.ts.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timeout) }
}

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || request.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)
  // Rede de segurança para disparo manual; a janela completa fica no agendador (juia_quiet_now).
  const hora = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (hora >= 20 || hora < 8) return json({ ok: true, quiet_hours: true })

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
  if (!dryRun && (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance)) return json({ error: 'WhatsApp indisponível.' }, 500)

  const send = async (rawPhone: string, text: string) => {
    const number = canonicalPhone(rawPhone)
    if (!number) throw new Error('telefone')
    const res = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number, text: semEmoji(text) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Evolution ${res.status}`)
    const clean = semEmoji(text)
    await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: clean, sent_by: 'bot', evolution_message_id: String(data?.key?.id || '') || null })
    await admin.from('whatsapp_conversations').upsert({ phone: number, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
    return number
  }

  const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const em7 = new Date(Date.parse(`${hojeSP}T12:00:00-03:00`) + 7 * 86400000).toISOString().slice(0, 10)
  const out: Record<string, unknown> = { hoje: hojeSP, dry_run: dryRun }

  // 1. vencidos
  if (!dryRun) {
    const { data: vencidos } = await admin.rpc('expire_customer_benefits')
    out.expirados = vencidos ?? 0
  }

  // 2. crédito de quem indicou
  const { data: creditos } = await admin.from('customer_benefits')
    .select('id, customer_id, phone, valid_until, meta, customer_profiles(name)')
    .eq('kind', 'indicacao_indicador').eq('status', 'available').is('notified_at', null).limit(20)
  const credRes: unknown[] = []
  for (const c of creditos || []) {
    const text = textoCreditoIndicador({ nome: (c as any).customer_profiles?.name, indicado: (c.meta as any)?.indicado_nome, validoAte: c.valid_until })
    if (dryRun) { credRes.push({ id: c.id, text }); continue }
    try {
      await send(c.phone, text)
      await admin.from('customer_benefits').update({ notified_at: new Date().toISOString() }).eq('id', c.id)
      credRes.push({ id: c.id, ok: true })
    } catch (e) { credRes.push({ id: c.id, ok: false, error: String(e) }) }
  }
  out.creditos_indicacao = credRes

  // 3. lembrete do presente de aniversário (7 dias antes de vencer, uma vez)
  const { data: lembrar } = await admin.from('customer_benefits')
    .select('id, phone, valid_until, customer_profiles(name)')
    .eq('kind', 'aniversario').eq('status', 'available').is('reminded_at', null)
    .lte('valid_until', em7).gte('valid_until', hojeSP).limit(20)
  const lemRes: unknown[] = []
  for (const b of lembrar || []) {
    // quem já tem horário marcado dentro do prazo não precisa de lembrete
    const { data: futuros } = await admin.rpc('phone_upcoming_bookings', { p_phone: canonicalPhone(b.phone) })
    if (Array.isArray(futuros) && futuros.some((f: any) => String(f.booking_date || '') <= b.valid_until)) {
      if (!dryRun) await admin.from('customer_benefits').update({ reminded_at: new Date().toISOString(), meta: { lembrete: 'pulado_ja_agendado' } }).eq('id', b.id)
      lemRes.push({ id: b.id, skipped: 'ja_agendado' }); continue
    }
    const text = textoLembreteAniversario({ nome: (b as any).customer_profiles?.name, validoAte: b.valid_until })
    if (dryRun) { lemRes.push({ id: b.id, text }); continue }
    try {
      await send(b.phone, text)
      await admin.from('customer_benefits').update({ reminded_at: new Date().toISOString() }).eq('id', b.id)
      lemRes.push({ id: b.id, ok: true })
    } catch (e) { lemRes.push({ id: b.id, ok: false, error: String(e) }) }
  }
  out.lembretes_aniversario = lemRes

  // 4. convite para indicar
  const { data: candidatos, error: candErr } = await admin.rpc('referral_invite_candidates', { p_limit: 10 })
  if (candErr) console.error('[benefits-dispatch] candidatos', candErr)
  const convRes: unknown[] = []
  for (const c of candidatos || []) {
    const { data: codigo, error: codErr } = dryRun ? { data: 'JU????', error: null } : await admin.rpc('ensure_referral_code', { p_customer_id: c.customer_id })
    if (codErr || !codigo) { convRes.push({ customer_id: c.customer_id, ok: false, error: 'codigo' }); continue }
    const text = textoConviteIndicacao({ nome: c.name, codigo: String(codigo) })
    if (dryRun) { convRes.push({ customer_id: c.customer_id, name: c.name, text }); continue }
    try {
      const number = await send(c.phone, text)
      await admin.from('customer_outreach_log').insert({ customer_id: c.customer_id, phone: number, kind: 'referral_invite', channel: 'whatsapp', details: { codigo } })
      await admin.from('customer_profiles').update({ last_contact_at: new Date().toISOString() }).eq('id', c.customer_id)
      convRes.push({ customer_id: c.customer_id, ok: true })
    } catch (e) { convRes.push({ customer_id: c.customer_id, ok: false, error: String(e) }) }
  }
  out.convites_indicacao = convRes

  return json({ ok: true, ...out })
})
