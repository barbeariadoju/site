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

// Aviso por push pro Juliano sobre o desfecho da publicação em segundo plano — sem
// isso ele não teria como saber se o Status saiu ou falhou depois que a tela respondeu.
async function notifyOutcome(supabaseUrl: string, title: string, body: string, tag: string) {
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!pushSecret) return
  await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
    body: JSON.stringify({ custom: { title, body, url: '/admin-conteudo.html?app=1', tag } }),
  }).catch((error) => console.error('[content-publish-whatsapp] push', error))
}

// Central de Conteúdo (v28.44.0): único ponto do sistema que de fato publica um Status
// no WhatsApp da barbearia — sempre chamado por um clique explícito do Juliano no admin
// (verify_jwt=true, só admin autenticado). Nunca disparado por cron ou automaticamente.
//
// v28.48.2: a espera pela Evolution saiu do caminho da resposta HTTP. O sendStatus com
// allContacts enumera todos os contatos e pode passar de 90s (caso real na 1ª execução
// do fluxo diário, 2026-08-04: 90.4s = abort + 500 pro navegador, sem o Status sair).
// Agora a function reivindica a trava, responde na hora ({publishing:true}) e publica
// em segundo plano via EdgeRuntime.waitUntil (mesmo padrão comprovado do
// whatsapp-webhook) com timeout folgado de 130s. Desfecho vai por push e pelo próprio
// status do card (aprovado→publicado, ou de volta pra rascunho em caso de falha).
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
    // v28.46.1: mesma trava do content-publish-meta — a Evolution API busca a imagem
    // pelos próprios servidores dela, então um link relativo (ex. "/assets/foto.jpg")
    // falharia lá com erro genérico. Barra aqui com mensagem clara.
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return json({ error: 'O link da imagem precisa ser completo (começando com https://) — um caminho relativo não funciona pro WhatsApp buscar a imagem.' }, 400)
    }
    // Trava atômica contra clique duplo/aba dupla (v28.46.1): só quem conseguir mudar
    // rascunho→aprovado publica — uma segunda chamada simultânea não acha mais o status
    // 'rascunho' e recebe 409 em vez de publicar de novo. Já aconteceu na prática (2
    // cliques em erro de timeout = 2 Status reais publicados, precisou apagar via
    // dev-admin-tools). Em caso de falha da Evolution no segundo plano, o status volta
    // pra 'rascunho' e libera nova tentativa. 'aprovado' funciona como lease de 3
    // minutos (approved_at = início da tentativa): se a function morrer no meio sem
    // reverter, uma nova tentativa depois do prazo consegue "roubar" a lease em vez do
    // rascunho ficar preso pra sempre.
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

    // font: 4 = Bebas Neue (mesma fonte de display do site) — a fonte 1 (serifada, com
    // números oldstyle "caídos") saiu feia no primeiro Status real e o Juliano reclamou.
    const statusPayload = imageUrl
      ? { type: 'image', content: imageUrl, caption: finalCaption, allContacts: true }
      : { type: 'text', content: finalCaption, backgroundColor: '#0b0b0b', font: 4, allContacts: true }

    // Comportamento REAL da Evolution medido em produção (04/08/2026): o sendStatus com
    // allContacts PUBLICA o Status imediatamente, mas a resposta HTTP só volta depois de
    // distribuir pra todos os contatos — pode passar de 130s. Ou seja: timeout de resposta
    // NÃO significa falha. Por isso, quando a resposta demora, a gente confere direto na
    // lista de Status (findMessages status@broadcast) se a mensagem entrou no ar.
    const attemptStartedSec = Math.floor(Date.now() / 1000)
    const verifyPublished = async (): Promise<string | null> => {
      try {
        const r = await fetchWithTimeout(`${evolutionApiUrl}/chat/findMessages/${evolutionInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
          body: JSON.stringify({ where: { key: { remoteJid: 'status@broadcast' } }, limit: 8 }),
        }, 20000)
        const data = await r.json().catch(() => ({}))
        const arr = Array.isArray(data) ? data : (data?.messages?.records || data?.messages || data?.records || [])
        const captionStart = finalCaption.slice(0, 40)
        for (const m of Array.isArray(arr) ? arr : []) {
          const text = String(m?.message?.conversation || m?.message?.imageMessage?.caption || '')
          const ts = Number(m?.messageTimestamp || 0)
          if (m?.key?.fromMe && ts >= attemptStartedSec - 5 && text.startsWith(captionStart)) {
            return String(m?.key?.id || '') || null
          }
        }
      } catch (error) {
        console.error('[content-publish-whatsapp] verify', error)
      }
      return null
    }

    const markPublished = async (evolutionMessageId: string | null) => {
      await admin.from('content_posts').update({
        caption: finalCaption,
        status: 'publicado',
        published_at: new Date().toISOString(),
        evolution_message_id: evolutionMessageId,
      }).eq('id', id)
      await notifyOutcome(supabaseUrl, '✅ Status do WhatsApp publicado', finalCaption.slice(0, 90), `content-pub-ok-${id}`)
    }

    const publishInBackground = async () => {
      try {
        const statusResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendStatus/${evolutionInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
          body: JSON.stringify(statusPayload),
        }, 60000)

        if (!statusResponse.ok) {
          const errBody = await statusResponse.text().catch(() => '')
          console.error('[content-publish-whatsapp] evolution error', statusResponse.status, errBody)
          await admin.from('content_posts').update({ status: 'rascunho' }).eq('id', id)
          await notifyOutcome(supabaseUrl, '❌ Status do WhatsApp não publicou', 'A Evolution recusou a publicação. O rascunho voltou pra fila — confira o WhatsApp antes de tentar de novo.', `content-pub-fail-${id}`)
          return
        }

        const statusData = await statusResponse.json().catch(() => ({}))
        await markPublished(String(statusData?.key?.id || '') || null)
      } catch (_timeoutError) {
        // Resposta demorou (>60s): quase sempre o Status JÁ está publicado — confirmar
        // olhando a lista de Status. Duas checagens com 15s de intervalo.
        for (let i = 0; i < 2; i++) {
          await new Promise((resolve) => setTimeout(resolve, 15000))
          const foundId = await verifyPublished()
          if (foundId) { await markPublished(foundId); return }
        }
        // Não achou de verdade — aí sim é incerteza real: manter a trava e avisar.
        await notifyOutcome(supabaseUrl, '⚠️ Status do WhatsApp: confirmação pendente', 'A Evolution demorou e não consegui confirmar a publicação. Confira no celular antes de tentar de novo (pra não duplicar).', `content-pub-warn-${id}`)
      }
    }

    // EdgeRuntime.waitUntil mantém o processamento vivo depois da resposta HTTP
    // (comprovado em produção no whatsapp-webhook). Fallback: espera em linha.
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
    if (runtime?.waitUntil) runtime.waitUntil(publishInBackground())
    else await publishInBackground()

    return json({ ok: true, publishing: true, id }, 202)
  } catch (error) {
    console.error('[content-publish-whatsapp]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
