// v29.13.0 (11/08/2026) — leitura sob demanda dos números do Instagram/Facebook usando o
// token de usuário do sistema (META_SYSTEM_TOKEN, criado nesta data). Existe para eu
// consultar o desempenho na hora, sem depender de print do Juliano e sem esperar o
// relatório semanal do meta-insights-weekly.
//
// Só LÊ. Não publica, não responde, não gasta. A autorização é a mesma dos outros
// endpoints internos: header x-webhook-secret com o EMAIL_WEBHOOK_SECRET.
//
// Também grava um ponto em social_followers_snapshot quando chamado com {"snapshot":true},
// pra a série histórica de seguidores continuar crescendo (migration 102).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH = 'v23.0'
const IG_USER_ID = '17841480530970097' // @barbeariadoju_
const PAGE_ID = '1043604585499493'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

Deno.serve(async (req: Request) => {
  const esperado = Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim() || ''
  if (!esperado || req.headers.get('x-webhook-secret') !== esperado) return json({ error: 'Não autorizado.' }, 401)

  const token = Deno.env.get('META_SYSTEM_TOKEN')?.trim()
  if (!token) return json({ error: 'META_SYSTEM_TOKEN ausente.' }, 500)

  const { dias = 7, snapshot = false, media_id = '' } = await req.json().catch(() => ({}))

  // v29.87.0 (28/08): métricas de UMA publicação específica (ex.: views de um Reel).
  // Chamada: {"media_id":"<ig media id>"} → campos da mídia + insights por métrica
  // (uma chamada por métrica, mesma razão do relatório semanal: lote com métrica
  // inválida derruba o lote inteiro; métrica que falha vira "indisponível").
  if (media_id) {
    const g = async (path: string) => {
      try {
        const r = await fetch(`https://graph.facebook.com/${GRAPH}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
        const body = await r.json()
        return r.ok ? body : { erro: body?.error?.message || `HTTP ${r.status}` }
      } catch (e) { return { erro: e instanceof Error ? e.message : String(e) } }
    }
    const midia = await g(`${media_id}?fields=caption,timestamp,media_type,media_product_type,like_count,comments_count,permalink`)
    const metricas = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time']
    const insights: Record<string, unknown> = {}
    for (const m of metricas) {
      const d = await g(`${media_id}/insights?metric=${m}`)
      if ((d as any)?.erro) { insights[m] = { valor: 'indisponível', motivo: (d as any).erro }; continue }
      const row = (d as any)?.data?.[0]
      insights[m] = { valor: row?.total_value?.value ?? row?.values?.[0]?.value ?? 0 }
    }
    return json({ midia, insights })
  }
  const ate = Math.floor(Date.now() / 1000)
  const desde = ate - Number(dias) * 86400

  const get = async (path: string) => {
    try {
      const r = await fetch(`https://graph.facebook.com/${GRAPH}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
      const body = await r.json()
      return r.ok ? body : { erro: body?.error?.message || `HTTP ${r.status}` }
    } catch (e) { return { erro: e instanceof Error ? e.message : String(e) } }
  }

  // Uma chamada por métrica, de propósito: a Meta rejeita o lote inteiro quando uma única
  // métrica do lote é inválida — foi assim que o relatório semanal reportou zero em tudo
  // no primeiro envio (v28.56.0). Métrica que falha vira "indisponível", nunca 0.
  const metrica = async (nome: string, extra = '') => {
    const d = await get(`${IG_USER_ID}/insights?metric=${nome}&period=day&since=${desde}&until=${ate}${extra}`)
    if ((d as any)?.erro) return { valor: 'indisponível', motivo: (d as any).erro }
    const linhas = (d as any)?.data?.[0]?.values || []
    if ((d as any)?.data?.[0]?.total_value) return { valor: (d as any).data[0].total_value.value }
    return { valor: linhas.reduce((a: number, v: any) => a + Number(v.value || 0), 0) }
  }

  const perfil = await get(`${IG_USER_ID}?fields=username,followers_count,follows_count,media_count`)
  const [alcance, visitas, engajadas, interacoes] = await Promise.all([
    metrica('reach'),
    metrica('profile_views', '&metric_type=total_value'),
    metrica('accounts_engaged', '&metric_type=total_value'),
    metrica('total_interactions', '&metric_type=total_value'),
  ])
  const ultimos = await get(`${IG_USER_ID}/media?fields=caption,timestamp,like_count,comments_count,media_type,permalink&limit=5`)

  if (snapshot && (perfil as any)?.followers_count) {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    await admin.from('social_followers_snapshot').insert({
      platform: 'instagram',
      followers: (perfil as any).followers_count,
      following: (perfil as any).follows_count ?? null,
      note: 'coletado via META_SYSTEM_TOKEN (leitura automática)',
    })
  }

  return json({ periodo_dias: dias, perfil, alcance, visitas_ao_perfil: visitas, contas_engajadas: engajadas, interacoes, ultimas_publicacoes: ultimos })
})
