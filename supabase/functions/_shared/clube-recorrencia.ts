// v29.266.0 — Clube do Ju: cobrança automática no cartão (API de Pagamentos Recorrentes do PagBank,
// liberada em produção em 30/09/2026, chamado 1450423315).
//
// Como funciona:
//   - O navegador criptografa o cartão com a chave pública da recorrência (SDK oficial do PagBank,
//     servido do próprio site). Número do cartão nunca passa em claro por aqui; o CVV passa só para
//     ser repassado na 1ª cobrança (o PagBank exige) e nunca é gravado nem registrado.
//   - Cada assinatura ganha um plano próprio no PagBank (o Sob Medida tem preço variável) e a
//     assinatura "CJS-<código>". A 1ª fatura é cobrada na hora; as seguintes, pelo PagBank, todo mês.
//   - O sistema NÃO confia no aviso (webhook) do PagBank para dar baixa: a documentação não diz como
//     ele é assinado. O aviso só dispara sincronizarCartao, que pergunta à API (com o nosso token) quais
//     faturas estão pagas. A mesma conferência roda no clube-ciclo, então nada depende do aviso chegar.
//   - Toda chamada fica em club_pagbank_log, com cartão criptografado, CVV e CPF mascarados.
import { processarPagamentoClube } from './clube-ativacao.ts'
import { somaMeses, fimDoCicloAncorado, digitsOf } from './clube-pagbank.ts'

const base = () => Deno.env.get('PAGBANK_SUBS_BASE') || 'https://api.assinaturas.pagseguro.com'

// deno-lint-ignore no-explicit-any
const mascarar = (v: any): any => {
  if (Array.isArray(v)) return v.map(mascarar)
  if (!v || typeof v !== 'object') return v
  // deno-lint-ignore no-explicit-any
  const out: any = {}
  for (const [k, val] of Object.entries(v)) {
    if (k === 'encrypted' || k === 'security_code' || k === 'token') out[k] = '***'
    else if (k === 'tax_id') out[k] = String(val || '').replace(/^(\d{3})\d+(\d{2})$/, '$1******$2')
    else out[k] = mascarar(val)
  }
  return out
}

// deno-lint-ignore no-explicit-any
export async function pbSubs(admin: any, method: string, path: string, body?: unknown, code?: string) {
  const url = `${base()}${path}`
  let status = 0
  let data: unknown = null
  try {
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${Deno.env.get('PAGBANK_TOKEN')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    status = r.status
    const text = await r.text()
    data = text
    try { data = text ? JSON.parse(text) : null } catch { /* texto cru */ }
  } catch (e) {
    data = { erro_de_rede: String(e) }
  }
  try {
    await admin.from('club_pagbank_log').insert({ subscription_code: code || null, method, url, status, request: body === undefined ? null : mascarar(body), response: mascarar(data) })
  } catch (e) { console.error('[clube-recorrencia] log', e) }
  return { status, data }
}

let chaveCache: { key: string; at: number } | null = null
// deno-lint-ignore no-explicit-any
export async function chavePublica(admin: any): Promise<string | null> {
  if (chaveCache && Date.now() - chaveCache.at < 60 * 60 * 1000) return chaveCache.key
  // Leitura silenciosa (sem log): roda a cada carga da página /clube/.
  try {
    const r = await fetch(`${base()}/public-keys`, { headers: { Authorization: `Bearer ${Deno.env.get('PAGBANK_TOKEN')}`, Accept: 'application/json' } })
    const d = await r.json().catch(() => null)
    let key = d?.public_key ? String(d.public_key) : ''
    if (!key) {
      const c = await pbSubs(admin, 'PUT', '/public-keys')
      // deno-lint-ignore no-explicit-any
      key = String((c.data as any)?.public_key || '')
    }
    if (!key) return null
    chaveCache = { key, at: Date.now() }
    return key
  } catch (e) {
    console.error('[clube-recorrencia] public-keys', e)
    return null
  }
}

export const cpfValido = (raw: unknown) => {
  const c = digitsOf(raw)
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10])
}

