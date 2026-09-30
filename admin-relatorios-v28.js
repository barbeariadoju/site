(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = window.BDJ_H.esc; // v29.177.0: uma cópia só, em admin-ux-v30.js
  const money = window.BDJ_H.money; // v29.179.0: uma cópia só, em admin-ux-v30.js
  const phoneDigits = (s = '') => String(s).replace(/\D/g, '');
  // v29.152.0 — cliente único é por DDD + 8 últimos dígitos (regra de phone_match_key do banco),
  // não pelos dígitos exatos: o mesmo telefone gravado com e sem o 55 contava como dois clientes
  // (caso Helder). Mesma phoneKey de admin-v15-4-core.js, repetida aqui porque esta tela não
  // carrega o core.
  const phoneKey = (s = '') => { const d = phoneDigits(s).replace(/^55/, ''); return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d; };
  const pct = (n) => `${Math.round(n)}%`;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  let bookings = [], surveys = [], profiles = [], expediente = [];
  let expedienteErro = ''; // v29.247.0: mensagem do Supabase se a tabela expediente não puder ser lida
  let mode = 'month';            // 'month' | 'week' | 'day'
  let ref = new Date(); ref.setHours(0, 0, 0, 0); // data de referência dentro do período exibido

  // Semana do relatório = terça (2) a sábado (6), os dias em que a barbearia abre.
  function weekStartTue(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const back = (x.getDay() - 2 + 7) % 7; x.setDate(x.getDate() - back); return x; }

  // Retorna o intervalo [start,end] (strings YYYY-MM-DD), o rótulo e se é o período atual.
  function getRange() {
    if (mode === 'day') {
      const dayIso = iso(ref);
      return { start: dayIso, end: dayIso, label: cap(ref.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })), atCurrent: dayIso >= iso(new Date()) };
    }
    if (mode === 'week') {
      const start = weekStartTue(ref);
      const end = new Date(start); end.setDate(start.getDate() + 4); // terça + 4 = sábado
      return { start: iso(start), end: iso(end), label: `${ddmm(start)} a ${ddmm(end)}`, atCurrent: iso(weekStartTue(new Date())) <= iso(start) };
    }
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const now = new Date();
    const atCurrent = ref.getFullYear() > now.getFullYear() || (ref.getFullYear() === now.getFullYear() && ref.getMonth() >= now.getMonth());
    return { start: iso(start), end: iso(end), label: cap(ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })), atCurrent };
  }
  function shift(dir) {
    if (mode === 'day') { ref.setDate(ref.getDate() + dir); }
    else if (mode === 'week') { ref.setDate(ref.getDate() + 7 * dir); }
    else { ref = new Date(ref.getFullYear(), ref.getMonth() + dir, 1); }
  }
  function setMode(m) {
    if (mode === m) return;
    mode = m; ref = new Date(); ref.setHours(0, 0, 0, 0);
    $('rel-mode-month').classList.toggle('is-active', m === 'month');
    $('rel-mode-week').classList.toggle('is-active', m === 'week');
    $('rel-mode-day').classList.toggle('is-active', m === 'day');
    // Seletor de data direta só faz sentido no modo Dia — pedido do Juliano: "quero ver
    // quanto faturei na quinta passada" sem precisar clicar ‹ várias vezes até chegar lá.
    $('rel-day-picker').hidden = m !== 'day';
    render();
  }

  async function auth() {
    if (!sb) { showLogin('Configuração do Supabase ausente.'); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (session) return show();
    $('admin-signin').onclick = signIn;
    $('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  }
  async function signIn() {
    const msg = $('admin-message'); msg.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value });
    if (error) { msg.textContent = error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message; return; }
    show();
  }
  function showLogin(m = '') { $('admin-login').hidden = false; $('admin-app').hidden = true; if ($('admin-message')) $('admin-message').textContent = m; }
  async function show() {
    $('admin-login').hidden = true; $('admin-app').hidden = false;
    $('admin-signout').onclick = () => sb.auth.signOut().then(() => location.reload());
    $('rel-prev').onclick = () => { shift(-1); render(); };
    $('rel-next').onclick = () => { if (getRange().atCurrent) return; shift(1); render(); };
    $('rel-mode-month').onclick = () => setMode('month');
    $('rel-mode-week').onclick = () => setMode('week');
    $('rel-mode-day').onclick = () => setMode('day');
    // Ir direto pra uma data específica no modo Dia (ex.: "quanto faturei na quinta
    // passada") em vez de clicar ‹ várias vezes até chegar lá.
    $('rel-day-picker').onchange = (e) => { if (!e.target.value) return; ref = new Date(e.target.value + 'T12:00:00'); render(); };
    await load();
  }
  async function load() {
    // v29.247.0: start_time/end_time/duration_minutes entram pras horas em atendimento; a tabela
    // expediente (abrir/fechar, migração 180) é pequena — uma linha por dia trabalhado — então vem inteira.
    const [{ data: b, error: be }, { data: s, error: se }, { data: p, error: pe }, { data: x, error: xe }] = await Promise.all([
      sb.from('bookings').select('customer_phone,service_name,service_price,products_price,booking_date,start_time,end_time,duration_minutes,status,channel,loyalty_discount,courtesy').order('booking_date', { ascending: true }).limit(5000),
      sb.from('experience_requests').select('answer,status,created_at').order('created_at', { ascending: false }).limit(5000),
      sb.from('customer_profiles').select('phone,prior_visits').limit(5000),
      sb.from('expediente').select('dia,aberto_em,aberto_por,fechado_em,fechado_por,motivo,observacao').order('dia', { ascending: true }).limit(2000)
    ]);
    if (be) console.error(be);
    if (se) console.warn('Pesquisa de satisfação indisponível:', se.message);
    if (pe) console.warn('Cadastro de clientes indisponível:', pe.message);
    if (xe) console.warn('Expediente indisponível:', xe.message);
    bookings = b || []; surveys = s || []; profiles = p || []; expediente = x || [];
    expedienteErro = xe ? (xe.message || 'erro') : '';
    render();
  }

  // Telefone -> data (YYYY-MM-DD) do primeiro atendimento concluído de toda a história.
  // Serve para separar clientes novos de recorrentes. Cliente com prior_visits (v29.9.0 —
  // já vinha desde antes do sistema, marcado na conclusão do atendimento) sempre conta
  // como se o "primeiro atendimento" fosse muito antigo, pra nunca aparecer como "novo".
  function firstCompletedByPhone() {
    const map = new Map();
    bookings.forEach(x => {
      if (x.status !== 'completed') return;
      const ph = phoneKey(x.customer_phone); if (!ph) return;
      const d = x.booking_date || '';
      if (!map.has(ph) || d < map.get(ph)) map.set(ph, d);
    });
    profiles.forEach(p => {
      if (!(Number(p.prior_visits) > 0)) return;
      const ph = phoneKey(p.phone); if (!ph) return;
      if (!map.has(ph) || '0001-01-01' < map.get(ph)) map.set(ph, '0001-01-01');
    });
    return map;
  }

  function render() {
    const { start, end, label, atCurrent } = getRange();
    $('rel-month-label').textContent = label;
    $('rel-next').disabled = atCurrent;
    $('rel-day-picker').value = iso(ref);

    const inRange = bookings.filter(x => { const d = x.booking_date || ''; return d >= start && d <= end; });
    const completed = inRange.filter(x => x.status === 'completed');
    const noShows = inRange.filter(x => x.status === 'no_show');

    // v29.138.0: serviço premiado pela fidelidade (loyalty_discount) e cortesia não são receita.
    const servNet = (x) => x.courtesy ? 0 : Math.max(0, Number(x.service_price || 0) - Number(x.loyalty_discount || 0));
    const revenueServ = completed.reduce((a, x) => a + servNet(x), 0);
    const revenueProd = completed.reduce((a, x) => a + Number(x.products_price || 0), 0);
    const revenue = revenueServ + revenueProd;
    const avg = completed.length ? revenue / completed.length : 0;
    const phones = new Set(completed.map(x => phoneKey(x.customer_phone)).filter(Boolean));
    const avgPerCustomer = phones.size ? revenue / phones.size : 0;
    // Pedido do Juliano: mesma lógica do card do Dashboard (split de combo por "+"), aqui pro
    // período selecionado em vez de só "hoje".
    const serviceCount = completed.reduce((a, x) => a + String(x.service_name || '').split('+').map(s => s.trim()).filter(Boolean).length, 0);
    const servicesPerCustomer = phones.size ? serviceCount / phones.size : 0;

    // Satisfação: pesquisas criadas dentro do período selecionado.
    const surveysRange = surveys.filter(s => { const k = iso(new Date(s.created_at)); return k >= start && k <= end; });
    const answered = surveysRange.filter(s => s.answer === 'satisfied' || s.answer === 'suggestion').length;
    const satisfied = surveysRange.filter(s => s.answer === 'satisfied').length;
    const suggestions = surveysRange.filter(s => s.answer === 'suggestion').length;
    const sent = surveysRange.filter(s => s.status !== 'pending').length;
    const satRate = answered ? (satisfied / answered * 100) : null;

    $('rel-revenue').textContent = money(revenue);
    $('rel-completed').textContent = completed.length;
    $('rel-avg').textContent = money(avg);
    $('rel-avg-customer').textContent = money(avgPerCustomer);
    $('rel-customers').textContent = phones.size;
    $('rel-services-customer').textContent = servicesPerCustomer.toFixed(1).replace('.', ',');
    $('rel-satisfaction').textContent = satRate === null ? '—' : pct(satRate);
    $('rel-noshows').textContent = noShows.length;

    renderServices(completed);
    renderAudience(completed, start);
    renderSatisfaction({ answered, satisfied, suggestions, sent });
    renderRevenue({ revenueServ, revenueProd, revenue });
    renderChannel(completed);
    renderJuia();
    renderHoras(start, end);
  }

  // v29.247.0 — Horas trabalhadas: cruza a tabela expediente (Abrir/Fechar na tela Hoje, desde
  // 26/09/2026) com os atendimentos concluídos do período. A conta é a de admin-expediente-calc.js
  // (a mesma do Histórico dos 14 dias); aqui só se desenha. Dia com atendimento e sem registro
  // aparece como "sem registro" e fica fora das médias — nunca se inventa hora.
  function renderHoras(start, end) {
    const box = $('rel-horas');
    if (!box) return;
    const X = window.BDJ_EXPEDIENTE;
    if (!X) { box.innerHTML = '<div class="admin-empty">Cálculo do expediente indisponível (admin-expediente-calc.js não carregou).</div>'; return; }
    if (expedienteErro) { box.innerHTML = `<div class="admin-empty">Não consegui ler o expediente agora (${esc(expedienteErro)}).</div>`; return; }

    const porDia = Object.fromEntries(expediente.filter(e => e.dia >= start && e.dia <= end).map(e => [e.dia, e]));
    const dias = [];
    for (let d = new Date(start + 'T12:00:00'); iso(d) <= end; d.setDate(d.getDate() + 1)) dias.push(iso(d));
    const { linhas, totais: t } = X.resumo(dias, porDia, bookings);
    const uteis = linhas.filter(l => l.registro || l.at); // domingo/segunda e folga não viram linha

    const notas = [];
    if (start < X.INICIO) notas.push(`O registro de abrir/fechar existe desde ${X.INICIO.split('-').reverse().join('/')}; dias anteriores aparecem sem horas.`);
    if (t.semRegistro) notas.push(`${t.semRegistro} dia${t.semRegistro === 1 ? '' : 's'} com atendimento mas sem registro de abrir/fechar: as horas desse${t.semRegistro === 1 ? '' : 's'} dia${t.semRegistro === 1 ? '' : 's'} não entram nas médias.`);
    if (!uteis.length) {
      box.innerHTML = `<div class="admin-empty">Nenhum dia com expediente registrado ou atendimento neste período.</div>${notas.map(n => `<p class="rel-note">${n}</p>`).join('')}`;
      return;
    }

    // "qui., 03/09" → "Qui 03/09" (o ponto da abreviação atrapalha na tabela)
    const dowLong = (dia) => cap(new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(/\.,?/, ''));
    const traco = '—';
    const badgeAuto = (titulo, rotulo = 'automático') => `<span class="admin-visit-badge is-new" title="${titulo}">${rotulo}</span>`;
    const extremos = t.menor ? (t.menor.dia === t.maior.dia
      ? `${X.fmtMin(t.menor.min)}`
      : `${X.fmtMin(t.menor.min)} – ${X.fmtMin(t.maior.min)}`) : traco;
    const extremosNota = t.menor ? (t.menor.dia === t.maior.dia ? `único dia com horas (${dowLong(t.menor.dia)})` : `menor ${dowLong(t.menor.dia)} · maior ${dowLong(t.maior.dia)}`) : 'sem dia com horas';

    const cards = `
      <section class="admin-metrics is-compact" aria-label="Resumo das horas trabalhadas">
        <article><span>Horas abertas</span><strong id="rel-horas-abertas">${t.somaMin ? X.fmtMin(t.somaMin) : traco}</strong><small>${t.diasComHoras} dia${t.diasComHoras === 1 ? '' : 's'} com abrir e fechar</small></article>
        <article><span>Média por dia aberto</span><strong id="rel-horas-media">${t.diasComHoras ? X.fmtMin(t.mediaMinPorDia) : traco}</strong><small>do Abrir ao Fechar, nos dias com registro</small></article>
        <article><span>Em atendimento</span><strong id="rel-horas-atendimento">${t.somaMinAtend ? X.fmtMin(t.somaMinAtend) : traco}</strong><small>soma da duração dos ${t.somaAt} concluído${t.somaAt === 1 ? '' : 's'}</small></article>
        <article><span>Ocupação</span><strong id="rel-horas-ocupacao">${t.ocupacao == null ? traco : pct(t.ocupacao * 100)}</strong><small>atendimento ÷ horas abertas</small></article>
        <article><span>Faturado por hora aberta</span><strong id="rel-horas-fat-hora">${t.fatPorHora == null ? traco : money(t.fatPorHora)}</strong><small>${t.somaMin ? `${money(t.fatComHoras)} em ${X.fmtMin(t.somaMin)}` : 'sem horas registradas'}</small></article>
        <article><span>Atendimentos por hora aberta</span><strong id="rel-horas-at-hora">${t.atPorHora == null ? traco : t.atPorHora.toFixed(1).replace('.', ',')}</strong><small>${t.somaMin ? `${t.atComHoras} em ${X.fmtMin(t.somaMin)}` : 'sem horas registradas'}</small></article>
        <article><span>Abre · fecha (média)</span><strong id="rel-horas-abre-fecha">${t.aberturaMedia == null ? traco : `${X.horaDeMinuto(t.aberturaMedia)} · ${X.horaDeMinuto(t.fechamentoMedia)}`}</strong><small>horário médio de abertura e fechamento</small></article>
        <article><span>Menor e maior dia</span><strong id="rel-horas-extremos">${extremos}</strong><small>${extremosNota}</small></article>
      </section>`;

    const rows = uteis.map(l => {
      const e = l.e;
      const dia = `<th scope="row"><b>${dowLong(l.dia)}</b></th>`;
      if (!l.registro) return `<tr>${dia}<td colspan="2" class="is-muted">sem registro</td><td class="num is-muted">${traco}</td><td class="num">${l.at}</td><td class="num">${money(l.fat)}</td><td class="num is-muted">${traco}</td></tr>`;
      const abriu = `${X.hora(e.aberto_em)}${e.aberto_por === 'automatico' ? badgeAuto('Ninguém clicou em Abrir: a abertura foi preenchida pelo primeiro atendimento do dia') : e.aberto_por === 'camera' ? badgeAuto('Aberto pela câmera: primeira pessoa vista no dia', 'câmera') : e.aberto_por === 'ajuste' ? badgeAuto('Horário corrigido à mão', 'ajustado') : ''}`;
      const motivo = e.motivo ? `<small>${esc(X.MOTIVO_LABEL[e.motivo] || e.motivo)}</small>` : '';
      const fechou = l.aberta
        ? '<span class="is-muted">em andamento</span>'
        : `${X.hora(e.fechado_em)}${e.fechado_por === 'automatico' ? badgeAuto('Ninguém clicou em Fechar: fechado sozinho 30 min depois do fim do expediente') : e.fechado_por === 'camera' ? badgeAuto('Fechado pela câmera: última pessoa vista no dia', 'câmera') : e.fechado_por === 'ajuste' ? badgeAuto('Horário corrigido à mão', 'ajustado') : ''}${motivo}`;
      return `<tr>${dia}<td>${abriu}</td><td>${fechou}</td><td class="num">${l.min ? X.fmtMin(l.min) : `<span class="is-muted">${traco}</span>`}</td><td class="num">${l.at}</td><td class="num">${money(l.fat)}</td><td class="num">${l.min ? money(l.fat / (l.min / 60)) : `<span class="is-muted">${traco}</span>`}</td></tr>`;
    }).join('');

    box.innerHTML = `${cards}
      <div class="clube-table-wrap"><table class="clube-table rel-horas-table" aria-label="Expediente por dia">
        <thead><tr><th scope="col">Dia</th><th scope="col">Abriu</th><th scope="col">Fechou</th><th scope="col" class="num">Horas</th><th scope="col" class="num">Atend.</th><th scope="col" class="num">Faturado</th><th scope="col" class="num">R$/hora</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Total</td><td colspan="2" class="is-muted">${t.diasComHoras} dia${t.diasComHoras === 1 ? '' : 's'} com horas</td><td class="num">${t.somaMin ? X.fmtMin(t.somaMin) : traco}</td><td class="num">${t.somaAt}</td><td class="num">${money(t.somaFat)}</td><td class="num">${t.fatPorHora == null ? traco : money(t.fatPorHora)}</td></tr></tfoot>
      </table></div>
      <p class="rel-note">Horas abertas = do Abrir ao Fechar na tela Hoje. Em atendimento = soma da duração dos atendimentos concluídos. Ocupação, R$/hora e atendimentos/hora consideram só os dias com abrir e fechar registrados.</p>
      ${notas.map(n => `<p class="rel-note">${n}</p>`).join('')}`;
  }

  function renderServices(completed) {
    const box = $('rel-services');
    if (!completed.length) { box.innerHTML = '<div class="admin-empty">Nenhum atendimento concluído neste período.</div>'; return; }
    const map = new Map();
    completed.forEach(x => {
      const name = x.service_name || 'Serviço';
      const cur = map.get(name) || { count: 0, revenue: 0 };
      cur.count++; cur.revenue += (x.courtesy ? 0 : Math.max(0, Number(x.service_price || 0) - Number(x.loyalty_discount || 0))) + Number(x.products_price || 0);
      map.set(name, cur);
    });
    const rows = [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count).slice(0, 8);
    const max = rows[0].count || 1;
    box.innerHTML = rows.map(r => `<div class="rel-bar-row"><div class="rel-bar-head"><b>${esc(r.name)}</b><span>${r.count}× · ${money(r.revenue)}</span></div><div class="rel-bar-track"><i class="rel-bar-fill" style="width:${Math.max(6, Math.round(r.count / max * 100))}%"></i></div></div>`).join('');
  }

  function renderAudience(completed, start) {
    const box = $('rel-audience');
    if (!completed.length) { box.innerHTML = '<div class="admin-empty">Nenhum cliente atendido neste período.</div>'; return; }
    const firstMap = firstCompletedByPhone();
    const phones = new Set(completed.map(x => phoneKey(x.customer_phone)).filter(Boolean));
    let novos = 0, recorrentes = 0;
    phones.forEach(ph => {
      const first = firstMap.get(ph) || '';
      if (first && first < start) recorrentes++; else novos++;
    });
    const total = (novos + recorrentes) || 1;
    box.innerHTML = `
      <div class="rel-split">
        <div class="rel-split-nums">
          <article><strong>${novos}</strong><small>Novos</small></article>
          <article><strong>${recorrentes}</strong><small>Recorrentes</small></article>
        </div>
        <div class="rel-dualbar"><i class="is-gold2" style="width:${Math.round(novos / total * 100)}%"></i><i class="is-blue" style="width:${Math.round(recorrentes / total * 100)}%"></i></div>
        <div class="rel-legend"><span><i class="rel-dot is-gold2"></i>Novos</span><span><i class="rel-dot is-blue"></i>Recorrentes</span></div>
        <p class="rel-note">Cada cliente conta uma vez (pelo telefone). "Recorrente" = já teve atendimento concluído antes deste período.</p>
      </div>`;
  }

  function renderSatisfaction({ answered, satisfied, suggestions, sent }) {
    const box = $('rel-satisfaction-detail');
    if (!sent) { box.innerHTML = '<div class="admin-empty">Nenhuma pesquisa de satisfação enviada neste período.</div>'; return; }
    const rate = answered ? Math.round(satisfied / answered * 100) : 0;
    box.innerHTML = `
      <div class="rel-split">
        <div class="rel-split-nums">
          <article><strong>${satisfied}</strong><small>Satisfeitos</small></article>
          <article><strong>${suggestions}</strong><small>Deram sugestão</small></article>
        </div>
        ${answered ? `<div class="rel-bar-track"><i class="rel-bar-fill" style="width:${rate}%"></i></div><p class="rel-note"><b>${rate}%</b> de quem respondeu ficou satisfeito.</p>` : ''}
        <p class="rel-note">${sent} pesquisa(s) enviada(s) · ${answered} resposta(s) recebida(s).</p>
      </div>`;
  }

  // "Balcão" = atendimento registrado manualmente pelo admin (cliente que veio direto na
  // porta). Registros antigos (antes da v28.17.0) não têm essa coluna preenchida e caem
  // como 'site' pelo default da migration — não dá pra saber a origem retroativamente.
  function renderChannel(completed) {
    const box = $('rel-channel');
    if (!completed.length) { box.innerHTML = '<div class="admin-empty">Nenhum atendimento concluído neste período.</div>'; return; }
    const site = completed.filter(x => x.channel !== 'balcao').length;
    const balcao = completed.filter(x => x.channel === 'balcao').length;
    const total = (site + balcao) || 1;
    box.innerHTML = `
      <div class="rel-split">
        <div class="rel-split-nums">
          <article><strong>${site}</strong><small>Site / WhatsApp</small></article>
          <article><strong>${balcao}</strong><small>Direto na porta</small></article>
        </div>
        <div class="rel-dualbar"><i class="is-gold" style="width:${Math.round(site / total * 100)}%"></i><i class="is-blue" style="width:${Math.round(balcao / total * 100)}%"></i></div>
        <div class="rel-legend"><span><i class="rel-dot is-gold"></i>Site / WhatsApp</span><span><i class="rel-dot is-blue"></i>Direto na porta</span></div>
        <p class="rel-note">Conta atendimentos concluídos, não clientes únicos. "Direto na porta" é o que foi registrado em Atendimento Balcão.</p>
      </div>`;
  }

  // v28.63.0 (melhoria B): até aqui a conversão da JuIA nunca tinha sido medida — foi
  // calculada à mão uma única vez, em 05/08, e o número se perdeu. Sem isso, mexer no
  // prompt dela é chute. Usa janela fixa de 14 e 30 dias (não o período selecionado no
  // topo): conversa e agendamento acontecem em dias diferentes, então recortar por mês
  // partiria o funil no meio e daria um número enganoso.
  async function renderJuia() {
    const box = $('rel-juia');
    if (!box) return;
    box.innerHTML = '<div class="admin-empty">Calculando…</div>';
    const [d14, d30] = await Promise.all([
      sb.rpc('juia_conversion_funnel', { p_days: 14 }),
      sb.rpc('juia_conversion_funnel', { p_days: 30 }),
    ]);
    const a = d14.data && d14.data[0];
    const b = d30.data && d30.data[0];
    if (d14.error || !a) {
      box.innerHTML = '<div class="admin-empty">Não consegui carregar a conversão agora.</div>';
      return;
    }
    const pct = Number(a.taxa_conversao) || 0;
    const perdidos = Number(a.sem_agendar) || 0;
    const etapas = [
      { rot: 'Já tinha escolhido dia e serviço', n: Number(a.parou_em_disponibilidade) || 0 },
      { rot: 'Parou no serviço ou no preço', n: Number(a.parou_em_servico_preco) || 0 },
      { rot: 'Mandou só um "oi" e sumiu', n: Number(a.parou_na_saudacao) || 0 },
      { rot: 'Outros assuntos (endereço, horário…)', n: Number(a.sem_lead_registrado) || 0 },
    ].filter(e => e.n > 0).sort((x, y) => y.n - x.n);
    box.innerHTML = `
      <div class="rel-split">
        <div class="rel-split-nums">
          <article><strong>${a.conversaram}</strong><small>Conversaram (14d)</small></article>
          <article><strong>${a.agendaram}</strong><small>Agendaram</small></article>
        </div>
        <div class="rel-bar-track"><i class="rel-bar-fill" style="width:${Math.max(2, Math.min(100, Math.round(pct)))}%"></i></div>
        <p class="rel-note"><b>${pct}%</b> de quem escreveu no WhatsApp acabou agendando${b ? ` · em 30 dias: <b>${b.taxa_conversao}%</b>` : ''}.</p>
        ${perdidos ? `<p class="rel-note">Dos ${perdidos} que não agendaram, onde a conversa parou:</p>
        <div class="rel-bars">${etapas.map(e => `<div class="rel-bar-row"><div class="rel-bar-head"><b>${esc(e.rot)}</b><span>${e.n}</span></div><div class="rel-bar-track"><i class="rel-bar-fill" style="width:${Math.max(6, Math.round(e.n / perdidos * 100))}%"></i></div></div>`).join('')}</div>` : ''}
        <p class="rel-note">Conta só quem escreveu no WhatsApp e agendou <b>depois</b> de ter escrito — agendamento feito antes da conversa não entra, porque não foi a JuIA que trouxe.</p>
      </div>`;
  }

  function renderRevenue({ revenueServ, revenueProd, revenue }) {
    const box = $('rel-revenue-detail');
    if (!revenue) { box.innerHTML = '<div class="admin-empty">Sem faturamento neste período.</div>'; return; }
    const ps = revenueServ / revenue * 100, pp = revenueProd / revenue * 100;
    box.innerHTML = `
      <div class="rel-split">
        <div class="rel-split-nums">
          <article><strong>${money(revenueServ)}</strong><small>Serviços</small></article>
          <article><strong>${money(revenueProd)}</strong><small>Produtos</small></article>
        </div>
        <div class="rel-dualbar"><i class="is-gold" style="width:${Math.round(ps)}%"></i><i class="is-gold2" style="width:${Math.round(pp)}%"></i></div>
        <p class="rel-note">Total do período: <b>${money(revenue)}</b>. Só entram atendimentos marcados como <b>concluídos</b>.</p>
      </div>`;
  }

  auth();
})();
