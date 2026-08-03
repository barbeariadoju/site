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

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

// Central de Conteúdo (v28.44.0): único ponto do sistema que de fato publica um Status
// no WhatsApp da barbearia — sempre chamado por um clique explícito do Juliano no admin
// (verify_jwt=true, só admin autenticado). Nunca disparado por cron ou automaticamente.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const anonKey = requiredSecret('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')

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
    const editedCaption = typeof body?.caption === 'string' ? body.caption.trim() : ''
    if (!id) return json({ error: 'id é obrigatório.' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: post, error: fetchError } = await admin.from('content_posts').select('*').eq('id', id).maybeSingle()
    if (fetchError || !post) return json({ error: 'Rascunho não encontrado.' }, 404)
    if (post.status === 'publicado') return json({ error: 'Esse rascunho já foi publicado.' }, 409)

    const finalCaption = editedCaption || post.caption

    const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
    const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
    const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')

    // Se o rascunho tem uma imagem (context.image_url), publica como Status de IMAGEM
    // com a legenda — visual muito melhor que o Status de texto puro (que renderiza o
    // link como um preview minúsculo e feio, visto no primeiro teste real). Sem imagem,
    // cai no Status de texto de antes.
    const imageUrl = typeof post.context?.image_url === 'string' ? post.context.image_url : ''
    // font: 4 = Bebas Neue (mesma fonte de display do site) — a fonte 1 (serifada, com
    // números oldstyle "caídos") saiu feia no primeiro Status real e o Juliano reclamou.
    const statusPayload = imageUrl
      ? { type: 'image', content: imageUrl, caption: finalCaption, allContacts: true }
      : { type: 'text', content: finalCaption, backgroundColor: '#0b0b0b', font: 4, allContacts: true }

    // Timeout de 90s: publicar Status com allContacts é lento na Evolution (ela enumera
    // todos os contatos pra distribuir) — 20s estourava na prática (visto nos logs:
    // 20.2s e abort). O navegador do admin espera sem problema; o botão mostra
    // "Publicando..." enquanto isso.
    const statusResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendStatus/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify(statusPayload),
    }, 90000)

    if (!statusResponse.ok) {
      const errBody = await statusResponse.text().catch(() => '')
      console.error('[content-publish-whatsapp] evolution error', statusResponse.status, errBody)
      await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
      return json({ error: 'Falha ao publicar no WhatsApp. Tente novamente.' }, 502)
    }

    const statusData = await statusResponse.json().catch(() => ({}))
    const evolutionMessageId = String(statusData?.key?.id || '') || null

    const nowIso = new Date().toISOString()
    await admin.from('content_posts').update({
      caption: finalCaption,
      status: 'publicado',
      approved_at: post.approved_at || nowIso,
      published_at: nowIso,
      evolution_message_id: evolutionMessageId,
    }).eq('id', id)

    return json({ ok: true, id, published_at: nowIso })
  } catch (error) {
    console.error('[content-publish-whatsapp]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
