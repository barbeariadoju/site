// v29.29.0 — Link rastreado da avaliação no Google.
//
// Até aqui o pedido de avaliação mandava o link direto (g.page/...), e o resultado apareceu
// nos números: 65 clientes responderam "satisfeito" em 60 dias e o sistema registrou ZERO
// cliques. Não era falta de avaliação — era falta de rastreio. Sem saber quem clicou, não dá
// pra medir o que funciona nem parar de pedir a quem já avaliou.
//
// Agora o cliente recebe um link nosso: registramos o clique e mandamos ele pro Google no
// mesmo instante (redirect 302, sem página intermediária — quem clicou quer avaliar, não
// quer ver um "aguarde").
//
// Se qualquer coisa falhar, o cliente vai pro Google do mesmo jeito: perder o registro é
// aceitável, perder a avaliação não.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_REVIEW_URL = 'https://g.page/r/CaQfC5axIQQIEBM/review'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = (url.searchParams.get('t') || '').trim()

  let destino = GOOGLE_REVIEW_URL
  try {
    if (token) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      const { data } = await admin.rpc('register_google_review_click', { p_token: token })
      const row = Array.isArray(data) ? data[0] : data
      if (row?.redirect_url) destino = row.redirect_url
    }
  } catch (e) {
    console.error('[go-review] registro falhou, seguindo pro Google mesmo assim', e)
  }

  return new Response(null, {
    status: 302,
    headers: { Location: destino, 'Cache-Control': 'no-store' },
  })
})
