import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'

// v29.191.0 — Envio manual de WhatsApp pelo sistema (pedido do Juliano, 15/09/2026: "se não tiver
// um jeito de você enviar a mensagem pelo WhatsApp, crie"). Até aqui a única resposta humana saía
// do celular dele; o painel não tinha como mandar texto pra um cliente. Esta function manda UMA
// mensagem de texto pra UM telefone, em nome do Juliano (sent_by='human'), e liga o human_takeover
// da conversa — exatamente o que acontece quando ele responde do celular.
//
// Quem pode chamar (um dos dois):
//   - header x-webhook-secret = WHATSAPP_WEBHOOK_SECRET (crons, SQL via net.http_post, sessões de
//     manutenção com acesso ao vault);
//   - Authorization: Bearer <JWT do admin> (painel — futuro botão "responder" na tela Mensagens).
// Nunca a chave publicável sozinha. verify_jwt=false por causa do primeiro caminho; a checagem é aqui.
//
// Regras da casa aplicadas na saída: sem emoji (sem-emoji.ts), texto até 4000 caracteres, telefone
// canônico (55 + DDD + número). Grava em whatsapp_messages com o id da Evolution — é o que faz o
// webhook reconhecer o eco (fromMe) da própria mensagem e não duplicar.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })

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

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')

  // ---- autenticação: segredo do webhook OU sessão de admin ----
  let via = ''
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (expected && provided === expected) via = 'secret'
  if (!via) {
    const authorization = request.headers.get('Authorization') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() || ''
    if (authorization.startsWith('Bearer ') && anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authorization } },
      })
      const { data: authData, error: authError } = await authClient.auth.getUser()
      if (!authError && authData?.user) {
        const { data: isAdmin } = await authClient.rpc('is_admin')
        if (isAdmin === true) via = 'admin'
      }
    }
  }
  if (!via) return json({ error: 'Não autorizado.' }, 401)

  const body = await request.json().catch(() => ({}))
  const phone = canonicalPhone(String(body?.phone || ''))
  const text = String(body?.text || '').trim()
  const takeover = body?.takeover !== false
  if (!phone) return json({ error: 'Telefone inválido.' }, 400)
  if (!text) return json({ error: 'Texto vazio.' }, 400)
  if (text.length > 4000) return json({ error: 'Texto longo demais (máximo 4000 caracteres).' }, 400)

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const outgoing = semEmoji(text)
  const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
    body: JSON.stringify({ number: phone, text: outgoing }),
  })
  if (!sendResponse.ok) {
    const detail = await sendResponse.text().catch(() => '')
    console.error('[whatsapp-send] sendText falhou', phone, sendResponse.status, detail.slice(0, 300))
    return json({ error: `Evolution respondeu ${sendResponse.status}.` }, 502)
  }
  const sendData = await sendResponse.json().catch(() => ({}))
  const sentMessageId = String(sendData?.key?.id || '') || null

  const now = new Date().toISOString()
  await admin.from('whatsapp_messages').insert({ phone, direction: 'out', body: outgoing, sent_by: 'human', evolution_message_id: sentMessageId })
  const { data: convRow } = await admin.from('whatsapp_conversations').select('state').eq('phone', phone).maybeSingle()
  await admin.from('whatsapp_conversations').upsert({
    phone,
    state: convRow?.state || {},
    human_takeover: takeover,
    human_takeover_at: takeover ? now : null,
    last_message_at: now,
    updated_at: now,
  }, { onConflict: 'phone' })

  console.log('[whatsapp-send] enviado', phone, 'via', via, 'chars', outgoing.length)
  return json({ ok: true, phone, message_id: sentMessageId, via, takeover })
})
