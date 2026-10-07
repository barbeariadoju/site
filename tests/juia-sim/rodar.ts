// Simulador da JuIA (v29.212.0) — roda o ju-ia-site INTEIRO no computador, com o banco e o modelo
// trocados por dublês. Nada sai daqui: nem banco de produção, nem WhatsApp, nem OpenAI.
//
//   deno run --allow-env --allow-read --config tests/juia-sim/deno.json tests/juia-sim/rodar.ts
//
// Cada cenário é um caso real da análise de erros de 19/09/2026, com nomes FICTÍCIOS (o repositório
// é público). O modelo é roteirizado: devolve o JSON que o modelo de verdade devolveu (ou devolveria)
// naquele turno — o que se testa é a camada de código em volta dele, que é onde os erros moravam.

import { chamadas, respostas } from './mock-supabase.ts'

// ---- dublês de ambiente -------------------------------------------------------------------------
Deno.env.set('SUPABASE_URL', 'https://simulador.local')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'chave-do-simulador')
Deno.env.set('OPENAI_API_KEY', 'sk-simulador')
Deno.env.set('PUSH_WEBHOOK_SECRET', 'push-simulador')

let handler: ((r: Request) => Promise<Response>) | null = null
Object.defineProperty(Deno, 'serve', { value: (h: any) => { handler = h; return {} }, configurable: true, writable: true })

let respostaDoModelo: any = { reply: 'Como posso ajudar?', intent: 'other', updates: {}, handoff: false }
const saidas: { url: string; body: any }[] = []
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url || input)
  const body = init?.body ? (() => { try { return JSON.parse(String(init.body)) } catch { return init.body } })() : null
  if (url.includes('api.openai.com')) {
    return new Response(JSON.stringify({ output_text: JSON.stringify(respostaDoModelo) }), { status: 200 })
  }
  saidas.push({ url, body })
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}) as typeof fetch

await import('../../supabase/functions/ju-ia-site/index.ts')
if (!handler) throw new Error('ju-ia-site não registrou o Deno.serve')

// ---- datas (sempre relativas a hoje, no fuso de São Paulo) ---------------------------------------
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const somar = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const proxima = (wd: number) => { for (let i = 0; i < 7; i++) { const d = somar(hoje, i); if (new Date(d + 'T12:00:00Z').getUTCDay() === wd) return d } return hoje }
const amanha = somar(hoje, 1)
const segunda = proxima(1), terca = proxima(2)
// dia1/dia2: os dois próximos dias de terça a sexta (dias abertos comuns), a partir de amanhã
const diasAbertos: string[] = []
for (let i = 1; i < 14 && diasAbertos.length < 2; i++) { const d = somar(hoje, i); const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w >= 2 && w <= 5) diasAbertos.push(d) }
const [dia1, dia2] = diasAbertos

// ---- catálogo (público, do banco em 19/09/2026) ---------------------------------------------------
const catalogo = [
  ['Corte + Lavagem', 50, 50, 'corte'], ['Corte de cabelo', 40, 45, 'corte'], ['Raspar a cabeça', 40, 40, 'corte'],
  ['Corte de cabelo infantil', 40, 40, 'corte'], ['Corte + Barba na navalha com toalha quente', 80, 70, 'combo'],
  ['Corte + Barba Express', 65, 60, 'combo'], ['Barboterapia com vaporizador de ozônio', 50, 50, 'barba'],
  ['Barba na navalha com toalha quente', 40, 40, 'barba'], ['Barba Express', 25, 30, 'barba'],
  ['Pezinho (acabamento)', 15, 15, 'adicional'], ['Sobrancelha Masculina', 15, 15, 'adicional'],
  ['Depilação nasal (cera quente)', 25, 30, 'adicional'], ['Depilação orelhas', 25, 30, 'adicional'],
  ['Nevou / Platinado', 150, 130, 'quimica'], ['Luzes', 120, 100, 'quimica'], ['Alisamento / Relaxamento', 70, 55, 'quimica'],
  ['Pigmentação Capilar (Tintura)', 50, 40, 'quimica'], ['Pigmentação de Barba', 35, 30, 'pigmentacao'],
].map(([name, price, duration_minutes, upsell_tag]) => ({ name, price, duration_minutes, upsell_tag, sales_pitch: '' }))

type Cenario = {
  msg: string; state?: any; history?: any[]; ai?: any
  contexto?: any; futuros?: any[]; vagas?: Record<string, string[]>; concluidos?: any[]; nomeWhats?: string
  fechados?: string[] // dias com "Fechar o dia inteiro" marcado no admin (viagem, folga, feriado)
  estendidoOk?: boolean // resposta do extended_close_slot_ok (horário livre fora da grade/do expediente)
  jaConvidadoIG?: boolean // já existe mensagem com o @barbeariadoju_ para este telefone
  emAndamento?: any[] // phone_current_bookings: horário de hoje que já começou (há até 2h)
  clube?: any // assinatura viva do Clube do Ju (club_subscriptions)
  clubeCobre?: boolean // o banco cobriu o horário recém-criado (trg_zz_club_before_insert)
  clubeMotivo?: string // club_quote: motivo de não cobrir
  clubeVendas?: boolean // club_settings.vendas_abertas
  sinalCancel?: boolean // sinal_cancelamentos_ativo: dois últimos = falta/cancelamento em cima da hora
}
const turno = async (c: Cenario) => {
  chamadas.length = 0; saidas.length = 0
  respostaDoModelo = { reply: 'Como posso ajudar?', intent: 'other', updates: {}, handoff: false, ...(c.ai || {}) }
  respostas.tabela = {
    services: () => catalogo, service_price_changes: () => [], products: () => [], marketing_memory: () => [],
    schedule_blocks: (q) => q.filtros?.some((f: any) => f[0] === 'eq' && f[1] === 'all_day' && f[2] === true)
      ? (c.fechados || []).map((d) => ({ block_date: d, reason: 'Viagem do Juliano' })) : [],
    customer_benefits: () => [], site_chat_messages: () => null, conversation_leads: () => null,
    customer_profiles: () => [], whatsapp_attribution: () => [],
    bookings: (q) => q.op === 'select' ? (q.filtros?.some((f: any) => f[0] === 'eq' && f[1] === 'status' && f[2] === 'completed') ? (c.concluidos || [])
      : q.filtros?.some((f: any) => f[0] === 'eq' && f[1] === 'id' && f[2] === 'bk-novo') && q.filtros?.some((f: any) => f[0] === 'single')
        ? { service_price: 0, discount_amount: 50, discount_reason: c.clubeCobre ? 'Clube do Ju' : null, club_subscription_id: c.clubeCobre ? 'sub1' : null }
        : [{ id: 'bk-novo' }]) : null,
    club_settings: () => ({ vendas_abertas: c.clubeVendas === true }),
    club_subscriptions: () => (c.clube ? { id: 'sub1', code: 'CJ-TESTE1', plan_id: 'clube-corte', visits_per_cycle: 2, current_cycle_start: hoje, current_cycle_end: somar(hoje, 29), cancel_at_cycle_end: false, fixed_weekday: null, fixed_time: null, ...c.clube } : null),
    club_plans: () => ({ name: 'Clube Corte' }),
    return_invites: () => null,
    whatsapp_messages: () => (c.jaConvidadoIG ? [{ id: 'm1' }] : []),
  }
  respostas.rpc = {
    get_customer_commercial_context: () => c.contexto || {},
    phone_upcoming_bookings: () => c.futuros || [],
    phone_current_bookings: () => c.emAndamento || [],
    phone_match_key: () => '1100000001',
    club_quote: () => [{ eligible: false, reason: c.clubeMotivo || null }],
    get_available_slots: (a: any) => ((c.vagas || {})[a.p_date] || []).map((t) => ({ slot_time: t + ':00' })),
    get_available_slots_excluding: (a: any) => ((c.vagas || {})[a.p_date] || []).map((t) => ({ slot_time: t + ':00' })),
    extended_close_slot_ok: () => Boolean(c.estendidoOk),
    create_public_booking_v15: () => ({ data: 'bk-novo', error: null }),
    whatsapp_cancel_booking: (a: any) => ({ data: [{ id: a.p_booking_id, booking_date: dia1, start_time: '08:00:00', service_name: 'Corte de cabelo' }], error: null }),
    waitlist_matches_for_slot: () => [],
    sinal_cancelamentos_ativo: () => Boolean(c.sinalCancel),
  }
  const req = new Request('https://simulador.local/functions/v1/ju-ia-site', {
    method: 'POST',
    headers: { Authorization: 'Bearer chave-do-simulador', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: c.msg, state: c.state || {}, history: c.history || [], verified_phone: '5511900000001', whatsapp_name: c.nomeWhats || 'Cliente Teste', session_id: 'sim' }),
  })
  const r = await handler!(req)
  const d = await r.json()
  if (Deno.env.get('SIM_VER')) {
    const umaLinha = (t: string) => t.split(String.fromCharCode(10)).join(' / ')
    console.log(`  > cliente: ${umaLinha(c.msg)}`)
    console.log(`  < JuIA:    ${umaLinha(String(d.reply))}`)
  }
  return { ...d, chamadas: [...chamadas], saidas: [...saidas] }
}

// ---- verificação ---------------------------------------------------------------------------------
let ok = 0, falhou = 0
const checar = (nome: string, cond: boolean, detalhe: any) => {
  if (cond) { ok++; console.log(`  OK   ${nome}`) } else { falhou++; console.log(`  FALHOU ${nome}\n       ${JSON.stringify(detalhe).slice(0, 600)}`) }
}
const reservou = (r: any) => r.chamadas.some((x: any) => x.alvo === 'create_public_booking_v15')
const cancelou = (r: any) => r.chamadas.some((x: any) => x.alvo === 'whatsapp_cancel_booking')
const ctxCliente = (nome: string, extra: any = {}) => ({ customer_id: 'c1', name: nome, completed_visits: 3, points: 2, ...extra })

console.log(`Simulador da JuIA — hoje ${hoje}, segunda ${segunda}, terça ${terca}, dia1 ${dia1}, dia2 ${dia2}\n`)

// 1. Dia pedido fechado não vira reserva de outro dia (caso "segunda às 18h" → terça, 18/09)
{
  const r = await turno({ msg: 'Segunda-feira você tem as 18h?', state: { services: ['Corte de cabelo'], name: 'Tiago Teste' },
    ai: { intent: 'book', reply: 'Reservado!', updates: { date: somar(segunda, 1), time: '18:00' } }, contexto: ctxCliente('Tiago Teste'), vagas: { [somar(segunda, 1)]: ['17:00', '18:00'] } })
  checar('1 dia fechado: não reserva', !reservou(r), r.reply)
  checar('1 dia fechado: explica que segunda não abre', /segunda/i.test(r.reply) && /não abre/i.test(r.reply), r.reply)
}

// 2. "antes das 11h" é teto, e o próximo dia respeita o mesmo teto (caso de 18/09, 08h39)
{
  const r = await turno({ msg: 'Como vc está de horários, hoje ou amanhã cedo, antes das 11:00 h', state: { services: ['Barba na navalha com toalha quente'] },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: amanha, time: '11:00' } }, contexto: ctxCliente('Rogerio Teste'),
    vagas: { [hoje]: ['11:50', '12:30'], [amanha]: ['08:00', '09:15', '11:30'] } })
  checar('2 teto: não oferece 11:50', !/11:50/.test(r.reply), r.reply)
  checar('2 teto: oferece horário antes das 11 no dia seguinte', /08:00|09:15/.test(r.reply) && !/11:30/.test(r.reply), r.reply)
}

