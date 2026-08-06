(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const phoneDigits = (s = '') => String(s).replace(/\D/g, '');
  const pct = (n) => `${Math.round(n)}%`;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  let bookings = [], surveys = [];
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
    const [{ data: b, error: be }, { data: s, error: se }] = await Promise.all([
      sb.from('bookings').select('customer_phone,service_name,service_price,products_price,booking_date,status,channel').order('booking_date', { ascending: true }).limit(5000),
      sb.from('experience_requests').select('answer,status,created_at').order('created_at', { ascending: false }).limit(5000)
    ]);
    if (be) console.error(be);
    if (se) console.warn('Pesquisa de satisfação indisponível:', se.message);
    bookings = b || []; surveys = s || [];
    render();
  }

  // Telefone -> data (YYYY-MM-DD) do primeiro atendimento concluído de toda a história.
  // Serve para separar clientes novos de recorrentes.
  function firstCompletedByPhone() {
    const map = new Map();
    bookings.forEach(x => {
      if (x.status !== 'completed') return;
      const ph = phoneDigits(x.customer_phone); if (!ph) return;
      const d = x.booking_date || '';
      if (!map.has(ph) || d < map.get(ph)) map.set(ph, d);
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

    const revenueServ = completed.reduce((a, x) => a + Number(x.service_price || 0), 0);
    const revenueProd = completed.reduce((a, x) => a + Number(x.products_price || 0), 0);
    const revenue = revenueServ + revenueProd;
    const avg = completed.length ? revenue / completed.length : 0;
    const phones = new Set(completed.map(x => phoneDigits(x.customer_phone)).filter(Boolean));
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
    $('rel-services-customer').textContent = servicesPerCustomer.toFixed(1);
    $('rel-satisfaction').textContent = satRate === null ? '—' : pct(satRate);
    $('rel-noshows').textContent = noShows.length;

    renderServices(completed);
    renderAudience(completed, start);
    renderSatisfaction({ answered, satisfied, suggestions, sent });
    renderRevenue({ revenueServ, revenueProd, revenue });
    renderChannel(completed);
    renderJuia();
  }

  function renderServices(completed) {
    const box = $('rel-services');
    if (!completed.length) { box.innerHTML = '<div class="admin-empty">Nenhum atendimento concluído neste período.</div>'; return; }
    const map = new Map();
    completed.forEach(x => {
      const name = x.service_name || 'Serviço';
      const cur = map.get(name) || { count: 0, revenue: 0 };
      cur.count++; cur.revenue += Number(x.service_price || 0) + Number(x.products_price || 0);
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
    const phones = new Set(completed.map(x => phoneDigits(x.customer_phone)).filter(Boolean));
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
        <div class="rel-dualbar"><i style="width:${Math.round(novos / total * 100)}%;background:var(--gold2)"></i><i style="width:${Math.round(recorrentes / total * 100)}%;background:#5a86c9"></i></div>
        <div class="rel-legend"><span><i class="rel-dot" style="background:var(--gold2)"></i>Novos</span><span><i class="rel-dot" style="background:#5a86c9"></i>Recorrentes</span></div>
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
          <article><strong>${satisfied}</strong><small>😊 Satisfeitos</small></article>
          <article><strong>${suggestions}</strong><small>💬 Deram sugestão</small></article>
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
          <article><strong>${site}</strong><small>💻 Site / WhatsApp</small></article>
          <article><strong>${balcao}</strong><small>🚶 Direto na porta</small></article>
        </div>
        <div class="rel-dualbar"><i style="width:${Math.round(site / total * 100)}%;background:var(--gold)"></i><i style="width:${Math.round(balcao / total * 100)}%;background:#5a86c9"></i></div>
        <div class="rel-legend"><span><i class="rel-dot" style="background:var(--gold)"></i>Site / WhatsApp</span><span><i class="rel-dot" style="background:#5a86c9"></i>Direto na porta</span></div>
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
          <article><strong>${a.conversaram}</strong><small>💬 Conversaram (14d)</small></article>
          <article><strong>${a.agendaram}</strong><small>✅ Agendaram</small></article>
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
          <article><strong>${money(revenueServ)}</strong><small>✂ Serviços</small></article>
          <article><strong>${money(revenueProd)}</strong><small>🛍 Produtos</small></article>
        </div>
        <div class="rel-dualbar"><i style="width:${Math.round(ps)}%;background:var(--gold)"></i><i style="width:${Math.round(pp)}%;background:var(--gold2)"></i></div>
        <p class="rel-note">Total do período: <b>${money(revenue)}</b>. Só entram atendimentos marcados como <b>concluídos</b>.</p>
      </div>`;
  }

  auth();
})();
