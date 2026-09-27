import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { primeiroNome } from '../_shared/primeiro-nome.ts'
import { montarMensagemReativacao, montarMensagemFollowupCancelado } from '../_shared/reativacao.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

const firstName = (value: string) => primeiroNome(value, 'tudo bem')

// Nome como vai no vocativo ("Olá, Marcos.") — ou vazio, quando é melhor não usar nome nenhum.
// v29.66.0: nome que parece empresa/título (Espaço, Salão, Dr…) não vira vocativo.
// v29.71.2 (25/08): a 1a leva saiu com "Oi, MOISES!" — 5 dos 141 cadastros estao em CAIXA ALTA e o
// nome ia cru pro vocativo, denunciando texto de robo. Nome todo maiusculo (ou todo minusculo) vira
// Capitalizado; nome ja bem escrito (Vinícius, McCarthy) fica intacto.
// v29.190.0 — "Sr Magno" saía "Oi!" sem nome (15/09): título na frente usa a palavra seguinte.
// v29.248.0 — virou função para o laço dos leads (agendou e cancelou) usar a mesma regra.
const nomeParaVocativo = (raw: unknown): string => {
  const nomeCru = firstName(String(raw || ''))
  const partesNome = String(raw || '').trim().split(/\s+/)
  const nomeBase = /^(dr|dra|sr|sra|prof|seu|dona)\.?$/i.test(partesNome[0] || '') && partesNome[1] ? partesNome[1] : nomeCru
  const nomeCase = (nomeBase === nomeBase.toUpperCase() || nomeBase === nomeBase.toLowerCase())
    ? nomeBase.charAt(0).toUpperCase() + nomeBase.slice(1).toLowerCase()
    : nomeBase
  return /^(espaco|espaço|salao|salão|studio|outlet|loja|conta)$/i.test(nomeBase) || nomeBase.length < 3 ? '' : nomeCase
}

