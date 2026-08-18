import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

// v28.54.1: 2min era curto demais pra conversa humana real (caso Kelvin, 05/08/2026) —
// o Juliano respondia normalmente com poucos minutos de pausa (atendendo cliente,
// digitando) e o watchdog já devolvia o controle pra JuIA no meio da conversa,
// que então mandava o "cochicho" de reativação por cima do que o Juliano estava
// conduzindo. 20min dá folga real pra uma pausa natural sem deixar o cliente
// esperando o dia inteiro se o Juliano de fato se afastar.
const INACTIVITY_MINUTES = 20

const greetingNow = (): string => {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()),
  )
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

// Evita mandar o "cochicho" de reativação quando a conversa já terminou naturalmente
// (o cliente só reagiu com figurinha/emoji, ou mandou um agradecimento/despedida).
// Sem isso, um cliente que já foi atendido recebia um "vim te lembrar de agendar"
// logo depois de ter respondido com uma figurinha de "toca aqui" — soa robótico e
// fora de contexto, especialmente se o atendimento já foi concluído no mesmo dia.
const CLOSING_TEXT = /^(obrigad[oa]s?|valeu|vlw|blz|beleza|ok(ay)?|tranquilo|falou|ate (mais|logo|breve)|tchau|flw|show|top|jo[ií]a|de nada|por nada|combinado|fechado)[\s!.,]*$/
function looksLikeClosingOrReaction(rawBody: string): boolean {
  const body = String(rawBody || '').trim()
  if (!body || body === '[mídia ou mensagem sem texto]') return true
  if (!/[a-zA-ZÀ-ÿ]/.test(body)) return true // só emoji/figurinha/pontuação, sem nenhuma letra
  const normalized = body.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return CLOSING_TEXT.test(normalized)
}
async function shouldSkipNudge(admin: any, phone: string): Promise<boolean> {
  const { data: last } = await admin
    .from('whatsapp_messages')
    .select('direction, body, sent_by')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!last) return false
  // Se a última mensagem foi enviada por nós (Juliano respondeu pessoalmente, ou a própria
  // JuIA já respondeu), o cliente não está "esperando" nada agora — mandar "ainda estou por
  // aqui" logo depois de o Juliano ter acabado de escrever é redundante e chato. Só faz
  // sentido reativar quando quem escreveu por último foi o CLIENTE e ainda não teve resposta.
  if (last.direction !== 'in') return true
  if (looksLikeClosingOrReaction(last.body)) return true
  // v29.43.5 (revisao 14-18/08): o cochicho saiu depois de "Um abraço, excelente fds" (Helder,
  // com o Juliano ja tendo se despedido), "Da um tok eu vou 🙏" (Rafael Ferreira) e "se ta ai
  // fico despreocupado" (Rafael) — frases de encerramento que a lista curta acima nao pegava.
  // Regra invertida: so cochicha se a ultima frase do cliente PARECE PRECISAR de resposta
  // (tem "?" ou palavra de pedido). Despedida, aviso ou combinado nao reabrem conversa.
  const body = String(last.body || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const despedida = /\b(abraco|abracos|bom fds|bom final de semana|boa semana|bom descanso|boa noite|bom dia|boa tarde|fico no aguardo|fico despreocupado|te aviso|eu aviso|passo ai|passo la|da um toque|da um tok|me avisa|qualquer coisa eu chamo|depois eu (vejo|falo|marco|passo)|ate (mais|logo|breve|amanha|la)|nos falamos|combinado|fechou|beleza entao|ta bom|tudo bem)\b/.test(body)
  const pedido = /\?|\b(quero|queria|gostaria|pode|poderia|consigo|consegue|tem |teria|horario|marcar|agendar|remarcar|cancelar|quanto|qual|como|onde|quando|preciso|me (fala|diz|passa|manda)|disponivel|vaga)\b/.test(body)
  if (despedida && !pedido) return true
  if (!pedido) return true
  return false
}

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString()

  const { data: stale, error } = await admin
    .from('whatsapp_conversations')
    .select('phone')
    .eq('human_takeover', true)
    .lt('last_message_at', cutoff)

  if (error) {
    console.error('[whatsapp-reactivation-watchdog]', error)
    return json({ error: error.message }, 500)
  }

  const staleCandidates = (stale || []).map((row) => row.phone as string)
  if (!staleCandidates.length) return json({ ok: true, reactivated: 0 })

  // Reconfirma human_takeover=true e last_message_at < cutoff no próprio UPDATE
  // (não só no SELECT de cima), pra evitar reativar uma conversa que o cliente
  // acabou de mandar mensagem enquanto este watchdog rodava.
  const { data: updated, error: updateError } = await admin
    .from('whatsapp_conversations')
    .update({ human_takeover: false, updated_at: new Date().toISOString() })
    .in('phone', staleCandidates)
    .eq('human_takeover', true)
    .lt('last_message_at', cutoff)
    .select('phone')

  if (updateError) {
    console.error('[whatsapp-reactivation-watchdog] update', updateError)
    return json({ error: updateError.message }, 500)
  }

  const phones = (updated || []).map((row) => row.phone as string)
  if (!phones.length) return json({ ok: true, reactivated: 0 })

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const nudgeText = `${greetingNow()}! 😊 Ainda estou por aqui se precisar de algo. Se preferir, também dá pra ver os serviços, consultar horários disponíveis e agendar direto pelo nosso site: www.barbeariadoju.com.br`
  let skippedCount = 0
  // v29.21.0 / v29.26.0 - guarda local de horario (20h-8h). A JANELA COMPLETA de contato
  // (domingo e feriado nunca; sabado ate 15h; demais dias 8h-20h) e aplicada no AGENDADOR,
  // pela migration 110: o cron so chama esta function quando public.juia_quiet_now() e falso.
  // Regra em um lugar so; isto aqui e apenas rede de seguranca para disparo manual.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  const quietHours = quietHour >= 20 || quietHour < 8

  for (const phone of phones) {
    try {
      if (quietHours || await shouldSkipNudge(admin, phone)) {
        skippedCount++
        continue
      }
      const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, text: nudgeText }),
      })
      const sendData = await sendResponse.json().catch(() => ({}))
      const sentMessageId = String(sendData?.key?.id || '') || null

      await admin.from('whatsapp_messages').insert({
        phone,
        direction: 'out',
        body: nudgeText,
        sent_by: 'bot',
        evolution_message_id: sentMessageId,
      })

      await admin
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('phone', phone)
    } catch (sendError) {
      console.error('[whatsapp-reactivation-watchdog] nudge falhou', phone, sendError)
    }
  }

  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (pushSecret) {
    await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({
        custom: {
          title: '🤖 JuIA reativada automaticamente',
          body: phones.length === 1
            ? `A conversa com ${phones[0]} ficou ${INACTIVITY_MINUTES} min sem atividade. A JuIA voltou a responder.`
            : `${phones.length} conversas ficaram ${INACTIVITY_MINUTES} min sem atividade. A JuIA voltou a responder.`,
          tag: 'whatsapp-auto-reactivate',
        },
      }),
    }).catch((error) => console.error('[whatsapp-reactivation-watchdog] push', error))
  }

  return json({ ok: true, reactivated: phones.length, nudged: phones.length - skippedCount, skipped_nudge: skippedCount, phones })
})