// 3. "tem que ser depois das 18h": sem nada depois no dia, oferece o próximo dia depois das 18h (17/09)
{
  const r = await turno({ msg: 'Tem ser depois das 18:00, vc não tem ?', state: { date: dia1, services: ['Corte de cabelo infantil'], last_requested_time: '18:00', last_requested_date: dia1 },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1, time: '18:00' } }, contexto: ctxCliente('Rodrigo Teste'),
    vagas: { [dia1]: ['17:00', '17:15'], [dia2]: ['18:15', '18:30'] } })
  checar('3 piso: não repete 17:15', !/17:15/.test(r.reply), r.reply)
  checar('3 piso: oferece depois das 18h em outro dia', /18:15|18:30/.test(r.reply), r.reply)
}

// 4. "Avisar" seco aceita a lista de espera (18/09, 13h05)
{
  const r = await turno({ msg: 'Avisar', state: { services: ['Corte + Barba Express', 'Sobrancelha Masculina'], date: terca, pending_waitlist: { date: hoje, period: null, service_name: 'Corte + Barba Express + Sobrancelha Masculina', service_price: 80, duration_minutes: 75 } },
    ai: { intent: 'other', reply: 'Certo.' }, contexto: ctxCliente('Moises Teste') })
  checar('4 avisar: entra na lista de espera', r.saidas.some((s: any) => s.url.includes('join-waitlist')), r.reply)
}

// 5. Aviso de chegada com conversa velha no estado não vira "quer cancelar o outro?" (18/09, 18h25)
{
  const r = await turno({ msg: 'Estou na rua de baixo', state: { services: ['Corte + Barba Express'], date: terca, time: null },
    ai: { intent: 'availability', reply: 'Antes de continuar…' }, contexto: ctxCliente('Moises Teste'),
    futuros: [{ id: 'b19', booking_date: hoje, start_time: '19:00:00', service_name: 'Corte de cabelo + Barba Express + Sobrancelha Masculina', status: 'confirmed' }], vagas: { [terca]: ['08:00'] } })
  checar('5 chegada: responde "te espero"', /te espero/i.test(r.reply), r.reply)
  checar('5 chegada: sem pergunta de cancelar', !/cancele|cancelar/i.test(r.reply), r.reply)
}

// 6. "falo direto com o Juliano?" é pedido de gente (17/09, 14h00)
{
  const r = await turno({ msg: 'Tudo bom tbm, falo direto com o Juliano?', ai: { intent: 'faq', reply: 'Aqui é a Juia, assistente virtual.' }, contexto: ctxCliente('Rafa Teste') })
  checar('6 pedido de gente: handoff', r.handoff === true && r.intent === 'handoff', { reply: r.reply, handoff: r.handoff })
  checar('6 pedido de gente: não se apresenta como assistente', !/assistente virtual/i.test(r.reply), r.reply)
}

// 7. Vocativo devolvido não vira nome (17/09, 14h19)
{
  const r = await turno({ msg: 'Boa tarde meu amigo\nJu', ai: { intent: 'other', reply: 'Boa tarde, meu amigo! Que bom falar com você novamente. Como posso ajudar hoje?' }, contexto: ctxCliente('Juliao Teste') })
  checar('7 vocativo: não começa por "meu amigo"', !/^[^!]*!?\s*meu amigo/i.test(r.reply.replace(/^(Bom dia|Boa tarde|Boa noite)[^!]*!\s*/, '')), r.reply)
  checar('7 vocativo: cumprimenta pelo nome', /Juliao/.test(r.reply), r.reply)
}

// 8. Fala no masculino + recado prometido chega no Juliano (17/09)
{
  const r = await turno({ msg: 'Uma dica: usa o endereço completo no convite do calendário', ai: { intent: 'other', reply: 'Obrigada pela dica! Vou registrar para avaliação do Juliano.' }, contexto: ctxCliente('Nuno Teste') })
  checar('8 masculino: "Obrigado"', /Obrigado/.test(r.reply) && !/Obrigada/.test(r.reply), r.reply)
  checar('8 recado: push pro Juliano', r.saidas.some((s: any) => s.url.includes('send-push') && /Recado/.test(JSON.stringify(s.body))), r.saidas.map((s: any) => s.url))
}

// 9. Serviço só perguntado não entra na reserva (16/09, 15h16)
{
  const r = await turno({ msg: '2 limpeza de pelos das orelhas e nas narinas  pergunto? Voce faz pintura nos cabelos ?', state: { services: [] },
    ai: { intent: 'services', reply: 'Faço sim.', updates: { services: ['Depilação orelhas', 'Depilação nasal (cera quente)', 'Pigmentação Capilar (Tintura)'] } }, contexto: ctxCliente('Magno Teste') })
  const sv = (r.state?.services || []) as string[]
  checar('9 pergunta: pintura fora', !sv.some((n) => /Pigmenta/.test(n)), sv)
  checar('9 pergunta: depilações ficam', sv.includes('Depilação orelhas') && sv.includes('Depilação nasal (cera quente)'), sv)
}

// 10. Tratamento no cadastro não vira nome na reserva (16/09, "Reservado! Sr,")
{
  const r = await turno({ msg: 'Fica agendado para 13.30 certo', state: { services: ['Corte de cabelo'], ditos: { nomes: ['Corte de cabelo'], fams: ['corte'] }, date: dia1, name: 'Sr Magno', upsell_offer_done: true },
    ai: { intent: 'book', reply: 'Reservado.', updates: { time: '13:30' } }, contexto: ctxCliente('Sr Magno'), vagas: { [dia1]: ['13:30'] } })
  checar('10 nome: reservou', reservou(r), r.reply)
  checar('10 nome: "Magno", não "Sr"', /Magno/.test(r.reply) && !/\bSr,/.test(r.reply), r.reply)
}

// 11. Modelo leu cancelamento → pergunta remarcar ou cancelar; "mais tarde" vira remarcação (10/09)
{
  const futuros = [{ id: 'b1', booking_date: amanha, start_time: '07:50:00', service_name: 'Barba na navalha com toalha quente', duration_minutes: 40 }]
  const r1 = await turno({ msg: 'Bom dia Ju. Tenho que exame de sangue 8:30 agora que vi', ai: { intent: 'cancel', reply: 'Quer cancelar?' }, contexto: ctxCliente('Julio Teste'), futuros })
  checar('11a não cancela direto', !cancelou(r1), r1.reply)
  checar('11a pergunta remarcar ou cancelar', /Remarcar/.test(r1.reply) && /Cancelar/.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Conseguimos marcar mais tarde, desculpa tinha esquecido', state: r1.state, history: [{ role: 'assistant', content: r1.reply }], ai: { intent: 'cancel', reply: 'Quer cancelar?' }, contexto: ctxCliente('Julio Teste'), futuros, vagas: { [amanha]: ['10:00', '11:00'] } })
  checar('11b não cancela', !cancelou(r2), r2.reply)
  checar('11b vai pra remarcação', r2.intent === 'reschedule' || /remarc|mudar|dia e hor/i.test(r2.reply), { intent: r2.intent, reply: r2.reply })
}

// 12. Horário pra outra pessoa pede o nome dela (11/09)
{
  const r1 = await turno({ msg: 'queria marcar um corte pro meu namorado amanhã 9h15', state: {},
    ai: { intent: 'book', reply: 'Reservado', updates: { services: ['Corte de cabelo'], date: amanha, time: '09:15' } }, contexto: ctxCliente('Amanda Teste'), vagas: { [amanha]: ['09:15'] } })
  checar('12a não reserva no nome dela', !reservou(r1), r1.reply)
  checar('12a pergunta o nome de quem vai ser atendido', /nome de quem/i.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Victor', state: r1.state, history: [{ role: 'assistant', content: r1.reply }], ai: { intent: 'other', reply: 'Certo.', updates: {} }, contexto: ctxCliente('Amanda Teste'), vagas: { [amanha]: ['09:15'] } })
  const reserva = r2.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('12b reserva no nome do Victor', reserva?.args?.p_customer_name === 'Victor', { reply: r2.reply, nome: reserva?.args?.p_customer_name })
}

// 13. "me chama daqui 14 dias" vira lembrete de verdade (08/09)
{
  const r = await turno({ msg: 'Decidir depois, me chama daqui 14 dias', ai: { intent: 'other', reply: 'Não consigo iniciar uma mensagem daqui a 14 dias.' }, contexto: ctxCliente('Pedro Teste'),
    concluidos: [{ id: 'bk-antigo', customer_name: 'Pedro Teste', service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 45 }] })
  const lemb = r.chamadas.find((x: any) => x.alvo === 'return_invites' && x.op === 'upsert')
  checar('13 lembrete gravado', lemb?.payload?.status === 'deferred' && Boolean(lemb?.payload?.remind_at), lemb?.payload)
  checar('13 resposta não diz que não consegue', !/não consigo/i.test(r.reply) && /te chamo/i.test(r.reply), r.reply)
}

// 14. Serviço assumido do histórico continua precisando de confirmação quando o cliente muda de assunto (18/09)
{
  const st = { services: ['Barboterapia com vaporizador de ozônio'], usual_assumed: true, pending_usual_confirm: { date: hoje, time: '11:50' }, date: hoje, time: '11:50', upsell_offer_done: true, last_question: { kind: 'usual_confirm' } }
  const r1 = await turno({ msg: 'Como vc está de horários, hoje ou amanhã cedo', state: st, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje } }, contexto: ctxCliente('Rogerio Teste', { last_services: 'Barboterapia com vaporizador de ozônio' }), vagas: { [hoje]: ['11:50'], [amanha]: ['08:00'] } })
  checar('14a suposição continua de pé', r1.state?.usual_assumed === true, r1.state?.usual_assumed)
  const r2 = await turno({ msg: 'Sim, serve sim', state: { ...r1.state, time: '11:50', date: hoje }, ai: { intent: 'book', reply: 'Reservado', updates: { time: '11:50', date: hoje } }, contexto: ctxCliente('Rogerio Teste', { last_services: 'Barboterapia com vaporizador de ozônio' }), vagas: { [hoje]: ['11:50'] } })
  checar('14b pergunta o serviço antes de reservar (numerada, sem presumir)', !reservou(r2) && /Qual serviço vai ser\?/.test(r2.reply) && !/como da última vez/i.test(r2.reply), r2.reply)
}

