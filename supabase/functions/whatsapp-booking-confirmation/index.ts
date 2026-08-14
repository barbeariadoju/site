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

  // v29.21.0 — horário de silêncio (pedido do Juliano, 14/08/2026): mensagem proativa não
  // sai entre 20h e 8h (Brasília). As duas consultas daqui são stateful (marcam
  // confirmation_requested_at / fallback_sent depois de enviar), então o que vencer de
  // noite fica pendente e a primeira rodada depois das 8h entrega sozinha.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (quietHour >= 20 || quietHour < 8) return json({ ok: true, quiet_hours: true })

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

  let requestsSent = 0, requestsSkipped = 0, deadlineNotified = 0, deadlineSkipped = 0

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
      // v28.59.0 — menu numérico (sugestão do Juliano, 06/08/2026, caso Graziela: cliente
      // não entendia que PRECISAVA responder). Número é o padrão que já validamos na
      // pesquisa de satisfação (mais confiável de digitar e de interpretar), e o aviso
      // final deixa claro o que acontece se não responder — sem tom de ameaça.
      // v28.66.0: o aviso de "libero automaticamente" saiu junto com a política — não é mais
      // verdade e assustava sem necessidade. O horário fica de pé mesmo sem resposta.
      const text = `Oi${name ? `, ${name}` : ''}! 😊 Aqui é da Barbearia do Ju. Seu horário de ${dayWord(booking.booking_date)} às ${time} (${booking.service_name}) está guardado pra você.\n\nSó pra eu me organizar, me responde com um número?\n*1* — Confirmo presença ✅\n*2* — Quero remarcar 🔄\n*3* — Preciso cancelar ❌\n\nSeu horário continua reservado de qualquer jeito — se não puder vir, é só avisar. 💈`
      await sendWhatsapp(booking.customer_phone, text)
      await admin.rpc('mark_confirmation_requested', { p_booking_id: booking.id })
      requestsSent++
    } catch (error) {
      console.error('[whatsapp-booking-confirmation] request falhou', booking.id, error)
      requestsSkipped++
    }
  }

  // --- Não respondeu no WhatsApp: v28.66.0 (decisão do Juliano, 07/08/2026) — antes daqui
  // a vaga era LIBERADA sozinha, partindo do princípio de que silêncio = desistência. Isso
  // é falso na prática: cliente que ia comparecer perdia o horário por não ter visto uma
  // mensagem. Agora o agendamento é MANTIDO e o sistema insiste por outros canais (SMS
  // sempre, e-mail quando houver cadastrado). Cancelar só quando o cliente pedir.
  const { data: dueForDeadline, error: deadlineError } = await admin.rpc('bookings_due_for_confirmation_deadline', { p_within_minutes: DEADLINE_WINDOW_MINUTES })
  if (deadlineError) { console.error('[whatsapp-booking-confirmation] deadline query', deadlineError); return json({ error: deadlineError.message }, 500) }

  const notifySecret = Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim() || ''

  for (const booking of dueForDeadline || []) {
    try {
      const name = firstName(booking.customer_name)
      const time = String(booking.start_time).slice(0, 5)
      const quando = dayWord(booking.booking_date)
      const dataBR = String(booking.booking_date).split('-').reverse().join('/')
      let smsOk = false, emailOk = false

      if (notifySecret) {
        // SMS é pago e tem limite de caracteres — texto curto e sem emoji.
        const smsText = `Barbearia do Ju: seu horario de ${quando} as ${time} (${booking.service_name}) esta reservado. Se nao puder vir, avise pelo WhatsApp (11) 96707-3038.`
        const smsResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': notifySecret },
          body: JSON.stringify({
            to: booking.customer_phone,
            text: smsText,
            booking_id: booking.id,
            event_type: 'confirmation_fallback',
            recipient_type: 'customer',
          }),
        }).catch((error) => { console.error('[whatsapp-booking-confirmation] sms', error); return null })
        smsOk = !!smsResponse?.ok

        const email = String(booking.customer_email || '').trim()
        if (email.includes('@')) {
          const html = `<p>Oi${name ? `, ${name}` : ''}!</p><p>Passando só pra lembrar do seu horário na <b>Barbearia do Ju</b>:</p><p><b>${dataBR} às ${time}</b> — ${booking.service_name}</p><p>Seu horário <b>continua reservado</b>. Se não puder vir ou quiser remarcar, é só responder no WhatsApp (11) 96707-3038 — sem problema nenhum.</p><p>Até breve! 💈</p>`
          const emailResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-webhook-secret': notifySecret },
            body: JSON.stringify({
              to: email,
              subject: `Seu horário ${quando} às ${time} está reservado — Barbearia do Ju`,
              html,
              booking_id: booking.id,
              event_type: 'confirmation_fallback',
              recipient_type: 'customer',
            }),
          }).catch((error) => { console.error('[whatsapp-booking-confirmation] email', error); return null })
          emailOk = !!emailResponse?.ok
        }
      }

      // Marca mesmo se um dos canais falhou: o objetivo é não repetir o disparo a cada
      // rodada do cron (SMS é pago). Falha de canal fica no log e no push abaixo.
      await admin.rpc('mark_confirmation_fallback_sent', { p_booking_id: booking.id })
      await notifyJuliano(
        '📩 Cliente não confirmou — horário mantido',
        `${booking.customer_name || booking.customer_phone}, ${quando} às ${time} (${booking.service_name}). Avisamos por SMS${emailOk ? ' e e-mail' : ''}${smsOk ? '' : ' (SMS falhou — confira)'}. O horário segue reservado.`,
        `booking-confirmation-fallback-${booking.id}`,
      )
      deadlineNotified++
    } catch (error) {
      console.error('[whatsapp-booking-confirmation] fallback falhou', booking.id, error)
      deadlineSkipped++
    }
  }

  return json({ ok: true, requests_sent: requestsSent, requests_skipped: requestsSkipped, fallback_notified: deadlineNotified, fallback_skipped: deadlineSkipped })
})
