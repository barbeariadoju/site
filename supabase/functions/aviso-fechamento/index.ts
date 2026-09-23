import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { semEmoji } from '../_shared/sem-emoji.ts'
import { periodosDeFechamento, diasAlternativos, textoAvisoFechamento, somarDias } from '../_shared/aviso-fechamento.ts'

// v29.226.0 — aviso de fechamento (pedido do Juliano, 23/09/2026: viagem com a família de 15 a 17/10;
// "tem clientes que marcam todas as sextas"). Cron bdj-aviso-fechamento, 10h15 de terça a sábado, só
// fora do silêncio da JuIA. Quando a agenda tem dias inteiros fechados (schedule_blocks all_day), quem
// costuma vir nesses dias ou tem o retorno previsto para eles (closure_notice_candidates) recebe UM
// aviso entre 10 e 3 dias antes, com dias concretos antes e depois. A resposta cai na JuIA como pedido
// de horário. Registro em closure_notices (um por telefone por período: nunca repete).
// Corpo opcional: { dry_run: true } devolve a lista e os textos sem mandar nada;
// { period_start, period_end } força um período (teste).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

const fetchWithTimeout = async (url: string | URL, init: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timeout) }
}

const canonicalPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return ''
}

const JANELA_MAX = 10 // dias antes do fechamento em que o aviso pode começar a sair
const JANELA_MIN = 3 // mais perto que isso, não avisa mais (vira ruído de véspera)
const LIMITE_POR_RODADA = 40

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim() || ''
  if (!expected || request.headers.get('x-webhook-secret') !== expected) return json({ error: 'Não autorizado.' }, 401)
  const hora = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))

  const body = await request.json().catch(() => ({}))
  const dryRun = body?.dry_run === true
  if (!dryRun && (hora >= 20 || hora < 8)) return json({ ok: true, quiet_hours: true })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.trim() || ''
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')?.trim() || ''
  const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME')?.trim() || ''
  if (!dryRun && (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance)) return json({ error: 'WhatsApp indisponível.' }, 500)

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  const { data: blocos, error: blocosErr } = await admin.from('schedule_blocks').select('block_date')
    .eq('all_day', true).gt('block_date', hoje).lte('block_date', somarDias(hoje, 90))
  if (blocosErr) return json({ error: blocosErr.message }, 500)
  const fechados = new Set<string>((blocos || []).map((b: any) => String(b.block_date).slice(0, 10)))
  let periodos = periodosDeFechamento([...fechados])
  if (body?.period_start) {
    const ini = String(body.period_start).slice(0, 10), fim = String(body.period_end || body.period_start).slice(0, 10)
    periodos = [{ ini, fim, dias: [] }]
  } else {
    periodos = periodos.filter((p) => p.ini >= somarDias(hoje, JANELA_MIN) && p.ini <= somarDias(hoje, JANELA_MAX))
  }

  const resultado: unknown[] = []
  let enviados = 0
  for (const p of periodos) {
    const { antes, depois } = diasAlternativos(p, hoje, fechados)
    const { data: cands, error: candErr } = await admin.rpc('closure_notice_candidates', { p_ini: p.ini, p_fim: p.fim })
    if (candErr) { resultado.push({ periodo: p, erro: candErr.message }); continue }
    const itens: unknown[] = []
    for (const c of (cands || []) as any[]) {
      const number = canonicalPhone(c.phone)
      if (!number) continue
      const text = textoAvisoFechamento({ nome: c.customer_name, periodo: p, motivo: c.motivo, diaHabitual: c.dia_habitual, antes, depois })
      if (dryRun) { itens.push({ nome: c.customer_name, motivo: c.motivo, text }); continue }
      if (enviados >= LIMITE_POR_RODADA) { itens.push({ nome: c.customer_name, adiado: 'limite_da_rodada' }); continue }
      // Não empilha com outra mensagem automática recente: se o robô falou com ele nas últimas 20h,
      // o aviso sai numa das próximas rodadas (a janela tem vários dias).
      const { data: recente } = await admin.from('whatsapp_messages').select('id')
        .like('phone', `%${number.slice(-8)}`).eq('direction', 'out')
        .gte('created_at', new Date(Date.now() - 20 * 3600 * 1000).toISOString()).limit(1)
      if (recente && recente.length) { itens.push({ nome: c.customer_name, adiado: 'mensagem_recente' }); continue }
      try {
        const res = await fetchWithTimeout(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
          body: JSON.stringify({ number, text: semEmoji(text) }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(`Evolution ${res.status}`)
        await admin.from('whatsapp_messages').insert({ phone: number, direction: 'out', body: semEmoji(text), sent_by: 'bot', evolution_message_id: String(data?.key?.id || '') || null })
        await admin.from('whatsapp_conversations').upsert({ phone: number, human_takeover: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
        await admin.from('closure_notices').insert({ period_start: p.ini, period_end: p.fim, phone_key: c.phone_key, phone: number, customer_name: c.customer_name, motivo: c.motivo, status: 'sent' })
        enviados++
        itens.push({ nome: c.customer_name, ok: true })
      } catch (e) {
        await admin.from('closure_notices').insert({ period_start: p.ini, period_end: p.fim, phone_key: c.phone_key, phone: number, customer_name: c.customer_name, motivo: c.motivo, status: 'failed', error: String(e).slice(0, 300) })
        itens.push({ nome: c.customer_name, ok: false, error: String(e) })
      }
    }
    resultado.push({ periodo: { ini: p.ini, fim: p.fim }, antes, depois, clientes: itens })
  }

  if (!dryRun && enviados > 0) {
    const pushSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')?.trim()
    const p0 = periodos[0]
    if (pushSecret && p0) {
      await fetchWithTimeout(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
        body: JSON.stringify({ custom: { title: 'Aviso de fechamento enviado', body: `${enviados} clientes avisados de que a barbearia não atende de ${p0.ini.slice(8, 10)}/${p0.ini.slice(5, 7)} a ${p0.fim.slice(8, 10)}/${p0.fim.slice(5, 7)}. As respostas chegam pela JuIA.`, url: '/admin-agenda.html?app=1', tag: `aviso-fechamento-${p0.ini}` } }),
      }).catch(() => {})
    }
  }

  return json({ ok: true, hoje, dry_run: dryRun, enviados, periodos: resultado })
})
