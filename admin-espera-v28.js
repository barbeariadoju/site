(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const catalog = window.BDJ_SERVICES || [];
  const sb = (cfg.supabaseUrl && cfg.supabaseAnonKey) ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s = '') => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const phoneDigits = (s = '') => String(s).replace(/\D/g, '');
  const formatPhone = (p = '') => { p = phoneDigits(p); return p.length === 11 ? `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}` : p; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayOfWeek = (dateStr) => new Date(`${dateStr}T12:00:00`).getDay();
  const WEEKDAY_LABEL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
  const WEEKDAYS = [2, 3, 4, 5, 6]; // Ter..Sáb — dias que a barbearia abre
  const whatsappBusinessUrl = (phone, msg = '') => {
    const digits = `55${phoneDigits(phone)}`;
    const web = `https://wa.me/${digits}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
    if (/Android/i.test(navigator.userAgent)) {
      const fallback = encodeURIComponent(web);
      return `intent://send?phone=${digits}${msg ? `&text=${encodeURIComponent(msg)}` : ''}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${fallback};end`;
    }
    return web;
  };

  let rows = [];
  let statusFilter = 'esperando';
  let mode = 'month';
  let ref = new Date(); ref.setHours(0, 0, 0, 0);
  let weekdayFilter = new Set(WEEKDAYS);
  let periodFilter = new Set(['manha', 'tarde']); // 'qualquer' sempre aparece
  let openRowId = null; // card com o mini-formulário de encaixe aberto

  function weekStartTue(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const back = (x.getDay() - 2 + 7) % 7; x.setDate(x.getDate() - back); return x; }
  function getRange() {
    if (mode === 'week') {
      const start = weekStartTue(ref);
      const end = new Date(start); end.setDate(start.getDate() + 4);
      return { start: iso(start), end: iso(end), label: `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`, atCurrent: iso(weekStartTue(new Date())) <= iso(start) };
    }
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const now = new Date();
    const atCurrent = ref.getFullYear() > now.getFullYear() || (ref.getFullYear() === now.getFullYear() && ref.getMonth() >= now.getMonth());
    const label = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { start: iso(start), end: iso(end), label: label.charAt(0).toUpperCase() + label.slice(1), atCurrent };
  }
  function shift(dir) { if (mode === 'week') ref.setDate(ref.getDate() + 7 * dir); else ref = new Date(ref.getFullYear(), ref.getMonth() + dir, 1); }

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
    await load();
  }

  async function load() {
    const { data, error } = await sb.from('waitlist').select('*').order('created_at', { ascending: true });
    if (error) { console.error(error); $('espera-list').innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`; return; }
    rows = data || [];
    render();
  }

  function bindStaticUI() {
    $('espera-add').onclick = () => openEntryModal();
    document.querySelectorAll('[data-close-espera-modal]').forEach(x => x.onclick = closeEntryModal);
    $('espera-form-save').onclick = saveEntry;
    document.querySelectorAll('[data-espera-tab]').forEach(b => b.onclick = () => { statusFilter = b.dataset.esperaTab; document.querySelectorAll('[data-espera-tab]').forEach(x => x.classList.toggle('is-active', x === b)); render(); });
    $('espera-mode-month').onclick = () => { mode = 'month'; ref = new Date(); ref.setHours(0, 0, 0, 0); $('espera-mode-month').classList.add('is-active'); $('espera-mode-week').classList.remove('is-active'); render(); };
    $('espera-mode-week').onclick = () => { mode = 'week'; ref = new Date(); ref.setHours(0, 0, 0, 0); $('espera-mode-week').classList.add('is-active'); $('espera-mode-month').classList.remove('is-active'); render(); };
    $('espera-prev').onclick = () => { shift(-1); render(); };
    $('espera-next').onclick = () => { if (getRange().atCurrent) return; shift(1); render(); };
    document.querySelectorAll('[data-weekday-chip]').forEach(b => b.onclick = () => {
      const d = Number(b.dataset.weekdayChip);
      if (weekdayFilter.has(d)) weekdayFilter.delete(d); else weekdayFilter.add(d);
      b.classList.toggle('is-selected', weekdayFilter.has(d));
      render();
    });
    document.querySelectorAll('[data-period-chip]').forEach(b => b.onclick = () => {
      const p = b.dataset.periodChip;
      if (periodFilter.has(p)) periodFilter.delete(p); else periodFilter.add(p);
      b.classList.toggle('is-selected', periodFilter.has(p));
      render();
    });
    $('espera-entry-period').addEventListener('change', updateEntryFormVisibility);
    document.querySelectorAll('input[name="espera-entry-date-mode"]').forEach(r => r.addEventListener('change', updateEntryFormVisibility));
  }

  function rowEffectiveDays(row) {
    if (row.preferred_date) return [dayOfWeek(row.preferred_date)];
    if (row.preferred_weekdays && row.preferred_weekdays.length) return row.preferred_weekdays;
    return null; // flexível — qualquer dia
  }
  function rowInPeriod(row, start, end) {
    if (row.preferred_date) {
      if (row.preferred_date < start || row.preferred_date > end) return false;
    } else {
      if (row.window_end && row.window_end < start) return false;
      if (row.window_start && row.window_start > end) return false;
    }
    return true;
  }
  function matchesWeekdayFilter(row) {
    const days = rowEffectiveDays(row);
    if (days === null) return true; // flexível, sempre aparece
    return days.some(d => weekdayFilter.has(d));
  }
  function matchesPeriodFilter(row) {
    if (row.preferred_period === 'qualquer') return true;
    return periodFilter.has(row.preferred_period);
  }

  function filteredRows() {
    const { start, end } = getRange();
    return rows.filter(r => r.status === statusFilter && rowInPeriod(r, start, end) && matchesWeekdayFilter(r) && matchesPeriodFilter(r));
  }

  function whenLabel(row) {
    if (row.preferred_date) {
      const d = new Date(`${row.preferred_date}T12:00:00`);
      return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    }
    if (row.preferred_weekdays && row.preferred_weekdays.length) {
      return `Toda(o) ${row.preferred_weekdays.map(d => WEEKDAY_LABEL[d]).join(', ')}`;
    }
    return 'Qualquer dia';
  }
  function periodLabel(p) { return p === 'manha' ? 'Manhã' : p === 'tarde' ? 'Tarde' : 'Qualquer turno'; }
  function timeRangeLabel(row) {
    if (row.preferred_time_start && row.preferred_time_end) return `${row.preferred_time_start.slice(0, 5)}–${row.preferred_time_end.slice(0, 5)}`;
    return periodLabel(row.preferred_period);
  }
  function daysWaiting(row) { return Math.max(0, Math.floor((new Date() - new Date(row.created_at)) / 86400000)); }

  function render() {
    const range = getRange();
    $('espera-range-label').textContent = range.label;
    $('espera-next').disabled = range.atCurrent;

    const waitingTotal = rows.filter(r => r.status === 'esperando').length;
    const now = new Date();
    const encaixadosMes = rows.filter(r => r.status === 'encaixado' && r.scheduled_at && new Date(r.scheduled_at).getMonth() === now.getMonth() && new Date(r.scheduled_at).getFullYear() === now.getFullYear()).length;
    $('espera-metric-waiting').textContent = waitingTotal;
    $('espera-metric-fitted').textContent = encaixadosMes;

    const list = filteredRows();
    const box = $('espera-list');
    if (!list.length) { box.innerHTML = '<div class="admin-empty"><strong>Ninguém aqui.</strong><small>Ajuste os filtros ou aguarde novos pedidos vindos do site.</small></div>'; return; }
    box.innerHTML = list.map(cardHtml).join('');
    bindCardActions(box);
  }

  function cardHtml(row) {
    const isOpen = openRowId === row.id;
    return `<article class="espera-card" data-row="${row.id}">
      <div class="espera-card-main">
        <div class="espera-card-head">
          <h3>${esc(row.customer_name)}</h3>
          <span class="espera-source">${row.source === 'site' ? '🌐 site' : '✍ admin'}</span>
        </div>
        <p class="espera-contact">${formatPhone(row.customer_phone)}${row.customer_email ? ` • ${esc(row.customer_email)}` : ''}</p>
        <div class="espera-tags">
          <span class="espera-tag">📅 ${esc(whenLabel(row))}</span>
          <span class="espera-tag">🕐 ${esc(timeRangeLabel(row))}</span>
          ${row.service_name ? `<span class="espera-tag">✂ ${esc(row.service_name)}</span>` : ''}
        </div>
        ${row.notes ? `<p class="espera-notes">${esc(row.notes)}</p>` : ''}
        <small class="espera-waiting">Esperando há ${daysWaiting(row)} dia(s)</small>
      </div>
      <div class="espera-card-actions">
        <a href="${whatsappBusinessUrl(row.customer_phone, `Oi, ${row.customer_name}! Abriu uma vaga na Barbearia do Ju${row.preferred_date ? ` em ${row.preferred_date.split('-').reverse().join('/')}` : ''}. Quer aproveitar?`)}" target="_blank" rel="noopener">WhatsApp</a>
        ${row.status === 'esperando' ? `<button data-fit="${row.id}" class="is-primary">Encaixar</button>` : ''}
        <button data-edit="${row.id}">Editar</button>
        ${row.status === 'esperando' ? `<button data-cancel="${row.id}">Cancelar</button>` : ''}
        <button class="is-danger" data-delete="${row.id}">Excluir</button>
      </div>
      ${isOpen ? fitFormHtml(row) : ''}
    </article>`;
  }

  function fitFormHtml(row) {
    return `<div class="espera-fit-form">
      <div class="espera-fit-grid">
        <label>Serviço<input data-fit-field="service_name" value="${esc(row.service_name || '')}" placeholder="Ex: Corte de cabelo"></label>
        <label>Valor (R$)<input data-fit-field="service_price" type="number" min="0" step="0.5" value="${row.service_price ?? ''}"></label>
        <label>Duração (min)<input data-fit-field="duration_minutes" type="number" min="10" max="240" value="${row.duration_minutes ?? 30}"></label>
        <label>Data<input data-fit-field="booking_date" type="date" value="${row.preferred_date || ''}"></label>
        <label>Horário<input data-fit-field="start_time" type="time"></label>
      </div>
      <label class="admin-checkbox-row"><input data-fit-field="allow_outside_hours" type="checkbox"> Permitir fora do horário de funcionamento</label>
      <p class="field-help" data-fit-message></p>
      <div class="espera-fit-actions">
        <button type="button" class="btn primary" data-fit-confirm="${row.id}">Confirmar encaixe</button>
        <button type="button" data-fit-cancel="${row.id}">Cancelar</button>
      </div>
    </div>`;
  }

  function bindCardActions(box) {
    box.querySelectorAll('[data-fit]').forEach(b => b.onclick = () => { openRowId = openRowId === b.dataset.fit ? null : b.dataset.fit; render(); });
    box.querySelectorAll('[data-fit-cancel]').forEach(b => b.onclick = () => { openRowId = null; render(); });
    box.querySelectorAll('[data-fit-confirm]').forEach(b => b.onclick = () => confirmFit(b.dataset.fitConfirm, b));
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEntryModal(rows.find(r => r.id === b.dataset.edit)));
    box.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => cancelEntry(b.dataset.cancel));
    box.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => deleteEntry(b.dataset.delete));
  }

  async function confirmFit(id, button) {
    const card = button.closest('.espera-card');
    const field = (name) => card.querySelector(`[data-fit-field="${name}"]`).value;
    const msg = card.querySelector('[data-fit-message]');
    const row = rows.find(r => r.id === id);

    const serviceName = field('service_name').trim();
    const servicePrice = Number(field('service_price'));
    const duration = Number(field('duration_minutes'));
    const bookingDate = field('booking_date');
    const startTime = field('start_time');
    const allowOutsideHours = Boolean(card.querySelector('[data-fit-field="allow_outside_hours"]')?.checked);

    if (!serviceName) { msg.textContent = 'Informe o serviço.'; return; }
    if (!Number.isFinite(servicePrice) || servicePrice < 0) { msg.textContent = 'Informe um valor válido.'; return; }
    if (!Number.isInteger(duration) || duration < 10 || duration > 240) { msg.textContent = 'Duração deve ser entre 10 e 240 minutos.'; return; }
    if (!bookingDate || !startTime) { msg.textContent = 'Informe data e horário do encaixe.'; return; }

    button.disabled = true; button.textContent = 'Encaixando...'; msg.textContent = '';
    const { data: bookingId, error } = await sb.rpc('admin_create_booking', {
      p_customer_name: row.customer_name,
      p_customer_phone: row.customer_phone,
      p_service_name: serviceName,
      p_service_price: servicePrice,
      p_duration_minutes: duration,
      p_booking_date: bookingDate,
      p_start_time: startTime,
      p_notes: 'Encaixe da lista de espera',
      p_allow_outside_hours: allowOutsideHours,
    });
    if (error) {
      msg.textContent = error.message || 'Não foi possível criar o agendamento.';
      button.disabled = false; button.textContent = 'Confirmar encaixe';
      return;
    }
    const { error: updError } = await sb.from('waitlist').update({ status: 'encaixado', booking_id: bookingId, scheduled_at: new Date().toISOString() }).eq('id', id);
    if (updError) console.error('[espera] falha ao marcar encaixado', updError);
    openRowId = null;
    await load();
  }

  async function cancelEntry(id) {
    if (!confirm('Cancelar este pedido de espera?')) return;
    const { error } = await sb.from('waitlist').update({ status: 'cancelado' }).eq('id', id);
    if (error) { alert(error.message); return; }
    await load();
  }
  async function deleteEntry(id) {
    if (!confirm('Excluir definitivamente este registro da lista de espera?')) return;
    const { error } = await sb.from('waitlist').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await load();
  }

  // ---- Modal de adicionar/editar ----
  function openEntryModal(row = null) {
    $('espera-modal').hidden = false;
    document.body.classList.add('modal-open');
    $('espera-modal-title').textContent = row ? 'Editar pedido' : 'Adicionar à lista de espera';
    $('espera-entry-id').value = row?.id || '';
    $('espera-entry-name').value = row?.customer_name || '';
    $('espera-entry-phone').value = row?.customer_phone || '';
    $('espera-entry-email').value = row?.customer_email || '';
    $('espera-entry-service').value = row?.service_name || '';
    $('espera-entry-price').value = row?.service_price ?? '';
    $('espera-entry-duration').value = row?.duration_minutes ?? '';
    $('espera-entry-notes').value = row?.notes || '';

    const dateMode = row?.preferred_date ? 'date' : (row?.preferred_weekdays?.length ? 'weekdays' : 'any');
    document.querySelector(`input[name="espera-entry-date-mode"][value="${dateMode}"]`).checked = true;
    $('espera-entry-date').value = row?.preferred_date || '';
    document.querySelectorAll('[data-entry-weekday]').forEach(chip => chip.classList.toggle('is-selected', (row?.preferred_weekdays || []).includes(Number(chip.dataset.entryWeekday))));
    $('espera-entry-period').value = row?.preferred_period || 'qualquer';
    $('espera-entry-message').textContent = '';
    updateEntryFormVisibility();
    setTimeout(() => $('espera-entry-name').focus(), 50);
  }
  function closeEntryModal() { $('espera-modal').hidden = true; document.body.classList.remove('modal-open'); }
  function updateEntryFormVisibility() {
    const mode = document.querySelector('input[name="espera-entry-date-mode"]:checked')?.value || 'any';
    $('espera-entry-date-field').hidden = mode !== 'date';
    $('espera-entry-weekdays-field').hidden = mode !== 'weekdays';
  }

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-entry-weekday]');
    if (chip) chip.classList.toggle('is-selected');
  });

  async function saveEntry() {
    const msg = $('espera-entry-message');
    const name = $('espera-entry-name').value.trim();
    const phone = phoneDigits($('espera-entry-phone').value);
    if (name.length < 2 || phone.length < 10) { msg.textContent = 'Informe nome e WhatsApp válidos.'; return; }
    const email = $('espera-entry-email').value.trim().toLowerCase() || null;
    const serviceName = $('espera-entry-service').value.trim() || null;
    const price = $('espera-entry-price').value ? Number($('espera-entry-price').value) : null;
    const duration = $('espera-entry-duration').value ? Number($('espera-entry-duration').value) : null;
    const notes = $('espera-entry-notes').value.trim() || null;
    const dateMode = document.querySelector('input[name="espera-entry-date-mode"]:checked')?.value || 'any';
    const preferredDate = dateMode === 'date' ? ($('espera-entry-date').value || null) : null;
    const preferredWeekdays = dateMode === 'weekdays' ? [...document.querySelectorAll('[data-entry-weekday].is-selected')].map(c => Number(c.dataset.entryWeekday)) : [];
    const period = $('espera-entry-period').value || 'qualquer';

    if (dateMode === 'date' && !preferredDate) { msg.textContent = 'Escolha a data desejada.'; return; }
    if (dateMode === 'weekdays' && !preferredWeekdays.length) { msg.textContent = 'Escolha ao menos um dia da semana.'; return; }

    const id = $('espera-entry-id').value || null;
    const payload = {
      customer_name: name, customer_phone: phone, customer_email: email,
      service_name: serviceName, service_price: price, duration_minutes: duration,
      preferred_date: preferredDate, preferred_weekdays: preferredWeekdays, preferred_period: period,
      notes, source: 'admin',
    };
    msg.textContent = 'Salvando...';
    const { error } = id
      ? await sb.from('waitlist').update(payload).eq('id', id)
      : await sb.from('waitlist').insert({ ...payload, status: 'esperando' });
    if (error) { msg.textContent = error.message; return; }
    closeEntryModal();
    await load();
  }

  auth();
})();
