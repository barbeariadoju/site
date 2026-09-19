import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { montarAvisoChegada, minutosAte, dentroDaJanela, horaPermitida, CRIADO_HA_MIN } from '../_shared/aviso-chegada.ts'

// v29.206.0 — aviso de chegada com a rota do Google Maps ~30 min antes do horário (dica do
// cliente Rafael, 18/09/2026). Cron bdj-arrival-route a cada 5 min, das 7h às 20h.
// v29.207.0 (19/09/2026): deixou de obedecer ao juia_quiet_now() — horário das 8h00 recebe o
// aviso às 7h30 (regra do Juliano). Exceção estreita, igual à do comprovante: só este aviso,
// só na janela de 30 min do próprio agendamento, piso 7h e teto 20h (horaPermitida).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timeout) }
}

const toWhatsNumber = (raw: string) => {
  const digits = String(raw || '').replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

const agoraSP = () => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).reduce<Record<string, string>>((acc, x) => { acc[x.type] = x.value; return acc }, {})
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || request.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)

  // Piso 7h / teto 20h. O silêncio da JuIA (8h) NÃO vale aqui: o horário é do próprio cliente.
  const agora = agoraSP()
  const hora = Number(agora.slice(11, 13))
  if (!horaPermitida(hora)) return json({ ok: true, quiet_hours: true })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) return json({ error: 'WhatsApp indisponível.' }, 500)

  const { data: bookings, error } = await admin.from('bookings')
    .select('id, customer_name, customer_phone, booking_date, start_time, created_at')
    .eq('booking_date', agora.slice(0, 10))
    .in('status', ['pending', 'confirmed'])
    .is('arrival_route_sent_at', null)
  if (error) { console.error('[whatsapp-arrival-route] consulta', error); return json({ error: error.message }, 500) }

  const limiteCriacao = Date.now() - CRIADO_HA_MIN * 60000
  const results: unknown[] = []
  for (const b of bookings || []) {
    const minutos = minutosAte(agora, `${b.booking_date}T${String(b.start_time).slice(0, 5)}`)
    if (!dentroDaJanela(minutos)) continue
    const number = toWhatsNumber(b.customer_phone)
    if (!number) { results.push({ booking_id: b.id, skipped: 'telefone' }); continue }
    if (Date.parse(b.created_at) > limiteCriacao) {
      // Acabou de marcar: marca como enviado pra não cair na rodada seguinte.
      await admin.from('bookings').update({ arrival_route_sent_at: new Date().toISOString() }).eq('id', b.id)
      results.push({ booking_id: b.id, skipped: 'recem_agendado' }); continue
    }

    // Reserva o envio antes de mandar: duas rodadas sobrepostas não mandam duas vezes.
    const { data: claimed } = await admin.from('bookings')
      .update({ arrival_route_sent_at: new Date().toISOString() })
      .eq('id', b.id).is('arrival_route_sent_at', null).select('id')
    if (!claimed?.length) continue

    const text = montarAvisoChegada({ nome: b.customer_name, horario: String(b.start_time) })
    try {
      const response = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number, text: semEmoji(text) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`Evolution ${response.status}`)
      await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: text, sent_by: 'bot', evolution_message_id: String(data?.key?.id || '') || null })
      results.push({ booking_id: b.id, ok: true, minutos })
    } catch (sendError) {
      // Libera a marca: a próxima rodada (5 min) ainda está dentro da janela e tenta de novo.
      await admin.from('bookings').update({ arrival_route_sent_at: null }).eq('id', b.id)
      console.error('[whatsapp-arrival-route] envio', b.id, sendError)
      results.push({ booking_id: b.id, ok: false, error: sendError instanceof Error ? sendError.message : String(sendError) })
    }
  }
  return json({ ok: true, agora, checked: bookings?.length || 0, results })
})
