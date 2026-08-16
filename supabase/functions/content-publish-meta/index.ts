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

// v29.31.8 — marcação das contas pessoais NA FOTO, e não só na legenda (pedido do Juliano,
// 16/08/2026). A diferença é prática: a menção na legenda notifica, mas a marcação na foto é
// a que coloca o post na aba "Marcados" dos perfis dele e da Nicole e a que dá o caminho
// curto pro repost no story. Como o painel publica pela Graph API, dá pra fazer sozinho.
// Só vale em FOTO de feed: story não tem esse campo e Reels usa outro formato — mexer neles
// só criaria chance de erro em publicação que hoje funciona.
// x/y são obrigatórios e ficam entre 0 e 1; ambos vão na metade de baixo da imagem, longe do
// canto inferior direito onde a marca é aplicada. A posição não aparece na foto — só define
// onde o toque revela o nome.
const CONTAS_MARCADAS = [
  { username: 'julianoblpadilha', x: 0.3, y: 0.72 },
  { username: 'nicolefpadilha', x: 0.62, y: 0.72 },
]
const USER_TAGS = JSON.stringify(CONTAS_MARCADAS)

// Publica um container de mídia do Instagram (feed ou story) e espera processar antes de
// devolver o creation_id pronto pra publicar. Usado tanto por 'instagram' quanto por
// 'instagram_story' — a única diferença entre os dois é o media_type enviado na criação.
async function createAndWaitInstagramContainer(igUserId: string, pageToken: string, params: URLSearchParams, isVideo = false): Promise<{ creationId: string } | { error: string }> {
  const createResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, {
    method: 'POST',
    body: params,
  }, 35000)
  const createData = await createResponse.json().catch(() => ({}))
  if (!createResponse.ok || !createData?.id) {
    console.error('[content-publish-meta] instagram create container error', createResponse.status, createData)
    return { error: createData?.error?.message || 'Falha ao preparar a publicação no Instagram.' }
  }
  const creationId = String(createData.id)

  // O container pode levar alguns segundos pra processar a mídia antes de poder ser
  // publicado. Imagem: 10 tentativas de 2.5s (~25s). VÍDEO/Reel precisa de muito mais —
  // a Meta transcodifica o arquivo inteiro antes de liberar (v28.57.0: 40 tentativas de
  // 3s ≈ 2min). Publicar antes de FINISHED devolve erro genérico e confuso da Meta.
  const maxAttempts = isVideo ? 40 : 10
  const waitMs = isVideo ? 3000 : 2500
  let ready = false
  let lastError = ''
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusResponse = await fetchWithTimeout(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code,status&access_token=${pageToken}`,
      { method: 'GET' },
      10000,
    )
    const statusData = await statusResponse.json().catch(() => ({}))
    if (statusData?.status_code === 'FINISHED') { ready = true; break }
    if (statusData?.status_code === 'ERROR') {
      // `status` traz o motivo real da recusa (formato, duração, proporção) — sem isso o
      // Juliano só via "não terminou de processar" e não sabia o que corrigir no vídeo.
      lastError = String(statusData?.status || '')
      break
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  if (!ready) {
    if (lastError) return { error: `A Meta recusou a mídia: ${lastError}` }
    return { error: isVideo
      ? 'O vídeo não terminou de processar a tempo (a Meta pode levar alguns minutos em vídeo maior). Espere um pouco e tente publicar de novo.'
      : 'A imagem não terminou de processar a tempo. Tente publicar de novo em instantes.' }
  }
  return { creationId }
}

// Central de Conteúdo (v28.45.0, Stories em v28.47.0): único ponto do sistema que de fato
// publica no Facebook e no Instagram via Meta Graph API — feed e Story dos dois. Mesmo
// princípio do content-publish-whatsapp: sempre chamado por um clique explícito do
// Juliano no admin (verify_jwt=true, só admin autenticado). Nunca disparado por cron.
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
    const validPlatforms = ['facebook', 'instagram', 'facebook_story', 'instagram_story']
    if (!validPlatforms.includes(post.platform)) {
      return json({ error: 'Essa função só publica no Facebook, Instagram ou nos Stories dos dois.' }, 400)
    }

    const finalCaption = editedCaption || post.caption
    const imageUrl = typeof post.context?.image_url === 'string' ? post.context.image_url : ''
    // v28.57.0 — suporte a vídeo. `context.video_url` espelha `image_url`: quando existe,
    // o post vira Reel (feed do Instagram), Story de vídeo ou vídeo de Página no Facebook.
    // Vídeo tem prioridade sobre imagem quando os dois estão presentes (a imagem passa a
    // valer só como capa/thumbnail de referência no admin).
    const videoUrl = typeof post.context?.video_url === 'string' ? post.context.video_url : ''
    const mediaUrl = videoUrl || imageUrl
    // v29.21.0 — carrossel do Instagram: context.carousel_urls com 2 a 10 links de imagem.
    // Fluxo da Graph API validado em produção nas pontes de 13/08/2026 (carrossel do guia
    // de manutenção): cada imagem vira um container filho (is_carousel_item=true), o pai
    // (media_type=CAROUSEL) junta os filhos + legenda e é ele que se publica. Só existe no
    // FEED do Instagram — Story e página do Facebook não têm carrossel por API.
    const carouselUrls: string[] = Array.isArray(post.context?.carousel_urls)
      ? post.context.carousel_urls.map((u: unknown) => String(u || '').trim()).filter(Boolean)
      : []
    if (carouselUrls.length) {
      if (post.platform !== 'instagram') {
        return json({ error: 'Carrossel só existe no feed do Instagram — nas outras plataformas use uma imagem ou um vídeo.' }, 400)
      }
      if (carouselUrls.length < 2 || carouselUrls.length > 10) {
        return json({ error: 'O carrossel precisa de 2 a 10 imagens (a Meta não aceita fora disso).' }, 400)
      }
      for (const url of carouselUrls) {
        if (!/^https?:\/\//i.test(url)) {
          return json({ error: 'Todos os links do carrossel precisam ser completos (começando com https://).' }, 400)
        }
      }
    }
    // Story de qualquer rede e post do Instagram exigem mídia — só o feed do Facebook
    // aceita texto puro. Barrado antes da trava de publicação pra não gastar a lease à toa.
    if (post.platform !== 'facebook' && !mediaUrl && !carouselUrls.length) {
      return json({ error: 'Esse tipo de post exige uma imagem ou um vídeo (context.image_url ou context.video_url).' }, 400)
    }
    // Defesa em profundidade: o formulário do admin já bloqueia link relativo, mas um
    // rascunho pode ter sido criado direto por SQL/API sem passar por ali. A Meta busca a
    // mídia pelos próprios servidores dela — um link relativo falharia lá com um erro
    // genérico e confuso; melhor barrar aqui com uma mensagem clara.
    if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) {
      return json({ error: 'O link da mídia precisa ser completo (começando com https://) — um caminho relativo não funciona pra Meta buscar o arquivo.' }, 400)
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
      // Vídeo: endpoint /videos (file_url + description). Com imagem: /photos (a legenda
      // vira o texto do post). Sem mídia nenhuma: post de texto puro no feed.
      const endpoint = videoUrl ? `${pageId}/videos` : imageUrl ? `${pageId}/photos` : `${pageId}/feed`
      const params = new URLSearchParams({ access_token: pageToken })
      if (videoUrl) { params.set('file_url', videoUrl); params.set('description', finalCaption) }
      else if (imageUrl) { params.set('url', imageUrl); params.set('caption', finalCaption) }
      else { params.set('message', finalCaption) }

      // Vídeo: a Meta baixa o arquivo inteiro do nosso servidor durante esta chamada, então
      // 35s (suficiente pra foto) pode estourar. 120s dá folga pro Reel típico.
      const fbResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`, {
        method: 'POST',
        body: params,
      }, videoUrl ? 120000 : 35000)
      const fbData = await fbResponse.json().catch(() => ({}))
      if (!fbResponse.ok) {
        console.error('[content-publish-meta] facebook error', fbResponse.status, fbData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: fbData?.error?.message || 'Falha ao publicar no Facebook.' }, 502)
      }
      metaPostId = String(fbData?.post_id || fbData?.id || '') || null
    } else if (post.platform === 'facebook_story' && videoUrl) {
      // v28.57.0 — Story de VÍDEO no Facebook usa um fluxo próprio, diferente do de foto:
      // (1) POST /video_stories com upload_phase=start devolve um video_id;
      // (2) sobe o arquivo por file_url nesse video_id;
      // (3) POST /video_stories com upload_phase=finish publica.
      const startParams = new URLSearchParams({ access_token: pageToken, upload_phase: 'start' })
      const startResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_stories`, {
        method: 'POST',
        body: startParams,
      }, 35000)
      const startData = await startResponse.json().catch(() => ({}))
      if (!startResponse.ok || !startData?.video_id || !startData?.upload_url) {
        console.error('[content-publish-meta] fb video story start error', startResponse.status, startData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: startData?.error?.message || 'Falha ao preparar o Story de vídeo do Facebook.' }, 502)
      }

      // A Meta baixa o arquivo da nossa URL (header file_url), não precisamos enviar bytes.
      const uploadResponse = await fetchWithTimeout(String(startData.upload_url), {
        method: 'POST',
        headers: { Authorization: `OAuth ${pageToken}`, file_url: videoUrl },
      }, 120000)
      const uploadResult = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok) {
        console.error('[content-publish-meta] fb video story upload error', uploadResponse.status, uploadResult)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: uploadResult?.error?.message || 'Falha ao enviar o vídeo do Story do Facebook.' }, 502)
      }

      const finishParams = new URLSearchParams({ access_token: pageToken, upload_phase: 'finish', video_id: String(startData.video_id) })
      const finishResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_stories`, {
        method: 'POST',
        body: finishParams,
      }, 60000)
      const finishData = await finishResponse.json().catch(() => ({}))
      if (!finishResponse.ok) {
        console.error('[content-publish-meta] fb video story finish error', finishResponse.status, finishData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: finishData?.error?.message || 'Falha ao publicar o Story de vídeo do Facebook.' }, 502)
      }
      metaPostId = String(finishData?.post_id || startData.video_id) || null
    } else if (post.platform === 'facebook_story') {
      // Story de FOTO de Página no Facebook é em 2 passos: (1) sobe a foto SEM publicar
      // (published=false, fica "invisível" até virar story), (2) publica esse photo_id
      // como story via /photo_stories. Não existe caption em Story de Facebook.
      const uploadParams = new URLSearchParams({ access_token: pageToken, url: imageUrl, published: 'false' })
      const uploadResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
        method: 'POST',
        body: uploadParams,
      }, 35000)
      const uploadData = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok || !uploadData?.id) {
        console.error('[content-publish-meta] facebook story upload error', uploadResponse.status, uploadData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: uploadData?.error?.message || 'Falha ao preparar o Story do Facebook.' }, 502)
      }
      const storyParams = new URLSearchParams({ access_token: pageToken, photo_id: String(uploadData.id) })
      // 45s aqui — foi exatamente esse passo que estourou 20s numa chamada real
      // (endpoint mais raro da Meta, aparenta ser mais lento que os outros).
      const storyResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photo_stories`, {
        method: 'POST',
        body: storyParams,
      }, 45000)
      const storyData = await storyResponse.json().catch(() => ({}))
      if (!storyResponse.ok) {
        console.error('[content-publish-meta] facebook story publish error', storyResponse.status, storyData)
        await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
        return json({ error: storyData?.error?.message || 'Falha ao publicar o Story do Facebook.' }, 502)
      }
      metaPostId = String(storyData?.post_id || storyData?.id || '') || null
    } else if (post.platform === 'instagram' || post.platform === 'instagram_story') {
      let creationId = ''

      if (carouselUrls.length) {
        // Carrossel: primeiro os filhos, um a um (cada imagem processa no servidor da
        // Meta antes de o pai poder referenciá-la), depois o container pai com a legenda.
        const childIds: string[] = []
        for (let index = 0; index < carouselUrls.length; index++) {
          const childParams = new URLSearchParams({ access_token: pageToken, image_url: carouselUrls[index], is_carousel_item: 'true' })
          // Em carrossel a marcação vai em cada imagem, não no container pai — a Meta ignora
          // user_tags no pai e não retorna erro, o que faria a tag sumir em silêncio.
          if (USER_TAGS) childParams.set('user_tags', USER_TAGS)
          let child = await createAndWaitInstagramContainer(igUserId, pageToken, childParams, false)
          if ('error' in child && childParams.has('user_tags')) {
            console.error('[content-publish-meta] user_tags recusado no carrossel, seguindo sem marcação:', child.error)
            childParams.delete('user_tags')
            child = await createAndWaitInstagramContainer(igUserId, pageToken, childParams, false)
          }
          if ('error' in child) {
            await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
            return json({ error: `Imagem ${index + 1} do carrossel: ${child.error}` }, 502)
          }
          childIds.push(child.creationId)
        }
        // O pai agrega até 10 mídias e processa mais devagar que imagem única — usa a
        // espera longa (a mesma de vídeo) pra não desistir antes da Meta terminar.
        const parentParams = new URLSearchParams({
          access_token: pageToken,
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: finalCaption,
        })
        const parent = await createAndWaitInstagramContainer(igUserId, pageToken, parentParams, true)
        if ('error' in parent) {
          await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
          return json({ error: `Montagem do carrossel: ${parent.error}` }, 502)
        }
        creationId = parent.creationId
      } else {
        const createParams = new URLSearchParams({ access_token: pageToken })
        if (videoUrl) createParams.set('video_url', videoUrl)
        else createParams.set('image_url', imageUrl)

        // Feed do Instagram usa legenda; Story do Instagram não tem campo de legenda (o
        // texto precisa já estar na própria mídia) — por isso caption só entra no feed.
        // v28.57.0: vídeo no FEED do Instagram só existe como REELS (a Meta aposentou o
        // post de vídeo comum) — sem media_type=REELS a criação do container falha.
        // Story aceita vídeo com o mesmo media_type=STORIES da imagem.
        if (post.platform === 'instagram') {
          createParams.set('caption', finalCaption)
          if (videoUrl) createParams.set('media_type', 'REELS')
          else if (USER_TAGS) createParams.set('user_tags', USER_TAGS)
        } else {
          createParams.set('media_type', 'STORIES')
        }

        let container = await createAndWaitInstagramContainer(igUserId, pageToken, createParams, Boolean(videoUrl))
        // A marcação NUNCA pode custar a publicação. Ela falha por motivos que não estão sob
        // nosso controle — a pessoa marcada mudou o perfil pra privado, desligou "permitir
        // marcações" ou trocou o @ — e nesses casos a Meta rejeita o container inteiro. Se
        // isso acontecer, publica sem marcação: post no ar sem tag é contorno; post que não
        // subiu por causa de uma tag é prejuízo.
        if ('error' in container && createParams.has('user_tags')) {
          console.error('[content-publish-meta] user_tags recusado, publicando sem marcação:', container.error)
          createParams.delete('user_tags')
          container = await createAndWaitInstagramContainer(igUserId, pageToken, createParams, Boolean(videoUrl))
        }
        if ('error' in container) {
          await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
          return json({ error: container.error }, 502)
        }
        creationId = container.creationId
      }

      const publishParams = new URLSearchParams({ access_token: pageToken, creation_id: creationId })
      const publishResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
        method: 'POST',
        body: publishParams,
      }, 35000)
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