// 15. Barba escolhida dentro do combo não repete a pergunta "qual barba?" (19/09, 10h24 — cliente desistiu)
{
  const ctx = ctxCliente('Danilo Teste')
  const r1 = await turno({ msg: 'Você tem horário para cabelo e barba hoje ?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje } }, contexto: ctx, vagas: { [hoje]: ['16:00', '17:00'] } })
  checar('15a pergunta qual barba (certo: barba genérica)', /Pra barba, qual/i.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Barba na navalha com toalha sem ozônio', state: r1.state, history: [{ role: 'assistant', content: r1.reply }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { services: ['Corte + Barba na navalha com toalha quente'], date: hoje } }, contexto: ctx, vagas: { [hoje]: ['16:00', '17:00'] } })
  checar('15b não repete a pergunta da barba', !/Pra barba, qual/i.test(r2.reply), r2.reply)
  checar('15b segue pros horários', /16:00|17:00|manhã, tarde/i.test(r2.reply), r2.reply)
  const r3 = await turno({ msg: 'Corte + barba na navalha', state: { ...r1.state, services: ['Corte + Barba na navalha com toalha quente'] }, history: [{ role: 'assistant', content: r2.reply }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { services: ['Corte + Barba na navalha com toalha quente'] } }, contexto: ctx, vagas: { [hoje]: ['16:00', '17:00'] } })
  checar('15c não repete a pergunta da barba', !/Pra barba, qual/i.test(r3.reply), r3.reply)
  checar('15c um corte só (sem "Corte de cabelo" somado ao combo)', JSON.stringify(r3.state?.services) === JSON.stringify(['Corte + Barba na navalha com toalha quente']), r3.state?.services)
}

// 16. Newton (sábado 19/09, 17h43–17h46): "Não. Obrigado." é recusa; aviso de viagem não recebe horários
{
  const ctx = ctxCliente('Newton Teste', { last_services: 'Barba Express' })
  const hist = [{ role: 'assistant', content: `Hoje já encerramos (atendemos até 15h). Na terça tenho alguns horários entre 08:00 e 19:00 (por exemplo 08:00, 11:45, 15:00 ou 19:00). Quer que eu reserve um?` }]
  const r1 = await turno({ msg: 'Não . Obrigado.', state: { services: ['Barba Express'], date: dia1, usual_assumed: true }, history: hist,
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctx, vagas: { [dia1]: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'] } })
  checar('16a "Não. Obrigado." não reabre a agenda', !/Consigo te atender|hor[aá]rios? (entre|para)|\d{2}:\d{2}/.test(r1.reply), r1.reply)
  checar('16a recusa fecha a conversa (dismissed)', r1.state?.dismissed === true, r1.state)
  const r2 = await turno({ msg: 'Estou saindo de viagem amanhã cedo', state: { services: ['Barba Express'], date: dia1, usual_assumed: true }, history: hist,
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1, period: 'morning' } }, contexto: ctx, vagas: { [dia1]: ['08:00', '09:30', '10:15', '11:00', '11:45', '12:30', '13:00'] } })
  checar('16b viagem: boa viagem, sem horários', /Boa viagem/.test(r2.reply) && !/\d{2}:\d{2}/.test(r2.reply), r2.reply)
  checar('16b viagem: lead apagado (sem cobrança automática)', r2.chamadas.some((x: any) => x.alvo === 'conversation_leads' && x.op === 'delete'), r2.chamadas.filter((x: any) => x.alvo === 'conversation_leads'))
  checar('16b viagem: agenda da conversa zerada', !r2.state?.date && !r2.state?.pending_waitlist, r2.state)
  const r3 = await turno({ msg: 'Vou ficar uma semana fora de Bragança Paulista', state: { services: ['Barba Express'], date: dia1 }, history: hist,
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctx, vagas: { [dia1]: ['08:00', '09:30'] },
    concluidos: [{ id: 'bk-newton', customer_name: 'Newton Teste', service_name: 'Barba Express', service_price: 25, duration_minutes: 30 }] })
  const lembN = r3.chamadas.find((x: any) => x.alvo === 'return_invites' && x.op === 'upsert')
  checar('16c uma semana fora: contato marcado pra volta (deferred)', lembN?.payload?.status === 'deferred' && Boolean(lembN?.payload?.remind_at), lembN?.payload)
  checar('16c uma semana fora: resposta diz quando chama', /Boa viagem/.test(r3.reply) && /te chamo/.test(r3.reply) && !/\d{2}:\d{2}/.test(r3.reply), r3.reply)
}

// 17. Rafael (segunda 21/09, 10h46–10h51): "HJ" é hoje; "EU VIAJO AMANHA CEDO" não recebe a manhã de amanhã
{
  const ctx = ctxCliente('Rafael Teste', { last_services: 'Corte de cabelo + Barba Express' })
  const muitos = ['08:00', '09:00', '09:45', '10:30', '11:15', '11:45', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
  const r1 = await turno({ msg: 'HJ VC ESTÁ ABERTO?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: {} }, contexto: ctx, vagas: { [hoje]: muitos, [amanha]: muitos } })
  checar('17a "hj" é lido como hoje', /hoje/i.test(r1.reply) && !/amanh[ãa] sim/i.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'EU VIAJO AMANHA CEDO, ACHEI Q ERA NA QUARTA Q EU VIAJAVA', state: { services: ['Corte de cabelo', 'Barba Express'], date: amanha, usual_assumed: true },
    history: [{ role: 'assistant', content: 'Consigo te atender amanhã sim! Ainda tenho alguns horários para Corte de cabelo + Barba Express (aproximadamente 75 min). Você prefere manhã, tarde ou final do dia?' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: amanha, period: 'morning' } }, contexto: ctx, vagas: { [amanha]: muitos } })
  checar('17b viajo amanhã: boa viagem, sem a manhã de amanhã', /Boa viagem/.test(r2.reply) && !/\d{2}:\d{2}/.test(r2.reply), r2.reply)
}

// 18. Maurício (16/09, 20h51): "volto de viagem de férias em 1 mês e marcamos" agenda o contato pra volta
{
  const r = await turno({ msg: 'Como disse , volto de viagem de férias em 1 mês e marcamos novamente... Muito obrigado', state: { services: ['Barba Express'], date: dia1, pending_rebook: { date: dia1, services: ['Barba Express'] } },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctxCliente('Mauricio Teste'), vagas: { [dia1]: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] },
    concluidos: [{ id: 'bk-mauricio', customer_name: 'Mauricio Teste', service_name: 'Barba Express', service_price: 25, duration_minutes: 30 }] })
  const lemb = r.chamadas.find((x: any) => x.alvo === 'return_invites' && x.op === 'upsert')
  const em30 = somar(hoje, 30)
  checar('18 férias 1 mês: convite adiado ~30 dias', lemb?.payload?.status === 'deferred' && String(lemb?.payload?.remind_at) >= em30, lemb?.payload)
  checar('18 férias: resposta sem agenda', /Boas férias/.test(r.reply) && !/Consigo te atender|\d{2}:\d{2}/.test(r.reply), r.reply)
}

// 19. Otavio (sábado 19/09, 10h58–11h15): "E só pra corte de cabelo?" tira a barba; o nome fecha a lista de espera
{
  const ctx = ctxCliente('Otavio Teste')
  const r1 = await turno({ msg: 'E so pra corte de cabelo?', state: { services: ['Corte de cabelo', 'Barba Express'], date: hoje, usual_assumed: false },
    history: [{ role: 'assistant', content: 'Hoje não tenho mais horário para Corte de cabelo + Barba Express. Na terça tenho alguns horários. Quer que eu reserve um? Se preferir, te aviso assim que abrir vaga hoje.' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: hoje } }, contexto: ctx, vagas: { [hoje]: [], [dia1]: ['09:00', '11:45', '14:30'] } })
  checar('19a "e só pra corte" deixa só o corte', JSON.stringify(r1.state?.services) === JSON.stringify(['Corte de cabelo']), r1.state?.services)
  // Depois do fechamento a resposta correta é "Hoje já encerramos", que não cita serviço nenhum —
  // o que este cenário testa é que a BARBA saiu, e isso vale nas duas redações. Sem esta ressalva
  // o simulador falhava toda vez que fosse rodado à noite.
  checar('19a resposta fala do corte, não do combo', !/Barba Express/.test(r1.reply) && (/já encerramos/.test(r1.reply) || /Corte de cabelo/.test(r1.reply)), r1.reply)
  const r2 = await turno({ msg: 'Otavio', state: { services: ['Corte de cabelo'], date: dia1, pending_waitlist: { date: hoje, period: null, service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 45 } },
    history: [{ role: 'assistant', content: 'Para te colocar na lista de espera, preciso de seu nome.' }],
    ai: { intent: 'other', reply: 'Certo.', updates: { name: 'Otavio' } }, contexto: { completed_visits: 0 }, vagas: { [dia1]: ['09:00'] } })
  checar('19b nome fecha a lista de espera', r2.saidas.some((s: any) => s.url.includes('join-waitlist')) && /lista de espera/i.test(r2.reply), r2.reply)
}

// 20. Marcelo (22/09, 13h15): a JuIA lista "18:00, 18:15, 18:30, 18:45, 19:00. Qual você prefere?"
// e ele responde só "18". A guarda de texto (29.150.0/29.190.0) descartava — nenhuma palavra de
// agenda, nenhum pending_* aberto — e a resposta era "Entendi. Se quiser marcar um horário…",
// com o horário já gravado no estado. Bateu na trave: só o aviso de conversa parada salvou a reserva.
{
  const r = await turno({ msg: '18', state: { services: ['Corte de cabelo'], ditos: { nomes: ['Corte de cabelo'], fams: ['corte'] }, date: dia1, period: 'evening', name: 'Marcelo Teste', upsell_offer_done: true },
    history: [{ role: 'assistant', content: 'No período da final do dia, estes são todos os horários disponíveis para aproximadamente 45 minutos: 18:00, 18:15, 18:30, 18:45, 19:00. Qual você prefere?' }],
    ai: { intent: 'book', reply: 'Reservado!', updates: { time: '18:00' } }, contexto: ctxCliente('Marcelo Teste'),
    vagas: { [dia1]: ['18:00', '18:15', '18:30', '18:45', '19:00'] } })
  checar('20 número solto depois da lista de horários reserva', reservou(r), r.reply)
  checar('20 não responde o genérico "Entendi"', !/^Entendi. Se quiser marcar/.test(r.reply), r.reply)
}

// 21. Dia ABERTO e lotado: a frase é "não tenho mais vaga", nunca "não tenho horário" (22/09)
{
  const r = await turno({ msg: 'Tem horário pra corte nesse dia?', state: { services: ['Corte de cabelo'] },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctxCliente('Anderson Teste'),
    vagas: { [dia1]: [], [dia2]: ['09:00', '14:00', '17:30'] } })
  checar('21 lotado: diz "não tenho mais vaga"', /não tenho mais vaga/.test(r.reply), r.reply)
  checar('21 lotado: não diz "não tenho horário"', !/não tenho horário/.test(r.reply), r.reply)
  checar('21 lotado: oferece o próximo dia e a lista de espera', /09:00|14:00|17:30/.test(r.reply) && Boolean(r.state?.pending_waitlist), r.reply)
}

// 22. Dia FECHADO o dia inteiro (viagem/folga no admin): "não estamos abertos" + próximo dia,
//     e SEM lista de espera — não abre vaga em dia que ninguém trabalha (22/09)
{
  const r = await turno({ msg: 'Tem horário pra corte nesse dia?', state: { services: ['Corte de cabelo'] },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctxCliente('Anderson Teste'),
    fechados: [dia1], vagas: { [dia1]: [], [dia2]: ['09:00', '14:00'] } })
  checar('22 fechado: diz que não estamos abertos', /não estamos abertos/.test(r.reply), r.reply)
  checar('22 fechado: não diz "não tenho mais vaga"', !/não tenho mais vaga|não tenho horário/.test(r.reply), r.reply)
  checar('22 fechado: oferece atender normalmente no próximo dia', /normalmente/.test(r.reply) && /09:00|14:00/.test(r.reply), r.reply)
  checar('22 fechado: sem lista de espera', !r.state?.pending_waitlist && !/lista de espera/i.test(r.reply), { w: r.state?.pending_waitlist, reply: r.reply })
}

// 23. Pergunta genérica ("tem horário?") em dia fechado, antes de escolher serviço (22/09)
{
  const r = await turno({ msg: 'Oi, tem horário?', ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } },
    contexto: ctxCliente('Anderson Teste'), fechados: [dia1], vagas: { [dia1]: [], [dia2]: ['09:00'] } })
  checar('23 genérica em dia fechado: não estamos abertos', /não estamos abertos/.test(r.reply), r.reply)
  checar('23 genérica em dia fechado: sem "não temos horários"', !/não temos horários/i.test(r.reply), r.reply)
}

// 24. Serviço de sempre é suposição SILENCIOSA (Juliano, 23/09/2026: "já anotei aqui corte de cabelo
//     mais sobrancelha isso é chato demais"). Enquanto se escolhe dia e horário, a JuIA não narra o
//     serviço; ele aparece UMA vez, na pergunta que fecha a reserva.
{
  const ctx = ctxCliente('Josue Teste', { last_services: 'Corte de cabelo + Sobrancelha Masculina' })
  const r1 = await turno({ msg: 'Tem horário amanhã?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: amanha } }, contexto: ctx,
    vagas: { [amanha]: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] } })
  checar('24a pergunta de agenda não diz "Anotei"', !/anotei|de sempre/i.test(r1.reply), r1.reply)
  checar('24a pergunta de agenda não cita o serviço suposto', !/Sobrancelha|Corte de cabelo/.test(r1.reply), r1.reply)
  checar('24a suposição fica guardada no estado', r1.state?.usual_assumed === true, r1.state)
  const r2 = await turno({ msg: '10h', state: r1.state, history: [{ role: 'assistant', content: r1.reply }], ai: { intent: 'book', reply: 'Reservado', updates: { time: '10:00' } }, contexto: ctx,
    vagas: { [amanha]: ['08:00', '09:00', '10:00'] } })
  checar('24b fecha com a pergunta numerada do serviço, sem o de sempre', !reservou(r2) && /Qual serviço vai ser\?/.test(r2.reply) && !/Sobrancelha/.test(r2.reply), r2.reply)
}
{
  const r = await turno({ msg: 'tem horário hoje às 14h?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje, time: '14:00' } }, contexto: {},
    vagas: { [hoje]: ['13:00', '15:00'] } })
  checar('24c cliente novo: corte suposto sem "(Anotei…)"', !/anotei/i.test(r.reply), r.reply)
  const r2 = await turno({ msg: '13h então', state: r.state, history: [{ role: 'assistant', content: r.reply }], ai: { intent: 'book', reply: 'Reservado', updates: { time: '13:00' } }, contexto: {},
    vagas: { [hoje]: ['13:00', '15:00'] } })
  checar('24d cliente novo: pergunta o serviço antes de reservar', !reservou(r2) && /Qual serviço vai ser\?/.test(r2.reply) && !/última vez/.test(r2.reply), r2.reply)
  const r3 = await turno({ msg: '1', state: r2.state, history: [{ role: 'assistant', content: r2.reply }], ai: { intent: 'other', reply: 'Certo.', updates: {} }, contexto: {},
    vagas: { [hoje]: ['13:00', '15:00'] } })
  checar('24e "1" segue a reserva (reserva ou pede o nome)', reservou(r3) || /nome/i.test(r3.reply), r3.reply)
}

// 25. Josué (22/09, 21h00): o convite pós-atendimento deixou "Corte + Sobrancelha" no estado e ele
//     pediu "horário amanhã para meu filho" — saiu "Corte infantil + Corte + Sobrancelha (100 min)".
//     Horário pra outra pessoa leva só o serviço dela.
{
  const ctx = ctxCliente('Josue Teste', { last_services: 'Corte de cabelo + Sobrancelha Masculina' })
  const r = await turno({ msg: 'Tem como marcar horário amanhã para meu filho?', state: { services: ['Corte de cabelo', 'Sobrancelha Masculina'] },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { services: ['Corte de cabelo infantil', 'Corte de cabelo', 'Sobrancelha Masculina'], date: amanha } }, contexto: ctx,
    vagas: { [amanha]: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] } })
  checar('25 filho: fica só o corte infantil', JSON.stringify(r.state?.services) === JSON.stringify(['Corte de cabelo infantil']), r.state?.services)
  checar('25 filho: resposta sem a sobrancelha do pai', !/Sobrancelha/.test(r.reply), r.reply)
}

