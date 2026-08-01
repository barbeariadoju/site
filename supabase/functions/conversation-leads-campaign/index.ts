import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v28.34.0 — item 0(c) do funil de reativação avançado: disparo MANUAL (sob demanda,
// nunca automático) de uma mensagem de reengajamento pra leads antigos de
// conversation_leads, opcionalmente filtrados por serviço. Só o admin autenticado pode
// chamar. Nunca inventa promoção/desconto — o Juliano não configurou nenhuma, então a
// mensagem só reforça interesse genuíno, sem prometer nada que não existe.
const ALLOWED_ORIGINS = new Set(['https://www.barbeariadoju.com.br', 'https://barbeariadoju.com.br'])
let requestOrigin: string | null = null
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders() })

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

const firstName = (value: any) => String(value || '').trim().split(/\s+/)[0] || ''

const MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000 // "interesse antigo": pelo menos 2 dias de silêncio
const RESEND_GUARD_MS = 24 * 60 * 60 * 1000 // não repete campanha no mesmo lead em menos de 24h

Deno.serve(async (request: Request) => {
  requestOrigin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const anonKey = requiredSecret('SUPABASE_ANON_KEY')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')

  const authorization = request.headers.get('Authorization') || ''
  const authedClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await authedClient.auth.getUser()
  if (!user) return json({ error: 'Não autorizado.' }, 401)
  const { data: isAdminRow } = await authedClient.rpc('is_admin')
  if (!isAdminRow) return json({ error: 'Não autorizado.' }, 401)

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const sendWhatsapp = async (to: string, textBody: string) => {
    const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number: to, text: textBody }),
    })
    const sendData = await sendResponse.json().catch(() => ({}))
    const sentMessageId = String(sendData?.key?.id || '') || null
    await admin.from('whatsapp_messages').insert({ phone: to, direction: 'out', body: textBody, sent_by: 'bot', evolution_message_id: sentMessageId })
  }

  const isResolved = async (phone: string, lastMessageAt: string): Promise<boolean> => {
    const { data: booking } = await admin
      .from('bookings')
      .select('id')
      .eq('customer_phone', phone)
      .in('status', ['pending', 'confirmed', 'completed'])
      .gte('created_at', lastMessageAt)
      .limit(1)
      .maybeSingle()
    if (booking) return true
    const { data: conv } = await admin
      .from('whatsapp_conversations')
      .select('human_takeover')
      .eq('phone', phone)
      .maybeSingle()
    return Boolean(conv?.human_takeover)
  }

  const body = await request.json().catch(() => ({}))
  const serviceFilter = String(body?.service_filter || '').trim()

  const now = Date.now()
  let query = admin
    .from('conversation_leads')
    .select('phone, customer_name, service_interest, last_message_at')
    .is('resolved_at', null)
    .lt('last_message_at', new Date(now - MIN_AGE_MS).toISOString())
    .or(`campaign_sent_at.is.null,campaign_sent_at.lt.${new Date(now - RESEND_GUARD_MS).toISOString()}`)
  if (serviceFilter) query = query.ilike('service_interest', `%${serviceFilter}%`)

  const { data: leads, error: leadsError } = await query
  if (leadsError) return json({ error: leadsError.message }, 500)

  let sent = 0, skipped = 0
  for (const lead of leads || []) {
    try {
      if (await isResolved(lead.phone, lead.last_message_at)) {
        await admin.from('conversation_leads').delete().eq('phone', lead.phone)
        continue
      }
      const name = firstName(lead.customer_name)
      const service = String(lead.service_interest || '').trim()
      const text = service
        ? `Oi${name ? `, ${name}` : ''}! 😊 Faz um tempo que você perguntou sobre ${service} aqui na Barbearia do Ju. Ainda tem interesse? Se quiser, posso já ver um horário disponível pra você.`
        : `Oi${name ? `, ${name}` : ''}! 😊 Faz um tempo que a gente conversou por aqui. Ainda tem interesse em marcar um horário na Barbearia do Ju? Posso te ajudar a ver a disponibilidade.`
      await sendWhatsapp(lead.phone, text)
      await admin.from('conversation_leads').update({ campaign_sent_at: new Date().toISOString() }).eq('phone', lead.phone)
      sent++
    } catch (error) {
      console.error('[conversation-leads-campaign] falhou', lead.phone, error)
      skipped++
    }
  }

  return json({ ok: true, matched: (leads || []).length, sent, skipped })
})
