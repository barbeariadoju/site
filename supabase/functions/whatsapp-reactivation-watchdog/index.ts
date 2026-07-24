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

// Evita mandar o "cochicho" de reativação quando a conversa já terminou naturalmente
// (o cliente só reagiu com figurinha/emoji, ou mandou um agradecimento/despedida).
// Sem isso, um cliente que já foi atendido recebia um "vim te lembrar de agendar"
// logo depois de ter respondido com uma figurinha de "toca aqui" — soa robótico e
// fora de contexto, especialmente se o atendimento já foi concluído no mesmo dia.
const CLOSING_TEXT = /^(obrigad[oa]s?|valeu|vlw|blz|beleza|ok(ay)?|tranquilo|falou|ate (mais|logo|breve)|tchau|flw|show|top|jo[ií]a|de nada|por nada|combinado|fechado)[\s!.,]*$/
function looksLikeClosingOrReaction(rawBody: string): boolean {
  const body = String(rawBody || '').trim()
  if (!body || body === '[mídia ou mensagem sem texto]') return true
  if (!/[a-zA-ZÀ-ÿ]/.test(body)) return true // só emoji/figurinha/pontuação, sem nenhuma letra
  const normalized = body.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return CLOSING_TEXT.test(normalized)
}
async function shouldSkipNudge(admin: any, phone: string): Promise<boolean> {
  const { data: last } = await admin
    .from('whatsapp_messages')
    .select('direction, body')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!last || last.direction !== 'in') return false
  return looksLikeClosingOrReaction(last.body)
}

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
  const nudgeText = 'Oi! 😊 Ainda estou por aqui se precisar de algo.'
  let skippedCount = 0

  for (const phone of phones) {
    try {
      if (await shouldSkipNudge(admin, phone)) {
        skippedCount++
        continue
      }
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

  return json({ ok: true, reactivated: phones.length, nudged: phones.length - skippedCount, skipped_nudge: skippedCount, phones })
})
