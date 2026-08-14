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

  // v29.21.0 — horário de silêncio (pedido do Juliano, 14/08/2026): nudge, oferta de vaga
  // e pesquisa de motivo não saem entre 20h e 8h (Brasília). Todos os blocos daqui marcam
  // estado DEPOIS de enviar (notified_at / followup_stage / slot_reopened_notified_at) e as
  // janelas de lookback são de dias — a primeira rodada depois das 8h entrega tudo.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (quietHour >= 20 || quietHour < 8) return json({ ok: true, quiet_hours: true })

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Formato canônico da Evolution: sempre com DDI 55. Leads vêm do remoteJid (já com 55),
  // mas a oferta de vaga da lista de espera usa waitlist.customer_phone, que pode vir do
  // site com 10-11 dígitos — envio sem normalizar falha SILENCIOSO na Evolution (caso
  // real na confirmação de presença, 2026-08-04: 0/3 sem 55 vs 373/373 com 55).
  const toWhatsNumber = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '')
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
  }

  const sendWhatsapp = async (to: string, textBody: string) => {
    const number = toWhatsNumber(to)
    const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number, text: textBody }),
    })
    const sendData = await sendResponse.json().catch(() => ({}))
    const sentMessageId = String(sendData?.key?.id || '') || null
    await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: textBody, sent_by: 'bot', evolution_message_id: sentMessageId })
  }

  // Um cliente que já foi cuidado (booking real criado depois da conversa abandonada, ou
  // handoff pra humano em andamento) não deve receber nudge nenhum — resolve/apaga o lead.
  // v28.48.6: comparação de telefone via phone_match_key (RPC lead_booking_exists,
  // migration 083) — a igualdade exata (eq) falhou em caso real: lead com DDI 55 (do
  // remoteJid) vs booking sem 55 → a JuIA mandou "ainda tem interesse?" pro Guilherme
  // 1h depois de ele ser ATENDIDO (04/08/2026).
  const isResolved = async (phone: string, lastMessageAt: string): Promise<boolean> => {
    const { data: hasBooking } = await admin.rpc('lead_booking_exists', { p_phone: phone, p_since: lastMessageAt })
    if (hasBooking === true) return true
    const { data: conv } = await admin
      .from('whatsapp_conversations')
      .select('human_takeover, human_takeover_at')
      .eq('phone', phone)
      .maybeSingle()
    if (conv?.human_takeover) return true
    // v28.71.0 — CASO TATIANE (07/08/2026): a cliente disse "meu marido vai levar meu filho,
    // não sei ainda o melhor horário, te mando mensagem antes", e o Juliano respondeu na mão
    // "Combinado fico no aguardo" às 11:44. Mesmo assim saíram DOIS nudges automáticos
    // (12:30 e 15:00) cutucando quem já tinha sido atendido e já tinha dito que retornaria.
    // Motivo: a flag human_takeover estava FALSE, embora human_takeover_at marcasse 11:44 —
    // responder pelo WhatsApp não liga a flag. Confiar só nela deixa passar todo caso em que
    // o Juliano assume a conversa manualmente, que é o mais comum.
    // Sinal confiável: existir mensagem enviada POR HUMANO (sent_by='human'). Se ele falou,
    // a conversa é dele — robô nenhum entra por cima.
    const { data: humanReply } = await admin
      .from('whatsapp_messages')
      .select('id')
      .eq('phone', phone)
      .eq('direction', 'out')
      .eq('sent_by', 'human')
      .gte('created_at', new Date(Date.now() - 72 * 3600 * 1000).toISOString())
      .limit(1)
    if (humanReply && humanReply.length > 0) return true
    // A data preenchida também vale, mesmo com a flag desligada.
    if (conv?.human_takeover_at && Date.now() - new Date(conv.human_takeover_at).getTime() < 72 * 3600 * 1000) return true
    return false
  }

  const now = Date.now()
  let nudge1Sent = 0, nudge1Skipped = 0, nudge2Sent = 0, nudge2Skipped = 0, reopenedSent = 0, reopenedSkipped = 0, waitlistOfferSent = 0, waitlistOfferSkipped = 0

  // --- Item 1 (fechar o loop da lista de espera, v28.40.0): o trigger
  // bookings_notify_waitlist_slot_reopened marca status='avisado' + offered_date/
  // offered_start_time sozinho quando um horário livre casa com quem está esperando
  // (de QUALQUER origem de cancelamento/reagendamento, e só quando a duração do
  // serviço realmente cabe no horário liberado). Este bloco só manda a mensagem
  // proativa perguntando se ainda quer aquele horário — a resposta (sim/não) é
  // tratada no whatsapp-webhook, nunca cria agendamento sozinho aqui.
  const { data: waitlistOffers, error: waitlistOffersError } = await admin
    .from('waitlist')
    .select('id, customer_name, customer_phone, service_name, offered_date, offered_start_time')
    .eq('status', 'avisado')
    .not('offered_date', 'is', null)
    .not('offered_start_time', 'is', null)
    .is('notified_at', null)

  if (waitlistOffersError) { console.error('[whatsapp-lead-followup] waitlist_offers', waitlistOffersError) }

  for (const offer of waitlistOffers || []) {
    try {
      const name = firstName(offer.customer_name)
      const dateLabel = formatDateBR(offer.offered_date)
      const timeLabel = String(offer.offered_start_time).slice(0, 5)
      await sendWhatsapp(offer.customer_phone, `Boa notícia${name ? `, ${name}` : ''}! 🎉 Abriu uma vaga pra ${dateLabel} às ${timeLabel}${offer.service_name ? ` (${offer.service_name})` : ''} — o horário que você estava esperando. Ainda quer? Responda *sim* ou *não*.`)
      await admin.from('waitlist').update({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', offer.id)
      waitlistOfferSent++
    } catch (error) {
      console.error('[whatsapp-lead-followup] waitlist_offer falhou', offer.customer_phone, error)
      waitlistOfferSkipped++
    }
  }

  // --- Vaga reaberta (v28.34.0): o trigger bookings_notify_leads_slot_reopened marca
  // slot_reopened_at sozinho quando um agendamento que ocupava a data que este lead
  // queria (kind='availability', date_interest) é cancelado ou reagendado pra outro dia
  // — de QUALQUER origem (admin, site, WhatsApp, auto-cancelamento por falta de
  // confirmação). Este bloco só lê a marca e avisa o cliente; não precisa saber quem
  // liberou a vaga nem por quê.
  const { data: reopenedLeads, error: reopenedError } = await admin
    .from('conversation_leads')
    .select('phone, customer_name, date_interest, last_message_at')
    .not('slot_reopened_at', 'is', null)
    .is('slot_reopened_notified_at', null)
    .is('resolved_at', null)

  if (reopenedError) { console.error('[whatsapp-lead-followup] reopened', reopenedError); return json({ error: reopenedError.message }, 500) }

  for (const lead of reopenedLeads || []) {
    try {
      if (await isResolved(lead.phone, lead.last_message_at)) {
        await admin.from('conversation_leads').update({ slot_reopened_notified_at: new Date().toISOString() }).eq('phone', lead.phone)
        continue
      }
      const name = firstName(lead.customer_name)
      const dateLabel = formatDateBR(lead.date_interest)
      await sendWhatsapp(lead.phone, `Boa notícia${name ? `, ${name}` : ''}! 🎉 Abriu uma vaga de novo pra ${dateLabel}, que era o dia que você queria. Ainda tem interesse? Se quiser, já posso ver um horário pra você.`)
      await admin.from('conversation_leads').update({ slot_reopened_notified_at: new Date().toISOString() }).eq('phone', lead.phone)
      reopenedSent++
    } catch (error) {
      console.error('[whatsapp-lead-followup] reopened falhou', lead.phone, error)
      reopenedSkipped++
    }
  }

  // --- Estágio 1: primeiro toque, 2h depois da última mensagem sem resposta ---
  const { data: stage0Leads, error: stage0Error } = await admin
    .from('conversation_leads')
    .select('phone, customer_name, kind, service_interest, last_message_at')
    .eq('followup_stage', 0)
    .is('resolved_at', null)
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
    .is('resolved_at', null)
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

  return json({ ok: true, nudge1_sent: nudge1Sent, nudge1_skipped: nudge1Skipped, nudge2_sent: nudge2Sent, nudge2_skipped: nudge2Skipped, reopened_sent: reopenedSent, reopened_skipped: reopenedSkipped, waitlist_offer_sent: waitlistOfferSent, waitlist_offer_skipped: waitlistOfferSkipped })
})
