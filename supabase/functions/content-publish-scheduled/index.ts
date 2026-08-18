import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Central de Conteúdo — PUBLICAÇÃO AGENDADA (v29.44.0, 18/08/2026).
//
// Até aqui a Central só publicava com um clique do Juliano no admin (content-publish-meta /
// content-publish-whatsapp, verify_jwt=true). Na prática isso virou gargalo: "publicar sábado
// 9h", "Reel às 18h", "teaser às 17h30" dependiam de alguém estar com o app aberto na hora —
// e a rotina de lembrete tem jitter de ~9 min. Esta function fecha o buraco: um rascunho pode
// ficar com status 'agendado' + scheduled_for; o cron `bdj-content-publish-scheduled` roda a
// cada 5 min e chama aqui; o que venceu é publicado sozinho, com o MESMO fluxo da Meta e da
// Evolution que os botões usam (código espelhado deles — mudou lá, mudar aqui).
//
// Segurança: verify_jwt=false + x-webhook-secret (WHATSAPP_WEBHOOK_SECRET, mesmo segredo dos
// outros robôs internos, lido do Vault pelo cron). Só publica o que o Juliano AGENDOU
// explicitamente (status 'agendado') — nunca toca em 'rascunho'.
//
// Regras herdadas:
// - trava atômica agendado→aprovado (lease) igual aos botões; falha volta pra 'rascunho' com
//   context.schedule_error e push pro Juliano (nada some em silêncio);
// - horário de silêncio (v29.21.0): Status do WhatsApp NÃO sai 20h-8h — fica agendado e sai
//   na primeira rodada depois das 8h. Facebook/Instagram não são mensagem, publicam a
//   qualquer hora agendada;
// - desfecho sempre por push (✅/❌), como no content-publish-whatsapp.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

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
const CONTAS_MARCADAS = [
  { username: 'julianoblpadilha', x: 0.3, y: 0.72 },
  { username: 'nicolefpadilha', x: 0.62, y: 0.72 },
]
const USER_TAGS = JSON.stringify(CONTAS_MARCADAS)

type Post = {
  id: string
  platform: string
  caption: string
  status: string
  context: Record<string, unknown> | null
  scheduled_for: string | null
}

async function notify(supabaseUrl: string, title: string, body: string, tag: string) {
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!pushSecret) return
  await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
    body: JSON.stringify({ custom: { title, body, url: '/admin-conteudo.html?app=1', tag } }),
  }).catch((error) => console.error('[content-publish-scheduled] push', error))
}

