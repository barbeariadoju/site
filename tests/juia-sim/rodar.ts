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
}
const turno = async (c: Cenario) => {
  chamadas.length = 0; saidas.length = 0
  respostaDoModelo = { reply: 'Como posso ajudar?', intent: 'other', updates: {}, handoff: false, ...(c.ai || {}) }
  respostas.tabela = {
    services: () => catalogo, service_price_changes: () => [], products: () => [], marketing_memory: () => [],
    schedule_blocks: () => [], customer_benefits: () => [], site_chat_messages: () => null, conversation_leads: () => null,
    customer_profiles: () => [], whatsapp_attribution: () => [],
    bookings: (q) => q.op === 'select' ? (q.filtros?.some((f: any) => f[0] === 'eq' && f[1] === 'status' && f[2] === 'completed') ? (c.concluidos || []) : [{ id: 'bk-novo' }]) : null,
    return_invites: () => null,
  }
  respostas.rpc = {
    get_customer_commercial_context: () => c.contexto || {},
    phone_upcoming_bookings: () => c.futuros || [],
    get_available_slots: (a: any) => ((c.vagas || {})[a.p_date] || []).map((t) => ({ slot_time: t + ':00' })),
    get_available_slots_excluding: (a: any) => ((c.vagas || {})[a.p_date] || []).map((t) => ({ slot_time: t + ':00' })),
    extended_close_slot_ok: () => false,
    create_public_booking_v15: () => ({ data: 'bk-novo', error: null }),
    whatsapp_cancel_booking: (a: any) => ({ data: [{ id: a.p_booking_id, booking_date: dia1, start_time: '08:00:00', service_name: 'Corte de cabelo' }], error: null }),
    waitlist_matches_for_slot: () => [],
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
  const r = await turno({ msg: 'Fica agendado para 13.30 certo', state: { services: ['Corte de cabelo'], date: dia1, name: 'Sr Magno', upsell_offer_done: true },
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
  checar('14b pergunta o serviço antes de reservar', !reservou(r2) && /como da última vez/i.test(r2.reply), r2.reply)
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
  checar('19a resposta fala do corte, não do combo', /Corte de cabelo/.test(r1.reply) && !/Barba Express/.test(r1.reply), r1.reply)
  const r2 = await turno({ msg: 'Otavio', state: { services: ['Corte de cabelo'], date: dia1, pending_waitlist: { date: hoje, period: null, service_name: 'Corte de cabelo', service_price: 40, duration_minutes: 45 } },
    history: [{ role: 'assistant', content: 'Para te colocar na lista de espera, preciso de seu nome.' }],
    ai: { intent: 'other', reply: 'Certo.', updates: { name: 'Otavio' } }, contexto: { completed_visits: 0 }, vagas: { [dia1]: ['09:00'] } })
  checar('19b nome fecha a lista de espera', r2.saidas.some((s: any) => s.url.includes('join-waitlist')) && /lista de espera/i.test(r2.reply), r2.reply)
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
  checar('R3 pedido explícito de cancelar pede sim/não', /cancelar\? Responda sim ou não/i.test(r.reply), r.reply)
}

console.log(`\n${ok} ok, ${falhou} falharam`)
if (falhou) Deno.exit(1)