// 26. Edgar (23/09, 08h37): pediu 11:15, recebeu 09:15 ou 11:25 e respondeu "Outro horário fica
//     difícil, obrigado". Saía "Consigo te atender hoje sim! Manhã, tarde ou final do dia?".
{
  const r = await turno({ msg: 'Outro horário fica dificil , obrigado', state: { services: ['Corte de cabelo'], date: hoje, last_requested_time: '11:15', last_requested_date: hoje, usual_assumed: true },
    history: [{ role: 'assistant', content: 'Hoje às 11:15 já está ocupado. O mais próximo que tenho é 09:15 ou 11:25. Serve pra você?' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje } }, contexto: ctxCliente('Edgar Teste'), vagas: { [hoje]: ['09:00', '09:15', '11:25', '11:30'] } })
  checar('26 recusa dos horários: não reabre a agenda', !/Consigo te atender|manhã, tarde|\d{2}:\d{2}(?!.*11:15)/.test(r.reply.replace('11:15', '')), r.reply)
  checar('26 recusa dos horários: diz que vê com o Juliano o 11:15', /Juliano/.test(r.reply) && /11:15/.test(r.reply), r.reply)
  checar('26 recusa dos horários: push pro Juliano', r.saidas.some((s: any) => s.url.includes('send-push') && /11:15/.test(JSON.stringify(s.body))), r.saidas.map((s: any) => s.url))
  const r2 = await turno({ msg: 'fica complicado pra mim, valeu', state: { services: ['Corte de cabelo'], date: dia1 },
    history: [{ role: 'assistant', content: 'Na quinta tenho 09:00 ou 14:00. Quer que eu reserve um?' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctxCliente('Edgar Teste'), vagas: { [dia1]: ['09:00', '14:00'] } })
  checar('26b "fica complicado" sem pedido de hoje: dispensa educada', !/\d{2}:\d{2}/.test(r2.reply) && r2.state?.dismissed === true, r2.reply)
}

// 27. Gabriel (22/09, 15h56): "Teria algum horário ainda pra hoje?" recebeu "Anotado: Corte de cabelo
//     no lugar de Corte + Lavagem" — troca que ele não pediu (o modelo preencheu o corte padrão).
{
  const r = await turno({ msg: 'Teria algum horário ainda pra hoje?', state: { services: ['Corte + Lavagem'] },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: hoje } }, contexto: ctxCliente('Gabriel Teste'),
    vagas: { [hoje]: ['16:15', '16:30', '16:45'] } })
  checar('27 sem serviço na frase: nada de "Anotado: X no lugar de Y"', !/no lugar de/.test(r.reply), r.reply)
  checar('27 sem serviço na frase: nada de "Só pra ajustar"', !/pra ajustar/.test(r.reply), r.reply)
}

// 28. Jessica (22/09, 10h51): "Prefiro 16h10" numa sexta recebeu "Nosso horário normal vai até 19:00,
//     mas pra você o Ju estica". 16h10 só não estava na grade de 15 em 15 minutos.
{
  const r = await turno({ msg: 'Prefiro 16h10', state: { services: ['Corte de cabelo'], date: dia2, name: 'Jessica Teste', upsell_offer_done: true },
    history: [{ role: 'assistant', content: 'Consigo te atender na sexta sim! Você prefere manhã, tarde ou final do dia?' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia2, time: '16:10' } }, contexto: ctxCliente('Jessica Teste'),
    vagas: { [dia2]: ['16:00', '16:15', '16:30'] }, estendidoOk: true })
  checar('28 16h10 dentro do expediente: sem "o Ju estica"', !/estica|horário normal vai até/.test(r.reply), r.reply)
  checar('28 16h10: diz que está livre e pede confirmação', /16:10/.test(r.reply) && /livre/.test(r.reply), r.reply)
}

// 29. Marcello (23/09, 10h03): o estado da conversa de 09/09 ainda tinha date=09/09. Respondendo ao
//     convite de retorno, "As 17h" virou "Na quarta (09/09) não tenho mais vaga… te aviso quando abrir
//     vaga na quarta (09/09)". Dia que já passou sai do estado; hora sem dia é hoje.
{
  const velho = somar(hoje, -14)
  const r = await turno({ msg: 'As 17h', state: { services: ['Barba Express'], date: velho, time: '17:00', usual_assumed: true, pending_waitlist: { date: velho, service_name: 'Barba Express', duration_minutes: 30 } },
    history: [{ role: 'assistant', content: 'Vamos marcar! Barba Express sai R$ 25,00. Me diz o horário que eu já deixo reservado pra você.' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { time: '17:00', date: velho } }, contexto: ctxCliente('Marcello Teste', { last_services: 'Barba Express' }),
    vagas: { [hoje]: ['12:10', '13:45', '16:15', '17:00', '19:00'] } })
  const dVelho = velho.slice(8, 10) + '/' + velho.slice(5, 7)
  checar('29 dia passado não aparece na resposta', !r.reply.includes(dVelho), r.reply)
  // Depois das 17h a hora já passou e o certo é perguntar o dia — mesma ressalva do cenário 19.
  const jaPassou17 = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()) >= '17:00'
  checar('29 hora sem dia vira hoje e 17:00 é oferecido', jaPassou17 ? /qual dia/i.test(r.reply) : (/17:00/.test(r.reply) && /hoje|Hoje/.test(r.reply)), r.reply)
  checar('29 estado não guarda o dia passado', r.state?.date !== velho && r.state?.pending_waitlist?.date !== velho, r.state)
}

// 30. Tiago (23/09, 10h42): "Agendar horário" → "Sexta-feira dia 25" → "Final do dia". Na conversa real as
//     duas últimas foram engolidas pela pesquisa de satisfação pendente (corrigido no webhook, 29.223.0).
//     Aqui, a parte da JuIA: com as mensagens chegando nela, a conversa fecha em horário.
{
  // A mensagem diz "sexta-feira": a data tem que ser uma sexta (com sexta falhava todo fim de semana).
  const sexta = proxima(5) === hoje ? somar(hoje, 7) : proxima(5)
  const ctx = ctxCliente('Tiago Teste', { last_services: 'Corte de cabelo' })
  const vagas = { [sexta]: ['09:00', '10:00', '14:00', '17:00', '17:15', '17:30', '18:00', '18:30', '19:00'] }
  const r1 = await turno({ msg: 'Agendar horário', state: {}, ai: { intent: 'book', reply: 'Vamos marcar!', updates: {} }, contexto: ctx, vagas })
  const r2 = await turno({ msg: `Sexta-feira dia ${sexta.slice(8, 10)}`, state: r1.state, history: [{ role: 'assistant', content: r1.reply }], ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: sexta } }, contexto: ctx, vagas })
  checar('30a dia dito: pergunta o período ou já mostra horários', /manhã, tarde ou final do dia|\d{2}:\d{2}/.test(r2.reply), r2.reply)
  const r3 = await turno({ msg: 'Final do dia', state: r2.state, history: [{ role: 'assistant', content: r2.reply }], ai: { intent: 'availability', reply: 'Vou ver.', updates: { period: 'evening' } }, contexto: ctx, vagas })
  checar('30b "final do dia": lista os horários do fim do dia', /17:00|18:00|18:30|19:00/.test(r3.reply) && !/manhã, tarde ou final do dia/.test(r3.reply), r3.reply)
  const r4 = await turno({ msg: '18h', state: r3.state, history: [{ role: 'assistant', content: r3.reply }], ai: { intent: 'book', reply: 'Reservado', updates: { time: '18:00' } }, contexto: ctx, vagas })
  checar('30c "18h": fecha com a pergunta numerada do serviço', reservou(r4) || /Qual serviço vai ser\?/.test(r4.reply), r4.reply)
}

