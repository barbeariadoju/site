import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { primeiroNome } from '../_shared/primeiro-nome.ts'

// v29.200.0 — Prazo do SINAL (regra do Juliano, 17/09/2026): "até 1h pra fazer o sinal; se não
// fizer, libera o horário. Isto só pra serviços de química, que são mais caros, duradouros e
// ocupam muito tempo na agenda".
// v29.240.0: vale também pro sinal de 50% de quem cancelou em cima da hora duas vezes (ju-ia-site e
// create-public-booking gravam prepay_amount + prepay_deadline_at do mesmo jeito).
//
// Quem marca o prazo é a JuIA (ju-ia-site), na hora em que pede o sinal de química em primeira
// visita: bookings.prepay_deadline_at = agora + 1h. Este cron (a cada 5 min, migration 161) pega
// os agendamentos com prazo vencido em que o cliente NEM declarou o Pix (comprovante/aviso) NEM o
// Juliano confirmou, cancela, limpa o estado da conversa pra JuIA não achar que ele ainda tem
// horário, avisa o cliente (como JuIA, sem tirar a conversa do automático) e avisa o Juliano.
//
// O que NÃO cancela: prepay_declared_at preenchido (mandou comprovante ou disse que pagou — o
// Juliano confere na mão) ou prepay_confirmed_at preenchido. Horário que já passou não é tocado.
// Sem guarda de silêncio das 20h: é consequência direta de uma conversa de uma hora antes.

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

const firstName = (value: unknown) => primeiroNome(value, '')
const money = (v: unknown) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const toWhatsNumber = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '')
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
  }

  const sendWhatsapp = async (to: string, textBody: string) => {
    const number = toWhatsNumber(to)
    const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
      body: JSON.stringify({ number, text: semEmoji(textBody) }),
    })
    const sendData = await sendResponse.json().catch(() => ({}))
    const sentMessageId = String(sendData?.key?.id || '') || null
    await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: semEmoji(textBody), sent_by: 'bot', evolution_message_id: sentMessageId })
    return sendResponse.ok
  }

  const notifyJuliano = async (title: string, body: string, tag: string) => {
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (!pushSecret) return
    await fetchWithTimeout(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ custom: { title, body: body.slice(0, 180), url: '/admin-agenda.html?app=1', tag } }),
    }).catch((error) => console.error('[prepay-deadline] push', error))
  }

  const agoraSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date()).replace(',', '')
  const hojeSP = agoraSP.slice(0, 10)

  const { data: vencidos, error } = await admin
    .from('bookings')
    .select('id, customer_name, customer_phone, booking_date, start_time, service_name, prepay_amount, prepay_deadline_at, notes')
    .not('prepay_deadline_at', 'is', null)
    .lt('prepay_deadline_at', new Date().toISOString())
    .is('prepay_declared_at', null)
    .is('prepay_confirmed_at', null)
    .in('status', ['pending', 'confirmed'])
    .order('prepay_deadline_at', { ascending: true })
    .limit(20)
  if (error) {
    console.error('[prepay-deadline] select', error)
    return json({ error: error.message }, 500)
  }

  let liberados = 0, pulados = 0
  for (const b of vencidos || []) {
    const inicio = `${String(b.booking_date)} ${String(b.start_time).slice(0, 5)}`
    // Horário que já passou não é liberado — não há mais o que liberar.
    if (inicio <= agoraSP) { pulados++; await admin.from('bookings').update({ prepay_deadline_at: null }).eq('id', b.id); continue }

    const nota = `Horário liberado automaticamente em ${agoraSP.slice(11, 16)} de ${hojeSP.split('-').reverse().join('/')}: sinal de ${money(b.prepay_amount || 50)} não chegou em 1 hora`
    const { data: upd, error: updErr } = await admin
      .from('bookings')
      .update({ status: 'cancelled', prepay_deadline_at: null, notes: [String(b.notes || '').trim(), nota].filter(Boolean).join(' | '), updated_at: new Date().toISOString() })
      .eq('id', b.id).is('prepay_declared_at', null).is('prepay_confirmed_at', null).in('status', ['pending', 'confirmed'])
      .select('id')
    if (updErr || !upd || !upd.length) { pulados++; continue }
    liberados++

    // Estado da conversa: sem isto a JuIA acha que ele ainda tem horário reservado.
    const phone = toWhatsNumber(b.customer_phone)
    try {
      const { data: convRow } = await admin.from('whatsapp_conversations').select('state').eq('phone', phone).maybeSingle()
      const st = (convRow?.state && typeof convRow.state === 'object') ? convRow.state as Record<string, unknown> : {}
      await admin.from('whatsapp_conversations').update({
        state: { ...st, completed: false, date: null, time: null, pending_rebook: null, sinal_pendente: null, pix_offered: false },
        updated_at: new Date().toISOString(),
      }).eq('phone', phone)
    } catch (stErr) { console.error('[prepay-deadline] estado', stErr) }

    const quando = b.booking_date === hojeSP ? 'hoje' : `${String(b.booking_date).slice(8, 10)}/${String(b.booking_date).slice(5, 7)}`
    const nome = firstName(b.customer_name)
    const texto = `${nome ? `${nome}, ` : ''}como o sinal de ${money(b.prepay_amount || 50)} não chegou dentro de 1 hora, o horário de ${quando} às ${String(b.start_time).slice(0, 5)} (${b.service_name}) foi liberado. Se ainda quiser fazer, é só me chamar por aqui que eu consulto a disponibilidade e reservo de novo. Se você já fez o Pix, me manda o comprovante que eu vejo com o Juliano.`
    try { await sendWhatsapp(b.customer_phone, texto) } catch (sendErr) { console.error('[prepay-deadline] whatsapp', sendErr) }
    await notifyJuliano('Horário liberado: sinal não chegou em 1h', `${b.customer_name || phone} — ${b.service_name}, ${quando} às ${String(b.start_time).slice(0, 5)}. Cancelado sozinho; se o Pix aparecer no extrato, reative pela Agenda.`, `prepay-deadline-${b.id}`)
  }

  return json({ ok: true, liberados, pulados, verificados: (vencidos || []).length })
})
