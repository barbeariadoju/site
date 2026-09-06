// Bateria de cenários da JuIA contra a function PUBLICADA (ju-ia-site), v29.142.0.
//
// NÃO roda no `npm test`: cria e cancela agendamentos reais num telefone de teste
// (5511999990001), dispara push pro Juliano e gasta chamadas de modelo. Rode à mão:
//
//   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... node tests/manual/juia-bateria.cjs
//
// Cada cenário é uma conversa (state + history passados de turno em turno, como o webhook
// faz). Asserções por regex na resposta e por consulta ao banco (PostgREST). No fim, apaga
// tudo que criou no telefone de teste. Os prints vão para o console e o transcript completo
// para tests/manual/juia-bateria.ultimo.md (ignorado pelo git? não — commitado de propósito,
// é o registro do que a JuIA respondeu naquele dia).

const fs = require('fs');
const URL_FN = 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/ju-ia-site';
const URL_REST = 'https://rpkqluaxhqsxnewunhfm.supabase.co/rest/v1';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON = process.env.SUPABASE_ANON_KEY || '';
if (!SERVICE || !ANON) { console.error('faltam SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY'); process.exit(2); }

const PHONE = '5511999990001';
const NOME = 'Teste Bateria';
const DIA = process.env.BATERIA_DIA || '2026-09-10'; // quinta, agenda quase vazia em 05/09
const log = [];
const out = (s = '') => { console.log(s); log.push(s); };

