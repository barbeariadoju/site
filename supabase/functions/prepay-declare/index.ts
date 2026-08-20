// Cliente diz que fez o Pix: registra e avisa o Juliano na hora.
//
// Antes esta declaração ia direto pra RPC e morria no banco — o Juliano só
// descobria se abrisse o painel, e o cliente ficava sem retorno nenhum.
// Aqui o push sai na hora e diz PARA QUAL CHAVE o cliente mandou, pra ele
// abrir o aplicativo certo de primeira em vez de caçar nos dois.
//
// Autorização: o par booking_code + token, o mesmo do link de gerenciamento.
// Não há sessão — por isso verify_jwt=false e validação rígida.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const KEY_LABEL: Record<string, string> = {
  pagbank: 'PagBank — celular 11967073038',
  picpay: 'PicPay — contato@barbeariadoju.com.br',
}
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const bookingCode = String(body.booking_code || '').trim()
    const token = String(body.token || '').trim()
    const key = String(body.key || 'pagbank').trim().toLowerCase()

    // v29.54.0 — dois eventos no mesmo endpoint: 'declared' (padrão, o "Já fiz o Pix")
    // e 'copied' (o cliente copiou uma chave na tela). O caso do Nado (20/08/2026) provou
    // que muita gente paga sem tocar no botão — a cópia da chave vira o primeiro aviso.
    const event = String(body.event || 'declared').trim().toLowerCase()

    if (!bookingCode || !token) return json({ ok: false, message: 'Dados incompletos.' }, 400)
    if (key !== 'pagbank' && key !== 'picpay') return json({ ok: false, message: 'Chave inválida.' }, 400)
    if (event !== 'declared' && event !== 'copied') return json({ ok: false, message: 'Evento inválido.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    if (event === 'copied') {
      // Registra a chave copiada; push só na PRIMEIRA sinalização deste agendamento,
      // pra não encher o celular do Juliano se o cliente copiar duas vezes.
      const { data: cData, error: cError } = await admin.rpc('note_prepay_key_copied', {
        p_booking_code: bookingCode,
        p_token: token,
        p_key: key,
      })
      const cRow = Array.isArray(cData) ? cData[0] : cData
      if (cError || !cRow?.ok) {
        console.error('[prepay-declare] rpc copied', cError)
        return json({ ok: false }, 400)
      }
      if (cRow.first_copy) {
        try {
          const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
          const supabaseUrl = Deno.env.get('SUPABASE_URL')
          if (pushSecret && supabaseUrl) {
            await fetch(`${supabaseUrl}/functions/v1/send-push`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
              body: JSON.stringify({
                custom: {
                  title: '👀 Copiou a chave Pix — de olho no extrato',
                  body: `${cRow.customer_name || 'Cliente'} • ${money(Number(cRow.valor || 0))}\nDeve cair em: ${KEY_LABEL[key]}\n(ainda sem o aviso "Já fiz o Pix")`,
                  url: '/admin-agenda.html?app=1',
                  tag: `prepay-copy-${cRow.booking_id}`,
                },
              }),
            })
          }
        } catch (pushErr) {
          console.error('[prepay-declare] push copied', pushErr)
        }
      }
      return json({ ok: true })
    }

    const { data, error } = await admin.rpc('declare_prepay', {
      p_booking_code: bookingCode,
      p_token: token,
      p_key: key,
    })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row?.ok) {
      console.error('[prepay-declare] rpc', error || row?.message)
      return json({ ok: false, message: row?.message || 'Não foi possível registrar.' }, 400)
    }

    // Push pro Juliano. Falhar aqui não invalida a declaração — ela já está gravada.
    try {
      const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      if (pushSecret && supabaseUrl) {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
          body: JSON.stringify({
            custom: {
              title: '💸 Cliente diz que fez o Pix',
              body: `${row.customer_name || 'Cliente'} • ${money(Number(row.valor || 0))}\nConferir em: ${KEY_LABEL[key]}`,
              url: '/admin-agenda.html?app=1',
              tag: `prepay-${row.booking_id}`,
            },
          }),
        })
      }
    } catch (pushErr) {
      console.error('[prepay-declare] push', pushErr)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('[prepay-declare] fatal', e)
    return json({ ok: false, message: 'Erro inesperado.' }, 500)
  }
})
