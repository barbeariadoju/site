// v29.28.0 — Varredura semanal: recupera pesquisas de satisfação sem resposta.
//
// O problema real (dados de 60 dias): 65 clientes responderam a pesquisa, mas 25 nunca
// responderam nada. O Juliano dizia que conversa com todo mundo que ainda não avaliou e
// ouve "vou fazer" — e depois ninguém responde. Esses 25 são exatamente esse público.
//
// A regra que ele pediu: "sempre não ser chato, tudo sempre muito sutil". Traduzida em
// código, é um TETO DE TOQUES, não uma campanha:
//   1. pesquisa no dia do atendimento (satisfaction-dispatch)
//   2. follow-up de 24h                 (satisfaction-dispatch)
//   3. ESTA varredura — uma vez só, e acabou
// Depois disso, silêncio definitivo para aquele atendimento. Quem ignorar a varredura sai
// do motor (survey_opt_out) e não é mais cobrado nos próximos atendimentos.
//
// A porta de saída é explícita na mensagem: "3 = já avaliei" tira a pessoa da fila para
// sempre. Pedir avaliação a quem já avaliou é o jeito mais rápido de irritar bom cliente.
//
// Janela de contato: roda por cron às segundas de manhã e a guarda do agendador
// (migration 110) garante que nunca sai em domingo, feriado ou sábado à tarde.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

const toWhatsNumber = (phone: string) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}
const firstName = (v: string) => String(v || '').trim().split(/\s+/)[0] || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = req.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')
  if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
    return json({ ok: false, message: 'Evolution não configurada.' }, 500)
  }

  try {
    const { data: targets, error } = await admin.rpc('list_survey_recovery_targets', { p_limit: 25 })
    if (error) {
      console.error('[survey-recovery] rpc', error)
      return json({ ok: false, message: error.message }, 500)
    }
    if (!targets || targets.length === 0) return json({ ok: true, sent: 0, message: 'ninguém na fila' })

    let sent = 0
    for (const t of targets) {
      const phone = toWhatsNumber(t.phone)
      if (!phone) continue
      // v29.43.0 — fila unica de perguntas numeradas: com convite/confirmacao/follow-up
      // pendente para este telefone, a recuperacao espera a varredura seguinte.
      {
        const { data: pendente } = await admin.rpc('juia_pending_numeric_question', { p_phone: phone })
        if (pendente && pendente !== 'survey') {
          console.log('[survey-recovery] fila unica: adiado, ja existe pergunta pendente', pendente, phone)
          continue
        }
      }

      // Tom: curto, humilde, com a saída explícita. Nada de "sua opinião é muito importante
      // para nós" — soa a robô de call center. E promete não insistir de novo, porque é verdade.
      // v29.29.0: aqui é ETAPA 1 — pesquisa de satisfação, só 1 ou 2. O pedido de avaliação
      // no Google (e a saída "já avaliei") vem depois, para quem responder 1.
      const nome = firstName(t.customer_name)
      const texto = `Oi${nome ? `, ${nome}` : ''}! 😊 Desculpe incomodar de novo — é rapidinho e prometo não insistir mais.\n\nComo foi seu último atendimento aqui na Barbearia do Ju?\n\n*1* — Satisfeito 👍\n*2* — Insatisfeito 👎\n\nObrigado! 💈`

      try {
        const res = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({ number: phone, text: texto }),
        })
        const sentData = await res.json().catch(() => ({}))
        if (!res.ok) {
          console.error('[survey-recovery] envio falhou', phone, res.status)
          continue
        }

        await admin.from('whatsapp_messages').insert({
          phone, direction: 'out', body: texto, sent_by: 'bot',
          evolution_message_id: String(sentData?.key?.id || '') || null,
        })

        // Marca a tentativa ANTES de qualquer coisa poder falhar de novo: se este registro
        // não subir, a varredura da semana seguinte insistiria outra vez — e insistir duas
        // vezes é exatamente o que não pode acontecer.
        await admin.from('experience_requests').update({
          recovery_attempts: 1,
          last_recovery_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', t.id)

        sent++
      } catch (e) {
        console.error('[survey-recovery] erro no envio', phone, e)
      }
    }

    // Quem foi tocado na varredura anterior e continuou sem responder sai do motor: não
    // recebe cobrança em atendimento nenhum daqui pra frente. Duas tentativas ignoradas são
    // uma resposta clara — a pessoa não responde pesquisa, e continua sendo bom cliente.
    const { data: ignoraram } = await admin
      .from('experience_requests')
      .select('id, customer_id')
      .eq('status', 'sent')
      .is('answered_at', null)
      .eq('recovery_attempts', 1)
      .eq('opted_out', false)
      .lt('last_recovery_at', new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString())
      .limit(50)

    let optedOut = 0
    for (const row of ignoraram || []) {
      await admin.from('experience_requests').update({ opted_out: true, updated_at: new Date().toISOString() }).eq('id', row.id)
      if (row.customer_id) {
        await admin.from('customer_profiles').update({ survey_opt_out: true, updated_at: new Date().toISOString() }).eq('id', row.customer_id)
      }
      optedOut++
    }

    return json({ ok: true, sent, opted_out: optedOut })
  } catch (e) {
    console.error('[survey-recovery] fatal', e)
    return json({ ok: false, message: String(e) }, 500)
  }
})
