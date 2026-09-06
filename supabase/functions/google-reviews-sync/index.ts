import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v28.33.0 — sincroniza avaliações novas do Google Business Profile e gera um rascunho
// de resposta com IA. NUNCA publica nada sozinha — só grava status 'pending' pra o
// Juliano revisar/editar/aprovar em admin-avaliacoes.html. A publicação de fato acontece
// só em google-reviews-publish, chamada manualmente pelo admin depois da aprovação.
//
// v29.147.0 (06/09/2026) — DUAS FONTES, em ordem de preferência:
//   1) Windsor.ai (secret WINDSOR_API_KEY): o conector google_my_business já está autorizado
//      na conta do Juliano e é o único caminho que funcionou até hoje — a API direta do
//      Google (abaixo) nunca teve os secrets cadastrados, e a tabela ficou vazia de 01/08
//      a 06/09. Lê pela Data API (GET connectors.windsor.ai/google_my_business).
//   2) API direta do Google (GOOGLE_REVIEWS_CLIENT_ID/SECRET/REFRESH_TOKEN): mantida como
//      estava, pra quando/se a aprovação do Google sair.
// Sem nenhuma das duas, sai cedo sem erro (pra não poluir logs).
// Também reconcilia: avaliação que já está na tabela e ganhou resposta por fora (app do
// Google, conector pelo chat) vira 'posted' com a resposta real — a tela não fica pedindo
// pra responder o que já foi respondido.
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

const textFrom = (d: any) =>
  typeof d?.output_text === 'string'
    ? d.output_text.trim()
    : (d?.output || []).flatMap((x: any) => x.content || []).filter((x: any) => x.type === 'output_text').map((x: any) => x.text).join('\n').trim()

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

// Formato interno único (é o da API v4 do Google; o Windsor é convertido pra ele).
type Review = {
  name: string
  starRating?: string
  comment?: string
  reviewer?: { displayName?: string; profilePhotoUrl?: string }
  createTime?: string
  updateTime?: string
  reviewReply?: { comment?: string; updateTime?: string }
}

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const windsorKey = Deno.env.get('WINDSOR_API_KEY')?.trim()
  const clientId = Deno.env.get('GOOGLE_REVIEWS_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('GOOGLE_REVIEWS_CLIENT_SECRET')?.trim()
  const refreshToken = Deno.env.get('GOOGLE_REVIEWS_REFRESH_TOKEN')?.trim()
  if (!windsorKey && (!clientId || !clientSecret || !refreshToken)) {
    return json({ ok: true, skipped: 'nenhuma_fonte_configurada' })
  }

  try {
    const reviews = windsorKey
      ? await listarPeloWindsor(windsorKey)
      : await listarPeloGoogle(clientId!, clientSecret!, refreshToken!)
    const fonte = windsorKey ? 'windsor' : 'google'

    if (!reviews.length) return json({ ok: true, fonte, checked: 0, new_reviews: 0 })

    const { data: existing } = await admin.from('google_reviews').select('google_review_id, status')
    const existingById = new Map<string, string>((existing || []).map((r: any) => [r.google_review_id, r.status]))

    // Reconciliação: já estava na tabela sem 'posted', mas no Google já tem resposta.
    let reconciled = 0
    for (const review of reviews) {
      const status = existingById.get(review.name)
      if (status && status !== 'posted' && review.reviewReply?.comment) {
        const { error } = await admin.from('google_reviews').update({
          status: 'posted',
          final_reply: review.reviewReply.comment,
          posted_at: review.reviewReply.updateTime || new Date().toISOString(),
          last_error: null,
        }).eq('google_review_id', review.name)
        if (!error) reconciled++
      }
    }

    const freshReviews = reviews.filter((r) => !existingById.has(r.name))
    if (!freshReviews.length) return json({ ok: true, fonte, checked: reviews.length, new_reviews: 0, reconciled })

    const { data: servicesData } = await admin.from('services').select('name').eq('active', true).order('sort_order')
    const serviceNames = (servicesData || []).map((s: any) => s.name).join(', ')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()

    let inserted = 0
    for (const review of freshReviews) {
      const rating = STAR_MAP[review.starRating as string] || null
      const comment = String(review.comment || '').trim()
      const reviewerName = String(review.reviewer?.displayName || '').trim() || 'Cliente'
      const alreadyReplied = Boolean(review.reviewReply?.comment)

      let draft: string | null = null
      if (!alreadyReplied && openaiKey) {
        draft = await generateDraft({ openaiKey, reviewerName, rating, comment, serviceNames }).catch((err) => {
          console.error('[google-reviews-sync] falha ao gerar rascunho', err)
          return null
        })
      }

      const { error: insertError } = await admin.from('google_reviews').insert({
        google_review_id: review.name,
        reviewer_name: reviewerName,
        reviewer_photo_url: review.reviewer?.profilePhotoUrl || null,
        star_rating: rating,
        comment: comment || null,
        review_created_at: review.createTime || null,
        review_updated_at: review.updateTime || null,
        ai_draft_reply: draft,
        final_reply: alreadyReplied ? (review.reviewReply?.comment || null) : draft,
        status: alreadyReplied ? 'posted' : 'pending',
        posted_at: alreadyReplied ? (review.reviewReply?.updateTime || null) : null,
      })
      if (insertError) { console.error('[google-reviews-sync] insert falhou', insertError); continue }
      inserted++
    }

    // Avisa o Juliano só se sobrou pelo menos 1 avaliação pendente de rascunho de verdade
    // (não conta as que já tinham resposta antiga, importadas só como histórico).
    const pendingNew = freshReviews.filter((r) => !r.reviewReply?.comment).length
    if (pendingNew > 0) {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')?.trim()
      if (pushSecret) {
        await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({
            custom: {
              title: '⭐ Nova avaliação no Google',
              body: pendingNew === 1 ? 'Uma avaliação nova chegou com rascunho de resposta pronto.' : `${pendingNew} avaliações novas chegaram com rascunho de resposta pronto.`,
              url: '/admin-avaliacoes.html?app=1',
              tag: `google-review-${Date.now()}`,
            },
          }),
        }).catch((err) => console.error('[google-reviews-sync] falha ao notificar', err))
      }
    }

    return json({ ok: true, fonte, checked: reviews.length, new_reviews: inserted, reconciled })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[google-reviews-sync]', message)
    return json({ error: message }, 500)
  }
})

