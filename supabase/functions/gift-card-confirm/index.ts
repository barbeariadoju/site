// v29.25.0 — Vale-presente: o Juliano confirma o Pix e o comprador recebe o código na hora.
//
// verify_jwt=true: quem chama é o painel admin com a sessão do Juliano. A RPC
// confirm_gift_card revalida is_admin() no banco (defesa em profundidade — não confiamos
// só no fato de a function ter sido chamada).
//
// O aviso vai pro WhatsApp do COMPRADOR (não do presenteado): quem pagou é quem precisa
// receber o código para entregar do jeito que quiser.
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
    if (!authHeader) return json({ ok: false, message: 'Sem sessão.' }, 401)

    const body = await req.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    if (!id) return json({ ok: false, message: 'Vale não informado.' }, 400)

    // Cliente COM o token do admin: a RPC roda sob a identidade dele e is_admin() decide.
    const asUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data, error } = await asUser.rpc('confirm_gift_card', { p_id: id })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row?.ok) {
      console.error('[gift-card-confirm] rpc', error || row?.message)
      return json({ ok: false, message: row?.message || 'Não foi possível confirmar.' }, 400)
    }

    // Avisa o comprador. Falhar aqui não desfaz a liberação — o código já existe e aparece no painel.
    let notified = false
    try {
      const url = Deno.env.get('EVOLUTION_API_URL')
      const apikey = Deno.env.get('EVOLUTION_API_KEY')
      const instance = Deno.env.get('EVOLUTION_INSTANCE_NAME')
      const phone = toWhatsNumber(row.buyer_phone || '')
      if (url && apikey && instance && phone) {
        const nome = String(row.buyer_name || '').split(' ')[0] || 'Tudo certo'
        const para = row.recipient_name ? ` para ${row.recipient_name}` : ''
        const validade = row.expires_at
          ? new Date(row.expires_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : ''
        const texto = `Pagamento confirmado ✅\n\n${nome}, recebemos seu Pix e o vale-presente${para} está liberado!\n\n🎁 *CÓDIGO: ${row.code}*\nValor: ${money(Number(row.amount_cents || 0) / 100)}\nVálido até ${validade}\n\nÉ só entregar esse código para quem vai ganhar. No agendamento (barbeariadoju.com.br/agendar) ou aqui pelo WhatsApp, basta informar o código.\n\nObrigado pela confiança! 💈\nBarbearia do Ju`
        const res = await fetch(`${url}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey },
          body: JSON.stringify({ number: phone, text: texto }),
        })
        notified = res.ok
        const sent = await res.json().catch(() => ({}))
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        await admin.from('whatsapp_messages').insert({
          phone, direction: 'out', body: texto, sent_by: 'bot',
          evolution_message_id: String(sent?.key?.id || '') || null,
        })
      }
    } catch (waErr) {
      console.error('[gift-card-confirm] whatsapp', waErr)
    }

    return json({ ok: true, code: row.code, notified })
  } catch (e) {
    console.error('[gift-card-confirm] fatal', e)
    return json({ ok: false, message: 'Erro inesperado.' }, 500)
  }
})
