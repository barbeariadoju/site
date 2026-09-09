// O Juliano confere o extrato e confirma que o Pix caiu.
//
// Isto é o que faltava para o cliente sair da dúvida: até aqui ele pagava, avisava,
// e nunca recebia retorno. Agora recebe a confirmação no WhatsApp.
//
// Autorização: a própria sessão do admin. A RPC confirm_prepay checa is_admin() por
// dentro, então usamos o token de quem chamou — não o service role — para essa parte.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { mensagemPixConfirmado } from '../_shared/pix-confirmado.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

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
        const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        // v29.163.0 — caso Marcelo (09/09): o Pix confirmado às 18h00 de um horário das 17h00
        // saiu com "é só chegar no horário combinado". A RPC devolve só nome/telefone/valor;
        // data, hora e status vêm daqui, e o texto é escolhido pelo momento (_shared/pix-confirmado.ts,
        // com teste). Se a consulta falhar, o módulo cai no texto original ("antes").
        const { data: reserva } = await admin
          .from('bookings')
          .select('booking_date,start_time,status')
          .eq('id', bookingId)
          .maybeSingle()
        const emSP = (opts: Intl.DateTimeFormatOptions) =>
          new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', ...opts }).format(new Date())
        const agoraSP = `${emSP({ year: 'numeric', month: '2-digit', day: '2-digit' })} ${emSP({ hour: '2-digit', minute: '2-digit' })}`
        const texto = mensagemPixConfirmado({
          clienteNome: String(row.customer_name || ''),
          valor: Number(row.valor || 0),
          bookingDate: String(reserva?.booking_date || ''),
          startTime: String(reserva?.start_time || ''),
          status: String(reserva?.status || ''),
          agoraSP,
        })
        const res = await fetch(`${url}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey },
          body: JSON.stringify({ number: phone, text: semEmoji(texto) }),
        })
        avisou = res.ok
        const sent = await res.json().catch(() => ({}))
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
