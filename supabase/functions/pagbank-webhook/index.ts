// v29.22.0 — Webhook do PagBank: a confirmação de pagamento que fecha o ciclo sozinha.
//
// Quando o cliente paga (Pix ou cartão) na página do Checkout, o PagBank chama
// esta function. Validada a assinatura, marcamos prepay_confirmed_at no
// agendamento, avisamos o cliente no WhatsApp e mandamos push pro Juliano.
// Ninguém mais confere extrato — era exatamente isso que a Fase 1 não tinha.
//
// Segurança: o header x-authenticity-token traz SHA-256("{token da conta}-{corpo cru}").
// Recalculamos sobre o corpo EXATAMENTE como chegou e comparamos; assinatura
// errada = descarte (regra do PagBank). O corpo não pode ser reformatado antes.
//
// Aviso de horário: a guarda de silêncio (20h–8h, v29.21.0) NÃO se aplica aqui —
// confirmar um pagamento que o cliente acabou de fazer é resposta, não incômodo
// (mesma exceção da JuIA respondendo mensagens).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const toWhatsNumber = (phone: string) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

const METHOD_MAP: Record<string, string> = { PIX: 'pix', CREDIT_CARD: 'credito', DEBIT_CARD: 'debito' }
const METHOD_LABEL: Record<string, string> = { pix: 'Pix', credito: 'cartão de crédito', debito: 'cartão de débito' }

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405)

  try {
    const raw = await req.text()
    const pagbankToken = Deno.env.get('PAGBANK_TOKEN')
    if (!pagbankToken) return json({ ok: false }, 500)

    const received = String(req.headers.get('x-authenticity-token') || '').trim().toLowerCase()
    const expected = await sha256Hex(`${pagbankToken}-${raw}`)
    if (!received || received !== expected) {
      console.error('[pagbank-webhook] assinatura inválida')
      return json({ ok: false, message: 'Assinatura inválida.' }, 401)
    }

    const payload = JSON.parse(raw)
    // Notificação de checkout traz charges[]; notificação de cobrança pode vir
    // com a charge no topo. Normalizamos para uma lista.
    const charges: Array<Record<string, unknown>> = Array.isArray(payload?.charges)
      ? payload.charges
      : (payload?.status && payload?.payment_method ? [payload] : [])
    const referenceId = String(payload?.reference_id || charges[0]?.reference_id || '').trim()
    const checkoutId = String(payload?.id || '').startsWith('CHEC_') ? String(payload.id) : null

    if (!referenceId) return json({ ok: true, ignored: 'sem reference_id' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: booking } = await admin
      .from('bookings')
      .select('id, customer_name, customer_phone, service_price, products_price, prepay_confirmed_at')
      .eq('booking_code', referenceId)
      .maybeSingle()
    if (!booking) return json({ ok: true, ignored: 'agendamento não encontrado' })

    const findPayment = async () => {
      let q = admin.from('payments').select('id, status').eq('booking_id', booking.id)
      q = checkoutId ? q.eq('checkout_id', checkoutId) : q.order('created_at', { ascending: false })
      return (await q.limit(1).maybeSingle()).data
    }

    const paid = charges.find((c) => String(c?.status || '').toUpperCase() === 'PAID')
    if (!paid) {
      // DECLINED/CANCELED: registra e encerra — a própria página do PagBank já
      // mostrou o erro pro cliente; o link continua vivo pra nova tentativa.
      const bad = charges.find((c) => ['DECLINED', 'CANCELED'].includes(String(c?.status || '').toUpperCase()))
      if (bad) {
        const pay = await findPayment()
        if (pay && pay.status === 'created') {
          await admin.from('payments').update({
            status: String(bad.status).toUpperCase() === 'DECLINED' ? 'declined' : 'canceled',
            charge_id: String(bad.id || '') || null,
            raw: payload,
            updated_at: new Date().toISOString(),
          }).eq('id', pay.id)
        }
      }
      return json({ ok: true })
    }

    const method = METHOD_MAP[String((paid.payment_method as Record<string, unknown>)?.type || '').toUpperCase()] || null
    const amountCents = Number((paid.amount as Record<string, unknown>)?.value || 0)
    const valor = amountCents > 0
      ? amountCents / 100
      : Number(booking.service_price || 0) + Number(booking.products_price || 0)

    // Idempotência: o PagBank reenvia notificações. Se este agendamento já está
    // confirmado, só garantimos o registro do pagamento e saímos sem reavisar.
    const alreadyConfirmed = !!booking.prepay_confirmed_at

    const pay = await findPayment()
    if (pay) {
      await admin.from('payments').update({
        status: 'paid',
        method,
        charge_id: String(paid.id || '') || null,
        paid_at: new Date().toISOString(),
        raw: payload,
        updated_at: new Date().toISOString(),
      }).eq('id', pay.id)
    } else {
      await admin.from('payments').insert({
        booking_id: booking.id,
        checkout_id: checkoutId,
        charge_id: String(paid.id || '') || null,
        status: 'paid',
        method,
        amount_cents: amountCents > 0 ? amountCents : Math.round(valor * 100),
        paid_at: new Date().toISOString(),
        raw: payload,
      })
    }

    if (alreadyConfirmed) return json({ ok: true, repeated: true })

    await admin.from('bookings').update({
      prepay_declared_at: booking.prepay_confirmed_at || new Date().toISOString(),
      prepay_confirmed_at: new Date().toISOString(),
      prepay_key: 'checkout',
      updated_at: new Date().toISOString(),
    }).eq('id', booking.id)

    // Avisa o cliente. Falhar aqui não desfaz nada — o pagamento já está gravado.
    try {
      const url = Deno.env.get('EVOLUTION_API_URL')
      const apikey = Deno.env.get('EVOLUTION_API_KEY')
      const instance = Deno.env.get('EVOLUTION_INSTANCE_NAME')
      const phone = toWhatsNumber(booking.customer_phone || '')
      if (url && apikey && instance && phone) {
        const nome = String(booking.customer_name || '').split(' ')[0] || 'Tudo certo'
        const meio = METHOD_LABEL[method || ''] || 'pagamento'
        const texto = method === 'pix'
          ? `Pagamento confirmado ✅\n\n${nome}, o seu Pix de ${money(valor)} caiu certinho aqui. Seu horário está garantido e não precisa fazer mais nada.\n\nAté logo! 💈\nBarbearia do Ju`
          : `Pagamento confirmado ✅\n\n${nome}, o seu pagamento de ${money(valor)} no ${meio} foi aprovado. Seu horário está garantido e não precisa fazer mais nada.\n\nAté logo! 💈\nBarbearia do Ju`
        const res = await fetch(`${url}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey },
          body: JSON.stringify({ number: phone, text: texto }),
        })
        const sent = await res.json().catch(() => ({}))
        await admin.from('whatsapp_messages').insert({
          phone, direction: 'out', body: texto, sent_by: 'bot',
          evolution_message_id: String(sent?.key?.id || '') || null,
        })
      }
    } catch (waErr) {
      console.error('[pagbank-webhook] whatsapp', waErr)
    }

    // Push pro Juliano — informativo, sem ação pendente (a conferência morreu).
    try {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      if (pushSecret && supabaseUrl) {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({
            custom: {
              title: '💰 Pagamento confirmado (PagBank)',
              body: `${booking.customer_name || 'Cliente'} • ${money(valor)} • ${METHOD_LABEL[method || ''] || 'pagamento'}\nConfirmação automática — nada a conferir.`,
              url: '/admin-agenda.html?app=1',
              tag: `pagbank-${booking.id}`,
            },
          }),
        })
      }
    } catch (pushErr) {
      console.error('[pagbank-webhook] push', pushErr)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('[pagbank-webhook] fatal', e)
    return json({ ok: false }, 500)
  }
})
