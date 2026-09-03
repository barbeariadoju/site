// Serve as conversões offline como CSV para o Google Ads buscar sozinho (Data Manager,
// fonte HTTPS) ou para download manual quando for preciso conferir na mão.
//
// Fecha a última seta do circuito: Google -> gclid -> WhatsApp -> JuIA -> agendamento -> Google.
// Sem isso o algoritmo só aprende com pedido de rota e clique, que era a única coisa que ele
// conseguia medir (23 rotas contra 1 agendamento nos 30 dias até 02/09).
//
// SEM JWT de propósito: o Data Manager do Google não manda Authorization do Supabase.
// A proteção é o ADS_CSV_TOKEN, conferido em tempo constante e aceito por header ou
// querystring (o Data Manager só permite URL simples, daí o ?token=).
//
// O formato do CSV mora em _shared/ads-csv.ts, com teste em tests/unit/ads-csv.spec.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { montarCsvAds } from '../_shared/ads-csv.ts'

// Comparação que não vaza pelo tempo de resposta o tamanho do prefixo correto.
const tokensIguais = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const esperado = Deno.env.get('ADS_CSV_TOKEN') || ''
  if (!esperado) {
    console.error('[google-ads-conversions-csv] ADS_CSV_TOKEN não configurado')
    return new Response('nao configurado', { status: 500 })
  }

  const url = new URL(req.url)
  const recebido = (req.headers.get('x-ads-token') || url.searchParams.get('token') || '').trim()
  if (!tokensIguais(recebido, esperado)) return new Response('nao autorizado', { status: 401 })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await admin
      .from('google_ads_offline_conversions')
      .select('*')
      .order('Conversion Time', { ascending: true })

    if (error) {
      console.error('[google-ads-conversions-csv]', error)
      return new Response('erro ao ler', { status: 500 })
    }

    const csv = montarCsvAds((data ?? []) as Array<Record<string, unknown>>)
    console.log(`[google-ads-conversions-csv] ${(data ?? []).length} conversao(oes) servida(s)`)

    return new Response(req.method === 'HEAD' ? null : csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="conversoes-offline-barbearia-do-ju.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[google-ads-conversions-csv] fatal', e)
    return new Response('erro', { status: 500 })
  }
})
