// admin-expediente-calc.js — contas do expediente (v29.247.0, 26/09/2026).
//
// Fonte única do cálculo "abriu/fechou → horas, atendimentos, faturado" em cima da tabela
// `expediente` (migração 180). Usado em dois lugares: o Histórico dos 14 dias na tela Hoje
// (admin-v15-4-expediente.js) e o bloco "Horas trabalhadas" dos Relatórios
// (admin-relatorios-v28.js). Só faz conta: não toca no DOM nem no Supabase. Carregar ANTES
// dos dois. Regras que valem nos dois lugares:
//   - "horas abertas" = fechado_em − aberto_em; dia aberto e ainda não fechado não soma;
//   - dia com atendimento concluído mas sem registro é "sem registro" — nunca inventa hora;
//   - ocupação, R$/hora e atendimentos/hora consideram só os dias com horas registradas
//     (senão o numerador ganharia atendimento de dia cujo denominador é zero);
//   - faturado é a mesma conta dos Relatórios: serviço líquido (cortesia = 0, tira o prêmio da
//     fidelidade) + produtos.
(() => {
  const MOTIVOS = [['', 'Sem motivo especial'], ['sem_cliente', 'Sem cliente marcado'], ['mais_cedo', 'Fui embora mais cedo'], ['emergencia', 'Emergência / imprevisto'], ['evento', 'Evento / compromisso'], ['outro', 'Outro']];
  const MOTIVO_LABEL = Object.fromEntries(MOTIVOS);
  const INICIO = '2026-09-26'; // primeiro dia com registro (v29.242.0); antes disso não existe hora

  const hora = (ts) => ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  // 545 -> "9h05"; 40 -> "40min"
  const fmtMin = (m) => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${String(r).padStart(2, '0')}` : `${r}min`; };
  const duracao = (a, b) => { if (!a) return ''; const ms = (b ? new Date(b) : new Date()) - new Date(a); return ms > 0 ? fmtMin(ms / 60000) : '0min'; };
  const minutosAbertos = (e) => (e && e.aberto_em && e.fechado_em) ? Math.max(0, Math.round((new Date(e.fechado_em) - new Date(e.aberto_em)) / 60000)) : 0;
  // Duração do atendimento: duration_minutes; registros antigos sem a coluna caem em end − start.
  const minutosAtendimento = (b) => {
    const d = Number(b && b.duration_minutes);
    if (d > 0) return d;
    const t = (s) => { const [h, m] = String(s || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
    const a = t(b && b.start_time), z = t(b && b.end_time);
    return a != null && z != null && z > a ? z - a : 0;
  };
  const receita = (b) => (b.courtesy ? 0 : Math.max(0, Number(b.service_price || 0) - Number(b.loyalty_discount || 0))) + Number(b.products_price || 0);
  const minutoDoDia = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
  const horaDeMinuto = (m) => m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

  // dias: ['YYYY-MM-DD', ...] na ordem que se quer exibir; porDia: { dia: linha da tabela expediente };
  // bookings: qualquer lista de bookings (filtra por booking_date + status='completed' aqui).
  function resumo(dias, porDia, bookings) {
    const lista = bookings || [];
    const linhas = dias.map((dia) => {
      const e = (porDia && porDia[dia]) || null;
      const rows = lista.filter((b) => b.booking_date === dia && b.status === 'completed');
      const at = rows.length;
      const fat = rows.reduce((a, b) => a + receita(b), 0);
      const minAtend = rows.reduce((a, b) => a + minutosAtendimento(b), 0);
      const min = minutosAbertos(e);
      return {
        dia, e, at, fat, minAtend, min,
        registro: !!(e && e.aberto_em),
        aberta: !!(e && e.aberto_em && !e.fechado_em),
        automatico: !!(e && (e.aberto_por === 'automatico' || e.fechado_por === 'automatico')),
      };
    });
    const t = { somaMin: 0, diasComHoras: 0, somaAt: 0, somaFat: 0, somaMinAtend: 0, atComHoras: 0, fatComHoras: 0, minAtendComHoras: 0, semRegistro: 0, menor: null, maior: null };
    const abertura = [], fechamento = [];
    linhas.forEach((l) => {
      t.somaAt += l.at; t.somaFat += l.fat; t.somaMinAtend += l.minAtend;
      if (l.min > 0) {
        t.somaMin += l.min; t.diasComHoras++;
        t.atComHoras += l.at; t.fatComHoras += l.fat; t.minAtendComHoras += l.minAtend;
        abertura.push(minutoDoDia(l.e.aberto_em)); fechamento.push(minutoDoDia(l.e.fechado_em));
        if (!t.menor || l.min < t.menor.min) t.menor = l;
        if (!t.maior || l.min > t.maior.min) t.maior = l;
      } else if (l.at && !l.registro) {
        t.semRegistro++;
      }
    });
    const media = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    t.mediaMinPorDia = t.diasComHoras ? t.somaMin / t.diasComHoras : 0;
    t.ocupacao = t.somaMin ? t.minAtendComHoras / t.somaMin : null;        // 0..1 (pode passar de 1 se atendeu fora do registro)
    t.fatPorHora = t.somaMin ? t.fatComHoras / (t.somaMin / 60) : null;
    t.atPorHora = t.somaMin ? t.atComHoras / (t.somaMin / 60) : null;
    t.aberturaMedia = media(abertura);      // minuto do dia (ex.: 525 = 08:45) ou null
    t.fechamentoMedia = media(fechamento);
    return { linhas, totais: t };
  }

  window.BDJ_EXPEDIENTE = { MOTIVOS, MOTIVO_LABEL, INICIO, hora, fmtMin, duracao, minutosAbertos, minutosAtendimento, receita, horaDeMinuto, resumo };
})();
