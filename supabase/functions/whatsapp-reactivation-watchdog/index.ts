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

const INACTIVITY_MINUTES = 2

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString()

  const { data: stale, error } = await admin
    .from('whatsapp_conversations')
    .select('phone')
    .eq('human_takeover', true)
    .lt('last_message_at', cutoff)

  if (error) {
    console.error('[whatsapp-reactivation-watchdog]', error)
    return json({ error: error.message }, 500)
  }

  const staleCandidates = (stale || []).map((row) => row.phone as string)
  if (!staleCandidates.length) return json({ ok: true, reactivated: 0 })

  // Reconfirma human_takeover=true e last_message_at < cutoff no próprio UPDATE
  // (não só no SELECT de cima), pra evitar reativar uma conversa que o cliente
  // acabou de mandar mensagem enquanto este watchdog rodava.
  const { data: updated, error: updateError } = await admin
    .from('whatsapp_conversations')
    .update({ human_takeover: false, updated_at: new Date().toISOString() })
    .in('phone', staleCandidates)
    .eq('human_takeover', true)
    .lt('last_message_at', cutoff)
    .select('phone')

  if (updateError) {
    console.error('[whatsapp-reactivation-watchdog] update', updateError)
    return json({ error: updateError.message }, 500)
  }

  const phones = (updated || []).map((row) => row.phone as string)
  if (!phones.length) return json({ ok: true, reactivated: 0 })

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const nudgeText = 'Oi! 😊 Ainda estou por aqui se precisar de algo — é só me chamar que te ajudo a ver horários ou agendar!'

  for (const phone of phones) {
    try {
      const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, text: nudgeText }),
      })
      const sendData = await sendResponse.json().catch(() => ({}))
      const sentMessageId = String(sendData?.key?.id || '') || null

      await admin.from('whatsapp_messages').insert({
        phone,
        direction: 'out',
        body: nudgeText,
        sent_by: 'bot',
        evolution_message_id: sentMessageId,
      })

      await admin
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('phone', phone)
    } catch (sendError) {
      console.error('[whatsapp-reactivation-watchdog] nudge falhou', phone, sendError)
    }
  }

  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (pushSecret) {
    await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({
        custom: {
          title: '🤖 JuIA reativada automaticamente',
          body: phones.length === 1
            ? `A conversa com ${phones[0]} ficou ${INACTIVITY_MINUTES} min sem atividade. A JuIA voltou a responder.`
            : `${phones.length} conversas ficaram ${INACTIVITY_MINUTES} min sem atividade. A JuIA voltou a responder.`,
          tag: 'whatsapp-auto-reactivate',
        },
      }),
    }).catch((error) => console.error('[whatsapp-reactivation-watchdog] push', error))
  }

  return json({ ok: true, reactivated: phones.length, phones })
})