// Windsor.ai Data API: GET connectors.windsor.ai/{connector}?fields=...&date_from=...&date_to=...
// (chave no header X-Api-Key). Resposta: { data: [ {campo: valor, ...} ] }. Os campos são
// os da tabela Reviews do conector google_my_business (mesmos nomes do get_fields do MCP).
// Janela de 2 anos: a Barbearia abriu em 2026, então pega tudo; e a Data API exige data.
async function listarPeloWindsor(apiKey: string): Promise<Review[]> {
  const url = new URL('https://connectors.windsor.ai/google_my_business')
  url.searchParams.set('fields', 'review_id,review_reviewer,review_reviewer_profile_photo,review_star_rating,review_comment,review_create_time,review_update_time,review_reply_comment,review_reply_update_time')
  const hoje = new Date()
  const inicio = new Date(hoje.getTime() - 730 * 24 * 60 * 60 * 1000)
  url.searchParams.set('date_from', inicio.toISOString().slice(0, 10))
  url.searchParams.set('date_to', hoje.toISOString().slice(0, 10))
  url.searchParams.set('_max_rows', '2000')
  const resp = await fetchWithTimeout(url, { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' } }, 45000)
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`Windsor (${resp.status}): ${JSON.stringify(data).slice(0, 500)}`)
  const rows: any[] = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
  const vistos = new Set<string>()
  const reviews: Review[] = []
  for (const row of rows) {
    const id = String(row?.review_id || '').trim()
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    const replyComment = String(row?.review_reply_comment || '').trim()
    reviews.push({
      name: id,
      starRating: String(row?.review_star_rating || '').toUpperCase() || undefined,
      comment: String(row?.review_comment || '').trim() || undefined,
      reviewer: { displayName: String(row?.review_reviewer || '').trim() || undefined, profilePhotoUrl: row?.review_reviewer_profile_photo || undefined },
      createTime: row?.review_create_time || undefined,
      updateTime: row?.review_update_time || undefined,
      reviewReply: replyComment ? { comment: replyComment, updateTime: row?.review_reply_update_time || undefined } : undefined,
    })
  }
  return reviews
}

// API direta do Google (v28.33.0), intacta — só saiu de dentro do handler.
async function listarPeloGoogle(clientId: string, clientSecret: string, refreshToken: string): Promise<Review[]> {
  // 1) Access token via refresh_token (mesmo padrão OAuth já usado com Zoho em send-email)
  const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error(`Google OAuth: ${JSON.stringify(tokenData)}`)
  }
  const accessToken = tokenData.access_token as string
  const authHeaders = { Authorization: `Bearer ${accessToken}` }

  // 2) Descobre a location (nome completo "accounts/{id}/locations/{id}") — usa secrets
  // fixos se existirem, senão descobre sozinha (conta/local únicos, negócio pequeno).
  let locationName = Deno.env.get('GOOGLE_REVIEWS_LOCATION_NAME')?.trim() || ''
  if (!locationName) {
    const accountsResp = await fetchWithTimeout('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers: authHeaders })
    const accountsData = await accountsResp.json().catch(() => ({}))
    if (!accountsResp.ok || !accountsData?.accounts?.length) {
      throw new Error(`Google accounts: ${JSON.stringify(accountsData)}`)
    }
    const accountName = accountsData.accounts[0].name as string

    const locationsResp = await fetchWithTimeout(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
      { headers: authHeaders },
    )
    const locationsData = await locationsResp.json().catch(() => ({}))
    if (!locationsResp.ok || !locationsData?.locations?.length) {
      throw new Error(`Google locations: ${JSON.stringify(locationsData)}`)
    }
    locationName = locationsData.locations[0].name as string
  }

  // 3) Lista reviews (API v4, legado — é onde reviews.list/reply de fato vivem)
  const reviewsResp = await fetchWithTimeout(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`, { headers: authHeaders })
  const reviewsData = await reviewsResp.json().catch(() => ({}))
  if (!reviewsResp.ok) throw new Error(`Google reviews: ${JSON.stringify(reviewsData)}`)
  return (reviewsData?.reviews || []) as Review[]
}

async function generateDraft(args: { openaiKey: string; reviewerName: string; rating: number | null; comment: string; serviceNames: string }): Promise<string | null> {
  const { openaiKey, reviewerName, rating, comment, serviceNames } = args
  const prompt = `Você escreve, em nome do Juliano (dono da Barbearia do Ju, em Bragança Paulista), respostas curtas e calorosas para avaliações recebidas no Google. Responda em português do Brasil, entre 2 e 4 frases, tom pessoal e caloroso (não corporativo, não genérico). Use o nome do cliente quando disponível. Se a avaliação citar um serviço (mesmo com nome informal), identifique o nome real mais próximo nesta lista e mencione-o naturalmente: ${serviceNames}. Quando fizer sentido de forma natural (sem forçar, sem parecer lista de palavras-chave), inclua também "Barbearia do Ju" e/ou "Bragança Paulista". Nunca chame o Juliano de dermatologista, tricologista ou cosmetólogo — ele é farmacêutico, não mencione isso a menos que seja natural para o contexto (normalmente não é preciso). Se a nota for baixa (1-3 estrelas) ou o comentário for uma reclamação, responda com empatia genuína, peça desculpas sem ser defensivo, e convide a pessoa a chamar no WhatsApp ou conversar pessoalmente pra resolver — nunca seja genérico tipo "obrigado pela visita" nesse caso. Nunca invente detalhes que não estão no comentário do cliente. PROIBIDO, SEM EXCEÇÃO (decisão do Juliano, 06/09/2026): oferecer ajuste, retoque ou refazer o corte ("se não ficou como queria, volta que a gente ajusta", "ajuste sem cobrar", "garantia de ajuste", "qualquer ajuste é só voltar"). Resposta pública com essa promessa faz o barbeiro parecer inseguro ou que erra o corte. Nunca use "premium", "de luxo", "a melhor barbearia" nem superlativo sobre a própria casa. Retorne APENAS o texto da resposta, sem aspas, sem markdown, sem explicações.`
  const input = `Cliente: ${reviewerName}\nNota: ${rating ?? 'não informada'} estrelas\nComentário: ${comment || '(sem comentário escrito, só a nota)'}`

  const pedir = async (instructions: string) => {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-luna', reasoning: { effort: 'medium' }, max_output_tokens: 400, instructions, input }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(`OpenAI: ${JSON.stringify(d)}`)
    return textFrom(d) || null
  }

  // v29.146.0 — trava em código da promessa de ajuste (a mesma de content-generate-daily).
  // O prompt proíbe, mas proibição textual depende do modelo. Se escapar, pede outra
  // versão; se escapar de novo, a frase é cortada e o resto da resposta segue.
  let texto = await pedir(prompt)
  if (texto && GARANTIA_INSEGURA.test(texto)) {
    console.warn('[google-reviews-sync] rascunho com promessa de ajuste, pedindo outra versão')
    const segunda = await pedir(`${prompt}\n\nATENÇÃO — sua tentativa anterior foi REPROVADA por prometer ajuste/refazer o corte. Recomece do zero sem essa ideia.`)
    texto = segunda && !GARANTIA_INSEGURA.test(segunda) ? segunda : removerFraseDeAjuste(texto)
  }
  return texto
}

const GARANTIA_INSEGURA = /garantia\s+de\s+ajuste|ajust(e|a|amos)\s+(sem\s+(cobrar|custo)|de\s+gra[çc]a|gr[áa]tis)|sem\s+cobrar\s+nada|(volta|voltar|retorna)r?\s+(que|e|pra)\s+(a\s+gente\s+)?(ajust|acert|corrig)|a\s+gente\s+(ajusta|acerta|corrige)|se\s+(n[ãa]o\s+)?(ficou|ficar)\s+(como|do\s+jeito)\s+(que\s+)?(voc[êe]\s+)?queria|[ée]\s+s[óo]\s+voltar|qualquer\s+ajuste|refazemos|refa[çc]o\s+sem/i
// Corta só as frases que contêm a promessa (separadas por . ! ?), preservando o resto.
const removerFraseDeAjuste = (t: string) =>
  String(t || '')
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => !GARANTIA_INSEGURA.test(frase))
    .join(' ')
    .trim()
