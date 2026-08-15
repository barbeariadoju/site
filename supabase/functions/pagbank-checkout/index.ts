// v29.22.0 — Fase 2 do pagamento antecipado: cria o link de Checkout PagBank.
//
// O cliente termina o agendamento e escolhe pagar agora: esta function cria um
// checkout (Pix + crédito + débito à vista) e devolve o link da página do PagBank.
// A confirmação NÃO passa mais pelo Juliano: quando o pagamento cai, o PagBank
// chama a pagbank-webhook, que marca prepay_confirmed_at e avisa o cliente.
//
// Enquanto a conta não estiver na allowlist do PagBank (chamado aberto em
// 15/08/2026), a API responde 403 — devolvemos not_enabled e o site cai no
// fluxo manual da Fase 1 (chave copiável + "Já fiz o Pix"). Ativação automática:
// no dia em que o PagBank liberar, o mesmo código passa a responder com o link.
//
// Autorização: o par booking_code + token, o mesmo do link de gerenciamento
// (padrão da prepay-declare). verify_jwt=false + validação rígida.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SITE = 'https://www.barbeariadoju.com.br'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const bookingCode = String(body.booking_code || '').trim()
    const token = String(body.token || '').trim()
    if (!bookingCode || !token) return json({ ok: false, message: 'Dados incompletos.' }, 400)

    const pagbankToken = Deno.env.get('PAGBANK_TOKEN')
    if (!pagbankToken) return json({ ok: false, not_configured: true })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data, error } = await admin.rpc('get_booking_for_checkout', {
      p_booking_code: bookingCode,
      p_token: token,
    })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row?.ok) {
      console.error('[pagbank-checkout] rpc', error || row?.message)
      return json({ ok: false, message: row?.message || 'Agendamento não encontrado.' }, 400)
    }
    if (row.already_paid) return json({ ok: true, already_paid: true })
    if (!row.amount_cents || row.amount_cents <= 0) return json({ ok: false, message: 'Valor indisponível.' }, 400)

    // Reaproveita um checkout ainda válido em vez de criar outro: evita dois links
    // vivos pro mesmo agendamento (e dois pagamentos possíveis).
    const { data: existing } = await admin
      .from('payments')
      .select('pay_link, expires_at')
      .eq('booking_id', row.booking_id)
      .eq('status', 'created')
      .gt('expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
      .not('pay_link', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing?.pay_link) return json({ ok: true, pay_url: existing.pay_link, amount_cents: row.amount_cents })

    const base = Deno.env.get('PAGBANK_API_BASE') || 'https://api.pagseguro.com'
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const redirect = `${SITE}/meu-agendamento.html?code=${encodeURIComponent(bookingCode)}&token=${encodeURIComponent(token)}&pago=1`

    const payload: Record<string, unknown> = {
      reference_id: bookingCode,
      expiration_date: expiresAt.toISOString(),
      // O cliente completa os próprios dados na página do PagBank (CPF etc.) —
      // o site não coleta documento e não deve coletar.
      customer_modifiable: true,
      items: [{
        reference_id: String(row.booking_id),
        name: `Barbearia do Ju — ${String(row.service_name || 'Atendimento').slice(0, 90)}`,
        quantity: 1,
        unit_amount: row.amount_cents,
      }],
      payment_methods: [{ type: 'PIX' }, { type: 'CREDIT_CARD' }, { type: 'DEBIT_CARD' }],
      // Cartão só à vista: nos valores da barbearia, parcelar não faz sentido e
      // complica estorno em cancelamento.
      payment_methods_configs: [{
        type: 'CREDIT_CARD',
        config_options: [{ option: 'INSTALLMENTS_LIMIT', value: '1' }],
      }],
      notification_urls: [`${Deno.env.get('SUPABASE_URL')}/functions/v1/pagbank-webhook`],
      redirect_url: redirect,
    }

    const r = await fetch(`${base}/checkouts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pagbankToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const resp = await r.json().catch(() => null)

    if (r.status !== 201 && r.status !== 200) {
      const errs = resp?.error_messages || resp
      const isAllowlist = JSON.stringify(errs || '').toLowerCase().includes('llowlist')
      console.error('[pagbank-checkout] api', r.status, JSON.stringify(errs).slice(0, 500))
      // not_enabled: o front entende e cai no fluxo manual da Fase 1.
      return json({ ok: false, not_enabled: isAllowlist, message: 'Pagamento online indisponível agora.' })
    }

    const payLink = (resp?.links || []).find((l: { rel?: string; href?: string }) =>
      String(l?.rel || '').toUpperCase() === 'PAY')?.href
    if (!payLink) {
      console.error('[pagbank-checkout] sem link PAY', JSON.stringify(resp).slice(0, 500))
      return json({ ok: false, message: 'Pagamento online indisponível agora.' })
    }

    const { error: insErr } = await admin.from('payments').insert({
      booking_id: row.booking_id,
      checkout_id: resp.id || null,
      status: 'created',
      amount_cents: row.amount_cents,
      pay_link: payLink,
      expires_at: expiresAt.toISOString(),
      raw: resp,
    })
    if (insErr) console.error('[pagbank-checkout] insert payments', insErr)

    return json({ ok: true, pay_url: payLink, amount_cents: row.amount_cents })
  } catch (e) {
    console.error('[pagbank-checkout] fatal', e)
    return json({ ok: false, message: 'Erro inesperado.' }, 500)
  }
})
