import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string, timeoutMs = 20000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: controller.signal })
    return await r.json().catch(() => ({}))
  } finally {
    clearTimeout(timeout)
  }
}

const GRAPH_VERSION = 'v23.0'

// Métricas confirmadas válidas via chamada real em 04/08/2026 — a Meta descontinuou
// quase todas as métricas antigas de impressões/alcance de Página (page_impressions,
// page_fans etc. dão "must be a valid insights metric"). Reconferir se a API mudar nomes
// de novo (rodar as métricas uma a uma via GET /{page-id}/insights?metric=X pra isolar
// qual quebrou, o erro em lote não diz qual é o problema).
const PAGE_METRICS = ['page_post_engagements', 'page_views_total', 'page_follows']
const IG_METRICS = ['reach', 'accounts_engaged', 'total_interactions', 'profile_views']

const sumMetric = (data: any[], metric: string): number => {
  const entry = data.find((d: any) => d.name === metric)
  const values = entry?.values || []
  return values.reduce((total: number, v: any) => total + (typeof v.value === 'number' ? v.value : 0), 0)
}

const METRIC_LABEL: Record<string, string> = {
  page_post_engagements: 'Interações com posts da Página',
  page_views_total: 'Visitas à Página',
  page_follows: 'Novos seguidores (Facebook)',
  reach: 'Contas alcançadas (Instagram)',
  accounts_engaged: 'Contas engajadas (Instagram)',
  total_interactions: 'Interações totais (Instagram)',
  profile_views: 'Visitas ao perfil (Instagram)',
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#d4af37;color:#111;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:9px;margin:5px">${label}</a>`

// JuIA Social — Fase 3 (v28.53.0): relatório semanal de Insights (Facebook + Instagram)
// via Meta Graph API, mandado por e-mail toda segunda de manhã. Só leitura — nunca
// publica nem altera nada, apenas resume a semana anterior pro Juliano acompanhar.
Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL')
    const pageToken = requiredSecret('META_PAGE_ACCESS_TOKEN')
    const pageId = requiredSecret('META_PAGE_ID')
    const igId = requiredSecret('META_IG_USER_ID')
    const emailSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim()

    const until = Math.floor(Date.now() / 1000)
    const since = until - 7 * 24 * 60 * 60

    const pageInsights = await fetchWithTimeout(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/insights?metric=${PAGE_METRICS.join(',')}&period=day&since=${since}&until=${until}&access_token=${pageToken}`,
    )
    const igInsights = await fetchWithTimeout(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/insights?metric=${IG_METRICS.join(',')}&period=day&since=${since}&until=${until}&access_token=${pageToken}`,
    )
    const igProfile = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}?fields=followers_count,media_count&access_token=${pageToken}`)

    const pageData = Array.isArray(pageInsights?.data) ? pageInsights.data : []
    const igData = Array.isArray(igInsights?.data) ? igInsights.data : []

    const rows: { label: string; value: number }[] = [
      ...PAGE_METRICS.map((m) => ({ label: METRIC_LABEL[m], value: sumMetric(pageData, m) })),
      ...IG_METRICS.map((m) => ({ label: METRIC_LABEL[m], value: sumMetric(igData, m) })),
    ]

    const sinceLabel = new Date(since * 1000).toLocaleDateString('pt-BR')
    const untilLabel = new Date(until * 1000).toLocaleDateString('pt-BR')

    const rowsHtml = rows.map((r) => `<tr><td style="padding:8px 0;color:#444">${r.label}</td><td style="padding:8px 0;text-align:right;font-weight:700">${r.value.toLocaleString('pt-BR')}</td></tr>`).join('')
    const followersLine = typeof igProfile?.followers_count === 'number'
      ? `<p style="color:#666;font-size:14px">Seguidores no Instagram hoje: <strong>${igProfile.followers_count.toLocaleString('pt-BR')}</strong> (${igProfile.media_count || 0} publicações no total)</p>`
      : ''

    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f2f2;font-family:Arial,sans-serif;color:#222">
<table width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#10131d;color:#fff;padding:26px;text-align:center"><div style="font-size:28px">📊</div><div style="font-size:20px;font-weight:bold">Relatório semanal — Barbearia do Ju</div></td></tr>
<tr><td style="padding:30px">
<p style="font-size:15px;color:#666">Período: ${sinceLabel} a ${untilLabel}</p>
<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rowsHtml}</table>
${followersLine}
<div style="text-align:center;margin:24px 0">${button('https://business.facebook.com/latest/insights', 'Ver mais no Meta Business Suite')}</div>
</td></tr>
</table></td></tr></table></body></html>`

    if (emailSecret) {
      await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-email`, 20000).catch(() => {})
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': emailSecret },
        body: JSON.stringify({
          to: 'contato@barbeariadoju.com.br',
          subject: `📊 Relatório semanal de redes sociais — ${sinceLabel} a ${untilLabel}`,
          html,
        }),
      }).catch((error) => console.error('[meta-insights-weekly] email', error))
    }

    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret) {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({ custom: { title: '📊 Relatório semanal de redes sociais', body: `${sinceLabel} a ${untilLabel} — confira no seu e-mail.`, url: 'https://business.facebook.com/latest/insights', tag: `insights-weekly-${untilLabel}` } }),
      }).catch(() => {})
    }

    return json({ ok: true, period: { since: sinceLabel, until: untilLabel }, rows })
  } catch (error) {
    console.error('[meta-insights-weekly]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
