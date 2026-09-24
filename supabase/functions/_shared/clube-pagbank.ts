// v29.233.0 — Clube do Ju: peças comuns às functions clube, clube-ciclo e pagbank-webhook.
// Cobrança por link do Checkout PagBank (Pix, crédito e débito à vista), o mesmo produto que já roda
// em produção para o pagamento antecipado do agendamento. A referência "CLB-<código>-<n>" é o que o
// pagbank-webhook usa para saber que o pagamento é do Clube.
import { semEmoji } from './sem-emoji.ts'

const SITE = 'https://www.barbeariadoju.com.br'

export const digitsOf = (s: unknown) => String(s || '').replace(/\D/g, '')
export const toWhatsNumber = (raw: string) => {
  const d = digitsOf(raw)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}
export const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('')
export const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const somaMeses = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}
export const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
// Fim do ciclo = véspera do mesmo dia no mês seguinte (mesma conta do banco: club_cycle_start_for).
export const fimDoCiclo = (inicio: string) => somaDias(somaMeses(inicio, 1), -1)
// Ciclos contados sempre a partir da âncora (1º pagamento), como o banco faz: âncora 31/01 dá ciclos
// 28/02, 31/03, 30/04… — somar um mês ao início de cada ciclo faria a data escorregar (28/03, 28/04…).
export const fimDoCicloAncorado = (ancora: string, inicio: string) => {
  let k = 1
  while (k < 600 && somaMeses(ancora, k) < inicio) k++
  return somaDias(somaMeses(ancora, k + 1), -1)
}
// Token do link "Minha assinatura": HMAC do código com um segredo só deste uso (CLUBE_TOKEN_SECRET).
// Não precisa ser guardado — o banco guarda só o hash — e qualquer function consegue refazer o link.
export const tokenDoCodigo = async (code: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('CLUBE_TOKEN_SECRET') || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`clube:${code}`))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}
export const linkGerenciar = (code: string, token: string) =>
  `${SITE}/clube/minha-assinatura/?c=${encodeURIComponent(code)}&t=${encodeURIComponent(token)}`

export async function criarCheckoutClube(opts: {
  reference: string; amountCents: number; descricao: string; redirectUrl: string; horasValidade?: number
}): Promise<{ ok: true; payUrl: string; checkoutId: string | null; expiresAt: string } | { ok: false; message: string }> {
  const token = Deno.env.get('PAGBANK_TOKEN')
  if (!token) return { ok: false, message: 'Pagamento online indisponível agora.' }
  const base = Deno.env.get('PAGBANK_API_BASE') || 'https://api.pagseguro.com'
  const expiresAt = new Date(Date.now() + (opts.horasValidade || 24) * 60 * 60 * 1000)
  const payload = {
    reference_id: opts.reference,
    expiration_date: expiresAt.toISOString(),
    customer_modifiable: true,
    items: [{ reference_id: opts.reference, name: opts.descricao.slice(0, 100), quantity: 1, unit_amount: opts.amountCents }],
    payment_methods: [{ type: 'PIX' }, { type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }],
    payment_methods_configs: [{ type: 'CREDIT_CARD', config_options: [{ option: 'INSTALLMENTS_LIMIT', value: '1' }] }],
    notification_urls: [`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`],
    redirect_url: opts.redirectUrl,
  }
  const r = await fetch(`${base}/checkouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const resp = await r.json().catch(() => null)
  if (r.status !== 201 && r.status !== 200) {
    console.error('[clube] checkout', r.status, JSON.stringify(resp?.error_messages || resp).slice(0, 500))
    return { ok: false, message: 'Pagamento online indisponível agora.' }
  }
  const payUrl = (resp?.links || []).find((l: { rel?: string }) => String(l?.rel || '').toUpperCase() === 'PAY')?.href
  if (!payUrl) return { ok: false, message: 'Pagamento online indisponível agora.' }
  return { ok: true, payUrl, checkoutId: resp?.id || null, expiresAt: expiresAt.toISOString() }
}

// deno-lint-ignore no-explicit-any
export async function enviarWhats(admin: any, phone: string, texto: string, textoParaLog?: string) {
  const url = Deno.env.get('EVOLUTION_API_URL')
  const apikey = Deno.env.get('EVOLUTION_API_KEY')
  const instance = Deno.env.get('EVOLUTION_INSTANCE_NAME')
  const number = toWhatsNumber(phone)
  if (!url || !apikey || !instance || !number) return false
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify({ number, text: semEmoji(texto) }), signal: controller.signal,
    }).finally(() => clearTimeout(t))
    const sent = await res.json().catch(() => ({}))
    await admin.from('whatsapp_messages').insert({
      phone: number, direction: 'out', body: semEmoji(textoParaLog ?? texto), sent_by: 'bot',
      evolution_message_id: String(sent?.key?.id || '') || null,
    })
    return res.ok
  } catch (e) {
    console.error('[clube] whatsapp', e)
    return false
  }
}

export async function pushJuliano(titulo: string, corpo: string, tag: string) {
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!pushSecret || !supabaseUrl) return
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title: titulo, body: corpo, url: '/admin-clube.html?app=1', tag } }),
    })
  } catch (e) { console.error('[clube] push', e) }
}

// Cria os horários fixos da Cadeira Cativa dentro de um ciclo (não passa pela régua de antecedência:
// club.skip_lead). Usa a RPC club_cativa_book, que roda no banco com a trava ligada.
// deno-lint-ignore no-explicit-any
export async function marcarCativa(admin: any, subscriptionId: string, inicio: string, fim: string) {
  const { data, error } = await admin.rpc('club_cativa_book', { p_subscription: subscriptionId, p_from: inicio, p_to: fim })
  if (error) console.error('[clube] cativa', error)
  return data
}
