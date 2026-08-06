import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 20000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const GRAPH_VERSION = 'v23.0'

// JuIA Social — Fase 1 (v28.50.0): único ponto do sistema que de fato publica resposta
// de comentário ou envia DM no Facebook/Instagram. Sempre disparado por um clique
// explícito do Juliano no admin (verify_jwt=true, só admin autenticado).
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const anonKey = requiredSecret('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
    const pageToken = requiredSecret('META_PAGE_ACCESS_TOKEN')
    const pageId = requiredSecret('META_PAGE_ID')
    const igId = requiredSecret('META_IG_USER_ID')

    const authHeader = request.headers.get('Authorization') || ''
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user) return json({ error: 'Não autenticado.' }, 401)
    const { data: isAdminResult } = await userClient.rpc('is_admin')
    if (!isAdminResult) return json({ error: 'Acesso restrito ao administrador.' }, 403)

    const body = await request.json().catch(() => ({}))
    const id = String(body?.id || '')
    const editedText = typeof body?.reply_text === 'string' ? body.reply_text.trim() : ''
    if (!id) return json({ error: 'id é obrigatório.' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: item, error: fetchError } = await admin.from('social_inbox').select('*').eq('id', id).maybeSingle()
    if (fetchError || !item) return json({ error: 'Item não encontrado.' }, 404)
    if (item.status === 'enviado') return json({ error: 'Essa resposta já foi enviada.' }, 409)

    const finalText = editedText || item.reply_text || item.ai_draft || ''
    if (!finalText) return json({ error: 'Texto de resposta vazio.' }, 400)

    let sendResult: { ok: boolean; status: number; data: any }
    if (item.kind === 'comment') {
      const endpoint = item.platform === 'facebook' ? 'comments' : 'replies'
      const params = new URLSearchParams({ message: finalText, access_token: pageToken })
      const r = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${item.external_id}/${endpoint}`, { method: 'POST', body: params }, 20000)
      sendResult = { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }
    } else {
      if (!item.sender_psid) return json({ error: 'Sem PSID do destinatário — não é possível enviar DM.' }, 400)
      const targetId = item.platform === 'facebook' ? pageId : igId
      const r = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${targetId}/messages?access_token=${pageToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          item.platform === 'facebook'
            ? { recipient: { id: item.sender_psid }, messaging_type: 'RESPONSE', message: { text: finalText } }
            : { recipient: { id: item.sender_psid }, message: { text: finalText } },
        ),
      }, 20000)
      sendResult = { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }
    }

    if (!sendResult.ok) {
      console.error('[meta-social-reply] falha', item.id, sendResult.status, sendResult.data)
      // A Meta responde erro técnico em inglês ("(#3) Application does not have the
      // capability to make this API call"), que não diz nada pra quem está no painel. Os
      // códigos 3/10/200 em envio de DM significam sempre a mesma coisa aqui: o app não tem
      // a permissão de mensagens (pages_messaging / acesso ao Direct), pendência conhecida
      // desde o diagnóstico de 03/08/2026. Responder COMENTÁRIO funciona normalmente.
      const code = Number(sendResult.data?.error?.code || 0)
      const isPermission = item.kind !== 'comment' && [3, 10, 200, 230].includes(code)
      const friendly = isPermission
        ? 'Ainda não dá para responder mensagens diretas por aqui: o app da Meta não tem a permissão de mensagens (pages_messaging) habilitada. Responder comentários funciona normalmente. Por enquanto, responda esta pessoa pelo app do Instagram/Messenger — e, quando quiser destravar, é preciso adicionar o caso de uso de Mensagens no app da Meta e gerar um token novo.'
        : (sendResult.data?.error?.message || 'Falha ao enviar a resposta.')
      return json({ error: friendly, meta_code: code || null, permission_missing: isPermission }, 502)
    }

    const { error: updateError } = await admin.from('social_inbox')
      .update({ status: 'enviado', reply_text: finalText, replied_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'rascunho')
    if (updateError) console.error('[meta-social-reply] update', updateError)

    return json({ ok: true })
  } catch (error) {
    console.error('[meta-social-reply]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
