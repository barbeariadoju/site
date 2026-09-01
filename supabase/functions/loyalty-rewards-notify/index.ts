import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'

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

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

const firstName = (value: string) => String(value || 'você').trim().split(/\s+/)[0] || 'você'
const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// v29.10.0 — avisa o cliente por WhatsApp assim que ele completa 10 pontos de fidelidade
// (loyalty_rewards status='available', notified_at ainda nulo). Deixa claro o prazo de 30
// dias e que o benefício é pessoal/intransferível (pedido explícito do Juliano — sem isso,
// um cliente podia completar o cartão e nunca vir resgatar, ou tentar passar pra outra
// pessoa). Mesmo padrão de envio/registro do customer-birthday.
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)
  // v29.21.0 / v29.26.0 - guarda local de horario (20h-8h). A JANELA COMPLETA de contato
  // (domingo e feriado nunca; sabado ate 15h; demais dias 8h-20h) e aplicada no AGENDADOR,
  // pela migration 110: o cron so chama esta function quando public.juia_quiet_now() e falso.
  // Regra em um lugar so; isto aqui e apenas rede de seguranca para disparo manual.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (quietHour >= 20 || quietHour < 8) return json({ ok: true, quiet_hours: true })

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true
  const onlyPhone = canonicalPhone(String(body?.only_phone || ''))

  const { data: due, error } = await admin.rpc('loyalty_rewards_due_for_notice')
  if (error) {
    console.error('[loyalty-rewards-notify]', error)
    return json({ error: error.message }, 500)
  }

  let candidates = (due || []).filter((row: any) => canonicalPhone(row.phone))
  if (onlyPhone) candidates = candidates.filter((row: any) => canonicalPhone(row.phone) === onlyPhone)

  if (dryRun) {
    return json({ ok: true, dry_run: true, would_notify: candidates.length, customers: candidates.map((c: any) => ({ name: c.name, phone: c.phone, expires_at: c.expires_at })) })
  }

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')

  let sent = 0
  let failed = 0
  for (const c of candidates) {
    const phone = canonicalPhone(c.phone)
    const expiresLabel = ddmm(new Date(c.expires_at))
    const text = `🎉 Parabéns, ${firstName(c.name)}! Você completou 10 pontos de fidelidade na Barbearia do Ju e ganhou 1 serviço grátis! Você tem até ${expiresLabel} (30 dias) pra resgatar — depois disso o prêmio expira. É um benefício pessoal, vale só pra você (intransferível). Da próxima vez que agendar, é só chamar aqui que eu já aplico sozinha, sem precisar pedir! 😊`
    try {
      const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, text: semEmoji(text) }),
      })
      if (!sendResponse.ok) throw new Error(`sendText ${sendResponse.status}`)
      const sendData = await sendResponse.json().catch(() => ({}))
      const sentMessageId = String(sendData?.key?.id || '') || null

      await admin.from('whatsapp_messages').insert({ phone, direction: 'out', body: text, sent_by: 'bot', evolution_message_id: sentMessageId })
      await admin.from('whatsapp_conversations').upsert({ phone, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
      await admin.from('loyalty_rewards').update({ notified_at: new Date().toISOString() }).eq('id', c.reward_id)
      sent++
    } catch (sendError) {
      failed++
      console.error('[loyalty-rewards-notify] envio falhou', phone, sendError)
    }
  }

  return json({ ok: true, checked: candidates.length, sent, failed })
})
