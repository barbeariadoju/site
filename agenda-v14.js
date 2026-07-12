(() => {
  const SERVICES = window.BDJ_SERVICES || [];
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const money = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let currentStep = 1;
  let activeCategory = '';
  let selectedServices = [];
  let selectedTime = '';
  let fullSlots = [];
  let partialSlots = [];

  const date = $('agenda-date');
  const slots = $('agenda-slots');
  const status = $('agenda-status');
  const submit = $('agenda-submit');
  const categoryBox = $('agenda-categories');
  const servicesBox = $('agenda-services');

  const today = new Date();
  date.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  function totals() {
    return selectedServices.reduce((acc, index) => ({
      price: acc.price + SERVICES[index].price,
      duration: acc.duration + SERVICES[index].duration
    }), { price: 0, duration: 0 });
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h${pad(remainder)}` : `${hours}h`;
  }

  function addMinutes(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const d = new Date(2000, 0, 1, hours, mins + minutes);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function categories() {
    return [...new Set(SERVICES.map((service) => service.category || 'Outros serviços'))];
  }

  function stepAllowed(step) {
    if (step === 1) return true;
    if (step === 2) return Boolean(activeCategory);
    if (step === 3) return selectedServices.length > 0;
    if (step === 4) return Boolean(date.value && selectedTime);
    if (step === 5) {
      const name = $('agenda-name').value.trim();
      const phone = $('agenda-phone').value.replace(/\D/g, '');
      return Boolean(name && phone.length >= 10);
    }
    return false;
  }

  function goToStep(step) {
    if (!stepAllowed(step)) return;
    currentStep = step;
    document.querySelectorAll('.booking-step-panel').forEach((panel) => {
      panel.hidden = Number(panel.dataset.step) !== step;
    });
    document.querySelectorAll('.booking-progress-item').forEach((item) => {
      const itemStep = Number(item.dataset.progressStep);
      item.classList.toggle('is-active', itemStep === step);
      item.classList.toggle('is-complete', itemStep < step);
    });
    const target = document.querySelector(`.booking-step-panel[data-step="${step}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateNav();
    updateSummary();
  }

  function updateNav() {
    document.querySelectorAll('[data-next-step]').forEach((button) => {
      const next = Number(button.dataset.nextStep);
      button.disabled = !stepAllowed(next);
    });
  }

  function renderCategories() {
    categoryBox.innerHTML = categories().map((category) => {
      const count = SERVICES.filter((service) => service.category === category).length;
      const selectedCount = selectedServices.filter((index) => SERVICES[index].category === category).length;
      return `<button type="button" class="booking-category-card${activeCategory === category ? ' is-active' : ''}" data-category="${category}">
        <span class="booking-category-icon">${category.includes('Corte') ? '✂' : category === 'Barba' ? '♜' : category.includes('Acabamento') ? '✦' : category.includes('Pigment') ? '◈' : '◆'}</span>
        <span><strong>${category}</strong><small>${count} ${count === 1 ? 'serviço' : 'serviços'}${selectedCount ? ` • ${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}` : ''}</small></span>
        <i>›</i>
      </button>`;
    }).join('');

    categoryBox.querySelectorAll('[data-category]').forEach((button) => {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.category;
        renderCategories();
        renderServices();
        goToStep(2);
      });
    });
  }

  function renderServices() {
    const items = SERVICES.map((service, index) => ({ service, index }))
      .filter(({ service }) => service.category === activeCategory);
    $('agenda-services-title').textContent = activeCategory || 'Serviços';
    servicesBox.innerHTML = items.map(({ service, index }) => {
      const selected = selectedServices.includes(index);
      return `<button type="button" class="booking-service-card${selected ? ' is-selected' : ''}" data-index="${index}" aria-pressed="${selected}">
        <span class="booking-service-check">✓</span>
        <span class="booking-service-copy"><strong>${service.name}</strong><small>${service.description}</small><em>${formatDuration(service.duration)}</em></span>
        <b>${money(service.price)}</b>
      </button>`;
    }).join('');

    servicesBox.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const position = selectedServices.indexOf(index);
        if (position >= 0) selectedServices.splice(position, 1);
        else selectedServices.push(index);
        selectedTime = '';
        renderServices();
        renderCategories();
        updateSelectionBar();
        updateSummary();
        updateNav();
      });
    });
    updateSelectionBar();
  }

  function updateSelectionBar() {
    const total = totals();
    const count = selectedServices.length;
    $('service-selection-count').textContent = count ? `${count} serviço${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''}` : 'Nenhum serviço selecionado';
    $('service-selection-total').textContent = count ? `${formatDuration(total.duration)} • ${money(total.price)}` : 'Escolha ao menos um serviço';
    $('service-continue').disabled = !count;
  }

  function dayHours(dateString) {
    if (!dateString) return null;
    const d = new Date(`${dateString}T12:00:00`);
    const weekday = d.getDay();
    if (weekday === 0 || weekday === 1) return null;
    return weekday === 6 ? ['08:00', '15:00'] : ['08:00', '19:00'];
  }

  function showHint(html, type = 'info') {
    const box = $('agenda-slot-hint');
    box.className = `agenda-slot-hint ${type}`;
    box.innerHTML = html;
    box.hidden = false;
  }

  function hideHint() {
    $('agenda-slot-hint').hidden = true;
  }

  async function rpcSlots(dateString, duration) {
    const { data, error } = await sb.rpc('get_available_slots', {
      p_date: dateString,
      p_duration_minutes: duration
    });
    if (error) throw error;
    return (data || []).map((item) => item.slot_time.slice(0, 5));
  }

  async function loadSlots() {
    selectedTime = '';
    slots.innerHTML = '';
    hideHint();
    const dateString = date.value;
    const total = totals();
    if (!selectedServices.length || !dateString) {
      updateSummary();
      updateNav();
      return;
    }
    if (!dayHours(dateString)) {
      $('agenda-day-message').textContent = 'A barbearia não abre neste dia.';
      updateSummary();
      updateNav();
      return;
    }
    $('agenda-day-message').textContent = 'Consultando disponibilidade...';
    try {
      const shortest = Math.min(...selectedServices.map((index) => SERVICES[index].duration));
      [fullSlots, partialSlots] = await Promise.all([
        rpcSlots(dateString, total.duration),
        rpcSlots(dateString, shortest)
      ]);
    } catch (error) {
      slots.innerHTML = '<p class="booking-empty">Não foi possível consultar a agenda.</p>';
      $('agenda-day-message').textContent = 'Erro na consulta';
      console.error(error);
      return;
    }

    partialSlots.forEach((time) => {
      const fitsAll = fullSlots.includes(time);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `agenda-slot${fitsAll ? '' : ' is-partial'}`;
      button.innerHTML = fitsAll ? `<strong>${time}</strong>` : `<strong>${time}</strong><small>apenas 1 serviço</small>`;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        document.querySelectorAll('.agenda-slot').forEach((slot) => {
          slot.classList.remove('is-selected');
          slot.setAttribute('aria-pressed', 'false');
        });
        if (!fitsAll) {
          const next = fullSlots.find((slot) => slot > time);
          const message = next
            ? `Às ${time} cabe só 1 serviço. Para todos, escolha <button type="button" data-use-slot="${next}">${next}</button>.`
            : `Às ${time} cabe só 1 serviço. Remova um serviço ou escolha outro horário.`;
          showHint(message, 'warning');
          const quick = $('agenda-slot-hint').querySelector('[data-use-slot]');
          if (quick) quick.addEventListener('click', () => selectSlot(next));
          selectedTime = '';
          updateSummary();
          updateNav();
          return;
        }
        hideHint();
        selectSlot(time, button);
      });
      slots.appendChild(button);
    });

    $('agenda-day-message').textContent = fullSlots.length
      ? `${fullSlots.length} horários disponíveis para todos os serviços`
      : 'Nenhum horário comporta todos os serviços';
    updateSummary();
    updateNav();
  }

  function selectSlot(time, button) {
    document.querySelectorAll('.agenda-slot').forEach((slot) => {
      slot.classList.remove('is-selected');
      slot.setAttribute('aria-pressed', 'false');
    });
    const target = button || [...document.querySelectorAll('.agenda-slot')]
      .find((slot) => slot.textContent.trim().startsWith(time));
    if (target) {
      target.classList.add('is-selected');
      target.setAttribute('aria-pressed', 'true');
    }
    selectedTime = time;
    updateSummary();
    updateNav();
  }

  function updateSummary() {
    const total = totals();
    const dateString = date.value;
    let html = '';

    if (!selectedServices.length) {
      html = '<div class="booking-summary-empty"><span>✂</span><p>Escolha seus serviços para começar.</p></div>';
    } else {
      html = `<ul class="agenda-summary-services">${selectedServices.map((index) => `
        <li><span>${SERVICES[index].name}</span><b>${money(SERVICES[index].price)}</b></li>`).join('')}</ul>
        <div class="booking-summary-total"><span>Total</span><strong>${money(total.price)}</strong></div>
        <p class="booking-summary-duration">Tempo previsto: <strong>${formatDuration(total.duration)}</strong></p>`;
    }

    if (dateString) {
      html += `<div class="booking-summary-date"><span>Data</span><strong>${new Date(`${dateString}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</strong></div>`;
    }
    if (selectedTime) {
      html += `<div class="booking-summary-time"><span>Horário</span><strong>${selectedTime} às ${addMinutes(selectedTime, total.duration)}</strong></div>`;
    }

    $('agenda-summary').innerHTML = html;
    $('review-summary').innerHTML = html;
    submit.disabled = !(configured && stepAllowed(5));
  }

  async function save() {
    const total = totals();
    const names = selectedServices.map((index) => SERVICES[index].name);
    submit.disabled = true;
    submit.textContent = 'Enviando...';
    const phone = $('agenda-phone').value.replace(/\D/g, '');
    const { error } = await sb.rpc('create_public_booking', {
      p_customer_name: $('agenda-name').value.trim(),
      p_customer_phone: phone,
      p_service_name: names.join(' + '),
      p_service_price: total.price,
      p_duration_minutes: total.duration,
      p_booking_date: date.value,
      p_start_time: selectedTime,
      p_notes: $('agenda-notes').value.trim() || null
    });

    if (error) {
      alert(error.message.includes('indisponível') || error.message.includes('bloqueado')
        ? error.message
        : 'Não foi possível agendar. Tente novamente.');
      submit.textContent = 'Confirmar solicitação';
      await loadSlots();
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'agendamento_proprio_solicitado',
      servicos: names.join(' | '),
      data: date.value,
      hora: selectedTime,
      valor: total.price,
      duracao: total.duration
    });

    status.innerHTML = '<strong>Solicitação recebida!</strong> Aguarde a confirmação pelo WhatsApp.';
    status.classList.add('is-success');
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    submit.textContent = 'Solicitação enviada';
  }

  document.querySelectorAll('[data-next-step]').forEach((button) => {
    button.addEventListener('click', () => goToStep(Number(button.dataset.nextStep)));
  });
  document.querySelectorAll('[data-prev-step]').forEach((button) => {
    button.addEventListener('click', () => goToStep(Number(button.dataset.prevStep)));
  });
  $('choose-another-category').addEventListener('click', () => goToStep(1));
  $('service-continue').addEventListener('click', () => goToStep(3));
  date.addEventListener('change', loadSlots);
  ['agenda-name', 'agenda-phone', 'agenda-notes'].forEach((id) => {
    $(id).addEventListener('input', () => {
      updateSummary();
      updateNav();
    });
  });
  submit.addEventListener('click', save);

  renderCategories();
  updateSelectionBar();
  status.innerHTML = configured
    ? '<strong>Agenda online.</strong> Escolha seus serviços e o melhor horário.'
    : '<strong>Versão de preparação.</strong> O banco de dados ainda precisa ser conectado.';
  goToStep(1);
})();
