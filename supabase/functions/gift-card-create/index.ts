// v29.25.0 — Vale-presente: registra o pedido e devolve o Pix copia e cola.
//
// Fluxo desenhado pelo Juliano (15/08/2026): o comprador escolhe um pacote pronto ou monta
// o próprio vale, vê o total, e SÓ ENTÃO chega no pagamento. Aqui o pedido nasce com status
// pending_payment — o código do vale ainda NÃO existe. Ele é gerado quando o Juliano confirma
// o Pix no painel (RPC confirm_gift_card), porque código gerado antes do pagamento é código
// que pode circular sem ter sido pago.
//
// O Pix copia e cola é montado aqui (BR Code / EMV estático com valor). Assim o comprador
// não precisa digitar chave nem valor — menos erro, menos desconfiança, mais conversão.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const PIX_KEY = 'contato@barbeariadoju.com.br'
const PIX_NAME = 'JULIANO B L PADILHA'
const PIX_CITY = 'BRAGANCA PAULISTA'
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// BR Code estático com valor (padrão EMV do Banco Central).
// Cada campo é "ID + tamanho(2) + valor"; o CRC16-CCITT fecha o payload.
const emv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Sem acento e sem caractere fora do ASCII: alguns bancos rejeitam o payload.
const clean = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, max)

function pixPayload(amountCents: number, txid: string): string {
  const account = emv('00', 'br.gov.bcb.pix') + emv('01', PIX_KEY)
  let p =
    emv('00', '01') +
    emv('26', account) +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', (amountCents / 100).toFixed(2)) +
    emv('58', 'BR') +
    emv('59', clean(PIX_NAME, 25)) +
    emv('60', clean(PIX_CITY, 15)) +
    emv('62', emv('05', clean(txid, 25)))
  p += '6304'
  return p + crc16(p)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const kind = body.kind === 'custom' ? 'custom' : 'package'
    const items = Array.isArray(body.items) ? body.items.slice(0, 12) : []
    const amountCents = Math.round(Number(body.amount_cents || 0))
    const buyerName = String(body.buyer_name || '').trim()
    const buyerPhone = String(body.buyer_phone || '').replace(/\D/g, '')
    const recipientName = String(body.recipient_name || '').trim() || null
    const message = String(body.message || '').trim().slice(0, 300) || null

    if (!buyerName || buyerPhone.length < 10) return json({ ok: false, message: 'Preencha seu nome e WhatsApp.' }, 400)
    if (!amountCents || amountCents < 4000) return json({ ok: false, message: 'Valor mínimo do vale: R$ 40,00.' }, 400)
    if (amountCents > 100000) return json({ ok: false, message: 'Valor acima do limite. Fale com a gente no WhatsApp.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data, error } = await admin
      .from('gift_cards')
      .insert({
        kind,
        items,
        amount_cents: amountCents,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        buyer_email: String(body.buyer_email || '').trim() || null,
        recipient_name: recipientName,
        message,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[gift-card-create] insert', error)
      return json({ ok: false, message: 'Não foi possível registrar o pedido.' }, 500)
    }

    // Identificador curto do pedido: o comprador cita isso ao mandar o comprovante.
    const orderRef = `VALE${String(data.id).replace(/\D/g, '').slice(0, 6) || Date.now().toString().slice(-6)}`
    const payload = pixPayload(amountCents, orderRef)

    // Push pro Juliano: pedido novo esperando confirmação de Pix.
    try {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      if (pushSecret && supabaseUrl) {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({
            custom: {
              title: '🎁 Novo pedido de vale-presente',
              body: `${buyerName} • ${money(amountCents / 100)}\nConfira o Pix e libere o código no painel.`,
              url: '/admin-vales.html?app=1',
              tag: `gift-${data.id}`,
            },
          }),
        })
      }
    } catch (pushErr) {
      console.error('[gift-card-create] push', pushErr)
    }

    return json({ ok: true, order_ref: orderRef, pix_payload: payload, amount_cents: amountCents })
  } catch (e) {
    console.error('[gift-card-create] fatal', e)
    return json({ ok: false, message: 'Erro inesperado.' }, 500)
  }
})
