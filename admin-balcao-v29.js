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
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  async function show() {
    $('admin-login').hidden = true; $('admin-app').hidden = false;
    $('admin-signout').onclick = () => sb.auth.signOut().then(() => location.reload());
    $('balcao-services').innerHTML = renderServicePicker();
    bindServicePicker();
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
  function updateTotal() {
    $('balcao-total').textContent = money(selectedServices().reduce((a, s) => a + s.price, 0));
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
      .select('id,customer_name,service_name,service_price,products_price,start_time,payment_method')
      .eq('channel', 'balcao').eq('booking_date', today)
      .order('start_time', { ascending: true });
    if (error) { box.innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    if (!data || !data.length) { box.innerHTML = '<div class="admin-empty">Nenhum atendimento de balcão registrado hoje ainda.</div>'; return; }
    box.innerHTML = data.map(x => `<div class="balcao-log-row"><div><strong>${esc(x.customer_name)}</strong><small>${esc(x.service_name)} • ${money(Number(x.service_price || 0) + Number(x.products_price || 0))}</small></div><span class="balcao-log-tag">${(x.start_time || '').slice(0, 5)} · ${PAYMENT_LABELS[x.payment_method] || x.payment_method || '—'}</span></div>`).join('');
  }

  async function saveWalkin() {
    const msg = $('balcao-message');
    const name = $('balcao-name').value.trim();
    const phone = $('balcao-phone').value.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    const services = selectedServices();
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
      msg.textContent = 'Atendimento registrado.' + note;

      $('balcao-name').value = ''; $('balcao-phone').value = ''; $('balcao-notes').value = ''; $('balcao-payment').value = '';
      document.querySelectorAll('input[name="balcao-service"]:checked').forEach(i => { i.checked = false; });
      updateTotal();
      setDefaultDateTime();
      await loadTodayLog();
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Registrar atendimento';
    }
  }

  auth();
})();
