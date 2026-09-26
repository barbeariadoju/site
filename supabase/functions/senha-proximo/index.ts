import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { montarMensagemProximo, ehProximo, horaPermitida } from '../_shared/senha-digital.ts'

// v29.241.0 — "Você é o próximo" da Senha Digital. Cron bdj-senha-proximo a cada minuto,
// 8h–19h de Brasília (migração 179). Modelo: whatsapp-arrival-route (reserva otimista da
// marca proximo_avisado_at; se o envio falha, a marca é desfeita e a rodada seguinte tenta).
// Quem pegou a senha sem ninguém na frente já foi avisado na própria mensagem da senha.

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
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }
}

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || request.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)

  const { data: hoje, hora } = agoraSP()
  if (!horaPermitida(Number(hora.slice(0, 2)))) return json({ ok: true, quiet_hours: true })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) return json({ error: 'WhatsApp indisponível.' }, 500)

  const { data: dia, error } = await admin.from('bookings')
    .select('id, customer_name, customer_phone, start_time, end_time, status, channel, proximo_avisado_at')
    .eq('booking_date', hoje)
    .in('status', ['pending', 'confirmed'])
  if (error) { console.error('[senha-proximo] consulta', error); return json({ error: error.message }, 500) }

  const senhas = (dia || []).filter((b: any) => b.channel === 'porta' && !b.proximo_avisado_at)
  const results: unknown[] = []
  for (const b of senhas) {
    const outros = (dia || []).filter((o: any) => o.id !== b.id)
    if (!ehProximo(hora, String(b.start_time), outros)) continue
    const number = toWhatsNumber(b.customer_phone)
    if (!number) { results.push({ booking_id: b.id, skipped: 'telefone' }); continue }

    const { data: claimed } = await admin.from('bookings')
      .update({ proximo_avisado_at: new Date().toISOString() })
      .eq('id', b.id).is('proximo_avisado_at', null).select('id')
    if (!claimed?.length) continue

    const text = semEmoji(montarMensagemProximo({ nome: b.customer_name, horario: String(b.start_time) }))
    try {
      const response = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number, text }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`Evolution ${response.status}`)
      await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: text, sent_by: 'bot', evolution_message_id: String(data?.key?.id || '') || null })
      results.push({ booking_id: b.id, ok: true })
    } catch (sendError) {
      await admin.from('bookings').update({ proximo_avisado_at: null }).eq('id', b.id)
      console.error('[senha-proximo] envio', b.id, sendError)
      results.push({ booking_id: b.id, ok: false, error: sendError instanceof Error ? sendError.message : String(sendError) })
    }
  }
  return json({ ok: true, hoje, hora, senhas: senhas.length, results })
})