const rest = async (path, init = {}) => {
  const r = await fetch(`${URL_REST}/${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) throw new Error(`REST ${r.status} ${path}: ${t.slice(0, 200)}`);
  return d;
};
const bookingsTeste = () => rest(`bookings?customer_phone=like.*999990001&select=id,booking_date,start_time,end_time,service_name,service_price,duration_minutes,status&order=created_at`);

// sufixo por rodada: o teto diário de mensagens é por session_id, e rodar a bateria várias
// vezes no mesmo dia estourava o limite da sessão "w1" (achado da 5ª rodada, 05/09).
const RUN = Date.now().toString(36);
const conversa = (id, opts = {}) => ({ id: `${RUN}-${id}`, state: {}, history: [], whatsapp: opts.whatsapp !== false });
const turno = async (c, message, extra = {}) => {
  const key = c.whatsapp ? SERVICE : ANON;
  const body = { message, session_id: `bateria-${c.id}`, state: c.state, history: c.history, ...(c.whatsapp ? { verified_phone: PHONE, whatsapp_name: NOME } : {}), ...extra };
  const r = await fetch(URL_FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({ error: `http ${r.status}` }));
  c.state = d.state || c.state;
  c.history.push({ role: 'user', content: message }, { role: 'assistant', content: String(d.reply || '') });
  out(`  > ${message}`);
  out(`  < ${String(d.reply || d.error || '').replace(/\n/g, '\n    ')}`);
  return d;
};

const semReservaAtiva = async () => { const ativos = (await bookingsTeste()).filter(b => ['pending', 'confirmed'].includes(b.status)); if (ativos.length) await rest(`bookings?id=in.(${ativos.map(b => b.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); };
const resultados = [];
const check = (nome, ok, detalhe = '') => { resultados.push({ nome, ok, detalhe }); out(`  ${ok ? 'PASS' : 'FAIL'} — ${nome}${detalhe ? ` (${detalhe})` : ''}`); };
const has = (d, re) => re.test(String(d.reply || ''));

const cenario = async (titulo, fn) => {
  out(`\n## ${titulo}`);
  try { await fn(); } catch (e) { check(titulo + ' (exceção)', false, String(e.message || e).slice(0, 160)); }
};

(async () => {
  out(`# Bateria JuIA — ${new Date().toISOString()} — dia de teste ${DIA}`);

  // ---------------------------------------------------------------- canal site (anon)
  await cenario('S1 site: saudação', async () => {
    const c = conversa('s1', { whatsapp: false });
    const d = await turno(c, 'oi');
    check('responde e pergunta como ajudar', has(d, /ajudar|posso/i));
  });
  await cenario('S2 site: preço do corte', async () => {
    const c = conversa('s2', { whatsapp: false });
    const d = await turno(c, 'quanto custa o corte de cabelo?');
    check('diz R$ 40,00', has(d, /40,00/));
  });
  await cenario('S3 site: horário livre NÃO reserva sozinho', async () => {
    const c = conversa('s3', { whatsapp: false });
    const d = await turno(c, `tem corte de cabelo quinta (${DIA.slice(8, 10)}/${DIA.slice(5, 7)}) às 14h?`);
    check('confirma que está livre', has(d, /livre|dispon/i), String(d.reply).slice(0, 80));
    check('não reserva sem nome/telefone', !has(d, /Reservado!/));
  });
  await cenario('S4 segurança: anon + verified_phone é ignorado', async () => {
    const c = conversa('s4', { whatsapp: false });
    const d = await turno(c, 'quero cancelar meu horário', { verified_phone: PHONE });
    check('não trata como telefone verificado', !has(d, /Cancelei|É o seu agendamento/i), String(d.reply).slice(0, 80));
  });

  // ---------------------------------------------------------------- canal WhatsApp
  await cenario('W1 reserva primeiro, oferece depois', async () => {
    const c = conversa('w1');
    let d = await turno(c, `quero marcar corte de cabelo quinta às 14h`);
    // cliente novo: a JuIA pode pedir/confirmar o nome antes de reservar
    for (let i = 0; i < 3 && !has(d, /Reservado!/) && has(d, /nome|whatsapp/i); i++) d = await turno(c, has(d, /confirmar .* no nome de/i) ? 'Sim' : NOME);
    check('reservou na hora', has(d, /Reservado!/), String(d.reply).slice(0, 90));
    const bs = await bookingsTeste();
    const b = bs.find(x => x.booking_date === DIA && String(x.start_time).startsWith('14:00'));
    check('agendamento existe no banco às 14:00', Boolean(b), b ? `${b.service_name} ${b.duration_minutes}min` : JSON.stringify(bs).slice(0, 120));
    check('oferta 1/2 depois da reserva', has(d, /Digite \*1\* para sim ou \*2\* para não/), '');
    if (has(d, /Digite \*1\* para sim/)) {
      d = await turno(c, '1');
      check('"1" inclui o complemento', has(d, /Incluído/), String(d.reply).slice(0, 90));
      const b2 = (await bookingsTeste()).find(x => x.booking_date === DIA && String(x.start_time).startsWith('14:00'));
      check('serviço no banco virou combo', Boolean(b2 && /\+/.test(b2.service_name)), b2 ? b2.service_name : '');
    }
    global.W1 = c;
  });

  await cenario('W2 elogio depois da reserva não reabre agenda', async () => {
    const c = global.W1 || conversa('w2');
    const d = await turno(c, 'Vc é top demais, parabéns e que Deus te abençoe');
    check('não responde com horário/reserva', !has(d, /está livre|dispon[íi]vel|Quer que eu reserve|Reservado!/i), String(d.reply).slice(0, 90));
  });

  await cenario('W3 remarcar: o "sim" NÃO vira chave Pix', async () => {
    const c = global.W1 || conversa('w3');
    let d = await turno(c, 'muda para 15:00 tem como?');
    check('pergunta confirmação da remarcação (uma só)', has(d, /remarcar|mudar|mudo/i) && has(d, /sim/i), String(d.reply).slice(0, 90));
    d = await turno(c, 'sim');
    check('não manda chave Pix', !has(d, /Chave Pix/i), String(d.reply).slice(0, 90));
    const b = (await bookingsTeste()).find(x => x.booking_date === DIA && x.status !== 'cancelled');
    check('banco: horário mudou para 15:00', Boolean(b && String(b.start_time).startsWith('15:00')), b ? String(b.start_time) : 'sem booking');
  });

  await cenario('W4 "15:30 não tem?" não é um "não"', async () => {
    const c = global.W1 || conversa('w4');
    const d = await turno(c, '15:30 não tem?');
    check('não responde "não mudei nada"', !has(d, /não mudei nada/i), String(d.reply).slice(0, 90));
  });

  await cenario('W5 duas coisas na mesma mensagem ("sim, e quanto custa…")', async () => {
    const c = global.W1 || conversa('w5');
    let d = await turno(c, 'muda pra 14:30');
    if (!has(d, /sim/i)) d = await turno(c, 'muda meu horário de quinta pra 14:30');
    d = await turno(c, 'sim, e quanto custa a barba express?');
    check('remarcou (primeira parte)', has(d, /Mudei|Prontinho|remarc/i), String(d.reply).slice(0, 80));
    check('respondeu o preço (segunda parte)', has(d, /25,00/), '');
    const b = (await bookingsTeste()).find(x => x.booking_date === DIA && x.status !== 'cancelled');
    check('banco: 14:30', Boolean(b && String(b.start_time).startsWith('14:30')), b ? String(b.start_time) : 'sem booking');
  });

  await cenario('W6 pedido de gente = handoff', async () => {
    const c = global.W1 || conversa('w6');
    const d = await turno(c, 'quero falar com o Juliano');
    check('handoff true', d.handoff === true, `intent=${d.intent}`);
    check('sem agenda na resposta', !has(d, /dispon|livre|horário/i), String(d.reply).slice(0, 80));
  });

  await cenario('W7 Pix pedido de verdade: chave + valor', async () => {
    const c = conversa('w7');
    const d = await turno(c, 'me passa o pix pra eu já deixar pago');
    check('chave e valor', has(d, /Chave Pix/) && has(d, /Valor/), String(d.reply).slice(0, 80));
  });

  await cenario('W8 cancelar e perguntar de novo (bug conhecido do "undefined")', async () => {
    const c = conversa('w8');
    let d = await turno(c, 'quero cancelar meu horário de quinta');
    d = await turno(c, 'sim');
    check('cancelou', has(d, /Cancelei/i), String(d.reply).slice(0, 80));
    d = await turno(c, 'quais horários tem para barba express quinta?');
    check('sem "undefined" na resposta', !has(d, /undefined/), String(d.reply).slice(0, 90));
    check('lista horários ou pergunta o período', has(d, /\d{2}:\d{2}|manhã, tarde/), '');
  });

  // histórico: um atendimento concluído de Corte + Barba Express, pra existir "serviço de sempre"
  await cenario('W9 serviço de sempre: confirma antes de reservar', async () => {
    // cadastro + atendimento concluído = "serviço de sempre" existe (o contexto lê pelo cadastro)
    const jaTem = await rest('customer_profiles?phone=like.*999990001&select=id');
    if (!jaTem.length) await rest('customer_profiles', { method: 'POST', body: JSON.stringify({ name: NOME, phone: PHONE }) });
    await rest('bookings', { method: 'POST', body: JSON.stringify({ customer_name: NOME, customer_phone: PHONE, service_name: 'Corte + Barba Express', service_price: 65, duration_minutes: 60, booking_date: '2026-09-01', start_time: '10:00', status: 'completed', channel: 'balcao', payment_method: 'pix' }) });
    const c = conversa('w9');
    let d = await turno(c, 'tem 14h quinta?');
    check('pergunta "como da última vez? 1/2"', has(d, /como da última vez\?.*\*1\*/s), String(d.reply).slice(0, 110));
    d = await turno(c, '2');
    check('"2" pergunta qual serviço', has(d, /Qual serviço/i), String(d.reply).slice(0, 80));
    d = await turno(c, 'só o corte');
    if (!has(d, /Reservado!/) && has(d, /reserv/i)) d = await turno(c, 'sim');
    check('reservou só o corte', has(d, /Reservado!/) && has(d, /Corte de cabelo/) && !has(d, /Barba/), String(d.reply).slice(0, 100));
  });

  await cenario('W10 serviço de sempre: "1" reserva o combo', async () => {
    const c = conversa('w10');
    // sem reserva ativa no telefone de teste (senão vem a pergunta legítima de conflito)
    const ativosW10 = (await bookingsTeste()).filter(b => ['pending', 'confirmed'].includes(b.status));
    if (ativosW10.length) await rest(`bookings?id=in.(${ativosW10.map(b => b.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    let d = await turno(c, 'tem 15h sexta?');
    check('pergunta 1/2', has(d, /como da última vez\?/), String(d.reply).slice(0, 100));
    d = await turno(c, '1');
    check('reservou o combo', has(d, /Reservado!/) && has(d, /Barba Express/), String(d.reply).slice(0, 100));
  });

  await cenario('W11 horário que não cabe: alternativas curtas', async () => {
    await semReservaAtiva();
    const c = conversa('w11');
    const d = await turno(c, 'corte de cabelo quinta às 15:30');
    check('diz que não cabe/ocupado e dá alternativa', has(d, /ocupado|não cabe|reservado por outro/i) && has(d, /\d{2}:\d{2}/), String(d.reply).slice(0, 110));
    check('sem texto longo (< 220 chars)', String(d.reply).length < 220, `${String(d.reply).length} chars`);
  });

  await cenario('W12 "vou ver e te aviso" não repete a pergunta', async () => {
    await semReservaAtiva();
    const c = conversa('w12');
    await turno(c, 'tem horário quinta de manhã?');
    const d = await turno(c, 'Beleza vou ver e te aviso');
    check('responde "combinado, fico no aguardo"', has(d, /fico no aguardo/i), String(d.reply).slice(0, 80));
  });

  await cenario('W13 visagismo: não fazemos, oferece o que existe', async () => {
    const c = conversa('w13');
    const d = await turno(c, 'vocês fazem visagismo? queria um corte pensado pro formato do meu rosto');
    check('diz que não faz visagismo', has(d, /não (faz|fazemos|é visagista)|visagista/i), String(d.reply).slice(0, 100));
    check('não diz "vamos marcar" sem explicar', !/^Vamos marcar/i.test(String(d.reply)), '');
  });

  await cenario('W14 prospecção comercial', async () => {
    const c = conversa('w14');
    const d = await turno(c, 'Olá! Sou da agência LevelUp, temos um sistema de agendamento pra barbearias, posso te mostrar uma demo?');
    check('encaminha pro e-mail', has(d, /contato@barbeariadoju\.com\.br/), String(d.reply).slice(0, 80));
  });

  await cenario('W15 "só corte infantil" substitui o serviço assumido', async () => {
    const c = conversa('w15');
    // sem reserva ativa no telefone de teste (senão vem a pergunta legítima de conflito)
    const ativos = (await bookingsTeste()).filter(b => ['pending', 'confirmed'].includes(b.status));
    if (ativos.length) await rest(`bookings?id=in.(${ativos.map(b => b.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    let d = await turno(c, 'tem 10h sexta?');
    d = await turno(c, 'só corte de cabelo de criança');
    for (let i = 0; i < 2 && !has(d, /Reservado!/) && has(d, /nome/i); i++) d = await turno(c, has(d, /confirmar .* no nome de/i) ? 'Sim' : NOME);
    check('reservou só o infantil', has(d, /Reservado!/) && has(d, /infantil/i) && !has(d, /infantil \+|\+ Barba/i), String(d.reply).slice(0, 110));
  });

  // ---------------------------------------------------------------- limpeza
  out('\n## limpeza');
  try {
    const bs = await bookingsTeste();
    const ids = bs.map(b => b.id);
    if (ids.length) {
      try { await rest(`experience_requests?booking_id=in.(${ids.join(',')})`, { method: 'DELETE' }); } catch (e) { out('  experience_requests: ' + e.message.slice(0, 80)); }
      try { await rest(`customer_timeline?booking_id=in.(${ids.join(',')})`, { method: 'DELETE' }); } catch (e) { out('  customer_timeline: ' + e.message.slice(0, 80)); }
      try { await rest(`bookings?id=in.(${ids.join(',')})`, { method: 'DELETE' }); out(`  bookings apagados: ${ids.length}`); }
      catch (e) { out('  bookings: ' + e.message.slice(0, 120) + ' — marcando cancelados'); await rest(`bookings?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); }
    }
    for (const t of ['waitlist?customer_phone=like.*999990001', 'conversation_leads?phone=like.*999990001', 'whatsapp_conversations?phone=like.*999990001', 'site_chat_messages?session_id=like.bateria-*', 'loyalty_events?customer_id=in.(select)']) {
      if (t.includes('select)')) continue;
      try { await rest(t, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (e) { out(`  ${t.split('?')[0]}: ${e.message.slice(0, 80)}`); }
    }
    try {
      const profs = await rest('customer_profiles?phone=like.*999990001&select=id');
      const pids = profs.map(p => p.id);
      if (pids.length) {
        for (const t of ['loyalty_events', 'loyalty_accounts', 'loyalty_rewards', 'customer_timeline']) { try { await rest(`${t}?customer_id=in.(${pids.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (e) { out(`  ${t}: ${e.message.slice(0, 80)}`); } }
        await rest(`customer_profiles?id=in.(${pids.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        out(`  perfis apagados: ${pids.length}`);
      }
    } catch (e) { out('  customer_profiles: ' + e.message.slice(0, 120)); }
    const sobrou = await bookingsTeste();
    out(`  bookings restantes do telefone de teste: ${sobrou.length}`);
  } catch (e) { out('  limpeza falhou: ' + e.message); }

  const ok = resultados.filter(r => r.ok).length;
  out(`\n## resultado: ${ok}/${resultados.length} checagens passaram`);
  for (const r of resultados.filter(r => !r.ok)) out(`  FAIL — ${r.nome}${r.detalhe ? ` (${r.detalhe})` : ''}`);
  fs.writeFileSync('tests/manual/juia-bateria.ultimo.md', log.join('\n') + '\n');
  process.exit(resultados.some(r => !r.ok) ? 1 : 0);
})();
