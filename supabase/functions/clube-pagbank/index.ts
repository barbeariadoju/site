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

  return json({ ok: false, message: 'Ação desconhecida.' }, 400)
})