async function createAndWaitInstagramContainer(igUserId: string, pageToken: string, params: URLSearchParams, isVideo = false): Promise<{ creationId: string } | { error: string }> {
  const createResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, { method: 'POST', body: params }, 35000)
  const createData = await createResponse.json().catch(() => ({}))
  if (!createResponse.ok || !createData?.id) {
    console.error('[content-publish-scheduled] instagram create container error', createResponse.status, createData)
    return { error: createData?.error?.message || 'Falha ao preparar a publicação no Instagram.' }
  }
  const creationId = String(createData.id)
  const maxAttempts = isVideo ? 40 : 10
  const waitMs = isVideo ? 3000 : 2500
  let ready = false
  let lastError = ''
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code,status&access_token=${pageToken}`, { method: 'GET' }, 10000)
    const statusData = await statusResponse.json().catch(() => ({}))
    if (statusData?.status_code === 'FINISHED') { ready = true; break }
    if (statusData?.status_code === 'ERROR') { lastError = String(statusData?.status || ''); break }
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  if (!ready) return { error: lastError ? `A Meta recusou a mídia: ${lastError}` : 'A mídia não terminou de processar a tempo na Meta.' }
  return { creationId }
}

// Publica no Facebook/Instagram. Devolve o id da Meta ou lança Error com mensagem legível.
async function publishMeta(post: Post, caption: string): Promise<string | null> {
  const pageToken = requiredSecret('META_PAGE_ACCESS_TOKEN')
  const pageId = requiredSecret('META_PAGE_ID')
  const igUserId = requiredSecret('META_IG_USER_ID')
  const ctx = post.context || {}
  const imageUrl = typeof ctx.image_url === 'string' ? ctx.image_url : ''
  const videoUrl = typeof ctx.video_url === 'string' ? ctx.video_url : ''
  const carouselUrls: string[] = Array.isArray(ctx.carousel_urls) ? ctx.carousel_urls.map((u) => String(u || '').trim()).filter(Boolean) : []
  const mediaUrl = videoUrl || imageUrl
  if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) throw new Error('O link da mídia precisa ser completo (https://).')
  if (post.platform !== 'facebook' && !mediaUrl && !carouselUrls.length) throw new Error('Esse tipo de post exige imagem ou vídeo.')

  if (post.platform === 'facebook') {
    const endpoint = videoUrl ? `${pageId}/videos` : imageUrl ? `${pageId}/photos` : `${pageId}/feed`
    const params = new URLSearchParams({ access_token: pageToken })
    if (videoUrl) { params.set('file_url', videoUrl); params.set('description', caption) }
    else if (imageUrl) { params.set('url', imageUrl); params.set('caption', caption) }
    else params.set('message', caption)
    const fbResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`, { method: 'POST', body: params }, videoUrl ? 120000 : 35000)
    const fbData = await fbResponse.json().catch(() => ({}))
    if (!fbResponse.ok) {
      console.error('[content-publish-scheduled] facebook error', fbResponse.status, fbData)
      throw new Error(fbData?.error?.message || 'Falha ao publicar no Facebook.')
    }
    return String(fbData?.post_id || fbData?.id || '') || null
  }

  if (post.platform === 'instagram' || post.platform === 'instagram_story') {
    let creationId = ''
    if (carouselUrls.length) {
      if (post.platform !== 'instagram') throw new Error('Carrossel só existe no feed do Instagram.')
      if (carouselUrls.length < 2 || carouselUrls.length > 10) throw new Error('O carrossel precisa de 2 a 10 imagens.')
      const childIds: string[] = []
      for (let index = 0; index < carouselUrls.length; index++) {
        const childParams = new URLSearchParams({ access_token: pageToken, image_url: carouselUrls[index], is_carousel_item: 'true', user_tags: USER_TAGS })
        let child = await createAndWaitInstagramContainer(igUserId, pageToken, childParams, false)
        if ('error' in child) { childParams.delete('user_tags'); child = await createAndWaitInstagramContainer(igUserId, pageToken, childParams, false) }
        if ('error' in child) throw new Error(`Imagem ${index + 1} do carrossel: ${child.error}`)
        childIds.push(child.creationId)
      }
      const parent = await createAndWaitInstagramContainer(igUserId, pageToken, new URLSearchParams({ access_token: pageToken, media_type: 'CAROUSEL', children: childIds.join(','), caption }), true)
      if ('error' in parent) throw new Error(`Montagem do carrossel: ${parent.error}`)
      creationId = parent.creationId
    } else {
      const createParams = new URLSearchParams({ access_token: pageToken })
      if (videoUrl) createParams.set('video_url', videoUrl)
      else createParams.set('image_url', imageUrl)
      if (post.platform === 'instagram') {
        createParams.set('caption', caption)
        if (videoUrl) createParams.set('media_type', 'REELS')
        else createParams.set('user_tags', USER_TAGS)
      } else {
        createParams.set('media_type', 'STORIES')
      }
      let container = await createAndWaitInstagramContainer(igUserId, pageToken, createParams, Boolean(videoUrl))
      if ('error' in container && createParams.has('user_tags')) {
        createParams.delete('user_tags')
        container = await createAndWaitInstagramContainer(igUserId, pageToken, createParams, Boolean(videoUrl))
      }
      if ('error' in container) throw new Error(container.error)
      creationId = container.creationId
    }
    const publishResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, { method: 'POST', body: new URLSearchParams({ access_token: pageToken, creation_id: creationId }) }, 35000)
    const publishData = await publishResponse.json().catch(() => ({}))
    if (!publishResponse.ok || !publishData?.id) {
      console.error('[content-publish-scheduled] instagram publish error', publishResponse.status, publishData)
      throw new Error(publishData?.error?.message || 'Falha ao publicar no Instagram.')
    }
    return String(publishData.id)
  }

  throw new Error(`Plataforma "${post.platform}" não tem publicação agendada — publique pelo botão da Central.`)
}

// Status do WhatsApp via Evolution — mesma montagem de destinatários do botão (lista explícita
// do nosso banco; allContacts está quebrado nesta Evolution, ver content-publish-whatsapp).
async function publishWhatsapp(admin: ReturnType<typeof createClient>, post: Post, caption: string): Promise<{ messageId: string | null; audience: number }> {
  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const ctx = post.context || {}
  const imageUrl = typeof ctx.image_url === 'string' ? ctx.image_url : ''
  const videoUrl = typeof ctx.video_url === 'string' ? ctx.video_url : ''
  const mediaUrl = videoUrl || imageUrl
  if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) throw new Error('O link da mídia precisa ser completo (https://).')

  const toWhatsNumber = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '')
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return ''
  }
  const [{ data: convs }, { data: profiles }] = await Promise.all([
    admin.from('whatsapp_conversations').select('phone'),
    admin.from('customer_profiles').select('phone').not('phone', 'is', null),
  ])
  const numbers = new Set<string>()
  for (const row of [...(convs || []), ...(profiles || [])]) {
    const n = toWhatsNumber((row as { phone?: string }).phone || '')
    if (n) numbers.add(n)
  }
  const statusJidList = [...numbers].map((n) => `${n}@s.whatsapp.net`)
  if (!statusJidList.length) throw new Error('Nenhum contato encontrado pra montar a lista do Status.')

  const statusPayload = videoUrl
    ? { type: 'video', content: videoUrl, caption, allContacts: false, statusJidList }
    : imageUrl
      ? { type: 'image', content: imageUrl, caption, allContacts: false, statusJidList }
      : { type: 'text', content: caption, backgroundColor: '#0b0b0b', font: 4, allContacts: false, statusJidList }
  const statusResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendStatus/${evolutionInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
    body: JSON.stringify(statusPayload),
  }, videoUrl ? 130000 : 90000)
  if (!statusResponse.ok) {
    const errBody = await statusResponse.text().catch(() => '')
    console.error('[content-publish-scheduled] evolution error', statusResponse.status, errBody)
    throw new Error('A Evolution recusou o Status.')
  }
  const statusData = await statusResponse.json().catch(() => ({}))
  return { messageId: String(statusData?.key?.id || '') || null, audience: statusJidList.length }
}