// 31. Convite do Instagram no fechamento da conversa (23/09, ideia do Juliano a partir do WhatsApp de um
//     laboratório): depois do "é a sua primeira vez?", a última fala leva o @ uma vez por cliente.
{
  const st = { pending_first_visit: true, name: 'Caio Teste', last_question: { kind: 'first_visit' } }
  const r1 = await turno({ msg: '2', state: st, ai: { intent: 'other', reply: 'Certo.' }, contexto: ctxCliente('Caio Teste') })
  checar('31a fechamento leva o convite do Instagram', /@barbeariadoju_/.test(r1.reply) && /instagram\.com\/barbeariadoju_/.test(r1.reply), r1.reply)
  checar('31a convite sem "Atendimento Finalizado"', !/Atendimento Finalizado/i.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: '1', state: st, ai: { intent: 'other', reply: 'Certo.' }, contexto: ctxCliente('Caio Teste'), jaConvidadoIG: true })
  checar('31b quem já recebeu o @ não recebe de novo', !/@barbeariadoju_/.test(r2.reply) && /primeira vez/i.test(r2.reply), r2.reply)
}

// 32. Horário que acabou de começar é do cliente (24/09, 09h16): marcado às 09:15, "estou em trânsito,
//     chego em instantes" um minuto depois virou "09:15 acabou de ser reservado por outro cliente".
{
  const emCurso = [{ id: 'b915', booking_date: hoje, start_time: '09:15:00', duration_minutes: 45, service_name: 'Corte de cabelo', status: 'confirmed' }]
  const hist = [{ role: 'assistant', content: `Seu horário foi confirmado: ${hoje} às 09:15 - Corte de cabelo` }]
  const r1 = await turno({ msg: 'Bom dia Ju..estou em trânsito...chego em instantes', history: hist,
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje, time: '09:15', services: ['Corte de cabelo'] } },
    contexto: ctxCliente('Americo Teste'), emAndamento: emCurso, vagas: { [hoje]: ['11:10', '11:15', '11:30'] } })
  checar('32a trânsito: "te espero" com o horário dele', /te espero/i.test(r1.reply) && /09:15/.test(r1.reply), r1.reply)
  checar('32a trânsito: nunca "outro cliente"', !/outro cliente|ocupado/i.test(r1.reply), r1.reply)
  // Mesmo se a frase não for reconhecida, o horário pedido sendo o dele nunca vira "ocupado".
  const r2 = await turno({ msg: 'vou atrasar uns minutinhos', history: hist,
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje, time: '09:15', services: ['Corte de cabelo'] } },
    contexto: ctxCliente('Americo Teste'), emAndamento: emCurso, vagas: { [hoje]: ['11:10', '11:15', '11:30'] } })
  checar('32b atraso: horário próprio não vira "reservado por outro"', !/outro cliente|ocupado/i.test(r2.reply) && !reservou(r2), r2.reply)
}

// 33. Clube do Ju (v29.233.0). "O que é o clube do ju?" caía no cartão fidelidade ("Hoje o que temos
//     é o cartão fidelidade") porque a assinatura não existia. E o assinante precisa saber, na reserva,
//     se o Clube cobriu ou por que não cobriu.
{
  const r1 = await turno({ msg: 'o que é o clube do ju?', ai: { intent: 'loyalty', reply: 'Hoje o que temos é o cartão fidelidade' }, contexto: ctxCliente('Caio Teste') })
  checar('33a clube: explica a assinatura', /assinatura mensal/.test(r1.reply) && /\/clube\//.test(r1.reply) && !/cartão fidelidade, e ele é automático/.test(r1.reply), r1.reply)
  checar('33a clube: antes de 01/10 diz quando abre', /abrem em 1º de outubro/.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: `Quero corte de cabelo dia ${dia2.slice(8, 10)}/${dia2.slice(5, 7)} às 10h`, state: { upsell_offer_done: true },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: dia2, time: '10:00' } }, contexto: ctxCliente('Caio Teste'),
    vagas: { [dia2]: ['09:00', '10:00'] }, clube: { status: 'ativa' }, clubeCobre: true })
  checar('33b assinante coberto: reserva diz "coberto pelo Clube do Ju"', reservou(r2) && /coberto pelo Clube do Ju/.test(r2.reply) && !/R\$ 40,00\)/.test(r2.reply), r2.reply)
  const r3 = await turno({ msg: `Quero corte de cabelo ${dia1 === amanha ? 'amanhã' : 'dia ' + dia1.slice(8, 10) + '/' + dia1.slice(5, 7)} às 10h`, state: { upsell_offer_done: true },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: dia1, time: '10:00' } }, contexto: ctxCliente('Caio Teste'),
    vagas: { [dia1]: ['09:00', '10:00'] }, clube: { status: 'ativa' }, clubeCobre: false, clubeMotivo: 'Pelo Clube, o horário é marcado com no mínimo 7 dias de antecedência.' })
  checar('33c assinante fora da regra: diz que sai pelo preço normal e por quê', reservou(r3) && /preço normal: pelo Clube, o horário é marcado com no mínimo 7 dias/.test(r3.reply), r3.reply)
}

// 34. Lista de espera aceita com a recusa do outro dia junto (casos Israel 24/09 17h37 e Paulo 25/09 09h07).
//     "Se abrir alguma vaga hj me avisa / Amanhã não consigo" levou "me embolei"; "Se abrir pra hj /
//     Prefiro" levou a mesma oferta de novo. Os dois estavam aceitando o aviso de vaga de HOJE.
{
  const wl = { date: hoje, period: null, service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 45, direct: false }
  const base = { services: ['Corte de cabelo'], date: amanha, pending_waitlist: wl }
  const r1 = await turno({ msg: 'Se abrir alguma vaga hj me avisa\nAmanhã não consigo', state: base,
    ai: { intent: 'availability', reply: 'Hoje não tenho mais vaga.', updates: { date: amanha } }, contexto: ctxCliente('Israel Teste'), vagas: { [amanha]: ['08:00', '12:00'] } })
  checar('34a aviso + "amanhã não consigo": entra na lista de hoje', r1.saidas.some((s: any) => s.url.includes('join-waitlist')) && /lista de espera|te aviso/i.test(r1.reply), r1.reply)
  checar('34a não oferece amanhã de novo', !/08:00|12:00/.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Se abrir pra hj\nPrefiro', state: base,
    ai: { intent: 'availability', reply: 'Hoje não tenho mais vaga.', updates: { date: hoje } }, contexto: ctxCliente('Paulo Teste'), vagas: { [amanha]: ['08:00', '15:00'] } })
  checar('34b "se abrir pra hj, prefiro": entra na lista de hoje', r2.saidas.some((s: any) => s.url.includes('join-waitlist')), r2.reply)
}

// 35. "Amanhã não posso, trabalho 12 hrs / 06 às 06" não é pedido de meio-dia (caso Paulo, 25/09 09h08),
//     e "trabalho das 6 da manhã às 6 da tarde" não é reserva às 15h (09h10).
{
  const wl = { date: hoje, period: null, service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 45, direct: false }
  const r1 = await turno({ msg: 'Amanhã não posso trabalhar 12 hrs\n06 as 06', state: { services: ['Corte de cabelo'], date: amanha, last_requested_time: '15:00', pending_waitlist: wl },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: amanha, time: '12:00' } }, contexto: ctxCliente('Paulo Teste'),
    vagas: { [amanha]: ['12:45', '13:00', '15:00'], [dia2]: ['09:00', '15:00'] } })
  checar('35a "não posso trabalhar 12 hrs": não trata 12 como horário', !/12:00|12:45/.test(r1.reply) && !reservou(r1), r1.reply)
  checar('35a oferece o aviso de hoje ou outro dia', /te aviso|lista de espera|outro dia|qual dia/i.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Trabalhar 06 da manhã as 06 da tarde\nKkkk', state: { services: ['Corte de cabelo'], date: amanha, time: '12:00', last_requested_time: '15:00' },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { date: amanha, time: '15:00' } }, contexto: ctxCliente('Paulo Teste'), vagas: { [amanha]: ['12:45', '15:00'] } })
  checar('35b expediente do cliente não vira reserva amanhã', !/amanhã às 15:00 está livre/i.test(r2.reply) && !/Quer incluir mais alguma coisa/.test(r2.reply) && !reservou(r2), r2.reply)
}

// 36. "Como estão seus horários?" não anuncia serviço suposto (caso Bruno, 24/09 10h59).
{
  const r = await turno({ msg: 'Me tire um dúvida, por favor? \n\nComo estão seus horários ?\nAmém Ju', state: {},
    ai: { intent: 'availability', reply: 'Para qual dia?', updates: { services: ['Corte de cabelo'] } },
    contexto: ctxCliente('Bruno Teste', { last_service_name: 'Corte de cabelo', usual_service_name: 'Corte de cabelo' }), vagas: { [hoje]: ['11:30', '12:00'] } })
  checar('36 horários: sem "Anotei Corte"', !/Anotei/i.test(r.reply), r.reply)
}

// 37. "A gente marcou o horário de hoje?" é pergunta sobre a reserva, não pedido de vaga (caso 25/09 07h54).
{
  const msg = 'Fala, Ju. Bom dia, tudo bem? Ô, Ju, não lembra se a gente marcou o horário de hoje? Não consegui na terça. Hoje nós estamos com o horário marcado?'
  const r1 = await turno({ msg, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje } }, contexto: ctxCliente('Juca Teste'), vagas: { [hoje]: ['11:30', '11:45'] } })
  checar('37a sem reserva hoje: diz que não tem horário marcado', /hoje não tem horário marcado/i.test(r1.reply), r1.reply)
  const r2 = await turno({ msg, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje } }, contexto: ctxCliente('Juca Teste'),
    futuros: [{ id: 'b37', booking_date: hoje, start_time: '11:30:00', service_name: 'Corte de cabelo', status: 'confirmed' }], vagas: { [hoje]: ['11:45'] } })
  checar('37b com reserva hoje: confirma o horário dele', /11:30/.test(r2.reply) && !/11:45/.test(r2.reply), r2.reply)
}

