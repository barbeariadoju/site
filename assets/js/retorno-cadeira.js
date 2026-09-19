// v29.210.0 — Retorno marcado NA CADEIRA (19/09/2026).
//
// Os números de 60 dias (19/09): 53% dos clientes marcam no mesmo dia, 30% na véspera e só 7%
// com 4 dias ou mais. A agenda da semana seguinte fica quase vazia até a véspera, e quarta e
// quinta são as que menos enchem. A oferta de retorno pelo WhatsApp (v29.193.0) chega depois,
// quando o cliente já saiu. Aqui a oferta vira uma pergunta do próprio Juliano, com o cliente
// ainda na cadeira: logo depois do Concluir, o painel mostra até 3 opções reais de terça a
// quinta perto do retorno típico dele, e um toque reserva.
//
// Regra pura (sem banco, sem DOM), pra ser testada em tests/unit/retorno-cadeira.spec.js.
// É a MESMA regra de supabase/functions/_shared/dias-fracos.ts + convite-retorno.ts (o teste
// confere a paridade): mudou lá, muda aqui.

export const DIAS_FRACOS = new Set([2, 3, 4]); // terça, quarta, quinta
export const RETORNO_TIPICO = { corte: 17, barba: 7, outro: 17 };

export const diaDaSemana = (iso) => new Date(`${iso}T12:00:00-03:00`).getUTCDay();
export const ehDiaFraco = (iso) => DIAS_FRACOS.has(diaDaSemana(iso));

export const somarDias = (iso, dias) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
};

export const familiaDoServico = (nome) => {
  const n = String(nome || '').toLowerCase();
  if (/corte|raspar|infantil|luzes|platinado|nevou|alisamento|relaxamento|tintura|pigmenta[cç][aã]o capilar|lavagem/.test(n)) return 'corte';
  if (/barba|barboterapia/.test(n)) return 'barba';
  return 'outro';
};

export const retornoTipicoDias = (cadenciaDias, servico) => {
  const c = Number(cadenciaDias) || 0;
  return c >= 4 ? c : RETORNO_TIPICO[familiaDoServico(servico)];
};

// Mesma conta do customer_visit_cadence_days do banco: últimas 6 datas distintas com
// atendimento concluído, intervalos entre elas, mediana quando há 2 intervalos ou mais.
export const cadenciaDias = (datasIso) => {
  const datas = [...new Set((datasIso || []).map((d) => String(d).slice(0, 10)))].sort().slice(-6);
  const gaps = [];
  for (let i = 1; i < datas.length; i++) {
    gaps.push(Math.round((Date.parse(`${datas[i]}T12:00:00Z`) - Date.parse(`${datas[i - 1]}T12:00:00Z`)) / 86400000));
  }
  if (gaps.length < 2) return null;
  gaps.sort((a, b) => a - b);
  const m = gaps.length / 2;
  const med = gaps.length % 2 ? gaps[Math.floor(m)] : (gaps[m - 1] + gaps[m]) / 2;
  return Math.round(med);
};

export const candidatosRetorno = (ultimaVisitaIso, retornoDias, hojeIso) => {
  const alvo = somarDias(ultimaVisitaIso, Math.max(3, Math.round(Number(retornoDias) || 0)));
  const amanha = somarDias(hojeIso, 1);
  const out = [];
  for (let k = -3; k <= 7; k++) {
    const iso = somarDias(alvo, k);
    if (iso < amanha || !ehDiaFraco(iso)) continue;
    out.push({ iso, dist: Math.abs(k) });
  }
  return out.sort((a, b) => a.dist - b.dist || a.iso.localeCompare(b.iso)).map((x) => x.iso);
};

const minutos = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const horarioMaisProximo = (slots, hhmm) => {
  if (!slots || !slots.length) return '';
  const alvo = minutos(/^\d{1,2}:\d{2}/.test(String(hhmm || '')) ? hhmm : '10:00');
  return [...slots].sort((a, b) => Math.abs(minutos(a) - alvo) - Math.abs(minutos(b) - alvo) || minutos(a) - minutos(b))[0];
};

// Junta as datas candidatas com os horários livres de cada uma (slotsPorDia: { iso: ['09:00', …] })
// e devolve até `max` opções, uma por dia, na ordem de preferência dos candidatos, cada uma no
// horário mais perto do que o cliente acabou de vir. Dia sem horário é pulado.
export const opcoesRetorno = (candidatos, slotsPorDia, horaHabitual, max = 3) => {
  const out = [];
  for (const iso of candidatos || []) {
    const slots = (slotsPorDia && slotsPorDia[iso]) || [];
    const hora = horarioMaisProximo(slots.map((s) => String(s).slice(0, 5)), String(horaHabitual || '').slice(0, 5));
    if (hora) out.push({ date: iso, time: hora });
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const rotuloOpcao = ({ date, time }) => `${NOMES_DIA[diaDaSemana(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)} às ${time}`;
