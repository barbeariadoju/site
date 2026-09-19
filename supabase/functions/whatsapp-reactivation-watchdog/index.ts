import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { primeiroNome } from '../_shared/primeiro-nome.ts'

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
// v29.85.0 — mensagem humana nos últimos 90 min = a conversa é do Juliano, o watchdog não toca.
const HUMAN_RECENT_MINUTES = 90
// v29.204.0 — cliente com pedido em aberto: o Juliano é cutucado por push a cada hora e a
// conversa só volta pra JuIA (em silêncio) depois de 3 h sem resposta dele.
const PENDING_RELEASE_MINUTES = 180
const PENDING_PUSH_EVERY_MINUTES = 60

// v29.204.0 — caso Rodrigo Miranda (17/09/2026): o Juliano mandou os horários na mão às 17h17,
// o cliente respondeu às 17h47 "Pode ser sábado às 14:45. Marca dois cortes, pode ser?", e às
// 18h48 (91 min depois da última mensagem humana — 1 min além da guarda de 90) o watchdog
// devolveu a conversa pra JuIA e mandou o "Boa noite! Ainda estou por aqui se precisar de algo…
// agendar pelo site" — genérico, por cima de um pedido concreto, ignorando o que o cliente
// tinha acabado de dizer. O Juliano teve que responder na mão às 18h51.
//
// Regra nova: o watchdog NÃO manda mais mensagem nenhuma pro cliente. Ele só decide se a
// conversa volta pra JuIA e avisa o Juliano:
//   - última mensagem é do cliente e parece um PEDIDO (pergunta, "pode ser", horário, marcar…):
//     é o Juliano quem tem que responder. Push "fulano está esperando há X min" a cada hora,
//     takeover mantido. Só depois de 3 h sem resposta a conversa volta pra JuIA, em silêncio,
//     pra ela atender a PRÓXIMA mensagem dele — nunca um texto genérico por cima do pedido.
//   - última mensagem é do cliente mas é despedida/figurinha/"obrigado", ou a última é nossa:
//     conversa terminou; takeover volta pra JuIA em silêncio depois dos 20 min, sem mensagem.
// O "cochicho" com link do site (v28.x) deixou de existir: em todos os casos reais revisados
// ele saiu fora de hora (Kelvin, Helder, Rafael, Rodrigo 27/08, Rodrigo 17/09).

const CLOSING_TEXT = /^(obrigad[oa]s?|valeu|vlw|blz|beleza|ok(ay)?|tranquilo|falou|ate (mais|logo|breve)|tchau|flw|show|top|jo[ií]a|de nada|por nada|combinado|fechado)[\s!.,]*$/
function looksLikeClosingOrReaction(rawBody: string): boolean {
  const body = String(rawBody || '').trim()
  if (!body || body === '[mídia ou mensagem sem texto]') return true
  if (!/[a-zA-ZÀ-ÿ]/.test(body)) return true // só emoji/figurinha/pontuação, sem nenhuma letra
  const normalized = body.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return CLOSING_TEXT.test(normalized)
}
const DESPEDIDA = /\b(abraco|abracos|bom fds|bom final de semana|boa semana|bom descanso|boa noite|bom dia|boa tarde|fico no aguardo|fico despreocupado|te aviso|eu aviso|passo ai|passo la|da um toque|da um tok|me avisa|qualquer coisa|ate (mais|logo|breve|amanha|sabado|segunda|terca|quarta|quinta|sexta))\b/
const PEDIDO = /\?|\b(quero|queria|gostaria|pode|poderia|consigo|consegue|tem |teria|horario|marcar|agendar|remarcar|cancelar|quanto|qual|como|onde|quando|preciso|me (fala|diz|passa|manda)|disponivel|vaga)\b/