// 38. Já agendado pedindo "se desmarcar mais cedo me avisa" (caso Sérgio, 25/09 10h32): entrou na lista do
//     dia sem limite de hora, a JuIA respondeu só "você já está confirmado" e no dia seguinte ele recebeu a
//     vaga das 11h30 — DEPOIS do horário dele — como "o horário que você estava esperando".
{
  const r = await turno({ msg: 'Caso tenha algum horario desmarcado para mais cedo pode me avisar que consigo ir.', state: { services: ['Corte + Barba na navalha com toalha quente'], date: amanha, time: '09:45' },
    ai: { intent: 'other', reply: 'Você já está confirmado para amanhã às 09:45 (Corte + Barba na navalha com toalha quente). Pode vir tranquilo, te esperamos!' }, contexto: ctxCliente('Sergio Teste'),
    futuros: [{ id: 'b38', booking_date: amanha, start_time: '09:45:00', service_name: 'Corte + Barba na navalha com toalha quente', status: 'confirmed' }] })
  const wl = r.saidas.find((s: any) => s.url.includes('join-waitlist'))
  checar('38 mais cedo: entra na lista com teto no horário dele', wl && wl.body?.preferred_time_end === '09:45', wl?.body || r.reply)
  checar('38 mais cedo: resposta diz que avisa se abrir ANTES das 09:45', /antes das 09:45/.test(r.reply) && /aviso/i.test(r.reply), r.reply)
}

// 39. Pergunta de horário de funcionamento com oferta pendente (caso Gilvana, 25/09 13h10): "Vc fica até q horas
//     aberto" levou a lista de horários de novo, e "Entendi" virou "Sim! hoje às 15:30 está livre".
{
  const base = { services: ['Corte de cabelo infantil'], date: hoje }
  const hist = [{ role: 'assistant', content: 'Para Corte de cabelo infantil hoje, estes são os horários disponíveis: 15:30. Qual você prefere?' }]
  const r1 = await turno({ msg: 'Vc fica até q horas aberto', state: base, history: hist,
    ai: { intent: 'availability', reply: 'Para Corte de cabelo infantil hoje, estes são os horários disponíveis: 15:30. Qual você prefere?', updates: { date: hoje } }, contexto: ctxCliente('Gil Teste'), vagas: { [hoje]: ['15:30'] } })
  checar('39a até que horas: responde o horário de funcionamento', /atendemos até (19|15)h|encerramos/.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Entendi', state: { ...base, last_requested_time: '15:30' }, history: hist,
    ai: { intent: 'book', reply: 'Vou ver.', updates: { date: hoje, time: '15:30' } }, contexto: ctxCliente('Gil Teste'), vagas: { [hoje]: ['15:30'] } })
  checar('39b "Entendi" não aceita o horário', !/está livre|confirmar esse agendamento/.test(r2.reply) && !reservou(r2) && /quando decidir/i.test(r2.reply), r2.reply)
}

// 40. "2 — quero remarcar" na confirmação de presença, depois só o horário (caso Guilherme, 26/09 07h39): o "15:00"
//     caiu de volta no menu 1/2/3. O webhook agora deixa pending_reschedule_booking_id no estado; aqui, a parte da
//     JuIA: hora solta = mesmo dia do horário que ele tem, e 15:00 depois do expediente vira o mais próximo.
{
  const futuros = [{ id: 'b40', booking_date: dia1, start_time: '11:30:00', service_name: 'Corte de cabelo + Barba Express', status: 'confirmed', duration_minutes: 60 }]
  const r = await turno({ msg: '15:00', state: { pending_reschedule_booking_id: 'b40' },
    history: [{ role: 'assistant', content: 'Sem problema! Me diz o dia e o horário que ficam melhores pra você que eu já remarco por aqui mesmo.' }],
    ai: { intent: 'reschedule', reply: 'Vou ver.', updates: { time: '15:00' } }, contexto: ctxCliente('Gui Teste'), futuros, vagas: { [dia1]: ['14:00', '14:30'] } })
  checar('40 remarcar só com hora: fica no mesmo dia e oferece o mais próximo', /14:30/.test(r.reply) && !/Confirmo presença/.test(r.reply), r.reply)
}

// 41. Regra do sinal (Juliano, 26/09/2026): dois últimos = cancelamento em cima da hora ou falta → a reserva
//     sai com sinal de 50% pelo Pix, prazo de 1 h; sem a regra, reserva normal sem sinal.
{
  const base = { msg: `Quero corte de cabelo ${dia1 === amanha ? 'amanhã' : 'dia ' + dia1.slice(8, 10) + '/' + dia1.slice(5, 7)} às 10h`, state: { upsell_offer_done: true },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: dia1, time: '10:00' } }, contexto: ctxCliente('Caio Teste'), vagas: { [dia1]: ['09:00', '10:00'] } }
  const r1 = await turno({ ...base, sinalCancel: true })
  const upd = r1.chamadas.find((x: any) => x.alvo === 'bookings' && x.op === 'update' && x.payload?.prepay_amount)
  checar('41a regra ativa: reserva e pede sinal de 50% (R$ 20,00)', reservou(r1) && /sinal de 50% \(R\$\s?20,00\)/.test(r1.reply) && /1 hora/.test(r1.reply), r1.reply)
  checar('41a regra ativa: grava o sinal e o prazo no agendamento', upd?.payload?.prepay_amount === 20 && Boolean(upd?.payload?.prepay_deadline_at), upd?.payload)
  const r2 = await turno({ ...base, sinalCancel: false })
  checar('41b sem a regra: reserva sem sinal', reservou(r2) && !/sinal/i.test(r2.reply), r2.reply)
}

// 42. Caso Murillo (28/09/2026): último atendimento Corte + Nevou/Platinado. Química não entra no "de
//     sempre", a duração da suposição não aparece, e "2 / Raspar / Careca" vale SÓ o raspar.
{
  const ctx = ctxCliente('Murillo Teste', { last_services: 'Corte de cabelo + Nevou / Platinado' })
  const r1 = await turno({ msg: 'Tem horário sexta a tarde ?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: dia1 } }, contexto: ctx,
    vagas: { [dia1]: ['12:00', '13:15', '14:30', '15:45', '17:00'] } })
  const durDaConsulta = r1.chamadas.filter((x: any) => x.tipo === 'rpc' && /get_available_slots/.test(x.alvo)).map((x: any) => x.args?.p_duration_minutes)
  checar('42a platinado fora da suposição (consulta com a duração do corte, não 175 min)', durDaConsulta.length > 0 && durDaConsulta.every((d: number) => d < 100), durDaConsulta)
  checar('42a resposta não fala em "aproximadamente N minutos"', !/aproximadamente \d+ min/.test(r1.reply), r1.reply)
  const st = { services: ['Corte de cabelo', 'Nevou / Platinado'], usual_assumed: true, usual_origem: 'historico', pending_usual_confirm: { date: dia1, time: '12:00' }, date: dia1, time: '12:00', upsell_offer_done: true, upsell_services_done: true }
  const r2 = await turno({ msg: '2\nRaspar\nCareca', state: st, ai: { intent: 'book', reply: 'Reservado', updates: { services: ['Raspar a cabeça', 'Nevou / Platinado'], date: dia1, time: '12:00' } }, contexto: ctx,
    vagas: { [dia1]: ['12:00'] } })
  const criado = r2.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('42b fica só Raspar a cabeça (sem platinado)', !/Platinado/.test(r2.reply) && !/Platinado/.test(JSON.stringify(criado?.args || {})) && (r2.state?.services || []).join() === 'Raspar a cabeça', { reply: r2.reply, services: r2.state?.services })
  checar('42b sem "Anotado: X no lugar de Y"', !/no lugar de/.test(r2.reply), r2.reply)
}

// 43. Caso José Carlos (29/09/2026): histórico "Corte de cabelo + Barba na navalha com toalha quente"
//     (nome do painel) vira o COMBO do catálogo (70 min), não os dois avulsos (85 min).
{
  const ctx = ctxCliente('Jose Teste', { last_services: 'Corte de cabelo + Barba na navalha com toalha quente' })
  const r = await turno({ msg: 'Tem horário amanhã?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: amanha } }, contexto: ctx,
    vagas: { [amanha]: ['09:15', '11:15'] } })
  // v29.274.0: o histórico não vira mais serviço; a consulta mostra horários sem citar serviço.
  checar('43a sem suposição do histórico: mostra horários', /09:15|11:15/.test(r.reply) && !/navalha|Barba/.test(r.reply), r.reply)
  const r2 = await turno({ msg: 'Não tem mais cedo??', state: { ...r.state, date: amanha }, history: [{ role: 'assistant', content: 'Amanhã o primeiro horário livre é 11:15.' }],
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: amanha, time: '11:15' } }, contexto: ctx, vagas: { [amanha]: ['11:15'] } })
  checar('43b "mais cedo?" nunca é respondido com "Sim"', !/^Sim\b/.test(r2.reply), r2.reply)
}

// 44. Caso Ana (29/09/2026): "Hoje" (dia sem hora) mostra os horários, não "Corte sai R$ 40. Me diz o horário".
{
  const ctx = ctxCliente('Ana Teste', { last_services: 'Corte de cabelo' })
  const r = await turno({ msg: 'Amanhã', state: {}, ai: { intent: 'book', reply: 'Vamos marcar!', updates: { date: amanha } }, contexto: ctx,
    vagas: { [amanha]: ['08:00', '09:00', '10:30', '14:00'] } })
  checar('44a dia sem hora mostra horários', /10:30|08:00/.test(r.reply) && !reservou(r), r.reply)
  checar('44a sem o preço do serviço suposto', !/R\$/.test(r.reply), r.reply)
}

// 45. Caso Paulo (29/09/2026): oferta da lavagem depois da reserva respondida com "2 / somente corte"
//     (juntos no buffer) não inclui a lavagem.
{
  const ctx = ctxCliente('Paulo Teste', { last_services: 'Corte de cabelo' })
  const st = { services: ['Corte de cabelo'], date: dia1, time: '18:00', completed: true, upsell_offer_options: ['Corte + Lavagem', '__none__'], upsell_post_booking: { id: 'b9', date: dia1, time: '18:00', services: ['Corte de cabelo'] } }
  const r = await turno({ msg: '2\nsomente corte', state: st, ai: { intent: 'other', reply: 'Ok', updates: {} }, contexto: ctx })
  const trocou = r.chamadas.some((x: any) => x.alvo === 'phone_change_booking_service')
  checar('45a "2 / somente corte" não inclui a lavagem', !trocou && !/Incluído/.test(r.reply), r.reply)
  const r2 = await turno({ msg: '1', state: st, ai: { intent: 'other', reply: 'Ok', updates: {} }, contexto: ctx })
  checar('45b "1" continua incluindo', r2.chamadas.some((x: any) => x.alvo === 'phone_change_booking_service'), r2.reply)
}

// 46. Caso Paulo (29/09/2026): "dia 15 as 18:00" (sem mês) — o dia do cliente manda; o modelo não pode
//     pular pra outro dia e reservar em silêncio.
{
  const [y, m, d] = hoje.split('-').map(Number)
  const alvoDia = d <= 15 ? `${y}-${String(m).padStart(2, '0')}-15` : (m === 12 ? `${y + 1}-01-15` : `${y}-${String(m + 1).padStart(2, '0')}-15`)
  const outroDia = alvoDia.slice(0, 8) + '20'
  const r = await turno({ msg: 'dia 15 as 18:00\nvc teria', state: { services: ['Corte de cabelo'], upsell_offer_done: true }, ai: { intent: 'book', reply: 'Reservado', updates: { date: outroDia, time: '18:00' } },
    contexto: ctxCliente('Paulo Teste', { last_services: 'Corte de cabelo' }), vagas: { [alvoDia]: [], [outroDia]: ['18:00'] } })
  checar('46a "dia 15" não reserva outro dia sem perguntar', !reservou(r), r.reply)
}

