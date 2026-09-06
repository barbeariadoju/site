import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v28.33.0 — publica de fato no Google a resposta que o Juliano já aprovou em
// admin-avaliacoes.html. Só é chamada pelo painel admin (autenticado), nunca por cron —
// é o único ponto do sistema que efetivamente escreve no Google, de propósito, pra manter
// "nunca publica sozinha" garantido em código, não só por convenção de UI.
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

// Local da Barbearia do Ju no conector google_my_business do Windsor (id do Google Business
// Profile, não é credencial). Pode ser sobrescrito pelo secret WINDSOR_GMB_ACCOUNT.
const WINDSOR_GMB_ACCOUNT_PADRAO = 'locations/5325045674120268645'
// Mesma regex de content-generate-daily e google-reviews-sync (v29.146.0).
const GARANTIA_INSEGURA = /garantia\s+de\s+ajuste|ajust(e|a|amos)\s+(sem\s+(cobrar|custo)|de\s+gra[çc]a|gr[áa]tis)|sem\s+cobrar\s+nada|(volta|voltar|retorna)r?\s+(que|e|pra)\s+(a\s+gente\s+)?(ajust|acert|corrig)|a\s+gente\s+(ajusta|acerta|corrige)|se\s+(n[ãa]o\s+)?(ficou|ficar)\s+(como|do\s+jeito)\s+(que\s+)?(voc[êe]\s+)?queria|[ée]\s+s[óo]\s+voltar|qualquer\s+ajuste|refazemos|refa[çc]o\s+sem/i

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

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

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = await request.json().catch(() => ({}))
  const reviewId = String(body?.id || '').trim()
  if (!reviewId) return json({ error: 'id da avaliação ausente.' }, 400)

  const { data: review, error: loadError } = await admin.from('google_reviews').select('*').eq('id', reviewId).maybeSingle()
  if (loadError || !review) return json({ error: 'Avaliação não encontrada.' }, 404)
  if (review.status !== 'approved') return json({ error: 'Só é possível publicar avaliações com status "approved".' }, 400)

  const finalReply = String(review.final_reply || '').trim()
  if (!finalReply) return json({ error: 'Resposta final vazia.' }, 400)

  // v29.146.0/29.147.0 — trava da promessa de ajuste também na saída manual: mesmo que o
  // Juliano edite o texto na tela, a resposta pública não sai com "volta que a gente
  // acerta" (decisão dele, 06/09/2026: soa como barbeiro inseguro ou que erra o corte).
  if (GARANTIA_INSEGURA.test(finalReply)) {
    return json({ error: 'A resposta promete ajuste ou refazer o corte ("volta que a gente acerta", "sem cobrar nada", "garantia de ajuste"). Isso é proibido em resposta pública. Reescreva sem essa frase.' }, 400)
  }

  // v29.147.0 — caminho preferido: conector google_my_business do Windsor.ai (ação
  // reply_to_review), o mesmo que respondeu as avaliações de 29/08 a 05/09 pelo chat.
  // Endpoint: POST connectors.windsor.ai/{connector}/actions {account, action, params}.
  // Responder de novo substitui a resposta anterior no Google.
  const windsorKey = Deno.env.get('WINDSOR_API_KEY')?.trim()
  if (windsorKey) {
    try {
      const resp = await fetchWithTimeout('https://connectors.windsor.ai/google_my_business/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': windsorKey },
        body: JSON.stringify({
          account: Deno.env.get('WINDSOR_GMB_ACCOUNT')?.trim() || WINDSOR_GMB_ACCOUNT_PADRAO,
          action: 'reply_to_review',
          params: { review_id: review.google_review_id, comment: finalReply },
        }),
      }, 30000)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || data?.error) throw new Error(`Windsor (${resp.status}): ${JSON.stringify(data).slice(0, 500)}`)
      await admin.from('google_reviews').update({ status: 'posted', posted_at: new Date().toISOString(), last_error: null }).eq('id', reviewId)
      return json({ ok: true, via: 'windsor' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[google-reviews-publish] windsor', message)
      await admin.from('google_reviews').update({ last_error: message.slice(0, 4000) }).eq('id', reviewId)
      return json({ error: message }, 500)
    }
  }

  const clientId = Deno.env.get('GOOGLE_REVIEWS_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('GOOGLE_REVIEWS_CLIENT_SECRET')?.trim()
  const refreshToken = Deno.env.get('GOOGLE_REVIEWS_REFRESH_TOKEN')?.trim()
  if (!clientId || !clientSecret || !refreshToken) {
    return json({ error: 'Nenhuma integração configurada: falta o secret WINDSOR_API_KEY (conector do Windsor.ai) ou as credenciais OAuth do Google.' }, 503)
  }

  try {
    const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData?.access_token) throw new Error(`Google OAuth: ${JSON.stringify(tokenData)}`)

    const replyResponse = await fetchWithTimeout(`https://mybusiness.googleapis.com/v4/${review.google_review_id}/reply`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: finalReply }),
    })
    const replyData = await replyResponse.json().catch(() => ({}))
    if (!replyResponse.ok) throw new Error(`Google reply: ${JSON.stringify(replyData)}`)

    await admin.from('google_reviews').update({ status: 'posted', posted_at: new Date().toISOString(), last_error: null }).eq('id', reviewId)
    return json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[google-reviews-publish]', message)
    await admin.from('google_reviews').update({ last_error: message.slice(0, 4000) }).eq('id', reviewId)
    return json({ error: message }, 500)
  }
})
