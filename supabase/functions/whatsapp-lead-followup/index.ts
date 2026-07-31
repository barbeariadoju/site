import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const formatDateBR = (value: any) => {
  const iso = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const firstName = (value: any) => String(value || '').trim().split(/\s+/)[0] || ''

// v28.31.0: dois estágios de follow-up pra lead que sumiu sem agendar (pedido do
// Juliano, 31/07/2026) — nudge 1 depois de 2h de silêncio, pesquisa de motivo no dia
// seguinte se ainda não respondeu. "greeting" (cliente só mandou "oi" e sumiu) usa o
// contexto comercial real (agendamento ativo ou última visita) em vez de pesquisa de
// motivo — não faz sentido perguntar "por que não agendou" pra quem nem chegou a
// pedir um serviço.
const NUDGE1_AFTER_MS = 2 * 60 * 60 * 1000
const NUDGE2_AFTER_MS = 20 * 60 * 60 * 1000
const MAX_LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000
// Cliente só é "reativável" por visita antiga se já passaram pelo menos esses dias —
// evita mandar "quer marcar de novo?" pra quem esteve na barbearia ontem.
const MIN_DAYS_SINCE_VISIT = 15

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const sendWhatsapp = async (to: string, textBody: string) => {
    const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number: to, text: textBody }),
    })
    const sendData = await sendResponse.json().catch(() => ({}))
    const sentMessageId = String(sendData?.key?.id || '') || null
    await admin.from('whatsapp_messages').insert({ phone: to, direction: 'out', body: textBody, sent_by: 'bot', evolution_message_id: sentMessageId })
  }

  // Um cliente que já foi cuidado (booking real criado depois da conversa abandonada, ou
  // handoff pra humano em andamento) não deve receber nudge nenhum — resolve/apaga o lead.
  const isResolved = async (phone: string, lastMessageAt: string): Promise<boolean> => {
    const { data: booking } = await admin
      .from('bookings')
      .select('id')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'completed'])
      .gte('created_at', lastMessageAt)
      .limit(1)
      .maybeSingle()
    if (booking) return true
    const { data: conv } = await admin
      .from('whatsapp_conversations')
      .select('human_takeover, human_takeover_at')
      .eq('phone', phone)
      .maybeSingle()
    if (conv?.human_takeover) return true
    return false
  }

  const now = Date.now()
  let nudge1Sent = 0, nudge1Skipped = 0, nudge2Sent = 0, nudge2Skipped = 0

  // --- Estágio 1: primeiro toque, 2h depois da última mensagem sem resposta ---
  const { data: stage0Leads, error: stage0Error } = await admin
    .from('conversation_leads')
    .select('phone, customer_name, kind, service_interest, last_message_at')
    .eq('followup_stage', 0)
    .lt('last_message_at', new Date(now - NUDGE1_AFTER_MS).toISOString())
    .gt('last_message_at', new Date(now - MAX_LOOKBACK_MS).toISOString())

  if (stage0Error) { console.error('[whatsapp-lead-followup] stage0', stage0Error); return json({ error: stage0Error.message }, 500) }

  for (const lead of stage0Leads || []) {
    try {
      if (await isResolved(lead.phone, lead.last_message_at)) {
        await admin.from('conversation_leads').delete().eq('phone', lead.phone)
        continue
      }
      const name = firstName(lead.customer_name)
      let text = ''
      if (lead.kind === 'greeting') {
        // Precisa do contexto comercial de verdade (não só o que foi dito na conversa) —
        // agendamento ativo ou última visita, buscados agora, não guardados no lead.
        const { data: upcoming } = await admin.rpc('phone_upcoming_bookings', { p_phone: lead.phone })
        const nextBooking = Array.isArray(upcoming) && upcoming.length ? upcoming[0] : null
        if (nextBooking) {
          text = `Oi${name ? `, ${name}` : ''}! 😊 Vi que você tem um agendamento pra ${formatDateBR(nextBooking.booking_date)} às ${String(nextBooking.start_time).slice(0, 5)} (${nextBooking.service_name}). Precisa de alguma ajuda ou tem alguma dúvida?`
        } else {
          const { data: context } = await admin.rpc('get_customer_commercial_context', { p_phone: lead.phone })
          const lastVisitDaysAgo = context?.last_visit ? Math.floor((now - new Date(String(context.last_visit) + 'T12:00:00-03:00').getTime()) / 86400000) : null
          if (lastVisitDaysAgo !== null && lastVisitDaysAgo >= MIN_DAYS_SINCE_VISIT) {
            const lastServices = String(context?.last_services || '').trim()
            text = `Oi${name ? `, ${name}` : ''}! 😊 Vi que você esteve na barbearia${lastServices ? ` e fez ${lastServices}` : ''}${lastVisitDaysAgo ? ` há ${lastVisitDaysAgo} dias` : ''}. Quer marcar um novo horário?`
          }
        }
        // Nem agendamento ativo, nem visita antiga o suficiente (ou cliente desconhecido) —
        // não manda nada: cliente novo/recente não deve ser cutucado por causa de um "oi".
        if (!text) { await admin.from('conversation_leads').delete().eq('phone', lead.phone); continue }
      } else if (lead.kind === 'availability') {
        text = `Oi${name ? `, ${name}` : ''}! 😊 Aqueles horários que a gente conversou podem ter mudado desde então — se ainda tiver interesse, posso conferir de novo pra você.`
      } else {
        text = `Oi${name ? `, ${name}` : ''}! 😊 Só passando pra saber se ainda tem interesse em ${lead.service_interest || 'agendar um horário'} — se quiser, posso já ver um horário pra você.`
      }
      await sendWhatsapp(lead.phone, text)
      await admin.from('conversation_leads').update({ followup_stage: 1, followup_1_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('phone', lead.phone)
      nudge1Sent++
    } catch (error) {
      console.error('[whatsapp-lead-followup] nudge1 falhou', lead.phone, error)
      nudge1Skipped++
    }
  }

  // --- Estágio 2 (só price_or_service/availability): pesquisa de motivo, dia seguinte ---
  const { data: stage1Leads, error: stage1Error } = await admin
    .from('conversation_leads')
    .select('phone, service_interest, last_message_at, followup_1_sent_at, kind')
    .eq('followup_stage', 1)
    .neq('kind', 'greeting')
    .lt('followup_1_sent_at', new Date(now - NUDGE2_AFTER_MS).toISOString())
    .gt('followup_1_sent_at', new Date(now - MAX_LOOKBACK_MS).toISOString())

  if (stage1Error) { console.error('[whatsapp-lead-followup] stage1', stage1Error); return json({ error: stage1Error.message }, 500) }

  for (const lead of stage1Leads || []) {
    try {
      if (await isResolved(lead.phone, lead.last_message_at)) {
        await admin.from('conversation_leads').delete().eq('phone', lead.phone)
        continue
      }
      const text = `Oi de novo! 👋 Notei que você chegou a perguntar sobre ${lead.service_interest || 'um atendimento'} mas não fechamos o agendamento. Pra eu te ajudar melhor da próxima vez, o que rolou?\n\n1️⃣ Não tinha o dia/horário que eu queria\n2️⃣ Preço\n3️⃣ Só estava pesquisando\n4️⃣ Outro motivo (me conta!)\n\nResponda com o número ou me conte com suas palavras.`
      await sendWhatsapp(lead.phone, text)
      await admin.from('conversation_leads').update({ followup_stage: 2, followup_2_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('phone', lead.phone)
      nudge2Sent++
    } catch (error) {
      console.error('[whatsapp-lead-followup] nudge2 falhou', lead.phone, error)
      nudge2Skipped++
    }
  }

  return json({ ok: true, nudge1_sent: nudge1Sent, nudge1_skipped: nudge1Skipped, nudge2_sent: nudge2Sent, nudge2_skipped: nudge2Skipped })
})
