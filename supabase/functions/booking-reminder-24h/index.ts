import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

const saoPauloParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce<Record<string,string>>((acc, p) => { acc[p.type] = p.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET')?.trim() || ''
  if (!secret || request.headers.get('x-webhook-secret') !== secret) return json({ error: 'Não autorizado.' }, 401)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

    const now = new Date()
    const minLocal = saoPauloParts(new Date(now.getTime() + 23.5 * 60 * 60 * 1000))
    const maxLocal = saoPauloParts(new Date(now.getTime() + 24.5 * 60 * 60 * 1000))
    const minDate = minLocal.slice(0,10), maxDate = maxLocal.slice(0,10)

    const { data: bookings, error } = await admin.from('bookings').select('*')
      .in('status', ['pending','confirmed'])
      .gte('booking_date', minDate).lte('booking_date', maxDate)
      .not('customer_email', 'is', null)
    if (error) throw error

    const candidates = (bookings || []).filter((b:any) => {
      const local = `${b.booking_date}T${String(b.start_time).slice(0,8)}`
      return local >= minLocal && local <= maxLocal
    })

    const results:any[] = []
    for (const booking of candidates) {
      const { data: previous } = await admin.from('email_queue').select('id,status')
        .eq('booking_id', booking.id).eq('event_type', 'booking_reminder_24h')
        .eq('recipient_type', 'customer').maybeSingle()
      if (previous?.id) { results.push({ booking_id: booking.id, skipped: 'duplicate', status: previous.status }); continue }

      const response = await fetch(`${url}/functions/v1/booking-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
        body: JSON.stringify({ booking_id: booking.id, event_type: 'booking_reminder_24h', notify_admin: false }),
      })
      const body = await response.json().catch(() => ({}))
      results.push({ booking_id: booking.id, ok: response.ok, status: response.status, body })
    }

    return json({ ok: true, checked: bookings?.length || 0, candidates: candidates.length, results })
  } catch (error) {
    console.error('[booking-reminder-24h]', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
