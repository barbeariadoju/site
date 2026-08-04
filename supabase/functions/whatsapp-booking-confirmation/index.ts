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

const firstName = (value: any) => String(value || '').trim().split(/\s+/)[0] || ''

// v28.32.0: confirmação de presença automática (pedido do Juliano, 31/07/2026 à noite).
// Duas janelas: pede confirmação REQUEST_WINDOW_MINUTES antes do horário; se não confirmar
// nem recusar até DEADLINE_WINDOW_MINUTES antes, libera a vaga sozinha e avisa o Juliano.
// v28.49.1 (04/08/2026): janela de pedido subiu de 3h pra 24h — pedido explícito do
// Juliano depois do caso do Carlos ("cricri"), que recebia esse pedido de confirmação E
// o lembrete de 24h (booking-email/booking_reminder_24h) como 2 mensagens separadas no
// WhatsApp. Decisão: o WhatsApp continua sendo o canal principal (ele confirmou que é a
// melhor fonte de contato), mas só 1 mensagem — esta aqui passa a fazer o papel de
// lembrete E confirmação ao mesmo tempo, disparando ~24h antes quando há folga.
// bookings_due_for_confirmation_request já tem a guarda "created_at < now() - 3h" (quem
// acabou de agendar não precisa confirmar de novo) — pra reservas feitas com MENOS de 24h
// de antecedência, essa guarda sozinha já faz o pedido sair assim que der (o mais cedo
// possível, sem esperar a marca de 24h que nunca vai chegar a tempo), exatamente o "ou
// menos tempo que isso quando não tiver 24h de margem" que ele pediu.
const REQUEST_WINDOW_MINUTES = 1440
const DEADLINE_WINDOW_MINUTES = 60

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

  // Formato canônico da Evolution: sempre com DDI 55. bookings.customer_phone pode vir
  // com 10-11 dígitos (sem o 55) e o envio sem normalizar falha SILENCIOSO na Evolution —
  // caso real (Guilherme, 2026-08-04): 0/3 entregas sem 55 vs 373/373 com 55. Mesma
  // regra já usada em booking-email/customer-birthday/customer-reactivation/etc.
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

  const notifyJuliano = async (title: string, body: string, tag: string) => {
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (!pushSecret) return
    await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title, body: body.slice(0, 180), url: '/admin-agenda.html?app=1', tag } }),
    }).catch((error) => console.error('[whatsapp-booking-confirmation] push', error))
  }

  let requestsSent = 0, requestsSkipped = 0, deadlineCancelled = 0, deadlineSkipped = 0

  // Janela subiu pra 24h (v28.49.1) — o agendamento pedido agora pode ser hoje OU amanhã,
  // não dá mais pra cravar "hoje" no texto sem checar a data real.
  const todaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const dayWord = (bookingDate: string) => (bookingDate === todaySP ? 'hoje' : 'amanhã')

  // --- Pede confirmação: agendamentos dentro da janela de REQUEST_WINDOW_MINUTES que ainda
  // não receberam pedido nenhum. Marca confirmation_requested_at logo depois de enviar, então
  // cada agendamento só entra nesta consulta uma vez, não importa a frequência do cron.
  const { data: dueForRequest, error: requestError } = await admin.rpc('bookings_due_for_confirmation_request', { p_within_minutes: REQUEST_WINDOW_MINUTES })
  if (requestError) { console.error('[whatsapp-booking-confirmation] request query', requestError); return json({ error: requestError.message }, 500) }

  for (const booking of dueForRequest || []) {
    try {
      const name = firstName(booking.customer_name)
      const time = String(booking.start_time).slice(0, 5)
      const text = `Oi${name ? `, ${name}` : ''}! 😊 Passando pra confirmar seu horário de ${dayWord(booking.booking_date)} às ${time} para ${booking.service_name}. Você confirma presença? Responda *sim* pra confirmar, ou me avisa se não vai poder vir.`
      await sendWhatsapp(booking.customer_phone, text)
      await admin.rpc('mark_confirmation_requested', { p_booking_id: booking.id })
      requestsSent++
    } catch (error) {
      console.error('[whatsapp-booking-confirmation] request falhou', booking.id, error)
      requestsSkipped++
    }
  }

  // --- Prazo esgotado: pediu confirmação, cliente não respondeu (nem sim nem não) e já
  // estamos dentro de DEADLINE_WINDOW_MINUTES do horário — libera a vaga sozinha e avisa
  // o cliente (cortesia, pra ele não aparecer achando que ainda está marcado) e o Juliano.
  const { data: dueForDeadline, error: deadlineError } = await admin.rpc('bookings_due_for_confirmation_deadline', { p_within_minutes: DEADLINE_WINDOW_MINUTES })
  if (deadlineError) { console.error('[whatsapp-booking-confirmation] deadline query', deadlineError); return json({ error: deadlineError.message }, 500) }

  for (const booking of dueForDeadline || []) {
    try {
      const { data: cancelledRows, error: cancelError } = await admin.rpc('whatsapp_cancel_booking', { p_phone: booking.customer_phone, p_booking_id: booking.id })
      const cancelled = Array.isArray(cancelledRows) ? cancelledRows[0] : cancelledRows
      if (cancelError || !cancelled) {
        console.error('[whatsapp-booking-confirmation] auto-cancel falhou', booking.id, cancelError)
        deadlineSkipped++
        continue
      }
      const name = firstName(booking.customer_name)
      const time = String(booking.start_time).slice(0, 5)
      await sendWhatsapp(booking.customer_phone, `Oi${name ? `, ${name}` : ''}! Como não recebemos sua confirmação a tempo, liberamos seu horário de hoje às ${time} (${booking.service_name}) para outro cliente. Se ainda quiser vir, me chama que vejo outro horário disponível pra você. 🙏`)
      await notifyJuliano(
        '⏰ Agendamento cancelado por falta de confirmação',
        `${booking.customer_name || booking.customer_phone} não confirmou presença de hoje às ${time} (${booking.service_name}) — vaga liberada automaticamente.`,
        `booking-confirmation-deadline-${booking.id}`,
      )
      deadlineCancelled++
    } catch (error) {
      console.error('[whatsapp-booking-confirmation] deadline falhou', booking.id, error)
      deadlineSkipped++
    }
  }

  return json({ ok: true, requests_sent: requestsSent, requests_skipped: requestsSkipped, deadline_cancelled: deadlineCancelled, deadline_skipped: deadlineSkipped })
})
