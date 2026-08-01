import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v28.33.0 — sincroniza avaliações novas do Google Business Profile e gera um rascunho
// de resposta com IA. NUNCA publica nada sozinha — só grava status 'pending' pra o
// Juliano revisar/editar/aprovar em admin-avaliacoes.html. A publicação de fato acontece
// só em google-reviews-publish, chamada manualmente pelo admin depois da aprovação.
//
// Pré-requisito ainda pendente em 2026-08-01: acesso à API de reviews do Google (Business
// Profile / mybusiness.googleapis.com v4) depende de aprovação separada do Google
// (protocolo 8-0854000041581, prazo 7-10 dias úteis) + criação de credencial OAuth +
// autorização (refresh token) depois disso. Até lá, os secrets abaixo não existem e esta
// function retorna cedo sem erro (pra não poluir logs caso alguém dispare por engano) —
// NÃO agendar cron pra esta function antes de configurar os secrets.
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

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Credenciais OAuth do Google — ainda não configuradas em 2026-08-01 (aguardando
  // aprovação da API + fluxo de autorização). Sai cedo sem erro se estiverem ausentes.
  const clientId = Deno.env.get('GOOGLE_REVIEWS_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('GOOGLE_REVIEWS_CLIENT_SECRET')?.trim()
  const refreshToken = Deno.env.get('GOOGLE_REVIEWS_REFRESH_TOKEN')?.trim()
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ ok: true, skipped: 'google_oauth_not_configured' })
  }

  try {
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
    const reviews: any[] = reviewsData?.reviews || []

    if (!reviews.length) return json({ ok: true, checked: 0, new_reviews: 0 })

    const { data: existing } = await admin.from('google_reviews').select('google_review_id')
    const existingIds = new Set((existing || []).map((r: any) => r.google_review_id))
    const freshReviews = reviews.filter((r) => !existingIds.has(r.name))

    if (!freshReviews.length) return json({ ok: true, checked: reviews.length, new_reviews: 0 })

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
        final_reply: draft,
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

    return json({ ok: true, checked: reviews.length, new_reviews: inserted })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[google-reviews-sync]', message)
    return json({ error: message }, 500)
  }
})

async function generateDraft(args: { openaiKey: string; reviewerName: string; rating: number | null; comment: string; serviceNames: string }): Promise<string | null> {
  const { openaiKey, reviewerName, rating, comment, serviceNames } = args
  const prompt = `Você escreve, em nome do Juliano (dono da Barbearia do Ju, em Bragança Paulista), respostas curtas e calorosas para avaliações recebidas no Google. Responda em português do Brasil, entre 2 e 4 frases, tom pessoal e caloroso (não corporativo, não genérico). Use o nome do cliente quando disponível. Se a avaliação citar um serviço (mesmo com nome informal), identifique o nome real mais próximo nesta lista e mencione-o naturalmente: ${serviceNames}. Quando fizer sentido de forma natural (sem forçar, sem parecer lista de palavras-chave), inclua também "Barbearia do Ju" e/ou "Bragança Paulista". Nunca chame o Juliano de dermatologista, tricologista ou cosmetólogo — ele é farmacêutico, não mencione isso a menos que seja natural para o contexto (normalmente não é preciso). Se a nota for baixa (1-3 estrelas) ou o comentário for uma reclamação, responda com empatia genuína, peça desculpas sem ser defensivo, e convide a pessoa a chamar no WhatsApp ou conversar pessoalmente pra resolver — nunca seja genérico tipo "obrigado pela visita" nesse caso. Nunca invente detalhes que não estão no comentário do cliente. Retorne APENAS o texto da resposta, sem aspas, sem markdown, sem explicações.`
  const input = `Cliente: ${reviewerName}\nNota: ${rating ?? 'não informada'} estrelas\nComentário: ${comment || '(sem comentário escrito, só a nota)'}`

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5.6-luna', reasoning: { effort: 'medium' }, max_output_tokens: 400, instructions: prompt, input }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`OpenAI: ${JSON.stringify(d)}`)
  return textFrom(d) || null
}
