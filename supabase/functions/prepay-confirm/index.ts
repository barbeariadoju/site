// O Juliano confere o extrato e confirma que o Pix caiu.
//
// Isto é o que faltava para o cliente sair da dúvida: até aqui ele pagava, avisava,
// e nunca recebia retorno. Agora recebe a confirmação no WhatsApp.
//
// Autorização: a própria sessão do admin. A RPC confirm_prepay checa is_admin() por
// dentro, então usamos o token de quem chamou — não o service role — para essa parte.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const toWhatsNumber = (phone: string) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json({ ok: false, message: 'Sem autorização.' }, 401)

    const body = await req.json().catch(() => ({}))
    const bookingId = String(body.booking_id || '').trim()
    if (!bookingId) return json({ ok: false, message: 'Agendamento não informado.' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // Cliente com o token de quem chamou: a RPC exige is_admin() e vai recusar
    // qualquer um que não seja o dono. Não confiamos só no verify_jwt.
    const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data, error } = await asUser.rpc('confirm_prepay', { p_booking_id: bookingId, p_confirmed: true })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row?.ok) {
      console.error('[prepay-confirm] rpc', error)
      return json({ ok: false, message: error?.message || 'Não foi possível confirmar.' }, 400)
    }

    // Avisa o cliente. Falhar aqui não desfaz a confirmação — ela já está gravada.
    let avisou = false
    try {
      const url = Deno.env.get('EVOLUTION_API_URL')
      const apikey = Deno.env.get('EVOLUTION_API_KEY')
      const instance = Deno.env.get('EVOLUTION_INSTANCE_NAME')
      const phone = toWhatsNumber(row.customer_phone || '')
      if (url && apikey && instance && phone) {
        const nome = String(row.customer_name || '').split(' ')[0] || 'Tudo certo'
        // v29.47.0 — texto revisado (pedido do Juliano, 19/08: "mensagem bonita e profissional pra tranquilizá-lo").
        const texto = `✅ Pagamento confirmado!\n\n${nome}, o Juliano conferiu e o seu Pix de ${money(Number(row.valor || 0))} foi recebido. Seu horário está garantido — é só chegar no horário combinado, sem precisar fazer mais nada.\n\nObrigado pela confiança, te esperamos! 💈\nBarbearia do Ju`
        const res = await fetch(`${url}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey },
          body: JSON.stringify({ number: phone, text: texto }),
        })
        avisou = res.ok
        const sent = await res.json().catch(() => ({}))
        const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        await admin.from('whatsapp_messages').insert({
          phone, direction: 'out', body: texto, sent_by: 'bot',
          evolution_message_id: String(sent?.key?.id || '') || null,
        })
      }
    } catch (waErr) {
      console.error('[prepay-confirm] whatsapp', waErr)
    }

    return json({ ok: true, avisou })
  } catch (e) {
    console.error('[prepay-confirm] fatal', e)
    return json({ ok: false, message: 'Erro inesperado.' }, 500)
  }
})
