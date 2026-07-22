import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

const brl = (value: unknown) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dateBR = (value: string | null | undefined) =>
  value ? value.split('-').reverse().join('/') : ''

const timeBR = (value: unknown) => String(value || '').slice(0, 5)

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#d4af37;color:#111;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:9px;margin:5px">${escapeHtml(label)}</a>`

const layout = (title: string, lead: string, details: string, buttons: string) => `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f2f2f2;font-family:Arial,sans-serif;color:#222">
<table width="100%" cellspacing="0" cellpadding="0" role="presentation">
<tr><td align="center" style="padding:24px 12px">
<table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="max-width:620px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#10131d;color:#fff;padding:26px;text-align:center"><div style="font-size:28px">💈</div><div style="font-size:20px;font-weight:bold">Barbearia do Ju</div></td></tr>
<tr><td style="padding:30px"><h1 style="font-size:25px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.6">${escapeHtml(lead)}</p>${details}<div style="text-align:center;margin:24px 0">${buttons}</div><p style="color:#666;font-size:13px;line-height:1.5">Rua Dr. Antônio da Cruz, 482 – Centro, Bragança Paulista<br>WhatsApp: (11) 96707-3038<br>www.barbeariadoju.com.br</p></td></tr>
</table></td></tr></table></body></html>`

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET') || ''
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'Não autorizado.' }, 401)
  }

  try {
    const body = await request.json()
    const bookingId = String(body?.booking_id || '')
    const eventType = String(body?.event_type || 'booking_confirmed')
    const managementToken = String(body?.management_token || '')
    const cancelledBy = String(body?.cancelled_by || 'customer')
    const notifyAdmin = body?.notify_admin !== false
    const rebookingToken = String(body?.rebooking_token || '')

    if (!bookingId) return json({ error: 'booking_id ausente.' }, 400)
    if (!['booking_confirmed', 'booking_rescheduled', 'booking_cancelled', 'booking_reminder_24h'].includes(eventType)) {
      return json({ error: 'event_type inválido.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: booking, error } = await admin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (error || !booking) return json({ error: 'Agendamento não encontrado.' }, 404)

    const managementUrl = managementToken && booking.booking_code
      ? `https://www.barbeariadoju.com.br/meu-agendamento.html?code=${encodeURIComponent(booking.booking_code)}&token=${encodeURIComponent(managementToken)}`
      : ''

    const routeUrl = 'https://www.google.com/maps/search/?api=1&query=Rua%20Dr.%20Ant%C3%B4nio%20da%20Cruz%2C%20482%2C%20Bragan%C3%A7a%20Paulista'

    const currentDetails = `<div style="background:#f6f6f6;border-radius:12px;padding:18px;line-height:1.8">
      <strong>Data:</strong> ${escapeHtml(dateBR(booking.booking_date))}<br>
      <strong>Horário:</strong> ${escapeHtml(timeBR(booking.start_time))}<br>
      <strong>Serviço:</strong> ${escapeHtml(booking.service_name)}<br>
      <strong>Valor estimado:</strong> ${escapeHtml(brl(Number(booking.service_price || 0) + Number(booking.products_price || 0)))}
    </div>`

    const previousDetails = eventType === 'booking_rescheduled' && booking.previous_booking_date
      ? `<p style="margin:18px 0 8px;color:#666"><strong>Horário anterior:</strong> ${escapeHtml(dateBR(booking.previous_booking_date))} às ${escapeHtml(timeBR(booking.previous_start_time))}</p>`
      : ''

    let customerTitle = 'Agendamento confirmado'
    let customerLead = `Olá, ${booking.customer_name}! Seu horário foi reservado com sucesso.`
    let adminSubject = '📅 Novo agendamento confirmado'
    let customerSubjectIcon = '✅'

    if (eventType === 'booking_rescheduled') {
      customerTitle = 'Agendamento reagendado'
      customerLead = `Olá, ${booking.customer_name}! A alteração do seu horário foi concluída com sucesso.`
      adminSubject = '🔄 Agendamento reagendado'
      customerSubjectIcon = '🔄'
    }

    if (eventType === 'booking_reminder_24h') {
      customerTitle = 'Lembrete do seu horário'
      customerLead = `Olá, ${booking.customer_name}! Passando para lembrar que seu atendimento está marcado para amanhã.`
      adminSubject = '⏰ Lembrete de 24h enviado'
      customerSubjectIcon = '⏰'
    }

    if (eventType === 'booking_cancelled') {
      customerTitle = 'Agendamento cancelado'
      customerLead = cancelledBy === 'admin'
        ? `Olá, ${booking.customer_name}. Informamos que seu agendamento foi cancelado pela Barbearia do Ju.`
        : `Olá, ${booking.customer_name}. Seu agendamento foi cancelado conforme solicitado.`
      adminSubject = '❌ Agendamento cancelado'
      customerSubjectIcon = '❌'
    }

    const bookingUrl = rebookingToken && booking.booking_code
      ? `https://www.barbeariadoju.com.br/reagendar.html?code=${encodeURIComponent(booking.booking_code)}&token=${encodeURIComponent(rebookingToken)}`
      : 'https://www.barbeariadoju.com.br/agendar/'
    const whatsappUrl = `https://wa.me/5511967073038?text=${encodeURIComponent(`Olá! Gostaria de falar sobre meu agendamento de ${dateBR(booking.booking_date)} às ${timeBR(booking.start_time)}.`)}`

    const smsDetails = `${dateBR(booking.booking_date)} às ${timeBR(booking.start_time)} - ${booking.service_name}`
    const smsAddress = 'Rua Dr. Antônio da Cruz, 482, Centro - Bragança Paulista'

    let smsText = `Barbearia do Ju: ${customerLead}`
    if (eventType === 'booking_confirmed') {
      smsText = `Barbearia do Ju: horário confirmado! ${smsDetails}. ${smsAddress}. Dúvidas: (11) 96707-3038`
    } else if (eventType === 'booking_rescheduled') {
      smsText = `Barbearia do Ju: horário alterado! Novo horário: ${smsDetails}. Dúvidas: (11) 96707-3038`
    } else if (eventType === 'booking_reminder_24h') {
      smsText = `Barbearia do Ju: lembrete do seu horário amanhã, ${smsDetails}. ${smsAddress}`
    } else if (eventType === 'booking_cancelled') {
      smsText = `Barbearia do Ju: agendamento de ${smsDetails} foi cancelado. Para remarcar: ${bookingUrl} ou (11) 96707-3038`
    }

    let customerButtons = ''
    if (eventType === 'booking_cancelled') {
      customerButtons = button(bookingUrl, 'Escolher nova data e horário') +
        `<br><a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;color:#7a6114;text-decoration:underline;font-weight:700;margin-top:10px">Falar com a Barbearia do Ju</a>`
    } else {
      customerButtons = (managementUrl ? button(managementUrl, 'Gerenciar agendamento') : button(bookingUrl, 'Abrir agendamento')) +
        button(routeUrl, 'Como chegar')
    }

    const customerHtml = layout(
      customerTitle,
      customerLead,
      `${previousDetails}${currentDetails}`,
      customerButtons,
    )

    const adminLead = `${booking.customer_name} — ${booking.customer_phone}${booking.customer_email ? ` — ${booking.customer_email}` : ''}`
    const adminHtml = layout(
      adminSubject,
      adminLead,
      `${previousDetails}${currentDetails}`,
      button('https://www.barbeariadoju.com.br/admin-agenda.html?app=1', 'Abrir agenda'),
    )

    const send = async (payload: Record<string, unknown>) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': secret,
        },
        body: JSON.stringify(payload),
      })

      return {
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => ({})),
      }
    }

    const sendSms = async (payload: Record<string, unknown>) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': secret,
        },
        body: JSON.stringify(payload),
      })

      return {
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => ({})),
      }
    }

    const results: unknown[] = []
    let customerChannel = 'none'

    if (booking.customer_email) {
      customerChannel = 'email'
      results.push(await send({
        booking_id: booking.id,
        event_type: eventType,
        recipient_type: 'customer',
        recipient_email: booking.customer_email,
        recipient_name: booking.customer_name,
        to: booking.customer_email,
        subject: `${customerSubjectIcon} ${customerTitle} | Barbearia do Ju`,
        html: customerHtml,
      }))
    } else if (booking.customer_phone) {
      customerChannel = 'sms'
      results.push(await sendSms({
        booking_id: booking.id,
        event_type: eventType,
        recipient_type: 'customer',
        recipient_name: booking.customer_name,
        to: booking.customer_phone,
        text: smsText,
      }))
    }

    if (notifyAdmin) results.push(await send({
      booking_id: booking.id,
      event_type: eventType,
      recipient_type: 'barbershop',
      recipient_email: 'contato@barbeariadoju.com.br',
      recipient_name: 'Barbearia do Ju',
      to: 'contato@barbeariadoju.com.br',
      subject: adminSubject,
      html: adminHtml,
    }))

    return json({
      ok: results.every((result: any) => result.ok),
      customer_channel: customerChannel,
      customer_skipped: customerChannel === 'none',
      results,
    })
  } catch (error) {
    console.error('[booking-email]', error)
    return json({
      error: error instanceof Error ? error.message : 'Falha ao preparar os e-mails.',
    }, 500)
  }
})