type Ultima = { pendente: boolean; body: string; minutos: number; nossa: boolean }
async function ultimaMensagem(admin: any, phone: string): Promise<Ultima | null> {
  const { data: last } = await admin
    .from('whatsapp_messages')
    .select('direction, body, sent_by, created_at')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!last) return null
  const minutos = Math.round((Date.now() - new Date(last.created_at).getTime()) / 60000)
  if (last.direction !== 'in') return { pendente: false, body: String(last.body || ''), minutos, nossa: true }
  if (looksLikeClosingOrReaction(last.body)) return { pendente: false, body: String(last.body || ''), minutos, nossa: false }
  const norm = String(last.body || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  // Despedida sem pedido ("até sábado", "te aviso") não é pendência; pedido é pendência mesmo com despedida junto.
  const pedido = PEDIDO.test(norm)
  if (!pedido) return { pendente: false, body: String(last.body || ''), minutos, nossa: false }
  return { pendente: true, body: String(last.body || ''), minutos, nossa: false }
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
  const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const push = async (title: string, body: string, tag: string) => {
    if (!pushSecret) return
    await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title, body: body.slice(0, 180), url: '/admin-mensagens.html?app=1', tag } }),
    }).catch((error) => console.error('[whatsapp-reactivation-watchdog] push', error))
  }

  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString()

  const { data: stale, error } = await admin
    .from('whatsapp_conversations')
    .select('phone, state')
    .eq('human_takeover', true)
    .lt('last_message_at', cutoff)

  if (error) {
    console.error('[whatsapp-reactivation-watchdog]', error)
    return json({ error: error.message }, 500)
  }
  if (!stale || !stale.length) return json({ ok: true, reactivated: 0 })

  // v29.85.0 — mensagem HUMANA na conversa nos últimos 90 min = o Juliano está conduzindo.
  const humanCutoff = new Date(Date.now() - HUMAN_RECENT_MINUTES * 60 * 1000).toISOString()
  const liberar: string[] = []
  const esperando: { phone: string; nome: string; minutos: number; body: string }[] = []
  let comHumano = 0
  for (const row of stale) {
    const phone = row.phone as string
    const { data: humanRecente } = await admin.from('whatsapp_messages').select('id')
      .eq('phone', phone).eq('direction', 'out').eq('sent_by', 'human')
      .gte('created_at', humanCutoff).limit(1)
    if (humanRecente && humanRecente.length) { comHumano++; continue }

    const ultima = await ultimaMensagem(admin, phone)
    if (ultima && ultima.pendente && ultima.minutos < PENDING_RELEASE_MINUTES) {
      // Pedido em aberto e ainda dentro das 3 h: é do Juliano. Cutuca por push (1x/hora) e segura.
      const st = (row.state && typeof row.state === 'object') ? row.state as Record<string, unknown> : {}
      const lastPush = st.waiting_reply_push_at ? new Date(String(st.waiting_reply_push_at)).getTime() : 0
      if (Date.now() - lastPush >= PENDING_PUSH_EVERY_MINUTES * 60 * 1000) {
        const nome = primeiroNome(st.name) || phone
        esperando.push({ phone, nome, minutos: ultima.minutos, body: ultima.body })
        await admin.from('whatsapp_conversations').update({ state: { ...st, waiting_reply_push_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('phone', phone)
      }
      continue
    }
    liberar.push(phone)
  }

  for (const e of esperando) {
    await push(
      `⏰ ${e.nome} está esperando sua resposta há ${e.minutos} min`,
      `"${e.body.slice(0, 110)}" — a JuIA não vai responder por cima: a conversa é sua. Sem resposta em 3 h, ela volta a atender a próxima mensagem dele.`,
      `waiting-reply-${e.phone}`,
    )
  }

  if (!liberar.length) return json({ ok: true, reactivated: 0, kept_with_human: comHumano, waiting_juliano: esperando.length })

  // Reconfirma human_takeover=true e last_message_at < cutoff no próprio UPDATE
  // (não só no SELECT de cima), pra evitar reativar uma conversa que o cliente
  // acabou de mandar mensagem enquanto este watchdog rodava.
  const { data: updated, error: updateError } = await admin
    .from('whatsapp_conversations')
    .update({ human_takeover: false, updated_at: new Date().toISOString() })
    .in('phone', liberar)
    .eq('human_takeover', true)
    .lt('last_message_at', cutoff)
    .select('phone')

  if (updateError) {
    console.error('[whatsapp-reactivation-watchdog] update', updateError)
    return json({ error: updateError.message }, 500)
  }

  const phones = (updated || []).map((row) => row.phone as string)
  if (phones.length) {
    await push(
      '🤖 JuIA voltou a atender',
      phones.length === 1
        ? `A conversa com ${phones[0]} ficou sem atividade; a JuIA responde a próxima mensagem. Nada foi enviado ao cliente.`
        : `${phones.length} conversas ficaram sem atividade; a JuIA responde a próxima mensagem. Nada foi enviado aos clientes.`,
      'whatsapp-auto-reactivate',
    )
  }

  return json({ ok: true, reactivated: phones.length, kept_with_human: comHumano, waiting_juliano: esperando.length, phones })
})