// "Corte + Barba" → "corte"; vazio → "atendimento".
const servicoCurto = (raw: unknown): string => String(raw || '').split(/\s*\+\s*/)[0].trim().toLowerCase() || 'atendimento'

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)
  // v29.21.0 / v29.26.0 - guarda local de horario (20h-8h). A JANELA COMPLETA de contato
  // (domingo e feriado nunca; sabado ate 15h; demais dias 8h-20h) e aplicada no AGENDADOR,
  // pela migration 110: o cron so chama esta function quando public.juia_quiet_now() e falso.
  // Regra em um lugar so; isto aqui e apenas rede de seguranca para disparo manual.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (quietHour >= 20 || quietHour < 8) return json({ ok: true, quiet_hours: true })

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true
  // v29.246.0 — a régua de etapas (30/45/60/75/90/105/120, depois a cada 30 até 365) vive na função
  // SQL customers_due_for_reactivation (migração 181); aqui só o cooldown de segurança (14 dias).
  const defaultDays = Number(body?.default_days ?? 30)
  const graceDays = Number(body?.grace_days ?? 0)
  const cooldownDays = Number(body?.cooldown_days ?? 14)
  // Parâmetro de teste: quando definido, restringe o envio a um único telefone,
  // permitindo testar o fluxo real sem atingir clientes de verdade.
  const onlyPhone = canonicalPhone(String(body?.only_phone || ''))

  const { data: due, error } = await admin.rpc('customers_due_for_reactivation', {
    p_default_days: defaultDays,
    p_grace_days: graceDays,
    p_cooldown_days: cooldownDays,
  })
  if (error) {
    console.error('[customer-reactivation]', error)
    return json({ error: error.message }, 500)
  }

  let candidates = (due || []).filter((row: any) => canonicalPhone(row.phone))
  if (onlyPhone) candidates = candidates.filter((row: any) => canonicalPhone(row.phone) === onlyPhone)

  // v29.248.0 — segundo grupo: quem agendou e cancelou (ou faltou) sem nunca ter vindo. A regra
  // (7 e 30 dias, nunca uma 3ª, sem cancelamento feito pelo painel, sem 'porta') vive na função SQL
  // leads_cancelled_due_for_followup (migração 182); mesmo cooldown. Se a RPC falhar (migração ainda
  // não aplicada, por exemplo), a reativação de sempre continua — o erro vai pro log e pro JSON.
  let leads: any[] = []
  let followupError: string | null = null
  {
    const { data: leadsDue, error: leadsError } = await admin.rpc('leads_cancelled_due_for_followup', { p_cooldown_days: cooldownDays })
    if (leadsError) {
      followupError = leadsError.message
      console.error('[customer-reactivation] leads_cancelled_due_for_followup', leadsError)
    } else {
      leads = (leadsDue || []).filter((row: any) => canonicalPhone(row.phone))
      if (onlyPhone) leads = leads.filter((row: any) => canonicalPhone(row.phone) === onlyPhone)
    }
  }

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      would_message: candidates.length,
      customers: candidates.map((c: any) => ({ name: c.name, phone: c.phone, last_visit: c.last_visit, days_since: c.days_since, stage: c.stage })),
      would_followup: leads.length,
      leads: leads.map((l: any) => ({ name: l.name, phone: l.phone, last_booking_date: l.last_booking_date, days_since_cancel: l.days_since_cancel, service_name: l.service_name, stage: l.stage })),
      ...(followupError ? { followup_error: followupError } : {}),
    })
  }

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')

  // v29.221.0 — caso Newton (19–22/09/2026): disse "Não. Obrigado." e "vou ficar uma semana fora" no
  // sábado, levou dois toques automáticos na segunda e, na terça, a pesquisa de motivo às 08h00 E esta
  // reativação às 14h00. Quatro mensagens em três dias para quem tinha acabado de dizer não. A
  // reativação é para quem SUMIU: quem conversou com a gente (ou recebeu qualquer mensagem) na última
  // semana não sumiu, e quem tem contato adiado ("me chama quando eu voltar") já tem data certa.
  // Pulado aqui não grava outreach: volta a ser candidato quando a conversa esfriar.
  const SILENCIO_MS = 7 * 86400000
  // Casa pelos 8 últimos dígitos: o mesmo cliente aparece com e sem o 9 (e com e sem o 55).
  const conversouRecente = async (phone: string): Promise<string | null> => {
    const fim = `%${phone.slice(-8)}`
    const { data: msgs } = await admin
      .from('whatsapp_messages')
      .select('id')
      .like('phone', fim)
      .gte('created_at', new Date(Date.now() - SILENCIO_MS).toISOString())
      .limit(1)
    if (msgs && msgs.length) return 'conversa_recente'
    const { data: adiado } = await admin
      .from('return_invites')
      .select('id')
      .like('phone', fim)
      .eq('status', 'deferred')
      .gte('remind_at', new Date().toISOString())
      .limit(1)
    if (adiado && adiado.length) return 'contato_adiado'
    return null
  }

  // Manda pela Evolution e registra em whatsapp_messages/whatsapp_conversations (o mesmo par que a
  // JuIA lê para saber que a conversa existe). Lança erro quando o envio falha; quem chama conta.
  const enviarTexto = async (phone: string, text: string) => {
    const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number: phone, text: semEmoji(text) }),
    })
    if (!sendResponse.ok) throw new Error(`sendText ${sendResponse.status}`)
    const sendData = await sendResponse.json().catch(() => ({}))
    const sentMessageId = String(sendData?.key?.id || '') || null

    await admin.from('whatsapp_messages').insert({ phone, direction: 'out', body: semEmoji(text), sent_by: 'bot', evolution_message_id: sentMessageId })
    await admin.from('whatsapp_conversations').upsert({ phone, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const c of candidates) {
    const phone = canonicalPhone(c.phone)
    const motivoPular = await conversouRecente(phone)
    if (motivoPular) { skipped++; console.log('[customer-reactivation] pulado', motivoPular, phone.slice(-4)); continue }
    // v29.66.0 (22/08/2026, Juliano ligou a reativação de 30 dias): texto genérico "sentimos
    // sua falta" virou mensagem com o que ele fez e há quanto tempo, e o CTA é o mesmo que
    // já converte no lead-followup ("me diz o dia") — a resposta cai na JuIA como pedido de
    // horário. Regras do nome em nomeParaVocativo (v29.71.2, v29.190.0).
    const nome = nomeParaVocativo(c.name)
    const servico = servicoCurto(c.last_service)
    const stage = Number(c.stage || 1)
    // v29.246.0 (26/09, Juliano): "mensagem curta, breve; o objetivo é lembrar, não incomodar".
    // Texto em _shared/reativacao.ts (testado no vitest): duas frases, sem pergunta, sem palpite
    // sobre a aparência (v29.208.0), link do site sempre; muda com a etapa para não repetir.
    const text = montarMensagemReativacao({ nome, servico, dias: Number(c.days_since) || 0, stage })
    try {
      await enviarTexto(phone, text)
      await admin.from('customer_outreach_log').insert({ customer_id: c.customer_id, phone, kind: 'reactivation', channel: 'whatsapp', details: { last_visit: c.last_visit, days_since: c.days_since, stage } })
      await admin.from('customer_profiles').update({ last_contact_at: new Date().toISOString() }).eq('id', c.customer_id)
      sent++
    } catch (sendError) {
      failed++
      console.error('[customer-reactivation] envio falhou', phone, sendError)
    }
  }

  // v29.248.0 — Segundo laço: quem agendou e cancelou (ou faltou) sem nunca ter vindo. Mesmas
  // proteções do laço de cima (conversa nos últimos 7 dias, contato adiado). O lead pode não ter
  // cadastro: customer_id vai null no log (a coluna aceita, migração 036) e o last_contact_at só é
  // marcado quando há perfil. O dedup da etapa é pelo telefone (phone_match_key), na função SQL.
  let followupSent = 0
  let followupFailed = 0
  let followupSkipped = 0
  for (const l of leads) {
    const phone = canonicalPhone(l.phone)
    const motivoPular = await conversouRecente(phone)
    if (motivoPular) { followupSkipped++; console.log('[customer-reactivation] followup pulado', motivoPular, phone.slice(-4)); continue }
    const nome = nomeParaVocativo(l.name)
    const servico = servicoCurto(l.service_name)
    const stage = Number(l.stage || 1)
    const text = montarMensagemFollowupCancelado({ nome, servico, stage })
    try {
      await enviarTexto(phone, text)
      await admin.from('customer_outreach_log').insert({
        customer_id: l.customer_id || null,
        phone,
        kind: 'followup_cancelado',
        channel: 'whatsapp',
        details: { last_booking_date: l.last_booking_date, days_since_cancel: l.days_since_cancel, service_name: l.service_name, stage },
      })
      if (l.customer_id) await admin.from('customer_profiles').update({ last_contact_at: new Date().toISOString() }).eq('id', l.customer_id)
      followupSent++
    } catch (sendError) {
      followupFailed++
      console.error('[customer-reactivation] followup envio falhou', phone, sendError)
    }
  }

  return json({
    ok: true,
    dry_run: false,
    eligible: candidates.length,
    sent,
    failed,
    skipped,
    followup_eligible: leads.length,
    followup_sent: followupSent,
    followup_failed: followupFailed,
    followup_skipped: followupSkipped,
    ...(followupError ? { followup_error: followupError } : {}),
  })
})