const PLATFORM_LABEL: Record<string, string> = {
  whatsapp_business: 'Status do WhatsApp', facebook: 'Facebook', instagram: 'Instagram',
  facebook_story: 'Story do Facebook', instagram_story: 'Story do Instagram',
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const webhookSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!webhookSecret || (request.headers.get('x-webhook-secret') || '') !== webhookSecret) return json({ error: 'Não autorizado.' }, 401)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const admin = createClient(supabaseUrl, requiredSecret('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })

    // Horário de silêncio (v29.21.0): Status do WhatsApp é mensagem pra base — não sai 20h-8h.
    const spHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
    const quiet = spHour >= 20 || spHour < 8

    const nowIso = new Date().toISOString()
    const { data: due, error: dueError } = await admin
      .from('content_posts')
      .select('id, platform, caption, status, context, scheduled_for')
      .eq('status', 'agendado')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(6)
    if (dueError) throw dueError

    const picked: Post[] = []
    const skippedQuiet: string[] = []
    for (const row of (due || []) as Post[]) {
      if (row.platform === 'whatsapp_business' && quiet) { skippedQuiet.push(row.id); continue }
      // Lease atômica: só quem consegue mudar agendado→aprovado publica (mesma trava dos botões).
      const { data: claimed } = await admin.from('content_posts')
        .update({ status: 'aprovado', approved_at: nowIso })
        .eq('id', row.id).eq('status', 'agendado').select('id')
      if (claimed?.length) picked.push(row)
    }

    const results: Record<string, string> = {}
    const runOne = async (post: Post) => {
      const label = PLATFORM_LABEL[post.platform] || post.platform
      const caption = String(post.caption || '')
      try {
        if (post.platform === 'whatsapp_business') {
          const { messageId, audience } = await publishWhatsapp(admin, post, caption)
          await admin.from('content_posts').update({ status: 'publicado', published_at: new Date().toISOString(), evolution_message_id: messageId }).eq('id', post.id)
          await notify(supabaseUrl, `✅ Agendado publicado: ${label} (${audience} contatos)`, caption.slice(0, 90), `content-sched-ok-${post.id}`)
        } else {
          const metaPostId = await publishMeta(post, caption)
          await admin.from('content_posts').update({ status: 'publicado', published_at: new Date().toISOString(), meta_post_id: metaPostId }).eq('id', post.id)
          await notify(supabaseUrl, `✅ Agendado publicado: ${label}`, caption.slice(0, 90), `content-sched-ok-${post.id}`)
        }
        results[post.id] = 'publicado'
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[content-publish-scheduled] falha', post.id, post.platform, message)
        // Volta pra rascunho (não pra agendado): a falha precisa de olho humano, e repetir
        // sozinho a cada 5 min poderia publicar duplicado se a Meta tiver aceitado por baixo.
        const context = { ...(post.context || {}), schedule_error: `${new Date().toISOString()} ${message}` }
        await admin.from('content_posts').update({ status: 'rascunho', context }).eq('id', post.id)
        await notify(supabaseUrl, `❌ Agendado NÃO publicou: ${label}`, `${message} — o rascunho voltou pra fila da Central.`, `content-sched-fail-${post.id}`)
        results[post.id] = `erro: ${message}`
      }
    }

    // Todos em paralelo, em segundo plano (Reel pode levar ~1-2 min na Meta) — a resposta
    // volta na hora pro cron; o desfecho vai por push e pelo status do card.
    const work = Promise.all(picked.map(runOne))
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
    if (runtime?.waitUntil) runtime.waitUntil(work)
    else await work

    return json({ ok: true, picked: picked.map((p) => p.id), skippedQuiet, results }, 202)
  } catch (error) {
    console.error('[content-publish-scheduled]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
