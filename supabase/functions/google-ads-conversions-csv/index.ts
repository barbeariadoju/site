// Serve as conversões offline como CSV para o Google Ads buscar sozinho (Data Manager,
// fonte HTTPS) ou para download manual quando for preciso conferir na mão.
//
// Fecha a última seta do circuito: Google -> gclid -> WhatsApp -> JuIA -> agendamento -> Google.
// Sem isso o algoritmo só aprende com pedido de rota e clique, que era a única coisa que ele
// conseguia medir (23 rotas contra 1 agendamento nos 30 dias até 02/09).
//
// SEM JWT de propósito: o Google não manda Authorization do Supabase.
//
// DUAS FORMAS DE AUTENTICAR, e a primeira existe porque o formulário do Google exige:
//   1. HTTP Basic — usuário ADS_CSV_USER e senha ADS_CSV_TOKEN. O campo "Senha" da tela
//      "Conectar com HTTPS" é obrigatório, então token na querystring não bastava.
//   2. Token direto — header x-ads-token ou ?token=, para conferir na mão com curl.
// As duas conferem o segredo em tempo constante.
//
// O formato do CSV mora em _shared/ads-csv.ts, com teste em tests/unit/ads-csv.spec.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { montarCsvAds } from '../_shared/ads-csv.ts'

// Comparação que não vaza pelo tempo de resposta o tamanho do prefixo correto.
const iguaisEmTempoConstante = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

// "Basic dXN1YXJpbzpzZW5oYQ==" -> { user, pass }. Devolve null pra qualquer coisa torta.
const lerBasic = (header: string | null): { user: string; pass: string } | null => {
  if (!header) return null
  const m = /^Basic\s+(.+)$/i.exec(header.trim())
  if (!m) return null
  try {
    const cru = atob(m[1].trim())
    const corte = cru.indexOf(':')
    if (corte < 0) return null
    return { user: cru.slice(0, corte), pass: cru.slice(corte + 1) }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const senhaEsperada = Deno.env.get('ADS_CSV_TOKEN') || ''
  const usuarioEsperado = Deno.env.get('ADS_CSV_USER') || ''
  if (!senhaEsperada || !usuarioEsperado) {
    console.error('[google-ads-conversions-csv] ADS_CSV_TOKEN ou ADS_CSV_USER não configurado')
    return new Response('nao configurado', { status: 500 })
  }

  const url = new URL(req.url)
  const basic = lerBasic(req.headers.get('authorization'))
  const porBasic = basic !== null &&
    iguaisEmTempoConstante(basic.user, usuarioEsperado) &&
    iguaisEmTempoConstante(basic.pass, senhaEsperada)
  const tokenSolto = (req.headers.get('x-ads-token') || url.searchParams.get('token') || '').trim()
  const porToken = tokenSolto.length > 0 && iguaisEmTempoConstante(tokenSolto, senhaEsperada)

  if (!porBasic && !porToken) {
    // WWW-Authenticate faz o Google (e o curl) saberem que Basic é aceito aqui.
    return new Response('nao autorizado', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="conversoes"' },
    })
  }

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

    const linhas = (data ?? []) as Array<Record<string, unknown>>

    // O Google recusa conectar uma fonte que só tem cabeçalho: "Falha ao determinar o tipo
    // de dados ou o esquema da fonte de dados... pelo menos uma linha de dados válidos"
    // (04/09/2026, na etapa "Selecionar dados"). Enquanto não existir conversão real, sai
    // uma linha de exemplo só para ele aprender o formato das colunas.
    //
    // O código de clique é sintético de propósito: o Google descarta linha cujo gclid ele
    // não reconhece, então isso NÃO vira conversão nem mexe no aprendizado da campanha —
    // aparece no relatório de importação como linha ignorada, e só.
    //
    // Não precisa de ninguém para remover depois: no primeiro agendamento de verdade a
    // view devolve dados e o exemplo some sozinho.
    const EXEMPLO_ENQUANTO_VAZIO = {
      'Google Click ID': 'CjwKCAiA0000EXEMPLO0000SEM0000CLIQUE0000REAL',
      'WBRAID': '',
      'GBRAID': '',
      'Conversion Name': 'Agendamento confirmado (WhatsApp)',
      'Conversion Time': new Date(Date.now() - 864e5).toISOString().slice(0, 19).replace('T', ' ') + '-03:00',
      'Conversion Value': '0.00',
      'Conversion Currency': 'BRL',
    }
    const corpo = linhas.length ? linhas : [EXEMPLO_ENQUANTO_VAZIO]

    const csv = montarCsvAds(corpo)
    console.log(`[google-ads-conversions-csv] ${linhas.length} conversao(oes) reais por ${porBasic ? 'basic' : 'token'}${linhas.length ? '' : ' (servindo linha de exemplo)'}`)

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
