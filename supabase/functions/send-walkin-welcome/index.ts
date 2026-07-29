import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Chamada pelo admin (admin-balcao) logo depois de registrar um atendimento de balcão
// cujo telefone AINDA não constava no CRM (admin_register_walkin_visit devolve
// is_new_customer). Manda uma mensagem única de boas-vindas convidando o cliente a
// conhecer o agendamento pelo WhatsApp/site — não é a pesquisa de satisfação (essa
// continua sendo só a do satisfaction-dispatch, disparada por e-mail/telefone de quem
// agendou pelo site). Requer sessão de admin válida (mesmo padrão do admin-booking-status).

const ALLOWED_ORIGINS = new Set([
  'https://www.barbeariadoju.com.br',
  'https://barbeariadoju.com.br',
])

let requestOrigin: string | null = null

const corsHeaders = (): Record<string, string> => ({
  'Access-Control-Allow-Origin': requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : 'https://www.barbeariadoju.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Origin',
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders() })

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

Deno.serve(async (request: Request) => {
  requestOrigin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = request.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão administrativa ausente.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Configuração interna do Supabase incompleta.' }, 500)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Sessão administrativa inválida ou expirada.' }, 401)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Corpo da solicitação inválido.' }, 400)
    }

    const name = String(body?.name || 'Cliente').trim()
    const phone = canonicalPhone(String(body?.phone || ''))
    if (!phone) return json({ ok: true, sent: false, skipped: true, error: 'Telefone inválido para WhatsApp.' })

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return json({ ok: true, sent: false, skipped: true, error: 'Integração do WhatsApp não configurada.' })
    }

    const first = name.split(/\s+/)[0]
    const text = `Olá, ${first}! Foi um prazer te atender hoje na Barbearia do Ju 💈\n\nVocê sabia que da próxima vez pode agendar seu horário de um jeito bem mais simples? Se preferir, é só responder aqui mesmo neste WhatsApp que já agendamos pra você — ou, se preferir, acesse www.barbeariadoju.com.br/agendar e escolha o dia e horário com toda liberdade.\n\nTe esperamos em breve!`

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

    let sent = false
    let sendError = ''
    try {
      const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, text }),
      })
      sent = response.ok
      if (sent) {
        const sendData = await response.json().catch(() => ({}))
        const sentMessageId = String(sendData?.key?.id || '') || null
        await admin.from('whatsapp_messages').insert({ phone, direction: 'out', body: text, sent_by: 'bot', evolution_message_id: sentMessageId })
        await admin.from('whatsapp_conversations').upsert({ phone, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
      } else {
        sendError = `Falha no envio (${response.status}).`
      }
    } catch (error) {
      sendError = error instanceof Error ? error.message : 'Falha ao enviar WhatsApp.'
    }

    if (!sent) console.error('[send-walkin-welcome] send_failed', JSON.stringify({ phone, error: sendError }))
    return json({ ok: true, sent, error: sent ? '' : sendError })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha inesperada.' }, 500)
  }
})
