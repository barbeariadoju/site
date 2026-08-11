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
// v29.13.0 (11/08/2026) — BUG REAL no primeiro relatório de verdade (segunda 10/08): ele
// informou "Novos seguidores (Facebook): 35" numa semana em que a Página tem 5 seguidores
// no TOTAL. A causa: `page_follows` é uma métrica ACUMULADA (o total de seguidores naquele
// dia), e o código somava os 7 dias — 5 × 7 = 35. Trocada por `page_daily_follows`, que é
// de fato o ganho do dia e pode ser somada. Regra geral pra não repetir: antes de somar uma
// métrica da Meta, confirmar se ela é do dia ou um total acumulado.
const PAGE_METRICS = ['page_post_engagements', 'page_views_total', 'page_daily_follows']
// v28.55.3 (05/08/2026) — BUG REAL, achado antes do primeiro envio de verdade: as 4 métricas
// do Instagram eram pedidas num LOTE só, e 3 delas (accounts_engaged, total_interactions,
// profile_views) exigem `metric_type=total_value`. Sem esse parâmetro a Meta devolve HTTP 400
// pro lote INTEIRO — então nem `reach` (que sozinha funcionaria) vinha. Como o código tratava
// resposta sem `data` como array vazio, o relatório mostrava ZERO em tudo do Instagram,
// silenciosamente. O primeiro relatório (segunda 10/08) ia dizer que o Instagram teve zero de
// alcance/engajamento na semana, quando o real era 74-77 contas alcançadas por dia e 27
// visitas ao perfil. Agora cada métrica é pedida SEPARADAMENTE (uma falha não derruba as
// outras) e sempre com metric_type=total_value, formato que a API aceita nas quatro.
const IG_METRICS = ['reach', 'accounts_engaged', 'total_interactions', 'profile_views']

const sumMetric = (data: any[], metric: string): number => {
  const entry = data.find((d: any) => d.name === metric)
  const values = entry?.values || []
  return values.reduce((total: number, v: any) => total + (typeof v.value === 'number' ? v.value : 0), 0)
}

// Aceita os dois formatos que a Graph API usa: `total_value.value` (metric_type=total_value)
// e a série `values[]` por dia (formato antigo). Devolve null quando a métrica não veio —
// null vira "indisponível" no e-mail, nunca 0: número zero falso é pior que dado ausente,
// porque parece resultado ruim de marketing quando na verdade é falha técnica.
const readMetric = (payload: any, metric: string): number | null => {
  const data = Array.isArray(payload?.data) ? payload.data : []
  const entry = data.find((d: any) => d?.name === metric)
  if (!entry) return null
  if (typeof entry?.total_value?.value === 'number') return entry.total_value.value
  if (Array.isArray(entry?.values)) {
    return entry.values.reduce((t: number, v: any) => t + (typeof v?.value === 'number' ? v.value : 0), 0)
  }
  return null
}

const METRIC_LABEL: Record<string, string> = {
  page_post_engagements: 'Interações com posts da Página',
  page_views_total: 'Visitas à Página',
  page_daily_follows: 'Novos seguidores (Facebook)',
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

  // v28.55.3: modo de teste. Sem isso, qualquer verificação da função mandava e-mail e push
  // de verdade pro Juliano (aconteceu na auditoria de 05/08 — ele recebeu um relatório de
  // teste sem querer). Com "dry_run":true no corpo, calcula tudo e devolve os números na
  // resposta, sem enviar nada.
  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true

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
    // Uma chamada por métrica: se a Meta rejeitar uma (mudança de nome/formato, que já
    // aconteceu duas vezes), as outras continuam chegando em vez de zerar o relatório todo.
    const igResults = await Promise.all(
      IG_METRICS.map(async (m) => {
        const payload = await fetchWithTimeout(
          `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/insights?metric=${m}&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${pageToken}`,
        )
        if (payload?.error) console.error('[meta-insights-weekly] ig metric falhou', m, JSON.stringify(payload.error).slice(0, 300))
        return { metric: m, value: readMetric(payload, m) }
      }),
    )
    const igProfile = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}?fields=followers_count,media_count&access_token=${pageToken}`)

    const pageData = Array.isArray(pageInsights?.data) ? pageInsights.data : []
    if (pageInsights?.error) console.error('[meta-insights-weekly] page insights falhou', JSON.stringify(pageInsights.error).slice(0, 300))

    const rows: { label: string; value: number | null }[] = [
      ...PAGE_METRICS.map((m) => ({
        label: METRIC_LABEL[m],
        value: pageData.some((d: any) => d?.name === m) ? sumMetric(pageData, m) : null,
      })),
      ...igResults.map((r) => ({ label: METRIC_LABEL[r.metric], value: r.value })),
    ]
    const failedMetrics = rows.filter((r) => r.value === null).map((r) => r.label)

    const sinceLabel = new Date(since * 1000).toLocaleDateString('pt-BR')
    const untilLabel = new Date(until * 1000).toLocaleDateString('pt-BR')

    const rowsHtml = rows.map((r) => {
      const cell = r.value === null
        ? '<span style="color:#a00;font-weight:600">indisponível</span>'
        : r.value.toLocaleString('pt-BR')
      return `<tr><td style="padding:8px 0;color:#444">${r.label}</td><td style="padding:8px 0;text-align:right;font-weight:700">${cell}</td></tr>`
    }).join('')
    const warningHtml = failedMetrics.length
      ? `<p style="background:#fff3f3;border-left:4px solid #a00;padding:10px 12px;font-size:13px;color:#a00;margin:14px 0">A Meta não devolveu ${failedMetrics.length === 1 ? 'esta métrica' : 'estas métricas'} desta vez: ${failedMetrics.join(', ')}. Isso é falha técnica da API, não resultado zero.</p>`
      : ''
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
${warningHtml}
${followersLine}
<div style="text-align:center;margin:24px 0">${button('https://business.facebook.com/latest/insights', 'Ver mais no Meta Business Suite')}</div>
</td></tr>
</table></td></tr></table></body></html>`

    if (emailSecret && !dryRun) {
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
    if (pushSecret && !dryRun) {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({ custom: { title: '📊 Relatório semanal de redes sociais', body: `${sinceLabel} a ${untilLabel} — confira no seu e-mail.`, url: 'https://business.facebook.com/latest/insights', tag: `insights-weekly-${untilLabel}` } }),
      }).catch(() => {})
    }

    return json({
      ok: true,
      dry_run: dryRun,
      period: { since: sinceLabel, until: untilLabel },
      rows,
      failed_metrics: failedMetrics,
      followers_count: igProfile?.followers_count ?? null,
    })
  } catch (error) {
    console.error('[meta-insights-weekly]', error)
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
