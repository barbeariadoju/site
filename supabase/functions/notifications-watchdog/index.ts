import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })

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

const LOW_BALANCE_THRESHOLD = 100
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim() || ''
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'Não autorizado.' }, 401)
  }

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const apiKey = requiredSecret('SMSDEV_API_KEY')
  const apiBase = Deno.env.get('SMSDEV_API_BASE_URL')?.trim() || 'https://api.smsdev.com.br'

  const dlrResults: unknown[] = []
  const fallbackResults: unknown[] = []
  let balanceResult: unknown = null

  // 1. Confirmar entrega (DLR) dos SMS ainda sem confirmação.
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: pending, error } = await admin
      .from('sms_queue')
      .select('id, booking_id, event_type, recipient_type, smsdev_message_id')
      .eq('status', 'sent')
      .eq('delivery_status', 'unknown')
      .gte('sent_at', since)
      .not('smsdev_message_id', 'is', null)
      .limit(50)

    if (error) throw error

    for (const row of pending || []) {
      try {
        const response = await fetchWithTimeout(
          `${apiBase}/v1/dlr?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(row.smsdev_message_id)}`,
          { method: 'GET', headers: { Accept: 'application/json' } },
        )
        const data = await response.json().catch(() => ({}))
        const descricao = String(data?.descricao || '').toUpperCase()

        let deliveryStatus: 'unknown' | 'delivered' | 'failed' = 'unknown'
        if (descricao === 'RECEBIDA') deliveryStatus = 'delivered'
        else if (['ERRO', 'BLACK LIST', 'CANCELADA'].includes(descricao)) deliveryStatus = 'failed'

        if (deliveryStatus !== 'unknown') {
          await admin
            .from('sms_queue')
            .update({
              delivery_status: deliveryStatus,
              delivery_operator: data?.operadora || null,
              delivery_checked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
        }

        dlrResults.push({ id: row.id, descricao, delivery_status: deliveryStatus })

        // 2. Fallback cruzado: SMS confirmado como falho -> tenta e-mail, se ainda não tentado.
        if (deliveryStatus === 'failed' && row.recipient_type === 'customer' && row.booking_id) {
          const { data: booking } = await admin
            .from('bookings')
            .select('id, customer_email')
            .eq('id', row.booking_id)
            .maybeSingle()

          if (booking?.customer_email) {
            const { data: existingEmail } = await admin
              .from('email_queue')
              .select('id')
              .eq('booking_id', row.booking_id)
              .eq('event_type', row.event_type)
              .eq('recipient_type', 'customer')
              .maybeSingle()

            if (!existingEmail) {
              const fallbackResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/booking-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
                body: JSON.stringify({
                  booking_id: row.booking_id,
                  event_type: row.event_type,
                  notify_admin: false,
                  channel: 'email',
                }),
              })
              fallbackResults.push({
                booking_id: row.booking_id,
                event_type: row.event_type,
                ok: fallbackResponse.ok,
                status: fallbackResponse.status,
              })
            }
          }
        }
      } catch (dlrError) {
        console.error('[notifications-watchdog] dlr', row.id, dlrError)
        dlrResults.push({ id: row.id, error: dlrError instanceof Error ? dlrError.message : String(dlrError) })
      }
    }
  } catch (error) {
    console.error('[notifications-watchdog] dlr batch', error)
  }

  // 3. Saldo da SMSDev.
  try {
    const response = await fetchWithTimeout(
      `${apiBase}/v1/balance?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    )
    const data = await response.json().catch(() => ({}))
    const saldo = Number(data?.saldo_sms)

    if (Number.isFinite(saldo)) {
      const { data: existingAlert } = await admin
        .from('integration_alerts')
        .select('id, last_alerted_at')
        .eq('alert_key', 'smsdev_balance')
        .maybeSingle()

      const now = new Date()
      const shouldAlert = saldo < LOW_BALANCE_THRESHOLD &&
        (!existingAlert?.last_alerted_at || now.getTime() - new Date(existingAlert.last_alerted_at).getTime() > ALERT_COOLDOWN_MS)

      let alertedAt = existingAlert?.last_alerted_at || null

      if (shouldAlert) {
        const emailSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET') || ''
        await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': emailSecret },
          body: JSON.stringify({
            event_type: 'test',
            recipient_type: 'barbershop',
            recipient_email: 'contato@barbeariadoju.com.br',
            recipient_name: 'Barbearia do Ju',
            to: 'contato@barbeariadoju.com.br',
            subject: '⚠️ Créditos SMSDev acabando',
            html: `<p>O saldo de créditos SMS da SMSDev está em <strong>${saldo}</strong>, abaixo do limite de ${LOW_BALANCE_THRESHOLD}.</p><p>Compre mais créditos em <a href="https://painel.smsdev.com.br">painel.smsdev.com.br</a> para não interromper as confirmações por SMS.</p>`,
          }),
        }).catch((sendError) => console.error('[notifications-watchdog] alerta de saldo', sendError))
        alertedAt = now.toISOString()
      }

      await admin
        .from('integration_alerts')
        .upsert({
          alert_key: 'smsdev_balance',
          last_value: { saldo_sms: saldo },
          last_checked_at: now.toISOString(),
          last_alerted_at: alertedAt,
          updated_at: now.toISOString(),
        }, { onConflict: 'alert_key' })

      balanceResult = { saldo_sms: saldo, alerted: shouldAlert }
    } else {
      balanceResult = { error: 'Resposta de saldo inválida', data }
    }
  } catch (error) {
    console.error('[notifications-watchdog] balance', error)
    balanceResult = { error: error instanceof Error ? error.message : String(error) }
  }

  return json({
    ok: true,
    dlr_checked: dlrResults.length,
    dlr_results: dlrResults,
    fallback_dispatched: fallbackResults.length,
    fallback_results: fallbackResults,
    balance: balanceResult,
  })
})
