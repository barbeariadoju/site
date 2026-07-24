import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Recebe pedidos de lista de espera vindos do site (agendar.html).
// Mesmo padrão de CORS/validação do create-public-booking.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const body = await req.json()

    const name = String(body?.customer_name || '').trim()
    const phone = String(body?.customer_phone || '').replace(/\D/g, '')
    if (name.length < 2 || name.length > 100) return json({ error: 'Informe seu nome.' }, 400)
    if (phone.length < 10 || phone.length > 13) return json({ error: 'Informe um WhatsApp válido com DDD.' }, 400)

    const email = body?.customer_email ? String(body.customer_email).trim().toLowerCase() : null

    const period = ['manha', 'tarde', 'qualquer'].includes(String(body?.preferred_period)) ? String(body.preferred_period) : 'qualquer'

    let preferredDate: string | null = null
    const rawDate = String(body?.preferred_date || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      // não aceita data no passado
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      if (rawDate >= today) preferredDate = rawDate
    }

    const serviceName = body?.service_name ? String(body.service_name).slice(0, 200) : null
    const servicePrice = Number.isFinite(Number(body?.service_price)) && Number(body?.service_price) >= 0 ? Number(body.service_price) : null
    const duration = Number.isInteger(Number(body?.duration_minutes)) && Number(body.duration_minutes) >= 10 && Number(body.duration_minutes) <= 240 ? Number(body.duration_minutes) : null
    const notes = body?.notes ? String(body.notes).trim().slice(0, 500) : null

    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, service)

    // Uma entrada ativa por telefone: se já está esperando, atualiza as preferências
    // em vez de criar duplicata (evita a mesma pessoa aparecer várias vezes na tela).
    const { data: existing } = await admin
      .from('waitlist')
      .select('id')
      .eq('customer_phone', phone)
      .eq('status', 'esperando')
      .maybeSingle()

    const payload = {
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      service_name: serviceName,
      service_price: servicePrice,
      duration_minutes: duration,
      preferred_date: preferredDate,
      preferred_period: period,
      notes,
      source: 'site',
    }

    let id = existing?.id || null
    if (existing) {
      const { error } = await admin.from('waitlist').update(payload).eq('id', existing.id)
      if (error) { console.error('[join-waitlist] update', error); return json({ error: 'Não foi possível registrar. Tente novamente.' }, 500) }
    } else {
      const { data, error } = await admin.from('waitlist').insert(payload).select('id').single()
      if (error) { console.error('[join-waitlist] insert', error); return json({ error: 'Não foi possível registrar. Tente novamente.' }, 500) }
      id = data.id
    }

    // Avisa o dono que alguém entrou na lista (não bloqueia a resposta).
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (pushSecret && !existing) {
      const when = preferredDate ? preferredDate.split('-').reverse().slice(0, 2).join('/') : 'qualquer dia'
      const turno = period === 'manha' ? 'manhã' : period === 'tarde' ? 'tarde' : 'qualquer horário'
      fetch(`${url}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({ custom: {
          title: '📋 Novo pedido de encaixe',
          body: `${name} quer ${when} (${turno})${serviceName ? `\n${serviceName}` : ''}`,
          url: '/admin-espera.html?app=1',
          tag: `waitlist-${id}`,
        } }),
      }).catch((e) => console.error('[join-waitlist] push', e))
    }

    return json({ ok: true, id, updated: Boolean(existing) })
  } catch (error) {
    console.error('[join-waitlist]', error)
    return json({ error: 'Não foi possível registrar. Tente novamente.' }, 500)
  }
})