// 47. Caso Mauricio (29/09/2026, 18h38): despedida que fala de cabelo não vira "Anotei Corte de cabelo".
{
  const r = await turno({ msg: 'Mais pra frente marcamos um horário.....meu cabelo demora muito pra crescer....abraço', state: {},
    ai: { intent: 'other', reply: 'Perfeito, Mauricio. Quando quiser marcar, é só me chamar. Abraço!', updates: {} }, contexto: ctxCliente('Mauricio Teste', { last_services: 'Corte de cabelo + Barba Express' }) })
  checar('47a despedida sem nota de serviço nem preço', !/Anotei|R\$/.test(r.reply) && !reservou(r), r.reply)
}

// 48. Caso Henrique (01/10/2026, 09h33): data e hora já na mesa, a JuIA listou as barbas e ele respondeu
// "Express". Ouviu "Entendi. Se quiser marcar um horário…" — a guarda de "sem sinal de agenda" jogou fora
// o serviço que ele tinha acabado de escolher.
{
  const r = await turno({ msg: 'Express', state: { date: dia1, time: '14:20', upsell_offer_done: true },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { services: ['Barba Express'], date: dia1, time: '14:20' } }, contexto: {}, nomeWhats: 'Henrique', vagas: { [dia1]: ['14:20', '14:30'] } })
  checar('48 "Express" escolhido segue a reserva', !/Se quiser marcar um horário/.test(r.reply) && (reservou(r) || /Barba Express/.test(r.reply)), r.reply)
}

// ---- v29.273.0: revisão da JuIA de 01/10/2026 ----
// 50. Caso Sharles (11h49): "8:45h. Seria somente o corte" com Corte + Pigmentação no estado (vindo do convite)
//     reserva SÓ o corte.
{
  const r = await turno({ msg: '8:45h. Seria somente o corte', state: { services: ['Corte de cabelo', 'Pigmentação Capilar (Tintura)'], date: dia2, upsell_offer_done: true, name: 'Sharles Teste' },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { date: dia2, time: '08:45' } }, contexto: ctxCliente('Sharles Teste'), vagas: { [dia2]: ['08:45'] } })
  const reserva = r.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('50 "somente o corte" no meio da frase tira a pigmentação', reserva ? reserva.args?.p_service_name === 'Corte de cabelo' : (!/Pigmenta/.test(r.reply) && /Corte/.test(r.reply)), { reply: r.reply, servico: reserva?.args?.p_service_name })
}
// 51. Caso Sharles (13h02): já reservado Corte + Pigmentação, "E somente o corte.. blz" confirma ficar só o corte.
{
  const futuros = [{ id: 'b51', booking_date: dia2, start_time: '08:45:00', service_name: 'Corte de cabelo + Pigmentação Capilar (Tintura)', status: 'confirmed', duration_minutes: 85 }]
  const r = await turno({ msg: 'E somente o corte.. blz', state: {}, ai: { intent: 'change_service', reply: 'Ok' }, contexto: ctxCliente('Sharles Teste'), futuros })
  checar('51 depois de reservado, "somente o corte" propõe ficar só o corte', /fica só Corte de cabelo/.test(r.reply) && !/Qual serviço você quer no lugar/.test(r.reply), r.reply)
}
// 52. Caso Juliano Prando (10h51): horário do exame não vira proposta de remarcação.
{
  const futuros = [{ id: 'b52', booking_date: dia1, start_time: '08:30:00', service_name: 'Raspar a cabeça', status: 'confirmed', duration_minutes: 40 }]
  const r = await turno({ msg: 'Tenho ultrassom às 7h55, consegue umas 9h?', state: {}, ai: { intent: 'reschedule', reply: 'Vou ver.', updates: {} }, contexto: ctxCliente('Prando Teste'), futuros, vagas: { [dia1]: ['09:00', '09:15'] } })
  checar('52 remarcação ignora o horário do exame', !/07:55/.test(r.reply) && /09:00/.test(r.reply), r.reply)
}
// 53. Caso Chaccal (30/09): "Pode fechar assim" na lista de complementos é a opção "nenhum".
{
  const r = await turno({ msg: 'Pode fechar assim', state: { services: ['Corte de cabelo'], date: dia1, time: '18:00', name: 'Chaccal Teste', upsell_offer_options: ['Sobrancelha Masculina', '__none__'] },
    ai: { intent: 'book', reply: 'Ok', updates: {} }, contexto: ctxCliente('Chaccal Teste'), vagas: { [dia1]: ['18:00'] } })
  checar('53 "pode fechar assim" recusa os complementos', !/Qual deles/i.test(r.reply), r.reply)
}
// 54. Caso Vivian (12h38): "😉👍🏻" sem pergunta aberta não vira "obrigado pela confirmação".
{
  const r = await turno({ msg: '😉👍🏻', state: {}, ai: { intent: 'book', reply: 'Obrigado pela confirmação. 🙏' }, contexto: ctxCliente('Vivian Teste') })
  checar('54 só emoji: resposta neutra', !/confirma/i.test(r.reply) && /Obrigado/.test(r.reply), r.reply)
}
// 55. Caso Henrique (09h29): "Marcelo me passou seu contato" não trata o cliente como Marcelo e anota a indicação.
{
  const r = await turno({ msg: 'Marcelo me passou seu contato', state: {}, ai: { intent: 'other', reply: 'Tudo bem por aqui, e você? O Marcelo é muito bem-vindo. Como posso ajudar?' }, contexto: {}, nomeWhats: 'Henrique' })
  checar('55 indicação: frase corrigida e anotada', !/O Marcelo é muito bem-vindo/.test(r.reply) && /indicação de Marcelo/.test(r.reply) && r.state?.referral_named === 'Marcelo', { reply: r.reply, st: r.state?.referral_named })
}
// 56. Caso Catarina (08h35): sem agendamento para remarcar, a resposta já oferece marcar.
{
  const r = await turno({ msg: 'Quero remarcar o corte do meu irmão', state: {}, ai: { intent: 'reschedule', reply: 'Ok' }, contexto: ctxCliente('Catarina Teste'), futuros: [] })
  checar('56 sem agendamento: oferece marcar um novo', /já marco um novo/.test(r.reply), r.reply)
}

// ---- v29.274.0: a JuIA não presume o serviço (Juliano, 01/10/2026) ----
// 57. Histórico "Pezinho + Pigmentação" (o do Sharles): pede horário sem dizer o serviço → mostra horários,
//     fecha com a pergunta numerada, e o "1" reserva SÓ o corte.
{
  const ctx = ctxCliente('Sharles Teste', { last_services: 'Pezinho (acabamento) + Pigmentação Capilar (Tintura)' })
  // v29.276.0: o pedido diz "sábado" — a data tem que ser um sábado (com dia2, que é terça a sexta, o dia do
  // cliente vencia o do modelo e o cenário falhava em toda semana em que dia2 não caía num sábado).
  const sabado = proxima(6) === hoje ? somar(hoje, 7) : proxima(6)
  const vagas = { [sabado]: ['08:45', '10:00'] }
  const r1 = await turno({ msg: 'Tem horário sábado cedo?', state: {}, ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: sabado } }, contexto: ctx, vagas })
  checar('57a consulta não cita pigmentação nem pezinho', !/Pigmenta|Pezinho/.test(r1.reply) && /08:45/.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: '8:45', state: r1.state, history: [{ role: 'user', content: 'Tem horário sábado cedo?' }, { role: 'assistant', content: r1.reply }], ai: { intent: 'book', reply: 'Reservado', updates: { time: '08:45' } }, contexto: ctx, vagas })
  checar('57b não reserva sem o serviço dito: pergunta numerada', !reservou(r2) && /Qual serviço vai ser\?/.test(r2.reply), r2.reply)
  const r3 = await turno({ msg: '1', state: r2.state, history: [{ role: 'assistant', content: r2.reply }], ai: { intent: 'book', reply: 'Reservado', updates: {} }, contexto: ctx, vagas })
  const reserva = r3.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('57c "1" reserva só o Corte de cabelo', reserva?.args?.p_service_name === 'Corte de cabelo', { reply: r3.reply, servico: reserva?.args?.p_service_name })
}
// 58. O modelo enfia serviço que ninguém pediu (pigmentação) num pedido sem serviço → a trava segura.
{
  const r = await turno({ msg: 'pode ser amanhã 10h', state: { name: 'Teste Trava', upsell_offer_done: true }, ai: { intent: 'book', reply: 'Reservado', updates: { services: ['Corte de cabelo', 'Pigmentação Capilar (Tintura)'], date: amanha, time: '10:00' } }, contexto: ctxCliente('Teste Trava'), vagas: { [amanha]: ['10:00'] } })
  checar('58 trava: serviço não dito não vira reserva', !reservou(r) && /Qual serviço vai ser\?/.test(r.reply), r.reply)
}
// 59. Ele disse "corte" e o modelo somou pigmentação → reserva só o corte.
{
  const r = await turno({ msg: 'quero um corte amanhã 10h', state: { name: 'Teste Trava', upsell_offer_done: true }, ai: { intent: 'book', reply: 'Reservado', updates: { services: ['Corte de cabelo', 'Pigmentação Capilar (Tintura)'], date: amanha, time: '10:00' } }, contexto: ctxCliente('Teste Trava'), vagas: { [amanha]: ['10:00'] } })
  const reserva = r.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('59 trava: fica só o que ele disse', !reserva || reserva.args?.p_service_name === 'Corte de cabelo', { reply: r.reply, servico: reserva?.args?.p_service_name })
  checar('59 trava: nada de pigmentação na resposta', !/Pigmenta/.test(r.reply), r.reply)
}

