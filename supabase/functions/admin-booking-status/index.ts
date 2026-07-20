import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Endpoint administrativo (exige Bearer token de sessão) — CORS restrito à mesma allowlist
// usada em contact-form/ju-ia-site, em vez de aceitar qualquer origem.
const ALLOWED_ORIGINS = new Set([
  'https://www.barbeariadoju.com.br',
  'https://barbeariadoju.com.br',
])

// Guardado por requisição (Deno.serve roda um handler por request, então uma variável de módulo
// reatribuída no início de cada chamada é segura aqui e evita ter que passar "origin" em toda
// chamada de json()/fail() já existente no arquivo).
let requestOrigin: string | null = null

const corsHeaders = (): Record<string, string> => ({
  'Access-Control-Allow-Origin': requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Origin',
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders() })

const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('')
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')

const log = (stage: string, details: Record<string, unknown> = {}) =>
  console.log(`[admin-booking-status] ${stage}`, JSON.stringify(details))

const fail = (stage: string, message: string, status: number, details: Record<string, unknown> = {}) => {
  // Detalhes completos (incluindo stack traces e erros do Postgres) só vão para o log do servidor.
  // O cliente recebe apenas a mensagem genérica, o estágio e o request_id, para não vazar
  // informação interna que poderia ajudar um invasor a mapear o schema/lógica do banco.
  console.error(`[admin-booking-status] ${stage}`, JSON.stringify({ message, ...details }))
  return json({ error: message, stage, request_id: details.requestId ?? null }, status)
}

Deno.serve(async (request: Request) => {
  requestOrigin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (request.method !== 'POST') return fail('method', 'Método não permitido.', 405)

  const requestId = crypto.randomUUID()
  log('request_received', { requestId })

  try {
    const authorization = request.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) {
      return fail('authorization_header', 'Sessão administrativa ausente.', 401, { requestId })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const emailSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET') || ''

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return fail('environment', 'Configuração interna do Supabase incompleta.', 500, {
        requestId,
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasAnonKey: Boolean(anonKey),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) {
      return fail('auth_get_user', 'Sessão administrativa inválida ou expirada.', 401, {
        requestId,
        authError: authError?.message || null,
      })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (error) {
      return fail('request_json', 'Corpo da solicitação inválido.', 400, {
        requestId,
        cause: error instanceof Error ? error.message : String(error),
      })
    }

    const bookingId = String(body?.booking_id || '').trim()
    const status = String(body?.status || '').trim()
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled']

    log('payload_validated', { requestId, bookingId, status, userId: authData.user.id })

    if (!bookingId) return fail('validation_booking_id', 'Agendamento não informado.', 400, { requestId })
    if (!allowedStatuses.includes(status)) return fail('validation_status', 'Status inválido.', 400, { requestId, status })

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: current, error: currentError } = await admin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()

    if (currentError) {
      return fail('booking_lookup', 'Erro ao consultar o agendamento.', 400, {
        requestId,
        dbCode: currentError.code,
        dbMessage: currentError.message,
        dbDetails: currentError.details,
        dbHint: currentError.hint,
      })
    }

    if (!current) return fail('booking_not_found', 'Agendamento não encontrado.', 404, { requestId, bookingId })

    log('booking_loaded', { requestId, bookingId, currentStatus: current.status, customerEmail: Boolean(current.customer_email) })

    if (status === 'cancelled' && !['pending', 'confirmed'].includes(current.status)) {
      return fail('cancellation_state', 'Este agendamento não pode mais ser cancelado.', 400, {
        requestId,
        currentStatus: current.status,
      })
    }

    let rebookingToken = ''
    const updatePayload: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'cancelled') {
      rebookingToken = newToken()
      updatePayload.rebooking_token_hash = await hash(rebookingToken)
      updatePayload.rebooking_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { data: updated, error: updateError } = await admin
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('*')
      .maybeSingle()

    if (updateError) {
      return fail('booking_update', 'Erro ao atualizar o agendamento.', 400, {
        requestId,
        dbCode: updateError.code,
        dbMessage: updateError.message,
        dbDetails: updateError.details,
        dbHint: updateError.hint,
      })
    }

    if (!updated) {
      return fail('booking_update_empty', 'O agendamento não foi atualizado.', 409, { requestId, bookingId })
    }

    log('booking_updated', { requestId, bookingId, newStatus: updated.status })

    let email = { attempted: false, sent: false, skipped: false, error: '' }

    if (status === 'cancelled') {
      if (!current.customer_email) {
        email = { attempted: false, sent: false, skipped: true, error: '' }
        log('email_skipped_no_customer_email', { requestId, bookingId })
      } else if (!emailSecret) {
        email = { attempted: false, sent: false, skipped: false, error: 'EMAIL_WEBHOOK_SECRET não configurado.' }
        console.error('[admin-booking-status] email_secret_missing', JSON.stringify({ requestId, bookingId }))
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
              rebooking_token: rebookingToken,
            }),
          })

          const responseText = await response.text()
          let result: Record<string, unknown> = {}
          try { result = responseText ? JSON.parse(responseText) : {} } catch { result = { raw: responseText } }

          email.sent = response.ok && result?.ok !== false
          if (!email.sent) {
            email.error = String(result?.error || `Falha no envio (${response.status}).`)
            console.error('[admin-booking-status] booking_email_failed', JSON.stringify({
              requestId,
              bookingId,
              status: response.status,
              response: result,
            }))
          } else {
            log('booking_email_sent', { requestId, bookingId })
          }
        } catch (error) {
          email.error = error instanceof Error ? error.message : 'Falha ao chamar booking-email.'
          console.error('[admin-booking-status] booking_email_exception', JSON.stringify({ requestId, bookingId, error: email.error }))
        }
      }
    }

    return json({ ok: true, request_id: requestId, booking: updated, email })
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Falha ao atualizar o agendamento.', 500, {
      requestId,
      stack: error instanceof Error ? error.stack : null,
    })
  }
})
