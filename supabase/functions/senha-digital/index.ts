import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeServiceSet, splitServiceNames } from '../_shared/service-rules.ts'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { montarMensagemSenha } from '../_shared/senha-digital.ts'

// v29.241.0 — Senha Digital (26/09/2026). Quem chega sem agendamento aponta o celular pro QR
// da parede (placa "Veio sem agendamento?"), informa nome/WhatsApp/serviço e a página /senha/
// chama esta function:
//   action 'criar'  -> senha_digital_criar (lock + primeiro horário livre de hoje + create_public_booking_v15
//                      + canal 'porta'), link de acompanhamento (mesmo esquema do meu-agendamento),
//                      push pro Juliano e WhatsApp com a senha e a previsão.
//   action 'status' -> posição na fila pelo code+token (a página consulta a cada 30 s).
// Diferenças de propósito em relação ao create-public-booking: sem sinal de 50% (a pessoa está
// na loja), sem booking-email (a confirmação padrão do site seria redundante), sem rota do Maps.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((b) => b.toString(16).padStart(2, '0')).join('')
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('')
const code = () => `BJ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
const hhmm = (t: unknown) => String(t || '').slice(0, 5)

const agoraSP = () => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).reduce<Record<string, string>>((acc, x) => { acc[x.type] = x.value; return acc }, {})
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }
}

const toWhatsNumber = (raw: string) => {
  const digits = String(raw || '').replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

// Posição na fila = quem tem horário ativo hoje e começa antes do meu (inclui quem está na
// cadeira). Quem já foi concluído/cancelado/faltou não conta.
async function situacao(admin: any, b: any) {
  const { data, hora } = agoraSP()
  const { data: dia } = await admin.from('bookings')
    .select('id, start_time, end_time, status, channel')
    .eq('booking_date', data)
    .in('status', ['pending', 'confirmed'])
  const outros = (dia || []).filter((o: any) => o.id !== b.id)
  const antes = outros.filter((o: any) => hhmm(o.start_time) < hhmm(b.start_time) && hhmm(o.end_time) > hora)
  const naCadeira = outros.find((o: any) => hhmm(o.start_time) <= hora && hhmm(o.end_time) > hora)
  return {
    code: b.booking_code,
    senha: b.senha_numero,
    servico: b.service_name,
    status: b.status,
    booking_date: b.booking_date,
    start_time: hhmm(b.start_time),
    end_time: hhmm(b.end_time),
    posicao: antes.length,
    atendendo_ate: naCadeira ? hhmm(naCadeira.end_time) : null,
    proximo: b.status !== 'completed' && antes.length === 0,
    avisado: Boolean(b.proximo_avisado_at),
    agora: hora,
  }
}

async function enviarWhats(admin: any, number: string, text: string) {
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance || !number) return false
  const limpo = semEmoji(text)
  const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
    body: JSON.stringify({ number, text: limpo }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Evolution ${response.status}`)
  // O id é o que faz o webhook reconhecer o eco (fromMe) e não ligar o human_takeover.
  await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: limpo, sent_by: 'bot', evolution_message_id: String(data?.key?.id || '') || null })
  await admin.from('whatsapp_conversations').upsert({ phone: number, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
  return true
}

async function vincularLink(admin: any, id: string, bookingCode?: string) {
  const managementToken = token()
  const tokenHash = await hash(managementToken)
  let record: any = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const c = bookingCode || code()
    const { data, error } = await admin.rpc('attach_booking_management_v25', { p_booking_id: id, p_booking_code: c, p_management_token_hash: tokenHash })
    if (!error && data) { record = data; break }
    console.error('[senha-digital] attach attempt', attempt + 1, error)
    if (bookingCode || !String(error?.message || '').toLowerCase().includes('duplicate')) break
  }
  return { record, managementToken }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const body = await req.json()
    const action = String(body?.action || 'criar')
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const site = 'https://www.barbeariadoju.com.br'

    if (action === 'status') {
      const c = String(body?.code || '').trim().toUpperCase()
      const t = String(body?.token || '').trim()
      if (!c || !t) return json({ error: 'Link inválido.' }, 400)
      const { data: b } = await admin.from('bookings').select('*').eq('booking_code', c).maybeSingle()
      if (!b) return json({ error: 'Senha não encontrada.' }, 404)
      if (!b.management_token_hash || (await hash(t)) !== b.management_token_hash) return json({ error: 'Link inválido ou expirado.' }, 403)
      return json({ ok: true, senha: await situacao(admin, b) })
    }

    if (action !== 'criar') return json({ error: 'Ação inválida.' }, 400)

    const nome = String(body?.customer_name || '').trim().replace(/\s+/g, ' ')
    const telefone = String(body?.customer_phone || '').replace(/\D/g, '')
    const servico = String(body?.service_name || '').trim()
    const preco = Number(body?.service_price)
    const duracao = Number(body?.duration_minutes)
    if (nome.length < 2 || nome.length > 100) return json({ error: 'Digite seu nome.' }, 400)
    if (!/^[0-9]{10,11}$/.test(telefone)) return json({ error: 'Digite um WhatsApp com DDD, só números.' }, 400)
    if (!servico || !Number.isFinite(preco) || !Number.isFinite(duracao) || duracao <= 0) return json({ error: 'Escolha o serviço.' }, 400)

    // Regra das famílias (1 corte + 1 barba), mesma rede de segurança do create-public-booking.
    try {
      const { data: svc } = await admin.from('services').select('name').eq('active', true)
      const known = (svc || []).map((s: any) => String(s.name))
      if (known.length) {
        const check = normalizeServiceSet(splitServiceNames(servico, known))
        const r = check.removed.find((x: any) => x.name !== x.keptBy)
        if (r) return json({ error: `«${r.keptBy}» e «${r.name}» não entram no mesmo horário. Vale 1 serviço de corte e 1 de barba por atendimento.` }, 400)
      }
    } catch (ruleError) { console.error('[senha-digital] service rule', ruleError) }

    const { data: criado, error: erroCriar } = await admin.rpc('senha_digital_criar', {
      p_nome: nome, p_telefone: telefone, p_servico: servico, p_preco: preco, p_duracao: duracao,
    })

    if (erroCriar) {
      const msg = String(erroCriar.message || '')
      const existente = msg.match(/senha_existente:([0-9a-f-]{36})/i)
      if (existente) {
        // Já tem senha ativa hoje: devolve a mesma, com link novo (o token antigo é só hash).
        const { data: b } = await admin.from('bookings').select('*').eq('id', existente[1]).maybeSingle()
        if (!b) return json({ error: 'Você já tem uma senha hoje. Procure o Juliano no balcão.' }, 409)
        const { record, managementToken } = await vincularLink(admin, b.id, b.booking_code)
        const atual = record || b
        return json({ ok: true, existente: true, code: atual.booking_code, token: managementToken, senha: await situacao(admin, atual) })
      }
      if (msg.includes('sem_horario')) {
        // v29.242.0 — se o Juliano fechou mais cedo (Abrir/Fechar), diz isso em vez de "não há horário".
        let texto = 'Não há mais horário para hoje. Você pode agendar outro dia pelo site ou falar com o Juliano no WhatsApp.'
        try {
          const { data: exp } = await admin.rpc('expediente_hoje')
          if (exp?.fechado_em) {
            const h = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(exp.fechado_em))
            texto = `A barbearia já fechou hoje, às ${h}. Você pode agendar outro dia pelo site ou falar com o Juliano no WhatsApp.`
          }
        } catch (expErr) { console.error('[senha-digital] expediente', expErr) }
        return json({ ok: false, motivo: 'sem_horario', error: texto }, 409)
      }
      if (msg.includes('cliente_bloqueado')) {
        return json({ error: 'Não foi possível gerar a senha por aqui. Fale com o Juliano no balcão.' }, 400)
      }
      console.error('[senha-digital] criar', erroCriar)
      return json({ error: msg || 'Não foi possível gerar a senha.' }, 400)
    }

    const linha = Array.isArray(criado) ? criado[0] : criado
    const id = String(linha?.booking_id || '')
    if (!id) return json({ error: 'Não foi possível gerar a senha.' }, 500)

    const { record, managementToken } = await vincularLink(admin, id)
    if (!record) return json({ error: 'A senha foi gerada, mas o link de acompanhamento falhou. Procure o Juliano no balcão.', booking_id: id }, 500)
    await admin.from('booking_customer_actions').insert({ booking_id: id, action: 'created_link' }).then(({ error }: any) => { if (error) console.error('[senha-digital] action log', error) })

    // Código e token vão no fragmento (#): não chegam ao servidor nem a logs, e o texto do
    // WhatsApp fica sem "?" (a regra da casa: mensagem sem pergunta).
    const link = `${site}/senha/#c=${encodeURIComponent(record.booking_code)}&t=${encodeURIComponent(managementToken)}`
    const posicao = Number(linha.posicao || 0)

    // Posição 0 = já é o próximo: a própria mensagem da senha diz isso, e o cron não repete.
    if (posicao === 0) {
      await admin.from('bookings').update({ proximo_avisado_at: new Date().toISOString() }).eq('id', id)
    }

    let whats = false
    try {
      whats = await enviarWhats(admin, toWhatsNumber(telefone), montarMensagemSenha({
        nome, senha: Number(linha.senha_numero), servico, horario: String(linha.start_time), posicao, link,
      }))
    } catch (sendError) { console.error('[senha-digital] whatsapp', sendError) }

    if (pushSecret) {
      fetch(`${url}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({ custom: {
          title: `Senha ${linha.senha_numero}: ${nome} (${servico})`,
          body: `Chegou sem agendamento e pegou a senha digital. Previsão ${hhmm(linha.start_time)}${posicao ? ` · ${posicao} na frente` : ' · é o próximo'}.`,
          url: '/admin-agenda.html?app=1', tag: `senha-${id}`,
        } }),
      }).catch(() => {})
    }

    const { data: b } = await admin.from('bookings').select('*').eq('id', id).maybeSingle()
    return json({ ok: true, code: record.booking_code, token: managementToken, whats, senha: await situacao(admin, b || record) })
  } catch (error) {
    console.error('[senha-digital]', error)
    return json({ error: 'Não foi possível gerar a senha.' }, 500)
  }
})
