import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

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

Deno.serve(async (request: Request) => {
  let queueId: string | null = null

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expectedWebhookSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim() || ''
  const providedWebhookSecret = request.headers.get('x-webhook-secret') || ''

  if (!expectedWebhookSecret || providedWebhookSecret !== expectedWebhookSecret) {
    return json({ error: 'Não autorizado.' }, 401)
  }

  try {
    const body = await request.json()
    const to = String(body?.to || '').trim().toLowerCase()
    const subject = String(body?.subject || '').trim()
    const html = String(body?.html || '').trim()

    if (!isEmail(to)) return json({ error: 'Destinatário inválido.' }, 400)
    if (!subject || subject.length > 250) return json({ error: 'Assunto inválido.' }, 400)
    if (!html || html.length > 500000) return json({ error: 'Conteúdo inválido.' }, 400)

    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: queueRow, error: insertError } = await admin
      .from('email_queue')
      .insert({
        booking_id: body?.booking_id || null,
        event_type: body?.event_type || 'test',
        recipient_type: body?.recipient_type || 'test',
        recipient_email: to,
        recipient_name: body?.recipient_name || null,
        subject,
        html_content: html,
        status: 'sending',
        attempts: 1,
      })
      .select('*')
      .single()

    if (insertError || !queueRow) {
      throw new Error(`Fila de e-mail: ${insertError?.message || 'não foi possível registrar o envio.'}`)
    }

    queueId = queueRow.id

    const clientId = requiredSecret('ZOHO_CLIENT_ID')
    const clientSecret = requiredSecret('ZOHO_CLIENT_SECRET')
    const refreshToken = requiredSecret('ZOHO_REFRESH_TOKEN')
    const accountId = requiredSecret('ZOHO_ACCOUNT_ID')
    const fromAddress = requiredSecret('ZOHO_FROM_ADDRESS')
    const accountsBase = Deno.env.get('ZOHO_ACCOUNTS_BASE_URL')?.trim() || 'https://accounts.zoho.com'
    const mailBase = Deno.env.get('ZOHO_MAIL_BASE_URL')?.trim() || 'https://mail.zoho.com'

    const tokenBody = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    })

    const tokenResponse = await fetchWithTimeout(`${accountsBase}/oauth/v2/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody,
    })

    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData?.access_token) {
      throw new Error(`Zoho OAuth: ${JSON.stringify(tokenData)}`)
    }

    const sendResponse = await fetchWithTimeout(
      `${mailBase}/api/accounts/${encodeURIComponent(accountId)}/messages`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
        },
        body: JSON.stringify({
          fromAddress,
          toAddress: to,
          subject,
          content: html,
          mailFormat: 'html',
          encoding: 'UTF-8',
          askReceipt: 'no',
        }),
      },
    )

    const sendData = await sendResponse.json().catch(() => ({}))
    const zohoCode = Number(sendData?.status?.code || sendResponse.status)

    if (!sendResponse.ok || zohoCode >= 400) {
      throw new Error(`Zoho Mail: ${JSON.stringify(sendData)}`)
    }

    const messageId = String(sendData?.data?.messageId || sendData?.data?.mailId || '') || null

    await admin
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        zoho_message_id: messageId,
        last_error: null,
      })
      .eq('id', queueRow.id)

    return json({ ok: true, queue_id: queueRow.id, message_id: messageId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[send-email]', message)

    if (queueId) {
      try {
        const admin = createClient(
          requiredSecret('SUPABASE_URL'),
          requiredSecret('SUPABASE_SERVICE_ROLE_KEY'),
          { auth: { persistSession: false, autoRefreshToken: false } },
        )

        await admin
          .from('email_queue')
          .update({
            status: 'failed',
            last_error: message.slice(0, 4000),
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueId)
      } catch (updateError) {
        console.error('[send-email] falha ao atualizar a fila', updateError)
      }
    }

    return json({ error: message, queue_id: queueId }, 500)
  }
})