const telefonePB = (phone: string) => {
  let d = digitsOf(phone)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return { country: '55', area: d.slice(0, 2), number: d.slice(2) }
}

// deno-lint-ignore no-explicit-any
const mensagemErro = (data: any) => {
  const msgs = Array.isArray(data?.error_messages) ? data.error_messages : []
  return msgs.map((m: { description?: string; parameter_name?: string }) => [m.description, m.parameter_name].filter(Boolean).join(' ')).join('; ').slice(0, 300)
}

// Cria plano + assinatura no PagBank e espera a 1ª fatura. Devolve 'paga' (ativa na hora), 'processando'
// (o clube-ciclo confirma depois) ou erro (nada fica cobrando: a assinatura é cancelada no PagBank).
export async function criarAssinaturaCartao(
  // deno-lint-ignore no-explicit-any
  admin: any,
  opts: {
    code: string; nomePlano: string; valorCents: number; nome: string; email: string; phone: string; cpf: string
    encrypted: string; cvv: string
  },
): Promise<
  | { ok: true; situacao: 'paga' | 'processando'; subscriptionId: string; planId: string; invoiceId: string | null; brand: string | null; last4: string | null }
  | { ok: false; recusado: boolean; mensagem: string }
> {
  const plano = await pbSubs(admin, 'POST', '/plans', {
    reference_id: `clube-${opts.code}`, name: `Clube do Ju - ${opts.nomePlano}`.slice(0, 65), description: `Assinatura ${opts.code}`,
    amount: { value: opts.valorCents, currency: 'BRL' }, interval: { unit: 'MONTH', length: 1 }, payment_method: ['CREDIT_CARD'],
  }, opts.code)
  // deno-lint-ignore no-explicit-any
  const planId = String((plano.data as any)?.id || '')
  if (!planId) return { ok: false, recusado: false, mensagem: `plano: HTTP ${plano.status} ${mensagemErro(plano.data)}` }

  const assin = await pbSubs(admin, 'POST', '/subscriptions', {
    reference_id: `CJS-${opts.code}`,
    plan: { id: planId },
    customer: {
      reference_id: `cli-${opts.code}`, name: opts.nome, email: opts.email, tax_id: digitsOf(opts.cpf),
      phones: [telefonePB(opts.phone)],
      billing_info: [{ type: 'CREDIT_CARD', card: { encrypted: opts.encrypted } }],
    },
    payment_method: [{ type: 'CREDIT_CARD', card: { security_code: opts.cvv } }],
    pro_rata: false,
  }, opts.code)
  // deno-lint-ignore no-explicit-any
  const s = assin.data as any
  const subscriptionId = String(s?.id || '')
  if (!subscriptionId) {
    await pbSubs(admin, 'PUT', `/plans/${planId}/inactivate`, undefined, opts.code)
    const m = mensagemErro(s)
    return { ok: false, recusado: assin.status >= 400 && assin.status < 500, mensagem: `assinatura: HTTP ${assin.status} ${m}` }
  }
  const card = Array.isArray(s?.payment_method) ? s.payment_method.find((p: { type?: string }) => p?.type === 'CREDIT_CARD')?.card : null
  const brand = card?.brand ? String(card.brand) : null
  const last4 = card?.last_digits ? String(card.last_digits) : null

  // 1ª fatura: normalmente já vem paga; espera até ~8 s se estiver processando.
  let invoice: { id?: string; status?: string } | null = null
  for (let i = 0; i < 4; i++) {
    const inv = await pbSubs(admin, 'GET', `/subscriptions/${subscriptionId}/invoices`, undefined, opts.code)
    // deno-lint-ignore no-explicit-any
    const lista = Array.isArray((inv.data as any)?.invoices) ? (inv.data as any).invoices : []
    invoice = lista.find((x: { occurrence?: number }) => Number(x?.occurrence) === 1) || lista[0] || null
    const st = String(invoice?.status || '').toUpperCase()
    if (st === 'PAID') return { ok: true, situacao: 'paga', subscriptionId, planId, invoiceId: invoice?.id || null, brand, last4 }
    if (['UNPAID', 'DECLINED', 'CANCELED', 'CANCELLED', 'OVERDUE'].includes(st) || ['SUSPENDED', 'CANCELED', 'OVERDUE'].includes(String(s?.status || '').toUpperCase())) {
      await pbSubs(admin, 'PUT', `/subscriptions/${subscriptionId}/cancel`, undefined, opts.code)
      return { ok: false, recusado: true, mensagem: `fatura ${st || '-'} / assinatura ${s?.status || '-'}` }
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return { ok: true, situacao: 'processando', subscriptionId, planId, invoiceId: invoice?.id || null, brand, last4 }
}

// deno-lint-ignore no-explicit-any
export async function cancelarNoPagBank(admin: any, sub: { id: string; code: string; pagbank_subscription_id: string | null; pagbank_cancelled_at?: string | null }) {
  if (!sub.pagbank_subscription_id || sub.pagbank_cancelled_at) return true
  const r = await pbSubs(admin, 'PUT', `/subscriptions/${sub.pagbank_subscription_id}/cancel`, undefined, sub.code)
  // 204 = cancelou; 4xx com a assinatura já cancelada também serve (conferido abaixo).
  let ok = r.status >= 200 && r.status < 300
  if (!ok) {
    const g = await pbSubs(admin, 'GET', `/subscriptions/${sub.pagbank_subscription_id}`, undefined, sub.code)
    // deno-lint-ignore no-explicit-any
    ok = ['CANCELED', 'CANCELLED', 'EXPIRED'].includes(String((g.data as any)?.status || '').toUpperCase())
  }
  if (ok) await admin.from('club_subscriptions').update({ pagbank_cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sub.id)
  return ok
}

// Confere as faturas da assinatura no PagBank e dá baixa das pagas que ainda não estão no sistema.
// Idempotente: fatura já registrada (pagbank_invoice_id) é ignorada; processarPagamentoClube também é.
// deno-lint-ignore no-explicit-any
export async function sincronizarCartao(admin: any, sub: any) {
  if (!sub?.pagbank_subscription_id) return { novas: 0 }
  const inv = await pbSubs(admin, 'GET', `/subscriptions/${sub.pagbank_subscription_id}/invoices`, undefined, sub.code)
  // deno-lint-ignore no-explicit-any
  const lista: any[] = Array.isArray((inv.data as any)?.invoices) ? (inv.data as any).invoices : []
  let novas = 0
  for (const f of lista.sort((a, b) => Number(a?.occurrence || 0) - Number(b?.occurrence || 0))) {
    if (String(f?.status || '').toUpperCase() !== 'PAID') continue
    const n = Math.max(1, Number(f?.occurrence || 1))
    const reference = `CLB-${sub.code}-${n}`
    const { data: jaTem } = await admin.from('club_charges').select('id, status, pagbank_invoice_id').eq('reference_id', reference).maybeSingle()
    if (jaTem?.status === 'paga') continue
    if (!jaTem) {
      // Ciclo n conta da âncora (1º pagamento), igual ao banco. Sem âncora ainda = é a 1ª.
      const inicio = sub.cycle_anchor && n > 1 ? somaMeses(sub.cycle_anchor, n - 1) : null
      const { error } = await admin.from('club_charges').insert({
        subscription_id: sub.id, seq: n, amount: Number(f?.amount?.value || Math.round(Number(sub.price) * 100)) / 100, status: 'pendente',
        reference_id: reference, pagbank_invoice_id: f?.id || null,
        cycle_start: inicio, cycle_end: inicio ? fimDoCicloAncorado(sub.cycle_anchor, inicio) : null,
      })
      if (error) { console.error('[clube-recorrencia] charge', error); continue }
    } else if (!jaTem.pagbank_invoice_id && f?.id) {
      await admin.from('club_charges').update({ pagbank_invoice_id: f.id }).eq('id', jaTem.id)
    }
    await processarPagamentoClube(admin, reference, [{ status: 'PAID', id: f?.id || null, payment_method: { type: 'CREDIT_CARD' } }], null)
    novas++
  }
  return { novas }
}
