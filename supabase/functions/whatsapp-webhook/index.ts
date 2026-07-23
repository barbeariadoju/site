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

const HISTORY_LIMIT = 10

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const url = new URL(request.url)
  const provided = request.headers.get('x-webhook-secret') || url.searchParams.get('token') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const payload = await request.json().catch(() => ({}))
    if (payload?.event !== 'messages.upsert') return json({ ok: true, skipped: 'event' })

    const data = payload?.data || {}
    const remoteJid = String(data?.key?.remoteJid || '')
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.startsWith('status@')) {
      return json({ ok: true, skipped: 'not_direct_chat' })
    }

    const phone = remoteJid.split('@')[0].replace(/\D/g, '')
    if (phone.length < 10) return json({ ok: true, skipped: 'invalid_phone' })

    const fromMe = data?.key?.fromMe === true
    const messageId = String(data?.key?.id || '')
    const text = String(data?.message?.conversation || data?.message?.extendedTextMessage?.text || '').trim()

    const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
    const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
    const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')

    if (fromMe) {
      if (messageId) {
        const { data: ownMessage } = await admin
          .from('whatsapp_messages')
          .select('id')
          .eq('phone', phone)
          .eq('direction', 'out')
          .eq('evolution_message_id', messageId)
          .maybeSingle()
        if (ownMessage) return json({ ok: true, skipped: 'own_echo' })
      }

      await admin.from('whatsapp_conversations').upsert({
        phone,
        human_takeover: true,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' })

      await admin.from('whatsapp_messages').insert({
        phone,
        direction: 'out',
        body: text || '[mensagem sem texto]',
        sent_by: 'human',
        evolution_message_id: messageId || null,
      })

      return json({ ok: true, human_takeover: true })
    }

    if (!text) {
      await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: '[mídia ou mensagem sem texto]' })
      return json({ ok: true, skipped: 'no_text' })
    }

    await admin.from('whatsapp_messages').insert({ phone, direction: 'in', body: text })

    const { data: conversation } = await admin
      .from('whatsapp_conversations')
      .select('state, human_takeover')
      .eq('phone', phone)
      .maybeSingle()

    await admin.from('whatsapp_conversations').upsert({
      phone,
      state: conversation?.state || {},
      human_takeover: conversation?.human_takeover || false,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })

    if (conversation?.human_takeover) return json({ ok: true, skipped: 'human_takeover' })

    const { data: recentMessages } = await admin
      .from('whatsapp_messages')
      .select('direction, body, created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)

    const history = (recentMessages || [])
      .reverse()
      .slice(0, -1)
      .map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.body }))

    const aiResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/ju-ia-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        state: conversation?.state || {},
        session_id: `whatsapp:${phone}`,
        history,
      }),
    })

    const ai = await aiResponse.json().catch(() => ({}))
    if (!aiResponse.ok || !ai?.reply) {
      console.error('[whatsapp-webhook] ju-ia-site falhou', aiResponse.status, ai)
      return json({ ok: false, error: 'Falha ao consultar a JuIA.' }, 502)
    }

    const reply = String(ai.reply)
    const handoff = Boolean(ai.handoff)

    const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number: phone, text: reply }),
    })
    const sendData = await sendResponse.json().catch(() => ({}))
    const sentMessageId = String(sendData?.key?.id || '') || null

    await admin.from('whatsapp_messages').insert({
      phone,
      direction: 'out',
      body: reply,
      sent_by: 'bot',
      evolution_message_id: sentMessageId,
    })

    await admin.from('whatsapp_conversations').update({
      state: ai.state || conversation?.state || {},
      human_takeover: handoff,
      updated_at: new Date().toISOString(),
    }).eq('phone', phone)

    if (handoff) {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
      if (pushSecret) {
        await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({
            custom: {
              title: '💬 WhatsApp precisa de você',
              body: `A JuIA não conseguiu resolver com ${phone}. Continue a conversa pelo WhatsApp.`,
              url: 'https://wa.me/' + phone,
              tag: `whatsapp-handoff-${phone}`,
            },
          }),
        }).catch((error) => console.error('[whatsapp-webhook] push handoff', error))
      }
    }

    return json({ ok: true, sent: sendResponse.ok, handoff })
  } catch (error) {
    console.error('[whatsapp-webhook]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
