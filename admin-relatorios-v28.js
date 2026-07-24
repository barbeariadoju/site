(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const phoneDigits = (s = '') => String(s).replace(/\D/g, '');
  const pct = (n) => `${Math.round(n)}%`;

  let bookings = [], surveys = [];
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  let ref = new Date(thisMonth);

  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = (d) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

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
    $('rel-prev').onclick = () => { ref.setMonth(ref.getMonth() - 1); render(); };
    $('rel-next').onclick = () => { if (monthKey(ref) >= monthKey(thisMonth)) return; ref.setMonth(ref.getMonth() + 1); render(); };
    await load();
  }
  async function load() {
    const [{ data: b, error: be }, { data: s, error: se }] = await Promise.all([
      sb.from('bookings').select('customer_phone,service_name,service_price,products_price,booking_date,status').order('booking_date', { ascending: true }).limit(5000),
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
    const mk = monthKey(ref);
    $('rel-month-label').textContent = monthLabel(ref);
    $('rel-next').disabled = (mk >= monthKey(thisMonth));

    const inMonth = bookings.filter(x => (x.booking_date || '').slice(0, 7) === mk);
    const completed = inMonth.filter(x => x.status === 'completed');
    const noShows = inMonth.filter(x => x.status === 'no_show');

    const revenueServ = completed.reduce((a, x) => a + Number(x.service_price || 0), 0);
    const revenueProd = completed.reduce((a, x) => a + Number(x.products_price || 0), 0);
    const revenue = revenueServ + revenueProd;
    const avg = completed.length ? revenue / completed.length : 0;
    const phones = new Set(completed.map(x => phoneDigits(x.customer_phone)).filter(Boolean));

    // Satisfação: pesquisas criadas no mês selecionado.
    const surveysMonth = surveys.filter(s => { const d = new Date(s.created_at); return monthKey(d) === mk; });
    const answered = surveysMonth.filter(s => s.answer === 'satisfied' || s.answer === 'suggestion').length;
    const satisfied = surveysMonth.filter(s => s.answer === 'satisfied').length;
    const suggestions = surveysMonth.filter(s => s.answer === 'suggestion').length;
    const sent = surveysMonth.filter(s => s.status !== 'pending').length;
    const satRate = answered ? (satisfied / answered * 100) : null;

    $('rel-revenue').textContent = money(revenue);
    $('rel-completed').textContent = completed.length;
    $('rel-avg').textContent = money(avg);
    $('rel-customers').textContent = phones.size;
    $('rel-satisfaction').textContent = satRate === null ? '—' : pct(satRate);
    $('rel-noshows').textContent = noShows.length;

    renderServices(completed);
    renderAudience(completed, mk);
    renderSatisfaction({ answered, satisfied, suggestions, sent });
    renderRevenue({ revenueServ, revenueProd, revenue });
  }

  function renderServices(completed) {
    const box = $('rel-services');
    if (!completed.length) { box.innerHTML = '<div class="admin-empty">Nenhum atendimento concluído neste mês.</div>'; return; }
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

  function renderAudience(completed, mk) {
    const box = $('rel-audience');
    if (!completed.length) { box.innerHTML = '<div class="admin-empty">Nenhum cliente atendido neste mês.</div>'; return; }
    const firstMap = firstCompletedByPhone();
    const phones = new Set(completed.map(x => phoneDigits(x.customer_phone)).filter(Boolean));
    let novos = 0, recorrentes = 0;
    phones.forEach(ph => {
      const first = firstMap.get(ph) || '';
      if (first.slice(0, 7) === mk) novos++; else recorrentes++;
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
        <p class="rel-note">Cada cliente conta uma vez (pelo telefone). "Recorrente" = já teve atendimento concluído antes deste mês.</p>
      </div>`;
  }

  function renderSatisfaction({ answered, satisfied, suggestions, sent }) {
    const box = $('rel-satisfaction-detail');
    if (!sent) { box.innerHTML = '<div class="admin-empty">Nenhuma pesquisa de satisfação enviada neste mês.</div>'; return; }
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

  function renderRevenue({ revenueServ, revenueProd, revenue }) {
    const box = $('rel-revenue-detail');
    if (!revenue) { box.innerHTML = '<div class="admin-empty">Sem faturamento neste mês.</div>'; return; }
    const ps = revenueServ / revenue * 100, pp = revenueProd / revenue * 100;
    box.innerHTML = `
      <div class="rel-split">
        <div class="rel-split-nums">
          <article><strong>${money(revenueServ)}</strong><small>✂ Serviços</small></article>
          <article><strong>${money(revenueProd)}</strong><small>🛍 Produtos</small></article>
        </div>
        <div class="rel-dualbar"><i style="width:${Math.round(ps)}%;background:var(--gold)"></i><i style="width:${Math.round(pp)}%;background:var(--gold2)"></i></div>
        <p class="rel-note">Total do mês: <b>${money(revenue)}</b>. Só entram atendimentos marcados como <b>concluídos</b>.</p>
      </div>`;
  }

  auth();
})();
