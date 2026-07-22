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

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  return ''
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
    const to = normalizePhone(String(body?.to || ''))
    const text = String(body?.text || '').trim()

    if (!to) return json({ error: 'Destinatário inválido.' }, 400)
    if (!text || text.length > 300) return json({ error: 'Conteúdo inválido.' }, 400)

    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: queueRow, error: insertError } = await admin
      .from('sms_queue')
      .insert({
        booking_id: body?.booking_id || null,
        event_type: body?.event_type || 'test',
        recipient_type: body?.recipient_type || 'test',
        recipient_phone: to,
        recipient_name: body?.recipient_name || null,
        message_text: text,
        status: 'sending',
        attempts: 1,
      })
      .select('*')
      .single()

    if (insertError || !queueRow) {
      throw new Error(`Fila de SMS: ${insertError?.message || 'não foi possível registrar o envio.'}`)
    }

    queueId = queueRow.id

    const apiKey = requiredSecret('SMSDEV_API_KEY')
    const apiBase = Deno.env.get('SMSDEV_API_BASE_URL')?.trim() || 'https://api.smsdev.com.br'

    const sendResponse = await fetchWithTimeout(`${apiBase}/v1/send`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: apiKey,
        type: 9,
        number: to,
        msg: text,
      }),
    })

    const sendData = await sendResponse.json().catch(() => ({}))
    const situacao = String(sendData?.situacao || '').toUpperCase()

    if (!sendResponse.ok || situacao !== 'OK') {
      throw new Error(`SMSDev: ${JSON.stringify(sendData)}`)
    }

    const messageId = String(sendData?.id || '') || null

    await admin
      .from('sms_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        smsdev_message_id: messageId,
        last_error: null,
      })
      .eq('id', queueRow.id)

    return json({ ok: true, queue_id: queueRow.id, message_id: messageId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[send-sms]', message)

    if (queueId) {
      try {
        const admin = createClient(
          requiredSecret('SUPABASE_URL'),
          requiredSecret('SUPABASE_SERVICE_ROLE_KEY'),
          { auth: { persistSession: false, autoRefreshToken: false } },
        )

        await admin
          .from('sms_queue')
          .update({
            status: 'failed',
            last_error: message.slice(0, 4000),
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueId)
      } catch (updateError) {
        console.error('[send-sms] falha ao atualizar a fila', updateError)
      }
    }

    return json({ error: message, queue_id: queueId }, 500)
  }
})
