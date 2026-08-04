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

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 20000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const GRAPH_VERSION = 'v23.0'

// Central de Conteúdo (v28.45.0): único ponto do sistema que de fato publica no
// Facebook e no Instagram via Meta Graph API. Mesmo princípio do
// content-publish-whatsapp: sempre chamado por um clique explícito do Juliano no
// admin (verify_jwt=true, só admin autenticado). Nunca disparado por cron.
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
    if (post.platform !== 'facebook' && post.platform !== 'instagram') {
      return json({ error: 'Essa função só publica no Facebook ou Instagram.' }, 400)
    }

    const finalCaption = editedCaption || post.caption
    const imageUrl = typeof post.context?.image_url === 'string' ? post.context.image_url : ''
    // Defesa em profundidade: o formulário do admin já bloqueia link relativo, mas um
    // rascunho pode ter sido criado direto por SQL/API sem passar por ali. A Meta busca a
    // imagem pelos próprios servidores dela — um link relativo falharia lá com um erro
    // genérico e confuso; melhor barrar aqui com uma mensagem clara.
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return json({ error: 'O link da imagem precisa ser completo (começando com https://) — um caminho relativo não funciona pra Meta buscar a imagem.' }, 400)
    }

    const pageToken = requiredSecret('META_PAGE_ACCESS_TOKEN')
    const pageId = requiredSecret('META_PAGE_ID')
    const igUserId = requiredSecret('META_IG_USER_ID')

    // Trava atômica contra clique duplo/aba dupla (v28.46.1): só quem conseguir mudar
    // rascunho→aprovado publica — uma segunda chamada simultânea não acha mais o status
    // 'rascunho' e recebe 409 em vez de publicar de novo. Já aconteceu na prática com o
    // Status do WhatsApp (2 cliques em erro de timeout = 2 publicações reais). Em caso
    // de falha da Meta mais abaixo, o status volta pra 'rascunho' e libera nova tentativa.
    // 'aprovado' funciona como lease de 3 minutos (approved_at = início da tentativa):
    // se a function morrer no meio sem reverter, uma nova tentativa depois do prazo
    // consegue "roubar" a lease em vez do rascunho ficar preso pra sempre.
    const { data: claimed } = await admin
      .from('content_posts')
      .update({ status: 'aprovado', approved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'rascunho')
      .select('id')
    if (!claimed?.length) {
      const leaseCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString()
      const { data: reclaimed } = await admin
        .from('content_posts')
        .update({ approved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'aprovado')
        .lt('approved_at', leaseCutoff)
        .select('id')
      if (!reclaimed?.length) return json({ error: 'Esse rascunho já está sendo publicado (ou acabou de ser). Atualize a página pra conferir.' }, 409)
    }

    let metaPostId: string | null = null

    if (post.platform === 'facebook') {
      // Com imagem: publica como foto (a legenda vira o texto do post). Sem imagem:
      // publica como post de texto puro no feed.
      const endpoint = imageUrl ? `${pageId}/photos` : `${pageId}/feed`
      const params = new URLSearchParams({ access_token: pageToken })
      if (imageUrl) { params.set('url', imageUrl); params.set('caption', finalCaption) }
      else { params.set('message', finalCaption) }

      const fbResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`, {
        method: 'POST',
        body: params,
      }, 20000)
      const fbData = await fbResponse.json().catch(() => ({}))
      if (!fbResponse.ok) {
        console.error('[content-publish-meta] facebook error', fbResponse.status, fbData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: fbData?.error?.message || 'Falha ao publicar no Facebook.' }, 502)
      }
      metaPostId = String(fbData?.post_id || fbData?.id || '') || null
    } else {
      // Instagram exige imagem — não existe post de texto puro por lá.
      if (!imageUrl) {
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: 'Post do Instagram precisa de uma imagem (context.image_url).' }, 400)
      }

      const createParams = new URLSearchParams({ access_token: pageToken, image_url: imageUrl, caption: finalCaption })
      const createResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, {
        method: 'POST',
        body: createParams,
      }, 20000)
      const createData = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok || !createData?.id) {
        console.error('[content-publish-meta] instagram create container error', createResponse.status, createData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: createData?.error?.message || 'Falha ao preparar a publicação no Instagram.' }, 502)
      }
      const creationId = String(createData.id)

      // O container pode levar alguns segundos pra processar a imagem antes de poder
      // ser publicado. 10 tentativas de 2.5s (~25s de espera total) — folga maior que o
      // "poucas tentativas" original, pra não falhar à toa numa imagem um pouco maior ou
      // numa resposta mais lenta da Meta; a function ainda fica bem dentro do limite de
      // execução do Supabase Edge Functions.
      let ready = false
      for (let attempt = 0; attempt < 10; attempt++) {
        const statusResponse = await fetchWithTimeout(
          `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code&access_token=${pageToken}`,
          { method: 'GET' },
          10000,
        )
        const statusData = await statusResponse.json().catch(() => ({}))
        if (statusData?.status_code === 'FINISHED') { ready = true; break }
        if (statusData?.status_code === 'ERROR') break
        await new Promise((resolve) => setTimeout(resolve, 2500))
      }
      if (!ready) {
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: 'A imagem não terminou de processar a tempo. Tente publicar de novo em instantes.' }, 502)
      }

      const publishParams = new URLSearchParams({ access_token: pageToken, creation_id: creationId })
      const publishResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
        method: 'POST',
        body: publishParams,
      }, 20000)
      const publishData = await publishResponse.json().catch(() => ({}))
      if (!publishResponse.ok || !publishData?.id) {
        console.error('[content-publish-meta] instagram publish error', publishResponse.status, publishData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: publishData?.error?.message || 'Falha ao publicar no Instagram.' }, 502)
      }
      metaPostId = String(publishData.id)
    }

    const nowIso = new Date().toISOString()
    await admin.from('content_posts').update({
      caption: finalCaption,
      status: 'publicado',
      published_at: nowIso,
      meta_post_id: metaPostId,
    }).eq('id', id)

    return json({ ok: true, id, published_at: nowIso, meta_post_id: metaPostId })
  } catch (error) {
    console.error('[content-publish-meta]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
