// admin-balcao-v29.js — tela "Atendimento Balcão" (admin-balcao.html), standalone
// (mesmo padrão do admin-espera-v28.js: cria o próprio cliente Supabase e cuida do
// próprio login, não depende do admin-v15-4-*.js).
//
// Registra um atendimento que veio direto na porta já como "concluído" (retroativo —
// entra no faturamento igual um agendamento do site) via RPC admin_register_walkin_visit.
// Se o telefone ainda não estava no CRM, dispara send-walkin-welcome (mensagem de
// boas-vindas via WhatsApp convidando o cliente a agendar pelo site/WhatsApp da próxima vez).
(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const catalog = window.BDJ_SERVICES || [];
  // Catálogo único em products-catalog-v1.js (window.BDJ_PRODUCTS) — catálogo completo
  // (inclusive bebidas), igual ao real produtos.html, pra vender qualquer item no balcão.
  const productCatalog = window.BDJ_PRODUCTS || [];
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const formatPhoneDisplay = (digits = '') => {
    const d = String(digits).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return digits;
  };
  const PAYMENT_LABELS = { pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', fidelidade: 'Fidelidade' };

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
  let linkedCustomerId = null;

  async function show() {
    $('admin-login').hidden = true; $('admin-app').hidden = false;
    $('admin-signout').onclick = () => sb.auth.signOut().then(() => location.reload());
    $('balcao-services').innerHTML = renderServicePicker();
    $('balcao-products').innerHTML = renderProductPicker();
    bindServicePicker();
    bindProductPicker();
    bindCustomerSearch();
    setDefaultDateTime();
    $('balcao-save').onclick = saveWalkin;
    await loadTodayLog();
  }

  function renderServicePicker() {
    const groups = {};
    catalog.forEach(s => (groups[s.category] ??= []).push(s));
    return Object.entries(groups).map(([cat, items]) => `<section class="booking-service-group"><h3>${esc(cat)}</h3><div>${items.map(s => `<label class="booking-service-option"><input type="checkbox" name="balcao-service" value="${esc(s.name)}"><span><strong>${esc(s.name)}</strong><small>${s.duration} min • ${money(s.price)}</small><i>✓</i></span></label>`).join('')}</div></section>`).join('');
  }
  function selectedServices() { return [...document.querySelectorAll('input[name="balcao-service"]:checked')].map(i => catalog.find(s => s.name === i.value)).filter(Boolean); }
  function bindServicePicker() {
    $('balcao-services').addEventListener('change', e => { if (e.target?.name === 'balcao-service') updateTotal(); });
  }

  function renderProductPicker() {
    const groups = {};
    productCatalog.forEach(p => (groups[p.category || 'Produtos'] ??= []).push(p));
    return Object.entries(groups).map(([cat, items]) => `<section class="booking-service-group"><h3>${esc(cat)}</h3><div>${items.map(p => `<label class="booking-service-option"><input type="checkbox" name="balcao-product" value="${esc(p.name)}"><span><strong>${esc(p.name)}</strong><small>${money(p.price)}</small><i>✓</i></span></label>`).join('')}</div></section>`).join('');
  }
  function selectedProducts() { return [...document.querySelectorAll('input[name="balcao-product"]:checked')].map(i => productCatalog.find(p => p.name === i.value)).filter(Boolean); }
  function bindProductPicker() {
    $('balcao-products').addEventListener('change', e => { if (e.target?.name === 'balcao-product') updateTotal(); });
  }

  function updateTotal() {
    const total = selectedServices().reduce((a, s) => a + s.price, 0) + selectedProducts().reduce((a, p) => a + p.price, 0);
    $('balcao-total').textContent = money(total);
  }

  // Busca por nome/telefone em customer_profiles (RLS já libera leitura pra qualquer
  // usuário autenticado — só existe a conta do dono). Evita o dono ter que redigitar
  // nome/telefone de quem já é cadastrado; ainda permite digitar livre pra cliente novo.
  let searchTimer = null;
  function bindCustomerSearch() {
    const input = $('balcao-name');
    const box = $('balcao-customer-results');
    input.addEventListener('input', () => {
      linkedCustomerId = null;
      renderCustomerTag(null);
      clearTimeout(searchTimer);
      const term = input.value.trim();
      if (term.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
      searchTimer = setTimeout(() => searchCustomers(term), 250);
    });
    input.addEventListener('focus', () => { if (box.innerHTML && input.value.trim().length >= 2) box.hidden = false; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.balcao-customer-search')) box.hidden = true; });
  }
  async function searchCustomers(term) {
    const box = $('balcao-customer-results');
    const digits = term.replace(/\D/g, '');
    let query = sb.from('customer_profiles').select('id,name,phone').limit(6).order('name', { ascending: true });
    query = digits.length >= 3 ? query.ilike('phone', `%${digits}%`) : query.ilike('name', `%${term}%`);
    const { data, error } = await query;
    if (error) { box.hidden = true; return; }
    box.hidden = false;
    if (!data || !data.length) { box.innerHTML = '<div class="is-empty">Nenhum cliente encontrado — pode continuar digitando pra cadastrar um novo.</div>'; return; }
    box.innerHTML = data.map(c => `<button type="button" data-pick="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone)}"><strong>${esc(c.name)}</strong><small>${esc(formatPhoneDisplay(c.phone))}</small></button>`).join('');
    box.querySelectorAll('[data-pick]').forEach(btn => btn.onclick = () => {
      $('balcao-name').value = btn.dataset.name;
      $('balcao-phone').value = formatPhoneDisplay(btn.dataset.phone);
      linkedCustomerId = btn.dataset.pick;
      renderCustomerTag(btn.dataset.name);
      box.hidden = true; box.innerHTML = '';
    });
  }
  function renderCustomerTag(name) {
    const tag = $('balcao-customer-tag');
    tag.innerHTML = name ? `<span class="balcao-customer-tag">✓ Cliente do CRM: ${esc(name)}<button type="button" data-clear-customer>×</button></span>` : '';
    tag.querySelector('[data-clear-customer]')?.addEventListener('click', () => { linkedCustomerId = null; renderCustomerTag(null); });
  }
  function setDefaultDateTime() {
    const now = new Date();
    $('balcao-date').value = isoLocal(now);
    $('balcao-time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  async function loadTodayLog() {
    const box = $('balcao-today-list');
    const today = isoLocal(new Date());
    const { data, error } = await sb.from('bookings')
      .select('id,customer_name,service_name,service_price,products_price,selected_products,start_time,payment_method,products_payment_method')
      .eq('channel', 'balcao').eq('booking_date', today)
      .order('start_time', { ascending: true });
    if (error) { box.innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    if (!data || !data.length) { box.innerHTML = '<div class="admin-empty">Nenhum atendimento de balcão registrado hoje ainda.</div>'; return; }
    box.innerHTML = data.map(x => {
      const products = Array.isArray(x.selected_products) ? x.selected_products : [];
      const productsNote = products.length ? ` + ${products.map(p => p.name).join(', ')}` : '';
      const hasSplit = x.products_payment_method && x.products_payment_method !== x.payment_method;
      const paymentTag = hasSplit
        ? `${PAYMENT_LABELS[x.payment_method] || x.payment_method} + ${PAYMENT_LABELS[x.products_payment_method] || x.products_payment_method}`
        : (PAYMENT_LABELS[x.payment_method] || x.payment_method || '—');
      return `<div class="balcao-log-row"><div><strong>${esc(x.customer_name)}</strong><small>${esc(x.service_name)}${esc(productsNote)} • ${money(Number(x.service_price || 0) + Number(x.products_price || 0))}</small></div><span class="balcao-log-tag">${(x.start_time || '').slice(0, 5)} · ${esc(paymentTag)}</span></div>`;
    }).join('');
  }

  async function saveWalkin() {
    const msg = $('balcao-message');
    const name = $('balcao-name').value.trim();
    const phone = $('balcao-phone').value.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    const services = selectedServices();
    const products = selectedProducts();
    const date = $('balcao-date').value;
    const time = $('balcao-time').value;
    const payment = $('balcao-payment').value;

    if (!name) { msg.textContent = 'Informe o nome do cliente.'; return; }
    if (phoneDigits.length < 10) { msg.textContent = 'Informe um telefone válido, com DDD.'; return; }
    if (!services.length) { msg.textContent = 'Selecione ao menos um serviço.'; return; }
    if (!date || !time) { msg.textContent = 'Informe a data e o horário aproximado.'; return; }
    if (!payment) { msg.textContent = 'Selecione a forma de pagamento.'; return; }

    const saveBtn = $('balcao-save');
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando…'; msg.textContent = 'Salvando...';
    try {
      const { data, error } = await sb.rpc('admin_register_walkin_visit', {
        p_customer_name: name,
        p_customer_phone: phone,
        p_service_name: services.map(s => s.name).join(' + '),
        p_service_price: services.reduce((a, s) => a + s.price, 0),
        p_duration_minutes: services.reduce((a, s) => a + s.duration, 0),
        p_booking_date: date,
        p_start_time: time,
        p_payment_method: payment,
        p_notes: $('balcao-notes').value.trim() || null,
        p_selected_products: products.map(p => ({ name: p.name, price: p.price })),
      });
      if (error) { msg.textContent = error.message; return; }

      const row = Array.isArray(data) ? data[0] : data;
      let note = ' Cliente já estava no CRM — histórico atualizado.';
      if (row?.is_new_customer) {
        try {
          const { data: wa } = await sb.functions.invoke('send-walkin-welcome', { body: { name, phone } });
          note = wa?.sent
            ? ' Cliente novo — mensagem de boas-vindas enviada por WhatsApp.'
            : ' Cliente novo, salvo no CRM — a mensagem de boas-vindas não pôde ser enviada agora.';
        } catch {
          note = ' Cliente novo, salvo no CRM — a mensagem de boas-vindas não pôde ser enviada agora.';
        }
      }
      // Extras opcionais (v29.9.0, campo de nº da visita em v29.15.0): pontos de fidelidade
      // avulsos e o nº total desta visita — mesmo padrão do "Concluir" da Agenda, não
      // bloqueia o registro em si. A RPC converte o nº digitado em prior_visits usando a
      // reserva recém-criada como referência (migration 104).
      const loyaltyDelta = Number($('balcao-loyalty-delta').value) || 0;
      const visitNumberTyped = Math.floor(Number($('balcao-visit-number').value)) || 0;
      if (loyaltyDelta || visitNumberTyped >= 1) {
        const { error: extrasError } = await sb.rpc('admin_apply_completion_extras', { p_phone: phone, p_customer_name: name, p_loyalty_delta: loyaltyDelta, p_visit_number: visitNumberTyped >= 1 ? visitNumberTyped : null, p_booking_id: row?.booking_id || null });
        if (extrasError) note += ` (extras de fidelidade/nº da visita não salvos: ${extrasError.message})`;
      }
      msg.textContent = 'Atendimento registrado.' + note;

      $('balcao-name').value = ''; $('balcao-phone').value = ''; $('balcao-notes').value = ''; $('balcao-payment').value = '';
      $('balcao-loyalty-delta').value = ''; $('balcao-visit-number').value = '';
      document.querySelectorAll('input[name="balcao-service"]:checked, input[name="balcao-product"]:checked').forEach(i => { i.checked = false; });
      linkedCustomerId = null;
      renderCustomerTag(null);
      updateTotal();
      setDefaultDateTime();
      await loadTodayLog();
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Registrar atendimento';
    }
  }

  auth();
})();
