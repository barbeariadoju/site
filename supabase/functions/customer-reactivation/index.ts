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

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

const firstName = (value: string) => String(value || 'tudo bem').trim().split(/\s+/)[0] || 'tudo bem'

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  const provided = request.headers.get('x-webhook-secret') || ''
  if (!expected || provided !== expected) return json({ error: 'Não autorizado.' }, 401)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true
  const defaultDays = Number(body?.default_days ?? 45)
  const graceDays = Number(body?.grace_days ?? 10)
  const cooldownDays = Number(body?.cooldown_days ?? 40)
  // Parâmetro de teste: quando definido, restringe o envio a um único telefone,
  // permitindo testar o fluxo real sem atingir clientes de verdade.
  const onlyPhone = canonicalPhone(String(body?.only_phone || ''))

  const { data: due, error } = await admin.rpc('customers_due_for_reactivation', {
    p_default_days: defaultDays,
    p_grace_days: graceDays,
    p_cooldown_days: cooldownDays,
  })
  if (error) {
    console.error('[customer-reactivation]', error)
    return json({ error: error.message }, 500)
  }

  let candidates = (due || []).filter((row: any) => canonicalPhone(row.phone))
  if (onlyPhone) candidates = candidates.filter((row: any) => canonicalPhone(row.phone) === onlyPhone)

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      would_message: candidates.length,
      customers: candidates.map((c: any) => ({ name: c.name, phone: c.phone, last_visit: c.last_visit, days_since: c.days_since })),
    })
  }

  const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
  const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
  const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')

  let sent = 0
  let failed = 0
  for (const c of candidates) {
    const phone = canonicalPhone(c.phone)
    const text = `Oi, ${firstName(c.name)}! 💈 Sentimos sua falta aqui na Barbearia do Ju! Já faz um tempinho desde seu último atendimento — que tal renovar o visual? É só me chamar aqui que eu te ajudo a agendar um horário. 😊`
    try {
      const sendResponse = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, text }),
      })
      if (!sendResponse.ok) throw new Error(`sendText ${sendResponse.status}`)
      const sendData = await sendResponse.json().catch(() => ({}))
      const sentMessageId = String(sendData?.key?.id || '') || null

      await admin.from('whatsapp_messages').insert({ phone, direction: 'out', body: text, sent_by: 'bot', evolution_message_id: sentMessageId })
      await admin.from('whatsapp_conversations').upsert({ phone, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
      await admin.from('customer_outreach_log').insert({ customer_id: c.customer_id, phone, kind: 'reactivation', channel: 'whatsapp', details: { last_visit: c.last_visit, days_since: c.days_since } })
      await admin.from('customer_profiles').update({ last_contact_at: new Date().toISOString() }).eq('id', c.customer_id)
      sent++
    } catch (sendError) {
      failed++
      console.error('[customer-reactivation] envio falhou', phone, sendError)
    }
  }

  return json({ ok: true, dry_run: false, eligible: candidates.length, sent, failed })
})