// ---- regressão: o caminho feliz continua igual ----------------------------------------------------
{
  const r = await turno({ msg: `Quero corte de cabelo ${dia1 === amanha ? 'amanhã' : 'dia ' + dia1.slice(8, 10) + '/' + dia1.slice(5, 7)} às 10h`, state: { upsell_offer_done: true },
    ai: { intent: 'book', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: dia1, time: '10:00' } }, contexto: ctxCliente('Carlos Teste'), vagas: { [dia1]: ['09:00', '10:00'] } })
  checar('R1 reserva normal continua funcionando', reservou(r) && /Reservado/.test(r.reply), r.reply)
}
{
  const r = await turno({ msg: 'bom dia', ai: { intent: 'other', reply: 'Bom dia! Como posso ajudar?' }, contexto: ctxCliente('Carlos Teste') })
  checar('R2 saudação com nome', /^(Bom dia|Boa tarde|Boa noite), Carlos!/.test(r.reply), r.reply)
}
{
  const r = await turno({ msg: 'pode cancelar meu horário', ai: { intent: 'cancel', reply: 'Ok' }, contexto: ctxCliente('Carlos Teste'), futuros: [{ id: 'b2', booking_date: dia1, start_time: '10:00:00', service_name: 'Corte de cabelo' }] })
  // v29.271.0: pedido explícito com um agendamento só cancela direto (era o sim/não até a 29.270).
  checar('R3 pedido explícito de cancelar cancela direto', cancelou(r) && /Cancelei/.test(r.reply), r.reply)
}
// 49. Caso Henrique (01/10/2026, 12h28): "vou ter que desmarcar" com um agendamento só cancela na hora.
{
  const r = await turno({ msg: 'Tive um imprevisto aqui vou ter que desmarcar', ai: { intent: 'cancel', reply: 'Ok' }, contexto: {}, nomeWhats: 'Henrique',
    futuros: [{ id: 'b49', booking_date: hoje, start_time: '14:20:00', service_name: 'Barba Express' }], vagas: { [dia1]: ['10:00'] } })
  checar('49 desmarcar com 1 agendamento: cancela direto', cancelou(r) && !/Responda sim ou não/.test(r.reply), r.reply)
}
// 49b. Pergunta sobre cancelar não cancela nada: continua no sim/não.
{
  const r = await turno({ msg: 'Posso desmarcar meu horário?', ai: { intent: 'cancel', reply: 'Ok' }, contexto: ctxCliente('Carlos Teste'), futuros: [{ id: 'b2', booking_date: dia1, start_time: '10:00:00', service_name: 'Corte de cabelo' }] })
  checar('49b pergunta "posso desmarcar?" pede sim/não', !cancelou(r) && /Responda sim ou não/.test(r.reply), r.reply)
}
// 60. Caso Alexander (06/10/2026, 10h28): "O mais próximo que tenho é 17:40 ou 17:45. Serve pra você?" →
// "pode ser" reserva o primeiro oferecido, sem voltar a perguntar o período.
{
  const st = { services: ['Corte + Barba Express'], servicos_escolhidos: ['Corte + Barba Express'], date: dia1, time: '17:30', name: 'Alexander Teste', pending_fit_choice: { time: '17:30', added: null, alts: ['17:40', '17:45'] } }
  const r = await turno({ msg: 'pode ser', state: st, ai: { intent: 'availability', reply: 'Você prefere manhã, tarde ou final do dia?' }, contexto: ctxCliente('Alexander Teste'), vagas: { [dia1]: ['17:40', '17:45'] } })
  const criou = r.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('60 "pode ser" à oferta: reserva o 17:40', Boolean(criou) && String(criou.args?.p_start_time).startsWith('17:40'), { reply: r.reply, args: criou?.args })
  const r2 = await turno({ msg: '17h45', state: st, ai: { intent: 'book', reply: 'Ok', updates: { time: '17:45' } }, contexto: ctxCliente('Alexander Teste'), vagas: { [dia1]: ['17:40', '17:45'] } })
  const criou2 = r2.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('60 horário citado da oferta: reserva o 17:45', Boolean(criou2) && String(criou2.args?.p_start_time).startsWith('17:45'), { reply: r2.reply, args: criou2?.args })
}
// 61. Caso Renan (06/10/2026, 12h02): "18:10 pode ser" + "Pode me mandar a localização" — a resposta leva a
// localização e diz que o agendamento ainda não está concluído (falta o serviço).
{
  const r = await turno({ msg: '18:10 pode ser\nPode me mandar a localização por favor', state: { date: hoje, period: 'noite' },
    ai: { intent: 'availability', reply: 'Vou ver.', updates: { date: hoje, time: '18:10' } }, contexto: {}, nomeWhats: 'Renan',
    vagas: { [hoje]: ['18:10', '18:15', '18:30'] } })
  checar('61 localização: manda o link do Maps', /maps\.app\.goo\.gl/.test(r.reply) && /Antônio da Cruz, 482/.test(r.reply), r.reply)
  checar('61 localização: não reserva sem o serviço', !reservou(r), r.reply)
  checar('61 localização: avisa que não está concluído quando pede o serviço', !/Qual serviço vai ser/.test(r.reply) || /não está concluído/.test(r.reply), r.reply)
}
// 62. Pedido do Juliano (06/10/2026, caso Lucas): a oferta da lavagem depois da reserva diz o ACRÉSCIMO
// ("por mais R$ 10,00"), não o preço do combo ("Corte + Lavagem, vira R$ 50,00").
{
  const r = await turno({ msg: `Quero corte de cabelo ${dia1 === amanha ? 'amanhã' : 'dia ' + dia1.slice(8, 10) + '/' + dia1.slice(5, 7)} às 10h`, state: {},
    ai: { intent: 'book', reply: 'Vou ver.', updates: { services: ['Corte de cabelo'], date: dia1, time: '10:00' } }, contexto: ctxCliente('Lucas Teste'), vagas: { [dia1]: ['09:00', '10:00'] } })
  checar('62 lavagem: oferece "por mais R$ 10,00" e não "vira"', /incluir a lavagem no seu corte por mais R\$\s?10,00/.test(r.reply) && !/vira R\$/.test(r.reply), r.reply)
}

// ---- v29.276.0: caso Samuel (07/10/2026) — "pintar o cabelo de preto" -------------------------------
const TINT = 'Pigmentação Capilar (Tintura)'
const histSamuel = ['Tem horário disponível', 'Para hj', 'É, mas vocês vão ter que pintar o cabelo preto também.', 'De manhã'].map((c) => ({ role: 'user', content: c }))
// 63a. Corte suposto + tintura pedida: a pergunta do serviço guarda a tintura; o "1" reserva os dois.
{
  const st = { services: ['Corte de cabelo', TINT], usual_assumed: true, date: dia1, name: 'Samuel Teste', upsell_offer_done: true, ditos: { nomes: [TINT], fams: [] } }
  const r1 = await turno({ msg: 'Pode ser a 10:30\n?', state: st, history: histSamuel, ai: { intent: 'book', reply: 'Ok', updates: { time: '10:30' } }, contexto: ctxCliente('Samuel Teste', { completed_visits: 0 }), vagas: { [dia1]: ['10:30'] } })
  checar('63a pergunta o serviço sem largar a tintura', !reservou(r1) && /Anotei Pigmentação Capilar/.test(r1.reply) && (r1.state?.services || []).includes(TINT), { reply: r1.reply, services: r1.state?.services })
  const r2 = await turno({ msg: '1', state: r1.state, history: [...histSamuel, { role: 'assistant', content: r1.reply }], ai: { intent: 'book', reply: 'Reservado', updates: {} }, contexto: ctxCliente('Samuel Teste', { completed_visits: 0 }), vagas: { [dia1]: ['10:30'] } })
  const criou = r2.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('63a "1" reserva corte E tintura', /Corte de cabelo/.test(String(criou?.args?.p_service_name)) && String(criou?.args?.p_service_name).includes(TINT), { reply: r2.reply, servico: criou?.args?.p_service_name })
}
// 63b. "Sim" a "Corte + Tintura, quer que eu reserve?": a trava reconhece "pintar" e a tintura entra.
{
  const st = { services: ['Corte de cabelo', TINT], date: dia1, time: '10:30', name: 'Samuel Teste', upsell_offer_done: true, ditos: { nomes: [], fams: ['corte'] } }
  const h = [...histSamuel, { role: 'user', content: 'Para pintar de preto' }, { role: 'user', content: 'Mas eu vou cortar o cabelo também' }]
  const r = await turno({ msg: 'Sim', state: st, history: h, ai: { intent: 'book', reply: 'Reservado', updates: {} }, contexto: ctxCliente('Samuel Teste'), vagas: { [dia1]: ['10:30'] } })
  const criou = r.chamadas.find((x: any) => x.alvo === 'create_public_booking_v15')
  checar('63b "Sim" reserva com a tintura', String(criou?.args?.p_service_name).includes(TINT), { reply: r.reply, servico: criou?.args?.p_service_name })
}
// 63c. "1" com reserva montada e não feita não é "Obrigado! Se precisar de horário…".
{
  const st = { services: ['Corte de cabelo', TINT], date: dia1, time: '10:30', name: 'Samuel Teste', upsell_offer_done: true, ditos: { nomes: [TINT], fams: ['corte'] } }
  const r = await turno({ msg: '1', state: st, history: histSamuel, ai: { intent: 'book', reply: 'Reservado', updates: {} }, contexto: ctxCliente('Samuel Teste'), vagas: { [dia1]: ['10:30'] } })
  checar('63c "1" no meio da reserva não vira despedida', !/Se precisar de horário/.test(r.reply), r.reply)
}
// 63d. "Fica quanto tudo" depois de "quer incluir a lavagem?" responde o valor e não inclui nada.
{
  const st = { services: ['Corte de cabelo'], date: dia1, time: '10:30', name: 'Samuel Teste', completed: true, upsell_offer_options: ['Corte + Lavagem', '__none__'], upsell_post_booking: { id: 'bk-novo', date: dia1, time: '10:30', services: ['Corte de cabelo'] } }
  const r = await turno({ msg: 'Fica quanto tudo', state: st, ai: { intent: 'other', reply: 'Ok' }, contexto: ctxCliente('Samuel Teste'), futuros: [{ id: 'bk-novo', booking_date: dia1, start_time: '10:30:00', service_name: 'Corte de cabelo' }] })
  const trocou = r.chamadas.some((x: any) => x.alvo === 'phone_change_booking_service')
  checar('63d "fica quanto tudo" não aceita a lavagem', !trocou && !/Incluído/.test(r.reply), r.reply)
  checar('63d "fica quanto tudo" diz os dois valores e mantém a oferta', /R\$\s?40,00/.test(r.reply) && /R\$\s?50,00/.test(r.reply) && /\*1\*/.test(r.reply), r.reply)
}
// 63e. Já reservado: "Mas é pintar o cabelo de preto" pede pra incluir a tintura no horário (não lista horários).
{
  const st = { services: ['Corte + Lavagem'], date: dia1, time: '10:30', name: 'Samuel Teste', completed: true }
  const fut = [{ id: 'b63', booking_date: dia1, start_time: '10:30:00', service_name: 'Corte + Lavagem' }]
  const r = await turno({ msg: 'Mas é pintar o cabelo de preto', state: st, ai: { intent: 'availability', reply: 'Hoje tenho 09:15, 09:30.', updates: {} }, contexto: ctxCliente('Samuel Teste'), futuros: fut, vagas: { [dia1]: ['09:15', '09:30'] } })
  checar('63e incluir a tintura no horário já marcado', /incluir Pigmentação Capilar \(Tintura\)/.test(r.reply) && /Fica Corte \+ Lavagem \+ Pigmentação Capilar \(Tintura\)/.test(r.reply), r.reply)
  const r2 = await turno({ msg: 'Sim', state: r.state, ai: { intent: 'other', reply: 'Ok' }, contexto: ctxCliente('Samuel Teste'), futuros: fut })
  const troca = r2.chamadas.find((x: any) => x.alvo === 'phone_change_booking_service')
  checar('63e "Sim" grava Corte + Lavagem + Tintura', troca?.args?.p_service_name === `Corte + Lavagem + ${TINT}`, { reply: r2.reply, args: troca?.args })
}
// 63f. Pergunta de existência depois de reservado continua sendo só pergunta (não vira inclusão).
{
  const st = { services: ['Corte + Lavagem'], date: dia1, time: '10:30', name: 'Samuel Teste', completed: true }
  const r = await turno({ msg: 'Vocês pinta cabelo', state: st, ai: { intent: 'faq', reply: 'Sim, fazemos Pigmentação Capilar (Tintura) por R$ 50,00.' }, contexto: ctxCliente('Samuel Teste'), futuros: [{ id: 'b63', booking_date: dia1, start_time: '10:30:00', service_name: 'Corte + Lavagem' }] })
  checar('63f "vocês pinta cabelo" responde, não pede confirmação de inclusão', !/Responda sim ou não/.test(r.reply), r.reply)
}

console.log(`\n${ok} ok, ${falhou} falharam`)
if (falhou) Deno.exit(1)
