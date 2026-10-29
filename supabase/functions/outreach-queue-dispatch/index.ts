import '../_shared/sem-contato.ts' // v29.317.0: nunca contatar (no_contact_at)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { digitandoMs, timeoutComDigitando } from '../_shared/humano.ts'
import { semEmoji } from '../_shared/sem-emoji.ts'

// v29.318.0 — fila de envio programado (tabela outreach_queue, migração 203). Pedido do Juliano, 29/10/2026:
// "pode deixar pra enviar de forma automática", "envia umas 5 por dia", "eu não vou lembrar de clicar".
//
// Cron bdj-outreach-queue a cada 20 min, terça a sábado. Por rodada sai NO MÁXIMO UMA mensagem, e só se:
//   - está entre 9h e 17h (São Paulo);
//   - hoje saíram menos de 5 da fila (todas as campanhas somadas — teto do Juliano);
//   - a última da fila saiu há 60 min ou mais.
// O item da vez é pulado de vez quando o cliente já marcou horário, pediu SAIR, foi arquivado ou está na
// lista de nunca contatar. É ADIADO (fica na fila, tenta na próxima rodada) quando houve mensagem com ele
// nas últimas 48 h, o Juliano está na conversa ou há pergunta numerada da JuIA esperando resposta.
// Item adiado por mais de 7 dias depois do dia marcado sai como 'pulado' (sem_janela).
// O envio entra no customer_outreach_log como 'reactivation', para o robô de reativação não mandar outra
// mensagem por cima nos 14 dias seguintes.

const LIMITE_DIA = 5
const INTERVALO_MIN = 60

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timeout) }
}

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

const agoraSP = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]))
  return { hoje: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || request.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)
  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true

  const { hoje, hora } = agoraSP()
  if (!dryRun && (hora < 9 || hora >= 17)) return json({ ok: true, fora_do_horario: true })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
  if (!dryRun && (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance)) return json({ error: 'WhatsApp indisponível.' }, 500)

  // Teto do dia e intervalo, contando o que a fila mandou (sent_at em horário de São Paulo).
  const inicioDia = new Date(`${hoje}T00:00:00-03:00`).toISOString()
  const { data: enviadosHoje, error: e1 } = await admin.from('outreach_queue').select('sent_at')
    .eq('status', 'enviado').gte('sent_at', inicioDia).order('sent_at', { ascending: false })
  if (e1) return json({ error: e1.message }, 500)
  if ((enviadosHoje || []).length >= LIMITE_DIA) return json({ ok: true, teto_do_dia: LIMITE_DIA })
  const ultimo = enviadosHoje?.[0]?.sent_at ? Date.parse(enviadosHoje[0].sent_at) : 0
  if (!dryRun && ultimo && Date.now() - ultimo < INTERVALO_MIN * 60000) return json({ ok: true, aguardando_intervalo: true })

  const { data: fila, error: e2 } = await admin.from('outreach_queue').select('*')
    .eq('status', 'fila').lte('send_on', hoje).order('send_on').order('id').limit(20)
  if (e2) return json({ error: e2.message }, 500)

  const vistos: unknown[] = []
  const pular = async (id: number, motivo: string) => { if (!dryRun) await admin.from('outreach_queue').update({ status: 'pulado', skip_reason: motivo }).eq('id', id) }

  for (const item of fila || []) {
    const phone = canonicalPhone(item.phone)
    if (!phone) { await pular(item.id, 'telefone'); vistos.push({ id: item.id, pulado: 'telefone' }); continue }
    const k = phone.slice(-8)

    // Pulos definitivos.
    const { data: perfis } = await admin.from('customer_profiles').select('id,archived,marketing_opt_out_at,no_contact_at').like('phone', `%${k}`)
    if ((perfis || []).some((p: any) => p.archived || p.marketing_opt_out_at || p.no_contact_at)) { await pular(item.id, 'sem_marketing'); vistos.push({ id: item.id, pulado: 'sem_marketing' }); continue }
    const { data: futuros } = await admin.rpc('phone_upcoming_bookings', { p_phone: phone })
    if (Array.isArray(futuros) && futuros.length) { await pular(item.id, 'ja_marcou'); vistos.push({ id: item.id, pulado: 'ja_marcou' }); continue }

    // Adiamentos: mensagem recente, Juliano na conversa, pergunta numerada pendente.
    const venceu = Date.parse(`${hoje}T12:00:00-03:00`) - Date.parse(`${item.send_on}T12:00:00-03:00`) > 7 * 86400000
    const { data: recente } = await admin.from('whatsapp_messages').select('id').like('phone', `%${k}`)
      .gte('created_at', new Date(Date.now() - 48 * 3600000).toISOString()).limit(1)
    const { data: conv } = await admin.from('whatsapp_conversations').select('human_takeover,human_takeover_at').eq('phone', phone).maybeSingle()
    const humano = !!(conv?.human_takeover && conv.human_takeover_at && Date.now() - Date.parse(conv.human_takeover_at) < 3 * 3600000)
    const { data: pendente } = await admin.rpc('juia_pending_numeric_question', { p_phone: phone })
    const adiar = recente?.length ? 'mensagem_48h' : humano ? 'juliano_na_conversa' : pendente ? 'pergunta_pendente' : ''
    if (adiar) {
      if (venceu) { await pular(item.id, 'sem_janela'); vistos.push({ id: item.id, pulado: 'sem_janela' }) }
      else vistos.push({ id: item.id, adiado: adiar })
      continue
    }

    if (dryRun) return json({ ok: true, dry_run: true, hoje, mandaria: { id: item.id, nome: item.customer_name, texto: item.text }, vistos })

    // Reserva a linha antes de enviar: duas rodadas ao mesmo tempo não mandam a mesma mensagem.
    const { data: reservado } = await admin.from('outreach_queue').update({ status: 'enviado', sent_at: new Date().toISOString() })
      .eq('id', item.id).eq('status', 'fila').select('id')
    if (!reservado?.length) continue
    const texto = semEmoji(item.text)
    try {
      const delay = digitandoMs(texto)
      const res = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, text: texto, delay }),
      }, timeoutComDigitando(delay))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`Evolution ${res.status}`)
      await admin.from('whatsapp_messages').insert({ phone, direction: 'out', body: texto, sent_by: 'bot', evolution_message_id: String(data?.key?.id || '') || null })
      await admin.from('whatsapp_conversations').upsert({ phone, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
      const customerId = item.customer_id || (perfis || [])[0]?.id || null
      await admin.from('customer_outreach_log').insert({ customer_id: customerId, phone, kind: 'reactivation', channel: 'whatsapp', details: { origem: 'outreach_queue', campaign: item.campaign, queue_id: item.id } })
      return json({ ok: true, enviado: { id: item.id, nome: item.customer_name }, vistos })
    } catch (e) {
      await admin.from('outreach_queue').update({ status: 'falhou', skip_reason: String(e).slice(0, 200), sent_at: null }).eq('id', item.id)
      return json({ ok: false, falhou: { id: item.id, erro: String(e) }, vistos }, 500)
    }
  }
  return json({ ok: true, nada_para_enviar: true, vistos })
})
