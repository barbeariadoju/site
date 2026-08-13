(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const KIND_LABEL = { fixo: 'Custos fixos', variavel: 'Custos variáveis', retirada: 'Retiradas' };
  const KIND_ORDER = ['fixo', 'variavel', 'retirada'];
  const PAYMENT_LABEL = { pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro' };

  let categories = [];      // {name, kind}
  let entries = [];         // lançamentos do mês
  let bookings = [];        // atendimentos concluídos do mês
  let feeRates = {};        // { debito: 2.12, credito: 4.61, ... }
  let recentBookings = [];  // últimos 7 dias, para o painel de taxas
  let ref = new Date(); ref.setHours(0, 0, 0, 0);

  const kindOf = (name) => (categories.find(c => c.name === name) || {}).kind || 'variavel';

  function getRange() {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const now = new Date();
    const atCurrent = ref.getFullYear() > now.getFullYear() || (ref.getFullYear() === now.getFullYear() && ref.getMonth() >= now.getMonth());
    const label = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { start: iso(start), end: iso(end), label: label.charAt(0).toUpperCase() + label.slice(1), atCurrent };
  }

  // ---------- auth ----------
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
    bindStaticUI();
    await loadCategories();
    await load();
  }

  // ---------- dados ----------
  async function loadCategories() {
    const { data, error } = await sb.from('finance_categories').select('name,kind,active,sort_order').eq('active', true).order('sort_order');
    if (error) { console.error(error); return; }
    categories = data || [];

    const rates = await sb.from('finance_fee_rates').select('method,label,rate_percent');
    if (rates.error) console.error(rates.error);
    feeRates = {};
    for (const r of (rates.data || [])) feeRates[r.method] = { label: r.label, rate: Number(r.rate_percent || 0) };

    const sel = $('fin-category');
    sel.innerHTML = KIND_ORDER.map(k => {
      const opts = categories.filter(c => c.kind === k);
      if (!opts.length) return '';
      return `<optgroup label="${esc(KIND_LABEL[k])}">${opts.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</optgroup>`;
    }).join('');
  }

  async function load() {
    const { start, end, label, atCurrent } = getRange();
    $('fin-range-label').textContent = label;
    $('fin-next').disabled = atCurrent;

    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6); sevenAgo.setHours(0, 0, 0, 0);
    const bookingCols = 'booking_date,service_price,products_price,payment_method,fee_passed_to_customer,tip_amount,courtesy';

    const [entriesRes, bookingsRes, recentRes] = await Promise.all([
      sb.from('finance_entries').select('*').gte('entry_date', start).lte('entry_date', end).order('entry_date', { ascending: false }),
      sb.from('bookings').select(bookingCols).eq('status', 'completed').gte('booking_date', start).lte('booking_date', end),
      sb.from('bookings').select(bookingCols).eq('status', 'completed').gte('booking_date', iso(sevenAgo)).lte('booking_date', iso(new Date()))
    ]);
    recentBookings = recentRes.error ? [] : (recentRes.data || []);
    if (recentRes.error) console.error(recentRes.error);
    if (entriesRes.error) { console.error(entriesRes.error); $('fin-list').innerHTML = '<p class="fin-empty">Não foi possível carregar os lançamentos.</p>'; return; }
    if (bookingsRes.error) console.error(bookingsRes.error);

    entries = entriesRes.data || [];
    bookings = bookingsRes.data || [];
    render();
  }

  // ---------- cálculo ----------
  function totals() {
    // v29.20.0 — cortesia (por conta da casa) zera o SERVIÇO na receita (produto vendido
    // junto continua contando); caixinha fica FORA do faturamento, somada à parte.
    const revenue = bookings.reduce((s, b) => s + bookingValue(b), 0);
    const tips = bookings.reduce((s, b) => s + Number(b.tip_amount || 0), 0);
    const courtesyCount = bookings.filter(b => b.courtesy).length;
    const courtesyValue = bookings.filter(b => b.courtesy).reduce((s, b) => s + Number(b.service_price || 0), 0);
    let fixo = 0, variavel = 0, retirada = 0;
    for (const e of entries) {
      const v = Number(e.amount || 0);
      const k = kindOf(e.category);
      if (k === 'retirada') retirada += v; else if (k === 'fixo') fixo += v; else variavel += v;
    }
    // taxa de maquininha que VOCÊ absorveu (não repassada) é custo real do mês
    const taxaAbsorvida = bookings.filter(b => b.fee_passed_to_customer === false).reduce((s, b) => s + feeOf(b), 0);
    variavel += taxaAbsorvida;

    const expenses = fixo + variavel;
    return { revenue, tips, courtesyCount, courtesyValue, fixo, variavel, retirada, taxaAbsorvida, expenses, profit: revenue - expenses, net: revenue - expenses - retirada, count: bookings.length };
  }

  // dia em que a receita acumulada passou a cobrir as despesas do mês
  function breakEvenDay(expenses) {
    if (expenses <= 0) return null;
    const byDay = {};
    for (const b of bookings) byDay[b.booking_date] = (byDay[b.booking_date] || 0) + bookingValue(b);
    let acc = 0;
    for (const day of Object.keys(byDay).sort()) {
      acc += byDay[day];
      if (acc >= expenses) return day;
    }
    return null;
  }

  function renderBreakEven(t) {
    const box = $('fin-breakeven');
    box.classList.remove('is-ok');
    if (t.expenses <= 0) { box.innerHTML = '<p>Lance seus custos para ver o ponto de equilíbrio deste mês.</p>'; return; }

    const ticket = t.count ? t.revenue / t.count : 0;
    const needed = ticket > 0 ? Math.ceil(t.expenses / ticket) : null;
    const pct = Math.min(100, t.expenses > 0 ? (t.revenue / t.expenses) * 100 : 0);
    const day = breakEvenDay(t.expenses);

    if (day) {
      box.classList.add('is-ok');
      const d = new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
      box.innerHTML = `<p>Você passou do ponto de equilíbrio em <strong>${esc(d)}</strong>. Tudo que entrou depois disso é lucro.</p>
        <div class="fin-bar"><i class="is-ok" style="width:100%"></i></div>`;
      return;
    }

    const falta = t.expenses - t.revenue;
    box.innerHTML = `<p>Faltam <strong>${esc(money(falta))}</strong> para cobrir os custos do mês${needed ? ` — cerca de <strong>${Math.max(0, needed - t.count)} atendimentos</strong> ao ticket médio de ${esc(money(ticket))}` : ''}.</p>
      <div class="fin-bar"><i style="width:${pct.toFixed(1)}%"></i></div>`;
  }

  // ---------- taxa da maquininha ----------
  // v29.20.0: cortesia não tem valor de serviço cobrado (produtos vendidos junto contam)
  const bookingValue = (b) => (b.courtesy ? 0 : Number(b.service_price || 0)) + Number(b.products_price || 0);
  const feeOf = (b) => {
    const r = feeRates[b.payment_method];
    if (!r || !r.rate) return 0;
    return bookingValue(b) * r.rate / 100;
  };
  const sumFees = (list) => list.reduce((s, b) => s + feeOf(b), 0);

  function renderFees() {
    const box = $('fin-fees');
    const todayIso = iso(new Date());
    const feeMonth = sumFees(bookings);

    if (feeMonth <= 0 && !recentBookings.some(feeOf)) {
      box.innerHTML = '<h3>Taxa da maquininha</h3><p class="fin-empty" style="padding:0">Nenhum pagamento em cartão neste período.</p>';
      return;
    }

    const feeToday = sumFees(recentBookings.filter(b => b.booking_date === todayIso));
    const feeWeek = sumFees(recentBookings);

    // por modalidade, no mês selecionado
    const byMethod = {};
    for (const b of bookings) {
      const r = feeRates[b.payment_method];
      if (!r || !r.rate) continue;
      const m = (byMethod[b.payment_method] ||= { label: r.label, rate: r.rate, qtd: 0, volume: 0, fee: 0, absorvido: 0, indefinido: 0 });
      const f = feeOf(b);
      m.qtd++; m.volume += bookingValue(b); m.fee += f;
      if (b.fee_passed_to_customer === false) m.absorvido += f;
      else if (b.fee_passed_to_customer !== true) m.indefinido += f;
    }

    const rows = Object.values(byMethod).map(m => `<tr>
      <td><b>${esc(m.label)}</b></td>
      <td class="num">${m.qtd}</td>
      <td class="num">${esc(money(m.volume))}</td>
      <td class="num">${m.rate.toString().replace('.', ',')}%</td>
      <td class="num"><b>${esc(money(m.fee))}</b></td>
    </tr>`).join('');

    const absorvido = Object.values(byMethod).reduce((s, m) => s + m.absorvido, 0);
    const indefinido = Object.values(byMethod).reduce((s, m) => s + m.indefinido, 0);

    box.innerHTML = `<h3>Taxa da maquininha</h3>
      <div class="fin-fees-grid">
        <div><span>Hoje</span><strong>${esc(money(feeToday))}</strong></div>
        <div><span>Últimos 7 dias</span><strong>${esc(money(feeWeek))}</strong></div>
        <div><span>No mês</span><strong>${esc(money(feeMonth))}</strong></div>
      </div>
      <table><thead><tr><th>Modalidade</th><th class="num">Qtd</th><th class="num">Volume</th><th class="num">Taxa</th><th class="num">Descontado</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="fin-note">${absorvido > 0 ? `Deste total, <b style="color:var(--text)">${esc(money(absorvido))}</b> saiu do seu bolso (taxa não repassada) e já entra como despesa no lucro.` : 'Nenhuma taxa marcada como absorvida por você neste mês.'}${indefinido > 0 ? ` Há <b style="color:var(--text)">${esc(money(indefinido))}</b> em atendimentos sem essa informação — a partir de agora o sistema pergunta ao concluir.` : ''}</p>`;
  }

  function render() {
    const t = totals();
    $('fin-metric-revenue').textContent = money(t.revenue);
    // v29.20.0: caixinhas (fora do faturamento) e cortesias aparecem no detalhe da receita
    const extraBits = [];
    if (t.tips > 0) extraBits.push(`💰 ${money(t.tips)} em caixinhas`);
    if (t.courtesyCount > 0) extraBits.push(`🎁 ${t.courtesyCount} cortesia${t.courtesyCount === 1 ? '' : 's'} (${money(t.courtesyValue)} não cobrados)`);
    $('fin-metric-revenue-detail').textContent = `${t.count} atendimento${t.count === 1 ? '' : 's'} concluído${t.count === 1 ? '' : 's'}${extraBits.length ? ' · ' + extraBits.join(' · ') : ''}`;
    $('fin-metric-expense').textContent = money(t.expenses);
    $('fin-metric-expense-detail').textContent = `${money(t.fixo)} fixos · ${money(t.variavel)} variáveis`;
    $('fin-metric-profit').textContent = money(t.profit);
    $('fin-metric-profit-detail').textContent = t.profit >= 0 ? 'antes da sua retirada' : 'prejuízo no mês';
    $('fin-metric-net').textContent = money(t.net);
    $('fin-metric-net-detail').textContent = t.retirada > 0 ? `você retirou ${money(t.retirada)}` : 'nenhuma retirada lançada';

    renderBreakEven(t);
    renderFees();

    if (!entries.length) { $('fin-list').innerHTML = '<p class="fin-empty">Nenhum lançamento neste mês ainda.</p>'; return; }

    const groups = KIND_ORDER.map(k => {
      const list = entries.filter(e => kindOf(e.category) === k);
      if (!list.length) return '';
      const sum = list.reduce((s, e) => s + Number(e.amount || 0), 0);
      const rows = list.map(e => {
        const d = new Date(`${e.entry_date}T12:00:00`);
        const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const extra = [e.description, PAYMENT_LABEL[e.payment_method]].filter(Boolean).join(' · ');
        return `<div class="fin-row">
          <span class="fin-day">${esc(day)}</span>
          <span class="fin-what"><strong>${esc(e.category)}${e.is_recurring ? '<span class="fin-tag">fixo mensal</span>' : ''}</strong>${extra ? `<small>${esc(extra)}</small>` : ''}</span>
          <span class="fin-amount">${esc(money(e.amount))}</span>
          <button class="fin-del" type="button" data-del="${esc(e.id)}">Excluir</button>
        </div>`;
      }).join('');
      return `<div class="fin-group-title"><span>${esc(KIND_LABEL[k])}</span><b>${esc(money(sum))}</b></div>${rows}`;
    }).join('');

    $('fin-list').innerHTML = groups;
    $('fin-list').querySelectorAll('[data-del]').forEach(btn => { btn.onclick = () => removeEntry(btn.dataset.del); });
  }

  // ---------- ações ----------
  function msg(text, ok = false) {
    const el = $('fin-message');
    el.textContent = text;
    el.style.color = ok ? '#a8c07f' : '';
    if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000);
  }

  async function saveEntry() {
    const date = $('fin-date').value;
    const category = $('fin-category').value;
    const amount = Number(String($('fin-amount').value).replace(',', '.'));
    if (!date) return msg('Escolha a data.');
    if (!category) return msg('Escolha a categoria.');
    if (!(amount > 0)) return msg('Informe um valor maior que zero.');

    const payload = {
      entry_date: date,
      category,
      amount,
      description: $('fin-description').value.trim() || null,
      payment_method: $('fin-payment').value || null,
      is_recurring: $('fin-recurring').checked
    };
    $('fin-save').disabled = true;
    const { error } = await sb.from('finance_entries').insert(payload);
    $('fin-save').disabled = false;
    if (error) { console.error(error); return msg('Não foi possível lançar. Tente de novo.'); }

    $('fin-amount').value = '';
    $('fin-description').value = '';
    msg('Lançado.', true);
    await load();
  }

  async function removeEntry(id) {
    const row = entries.find(e => e.id === id);
    if (!row) return;
    if (!confirm(`Excluir o lançamento de ${money(row.amount)} em "${row.category}"?`)) return;
    const { error } = await sb.from('finance_entries').delete().eq('id', id);
    if (error) { console.error(error); return msg('Não foi possível excluir.'); }
    await load();
  }

  // traz os lançamentos marcados como recorrentes do mês anterior, na mesma data do mês atual
  async function repeatRecurring() {
    const prevStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const prevEnd = new Date(ref.getFullYear(), ref.getMonth(), 0);
    const { data, error } = await sb.from('finance_entries').select('*').eq('is_recurring', true).gte('entry_date', iso(prevStart)).lte('entry_date', iso(prevEnd));
    if (error) { console.error(error); return msg('Não foi possível buscar o mês passado.'); }
    if (!data || !data.length) return msg('Nenhum lançamento fixo no mês passado.');

    const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const already = new Set(entries.filter(e => e.is_recurring).map(e => e.category));
    const toInsert = data
      .filter(e => !already.has(e.category))
      .map(e => {
        const day = Math.min(Number(e.entry_date.slice(8, 10)), lastDay);
        return {
          entry_date: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          category: e.category,
          amount: e.amount,
          description: e.description,
          payment_method: e.payment_method,
          is_recurring: true
        };
      });

    if (!toInsert.length) return msg('Os fixos deste mês já estão lançados.');
    if (!confirm(`Repetir ${toInsert.length} lançamento(s) fixo(s) do mês passado?`)) return;

    const { error: insErr } = await sb.from('finance_entries').insert(toInsert);
    if (insErr) { console.error(insErr); return msg('Não foi possível repetir.'); }
    msg(`${toInsert.length} lançamento(s) repetido(s).`, true);
    await load();
  }

  function bindStaticUI() {
    $('fin-date').value = iso(new Date());
    $('fin-prev').onclick = () => { ref = new Date(ref.getFullYear(), ref.getMonth() - 1, 1); load(); };
    $('fin-next').onclick = () => { if ($('fin-next').disabled) return; ref = new Date(ref.getFullYear(), ref.getMonth() + 1, 1); load(); };
    $('fin-save').onclick = saveEntry;
    $('fin-repeat').onclick = repeatRecurring;
    $('fin-amount').addEventListener('keydown', e => { if (e.key === 'Enter') saveEntry(); });
  }

  auth();
})();
