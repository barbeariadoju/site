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
  // v29.21.0 / v29.26.0 - guarda local de horario (20h-8h). A JANELA COMPLETA de contato
  // (domingo e feriado nunca; sabado ate 15h; demais dias 8h-20h) e aplicada no AGENDADOR,
  // pela migration 110: o cron so chama esta function quando public.juia_quiet_now() e falso.
  // Regra em um lugar so; isto aqui e apenas rede de seguranca para disparo manual.
  const quietHour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  if (quietHour >= 20 || quietHour < 8) return json({ ok: true, quiet_hours: true })

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
    // v29.66.0 (22/08/2026, Juliano ligou a reativação de 30 dias): texto genérico "sentimos
    // sua falta" virou mensagem com o que ele fez e há quanto tempo, e o CTA é o mesmo que
    // já converte no lead-followup ("me diz o dia") — a resposta cai na JuIA como pedido de
    // horário. Nome que parece empresa/título (Espaço, Salão, Dr…) não vira vocativo.
    const nomeCru = firstName(c.name)
    const nome = /^(espaco|espaço|salao|salão|studio|outlet|loja|dr|dra|sr|sra|conta)$/i.test(nomeCru) || nomeCru.length < 3 ? '' : nomeCru
    const servico = String(c.last_service || '').split(/\s*\+\s*/)[0].trim().toLowerCase() || 'atendimento'
    const tempo = c.days_since >= 60 ? 'mais de dois meses' : c.days_since >= 45 ? 'mais de um mês e meio' : c.days_since >= 35 ? 'mais de um mês' : 'um mês'
    const text = `Oi${nome ? `, ${nome}` : ''}! 💈 Aqui é a JuIA, da Barbearia do Ju. Já faz ${tempo} desde o seu último ${servico} com o Juliano — deve estar na hora de dar um trato, né? 😄\n\nMe diz o dia que fica melhor pra você que eu confiro os horários (hora marcada, sem fila). Se preferir, dá pra agendar direto no site: https://www.barbeariadoju.com.br/agendar/`
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
