// Guarda de qual visita veio um código que está viajando numa mensagem de WhatsApp.
// Chamada pelo site, sem sessão — por isso verify_jwt=false e validação rígida da entrada.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOKEN_RE = /^[a-z0-9]{6,12}$/
const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const token = typeof body.token === 'string' ? body.token.trim().toLowerCase() : ''
    if (!TOKEN_RE.test(token)) {
      return new Response(JSON.stringify({ ok: false, error: 'token inválido' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // upsert: se o mesmo código chegar duas vezes, mantém o primeiro registro
    const { error } = await admin.from('whatsapp_attribution').upsert({
      token,
      ga_client_id: clip(body.ga_client_id, 64),
      gclid: clip(body.gclid, 200),
      landing_page: clip(body.landing_page, 300),
      referrer: clip(body.referrer, 300),
      utm_source: clip(body.utm_source, 80),
      utm_medium: clip(body.utm_medium, 80),
      utm_campaign: clip(body.utm_campaign, 120),
    }, { onConflict: 'token', ignoreDuplicates: true })

    if (error) {
      console.error('[whatsapp-attribution]', error)
      return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[whatsapp-attribution] fatal', e)
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
