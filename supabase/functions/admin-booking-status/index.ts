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
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') || ''

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
    // status agora é opcional: a mesma function serve pra trocar status (fluxo original)
    // e/ou só atualizar os produtos vendidos de um agendamento já existente (site ou
    // balcão, em qualquer status) — pedido do Juliano pra registrar venda de produto
    // depois do fato, sem precisar que isso esteja amarrado a "concluir" o atendimento.
    const hasStatusChange = body?.status != null && String(body.status).trim() !== ''
    const status = hasStatusChange ? String(body.status).trim() : ''
    const paymentMethod = body?.payment_method != null ? String(body.payment_method).trim() : ''
    // Forma de pagamento dos PRODUTOS, separada da do serviço (ex.: corte no Pix, água
    // comprada depois no Débito). Opcional — quando ausente, o produto é considerado
    // pago na mesma forma do serviço (nenhum registro antigo precisa ser migrado).
    const productsPaymentMethod = body?.products_payment_method != null ? String(body.products_payment_method).trim() : ''
    // Controle manual (checkbox no "Concluir") de pedir avaliação no Google quando o
    // cliente responder satisfeito na pesquisa — o Juliano desmarca pra quem já sabe que
    // avaliou antes. Só um booleano puro, sem "trim" (não é string).
    const hasGoogleReviewChange = typeof body?.request_google_review === 'boolean'
    const requestGoogleReview = hasGoogleReviewChange ? Boolean(body.request_google_review) : true
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled']
    const allowedPaymentMethods = ['pix', 'debito', 'credito', 'dinheiro', 'fidelidade']

    // selected_products (opcional): array de {name, price} — mesmo formato já usado em
    // create_public_booking_v15/phone_update_booking_products. products_price é sempre
    // recalculado aqui a partir da lista, nunca aceito pronto do cliente.
    const rawProducts = Array.isArray(body?.selected_products) ? body.selected_products : null
    const selectedProducts = rawProducts
      ? rawProducts
          .map((p: any) => ({ name: String(p?.name || '').trim(), price: Number(p?.price || 0) }))
          .filter((p: { name: string; price: number }) => p.name && Number.isFinite(p.price) && p.price >= 0)
      : null

    // Forma de pagamento agora também pode ser corrigida sozinha (sem trocar status) —
    // caso real: atendimento concluído às pressas sem escolher pagamento certo, ou um
    // atendimento que na hora não tinha forma de pagamento definida ainda.
    const hasPaymentMethodChange = body?.payment_method != null && String(body.payment_method).trim() !== ''
    const hasProductsPaymentMethodChange = body?.products_payment_method != null && String(body.products_payment_method).trim() !== ''

    // Serviço realmente executado pode diferir do que foi agendado (ex.: cliente pediu
    // outro serviço na hora) — permite corrigir service_name/service_price/duration_minutes
    // do registro, tanto antes quanto depois de concluído. Vem como objeto {name,price,
    // duration_minutes} pra deixar explícito que os 3 andam juntos (não dá pra só mudar
    // o nome sem o preço/duração corretos).
    const rawService = body?.service && typeof body.service === 'object' ? body.service : null
    const serviceUpdate = rawService && String(rawService.name || '').trim()
      ? {
          name: String(rawService.name).trim(),
          price: Number(rawService.price || 0),
          duration_minutes: Number(rawService.duration_minutes || 0),
        }
      : null
    if (rawService && !serviceUpdate) return fail('validation_service', 'Serviço informado é inválido.', 400, { requestId })

    log('payload_validated', { requestId, bookingId, status, hasProducts: Boolean(selectedProducts), hasServiceUpdate: Boolean(serviceUpdate), userId: authData.user.id })

    if (!bookingId) return fail('validation_booking_id', 'Agendamento não informado.', 400, { requestId })
    if (!hasStatusChange && !selectedProducts && !hasPaymentMethodChange && !hasProductsPaymentMethodChange && !hasGoogleReviewChange && !serviceUpdate) {
      return fail('validation_nothing_to_update', 'Informe um status, o serviço, os produtos ou a forma de pagamento a atualizar.', 400, { requestId })
    }
    if (hasStatusChange && !allowedStatuses.includes(status)) return fail('validation_status', 'Status inválido.', 400, { requestId, status })
    if (hasPaymentMethodChange && !allowedPaymentMethods.includes(paymentMethod)) {
      return fail('validation_payment_method', 'Forma de pagamento inválida.', 400, { requestId, paymentMethod })
    }
    if (hasProductsPaymentMethodChange && !allowedPaymentMethods.includes(productsPaymentMethod)) {
      return fail('validation_products_payment_method', 'Forma de pagamento dos produtos inválida.', 400, { requestId, productsPaymentMethod })
    }
    // Concluir um atendimento sempre exige a forma de pagamento — é o que alimenta o
    // relatório financeiro. Validado aqui também (não só na tela) porque o admin-booking-status
    // é chamado com a sessão do dono, mas nada impede outra chamada direta à function.
    if (hasStatusChange && status === 'completed' && !hasPaymentMethodChange) {
      return fail('validation_payment_method', 'Informe a forma de pagamento para concluir o atendimento.', 400, { requestId, paymentMethod })
    }

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

    if (hasStatusChange && status === 'cancelled' && !['pending', 'confirmed'].includes(current.status)) {
      return fail('cancellation_state', 'Este agendamento não pode mais ser cancelado.', 400, {
        requestId,
        currentStatus: current.status,
      })
    }

    let rebookingToken = ''
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (hasStatusChange) updatePayload.status = status
    if (hasPaymentMethodChange) updatePayload.payment_method = paymentMethod
    if (hasProductsPaymentMethodChange) updatePayload.products_payment_method = productsPaymentMethod
    if (hasGoogleReviewChange) updatePayload.request_google_review = requestGoogleReview
    if (hasStatusChange && status === 'cancelled') {
      rebookingToken = newToken()
      updatePayload.rebooking_token_hash = await hash(rebookingToken)
      updatePayload.rebooking_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (selectedProducts) {
      updatePayload.selected_products = selectedProducts
      updatePayload.products_price = selectedProducts.reduce((a, p) => a + p.price, 0)
    }
    if (serviceUpdate) {
      updatePayload.service_name = serviceUpdate.name
      updatePayload.service_price = serviceUpdate.price
      updatePayload.duration_minutes = serviceUpdate.duration_minutes
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

    // Trilha de auditoria: registra a mudança de status, serviço, produtos e/ou forma de
    // pagamento no histórico do cliente, para o dono ter rastreabilidade de quem/quando
    // alterou o agendamento. Não bloqueia a resposta se falhar.
    const isStatusChange = hasStatusChange && current.status !== status
    if (isStatusChange || selectedProducts || serviceUpdate || hasPaymentMethodChange || hasProductsPaymentMethodChange || hasGoogleReviewChange) {
      try {
        const statusLabels: Record<string, string> = {
          pending: 'aguardando confirmação',
          confirmed: 'confirmado',
          completed: 'concluído',
          no_show: 'não compareceu',
          cancelled: 'cancelado',
        }
        const { data: customer } = await admin
          .from('customer_profiles')
          .select('id')
          .eq('phone', String(current.customer_phone || '').replace(/\D/g, ''))
          .maybeSingle()
        const title = isStatusChange
          ? `Agendamento marcado como ${statusLabels[status] || status}`
          : serviceUpdate
            ? `Serviço do atendimento corrigido para ${serviceUpdate.name}`
            : selectedProducts
              ? 'Produtos do atendimento atualizados'
              : 'Forma de pagamento do atendimento atualizada'
        await admin.from('customer_timeline').insert({
          customer_id: customer?.id ?? null,
          booking_id: bookingId,
          event_type: isStatusChange ? 'booking_status_changed' : 'booking_details_updated',
          title,
          details: {
            from: current.status,
            to: hasStatusChange ? status : current.status,
            service: serviceUpdate ?? undefined,
            products: selectedProducts ?? undefined,
            payment_method: hasPaymentMethodChange ? paymentMethod : undefined,
            products_payment_method: hasProductsPaymentMethodChange ? productsPaymentMethod : undefined,
            changed_by: authData.user.id,
            booking_date: current.booking_date,
            start_time: current.start_time,
          },
        })
      } catch (timelineError) {
        console.error('[admin-booking-status] timeline_log_failed', JSON.stringify({ requestId, bookingId, error: timelineError instanceof Error ? timelineError.message : String(timelineError) }))
      }
    }

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

    // Aviso de vaga aberta: se alguém está na lista de espera esperando exatamente
    // este dia/turno, avisa o dono para poder oferecer o encaixe. Não bloqueia a resposta.
    if (status === 'cancelled' && pushSecret) {
      try {
        const { data: waiting } = await admin.rpc('waitlist_matches_for_slot', {
          p_date: current.booking_date,
          p_start_time: current.start_time,
        })
        if (Array.isArray(waiting) && waiting.length) {
          const names = waiting.slice(0, 3).map((w: any) => w.customer_name).join(', ')
          const extra = waiting.length > 3 ? ` +${waiting.length - 3}` : ''
          const dateLabel = String(current.booking_date).split('-').reverse().join('/')
          const timeLabel = String(current.start_time).slice(0, 5)
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
            body: JSON.stringify({
              custom: {
                title: '🎉 Vaga aberta — tem gente esperando!',
                body: `${dateLabel} às ${timeLabel} abriu. ${names}${extra} está(ão) na lista de espera para esse dia.`,
                url: '/admin-espera.html?app=1',
                tag: `waitlist-slot-${bookingId}`,
              },
            }),
          }).catch((pushError) => console.error('[admin-booking-status] waitlist_push', pushError))
        }
      } catch (waitlistError) {
        console.error('[admin-booking-status] waitlist_check', waitlistError)
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
