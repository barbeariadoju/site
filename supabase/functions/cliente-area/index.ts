import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'

// v29.202.0 — Área do cliente (cliente.html) atrás de um código enviado pelo WhatsApp.
//
// Antes o site chamava get_public_customer_summary(telefone) direto com a chave anônima: quem
// soubesse o número de um cliente via nome, pontos e PRÓXIMO HORÁRIO dele. Auditoria de 17/09/2026,
// decisão do Juliano ("vamos arrumar os três casos"). Fluxo agora:
//   POST {action:'send',   phone}         → manda código de 6 dígitos pro WhatsApp do número
//   POST {action:'verify', phone, code}   → confere, abre sessão (token 12 h) e devolve o resumo
//   POST {action:'resume', token}         → devolve o resumo de novo (recarregou a página)
// Só esta function (service_role) chama a RPC; o anon perdeu EXECUTE nela (migration 163).
//
// Anti-abuso: 3 códigos/telefone/hora, 60 s entre códigos, 5 tentativas por código, código vale
// 10 min. Telefone sem cadastro recebe a MESMA resposta de "código enviado" (sem enumeração) — só
// não manda nada. Mensagem sem emoji (regra de 01/09/2026).

const ALLOWED_ORIGINS = new Set(['https://www.barbeariadoju.com.br', 'https://barbeariadoju.com.br', 'http://127.0.0.1:8090', 'http://localhost:8090'])
let requestOrigin: string | null = null
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin',
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders() })

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

const digitsOf = (s: unknown) => String(s || '').replace(/\D/g, '')
// Mesma regra de phone_key() do banco: 11 a 13 dígitos → últimos 8.
const phoneKeyOf = (s: unknown) => { const d = digitsOf(s); return d.length >= 11 && d.length <= 13 ? d.slice(-8) : (d.length === 10 ? d.slice(-8) : '') }
const toWhatsNumber = (raw: string) => {
  const d = digitsOf(raw)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}
const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')

const RESPOSTA_ENVIO = 'Se este número tiver cadastro na barbearia, o código chega no WhatsApp em instantes. Vale por 10 minutos.'

Deno.serve(async (request: Request) => {
  requestOrigin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = requiredSecret('SUPABASE_URL')
  const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY')
  const pepper = Deno.env.get('CUSTOMER_AREA_OTP_PEPPER')?.trim() || serviceRoleKey.slice(0, 32)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '').trim()
  const nowIso = new Date().toISOString()

  const resumo = async (phone: string) => {
    const { data, error } = await admin.rpc('get_public_customer_summary', { p_phone: phone })
    if (error) throw new Error(error.message)
    return data
  }

  try {
    if (action === 'send') {
      const phone = digitsOf(body?.phone)
      const key = phoneKeyOf(phone)
      if (!key || phone.length < 10 || phone.length > 13) return json({ error: 'Informe um WhatsApp válido com DDD.' }, 400)

      const { data: recentes } = await admin.from('customer_area_otp').select('created_at').eq('phone_key', key)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()).order('created_at', { ascending: false })
      const lista = recentes || []
      if (lista.length >= 3) return json({ error: 'Você já pediu 3 códigos na última hora. Tente de novo mais tarde ou fale com a barbearia pelo WhatsApp.' }, 429)
      if (lista.length && Date.now() - new Date(lista[0].created_at).getTime() < 60 * 1000) return json({ ok: true, message: RESPOSTA_ENVIO, waitSeconds: 60 })

      // Sem cadastro: mesma resposta, nada enviado, nada gravado (não dá pra enumerar).
      const { data: perfil } = await admin.from('customer_profiles').select('id').eq('phone_key', key).eq('archived', false).limit(1)
      if (!perfil || !perfil.length) return json({ ok: true, message: RESPOSTA_ENVIO })

      const code = randomCode()
      const { error: insErr } = await admin.from('customer_area_otp').insert({
        phone_key: key, phone, code_hash: await sha256(`${pepper}:${key}:${code}`),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      if (insErr) throw new Error(insErr.message)

      const evolutionApiUrl = requiredSecret('EVOLUTION_API_URL')
      const evolutionApiKey = requiredSecret('EVOLUTION_API_KEY')
      const evolutionInstance = requiredSecret('EVOLUTION_INSTANCE_NAME')
      const number = toWhatsNumber(phone)
      const texto = `Seu código para a área do cliente da Barbearia do Ju é ${code}. Vale por 10 minutos. Se não foi você que pediu, é só ignorar esta mensagem.`
      const res = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number, text: semEmoji(texto) }),
      })
      const sent = await res.json().catch(() => ({}))
      await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: 'Seu código para a área do cliente da Barbearia do Ju é ******. Vale por 10 minutos.', sent_by: 'bot', evolution_message_id: String(sent?.key?.id || '') || null })
      if (!res.ok) console.error('[cliente-area] envio falhou', number, res.status)
      return json({ ok: true, message: RESPOSTA_ENVIO })
    }

    if (action === 'verify') {
      const phone = digitsOf(body?.phone)
      const key = phoneKeyOf(phone)
      const code = digitsOf(body?.code).slice(0, 6)
      if (!key || code.length !== 6) return json({ error: 'Digite os 6 dígitos do código.' }, 400)
      const { data: rows } = await admin.from('customer_area_otp').select('id, code_hash, attempts, expires_at, consumed_at')
        .eq('phone_key', key).is('consumed_at', null).order('created_at', { ascending: false }).limit(1)
      const otp = rows && rows.length ? rows[0] : null
      if (!otp || new Date(otp.expires_at).getTime() < Date.now()) return json({ error: 'Código vencido ou não encontrado. Peça um novo.' }, 400)
      if (Number(otp.attempts) >= 5) return json({ error: 'Muitas tentativas com este código. Peça um novo.' }, 429)
      const ok = otp.code_hash === await sha256(`${pepper}:${key}:${code}`)
      if (!ok) {
        await admin.from('customer_area_otp').update({ attempts: Number(otp.attempts) + 1 }).eq('id', otp.id)
        return json({ error: `Código incorreto. ${Math.max(0, 4 - Number(otp.attempts))} tentativa(s) restante(s).` }, 400)
      }
      const token = randomToken()
      await admin.from('customer_area_otp').update({ consumed_at: nowIso, session_token: token, session_expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() }).eq('id', otp.id)
      return json({ ok: true, token, summary: await resumo(phone) })
    }

    if (action === 'resume') {
      const token = String(body?.token || '').trim()
      if (!/^[0-9a-f]{48}$/.test(token)) return json({ error: 'Sessão inválida.' }, 401)
      const { data: rows } = await admin.from('customer_area_otp').select('phone, session_expires_at').eq('session_token', token).limit(1)
      const s = rows && rows.length ? rows[0] : null
      if (!s || !s.session_expires_at || new Date(s.session_expires_at).getTime() < Date.now()) return json({ error: 'Sessão expirada. Peça um novo código.' }, 401)
      return json({ ok: true, summary: await resumo(String(s.phone)) })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    console.error('[cliente-area]', e)
    return json({ error: 'Não foi possível consultar agora. Tente de novo em instantes.' }, 500)
  }
})
