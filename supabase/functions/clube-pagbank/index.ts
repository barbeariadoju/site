// v29.233.0 — Clube do Ju: operações de bastidor com a API de Pagamentos Recorrentes do PagBank
// (api.assinaturas.pagseguro.com). Só o backend chama (chave service_role exata): nenhuma ação daqui
// é exposta ao navegador. O token é o mesmo PAGBANK_TOKEN do Checkout (a doc confirma: não existe
// token separado para assinaturas); o que muda é o endereço e a liberação da conta.
//
// Ações:
//   ping          — confere se a recorrência responde para a conta (GET /plans e GET /public-keys)
//   setup         — cria/atualiza a chave pública da recorrência, as preferências de notificação
//                   (webhook) e a política de retentativa. Idempotente.
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

// Sandbox: só para a homologação (o PagBank pede os logs de request/response do sandbox) e testes.
let sandbox = false
const base = () => sandbox ? 'https://sandbox.api.assinaturas.pagseguro.com' : (Deno.env.get('PAGBANK_SUBS_BASE') || 'https://api.assinaturas.pagseguro.com')
const token = () => sandbox ? Deno.env.get('PAGBANK_SANDBOX_TOKEN') : Deno.env.get('PAGBANK_TOKEN')

async function pb(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let data: unknown = text
  try { data = JSON.parse(text) } catch { /* texto cru */ }
  return { status: r.status, data }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405)
  const tok = String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const envKey = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  // Mesma régua do ju-ia-site: a chave exata do ambiente, ou um JWT com role service_role (o gateway
  // já validou a assinatura, verify_jwt=true).
  const roleDoJwt = (() => {
    try {
      const seg = tok.split('.')[1] || ''
      const b64 = seg.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - seg.length % 4) % 4)
      return String(JSON.parse(atob(b64))?.role || '')
    } catch { return '' }
  })()
  if (!tok || !((envKey && tok === envKey) || roleDoJwt === 'service_role')) return json({ ok: false, message: 'Não autorizado.' }, 401)
  if (!Deno.env.get('PAGBANK_TOKEN')) return json({ ok: false, message: 'PAGBANK_TOKEN ausente.' }, 500)

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  sandbox = body.sandbox === true

  if (action === 'ping') {
    const plans = await pb('GET', '/plans?limit=5')
    const key = await pb('GET', '/public-keys')
    const prefs = await pb('GET', '/preferences/notifications')
    return json({
      ok: true,
      plans: { status: plans.status, sample: typeof plans.data === 'string' ? plans.data.slice(0, 300) : plans.data },
      public_key: { status: key.status, has_key: Boolean((key.data as any)?.public_key) },
      notifications: { status: prefs.status, data: prefs.data },
    })
  }

  // Chave pública da recorrência (para criptografar o cartão no navegador). Cria se não existir.
  if (action === 'public_key') {
    let key = await pb('GET', '/public-keys')
    if (!(key.data as any)?.public_key) key = await pb('PUT', '/public-keys')
    return json({ ok: key.status < 300, sandbox, public_key: (key.data as any)?.public_key || null, status: key.status })
  }

  // Fluxo completo de teste (homologação): plano → assinatura com assinante novo e cartão criptografado →
  // consulta da assinatura e das faturas → cancelamento. Devolve cada request/response (o PagBank pede
  // esses logs no chamado). Só roda no sandbox.
  if (action === 'fluxo_teste') {
    if (!sandbox) return json({ ok: false, message: 'Fluxo de teste só no sandbox.' }, 400)
    const encrypted = String(body.encrypted || '')
    if (!encrypted) return json({ ok: false, message: 'Faltou o cartão criptografado.' }, 400)
    const log: unknown[] = []
    const call = async (method: string, path: string, reqBody?: unknown) => {
      const r = await pb(method, path, reqBody)
      log.push({ method, url: `${base()}${path}`, request: reqBody ?? null, status: r.status, response: r.data })
      return r
    }
    const sufixo = Date.now().toString(36)
    const plano = await call('POST', '/plans', {
      reference_id: `clube-corte-homolog-${sufixo}`, name: 'Clube Corte (homologação)', description: '2 cortes por mês — Clube do Ju',
      amount: { value: 8500, currency: 'BRL' }, interval: { unit: 'MONTH', length: 1 }, payment_method: ['CREDIT_CARD'],
    })
    const planId = (plano.data as any)?.id
    if (!planId) return json({ ok: false, etapa: 'plano', log })
    const assin = await call('POST', '/subscriptions', {
      reference_id: `CJ-HOMOLOG-${sufixo}`,
      plan: { id: planId },
      customer: {
        reference_id: `cli-homolog-${sufixo}`, name: 'Cliente Teste Homologacao', email: `teste.homolog.${sufixo}@example.com`,
        tax_id: '12345678909', phones: [{ country: '55', area: '11', number: '999999999' }],
        billing_info: [{ type: 'CREDIT_CARD', card: { encrypted } }],
      },
      payment_method: [{ type: 'CREDIT_CARD', card: { security_code: '123' } }],
      pro_rata: false,
    })
    const subId = (assin.data as any)?.id
    if (subId) {
      await call('GET', `/subscriptions/${subId}`)
      await call('GET', `/subscriptions/${subId}/invoices`)
      if (body.cancelar !== false) await call('PUT', `/subscriptions/${subId}/cancel`)
    }
    return json({ ok: Boolean(subId), plan_id: planId, subscription_id: subId || null, log })
  }

  // Webhook e retentativas da recorrência (produção, depois da liberação; no sandbox para o teste).
  if (action === 'setup') {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`
    const notif = await pb('PUT', '/preferences/notifications', { urls: [url], email: { merchant: { enabled: true }, customer: { enabled: false } } })
    const retry = await pb('PUT', '/preferences/retries', { first_try: '3', second_try: '5', third_try: '7', finally: 'SUSPEND' })
    return json({ ok: notif.status < 300 && retry.status < 300, sandbox, notificacoes: { status: notif.status, data: notif.data }, retentativas: { status: retry.status, data: retry.data } })
  }

  return json({ ok: false, message: 'Ação desconhecida.' }, 400)
})
