import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = request.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão administrativa ausente.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const emailSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET') || ''

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Sessão administrativa inválida ou expirada.' }, 401)

    const body = await request.json()
    const bookingId = String(body?.booking_id || '').trim()
    const status = String(body?.status || '').trim()
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled']

    if (!bookingId) return json({ error: 'Agendamento não informado.' }, 400)
    if (!allowedStatuses.includes(status)) return json({ error: 'Status inválido.' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: current, error: currentError } = await admin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (currentError || !current) return json({ error: 'Agendamento não encontrado.' }, 404)
    if (status === 'cancelled' && !['pending', 'confirmed'].includes(current.status)) {
      return json({ error: 'Este agendamento não pode mais ser cancelado.' }, 400)
    }

    const { data: updated, error: updateError } = await admin
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('*')
      .single()

    if (updateError) return json({ error: updateError.message }, 400)

    let email = { attempted: false, sent: false, skipped: false, error: '' }

    if (status === 'cancelled') {
      if (!current.customer_email) {
        email = { attempted: false, sent: false, skipped: true, error: '' }
      } else if (!emailSecret) {
        email = { attempted: false, sent: false, skipped: false, error: 'EMAIL_WEBHOOK_SECRET não configurado.' }
      } else {
        email.attempted = true
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/booking-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': emailSecret,
            },
            body: JSON.stringify({
              booking_id: bookingId,
              event_type: 'booking_cancelled',
              cancelled_by: 'admin',
              notify_admin: false,
            }),
          })
          const result = await response.json().catch(() => ({}))
          email.sent = response.ok && result?.ok !== false
          if (!email.sent) email.error = result?.error || `Falha no envio (${response.status}).`
        } catch (error) {
          email.error = error instanceof Error ? error.message : 'Falha ao chamar booking-email.'
        }
      }
    }

    return json({ ok: true, booking: updated, email })
  } catch (error) {
    console.error('[admin-booking-status]', error)
    return json({ error: error instanceof Error ? error.message : 'Falha ao atualizar o agendamento.' }, 500)
  }
})
