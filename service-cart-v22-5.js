import { money, parseDuration } from './assets/js/booking-format.js?v=28.16.2';
import { applyServiceRule, normalizeServiceSet } from './assets/js/service-rules.js?v=29.62.0';

(() => {
  const serviceStorageKey = 'bdj_services_v1';
  const productStorageKey = 'bdj_cart_v1';
  const agendaServicesKey = 'bdj_selected_services_v15';
  const agendaProductsKey = 'bdj_selected_products_v15';

  // Mesmo formato usado em agenda-v15.js: empurra pro dataLayer e o GTM
  // encaminha pro GA4. Sem isso, a etapa 1 do funil (escolher o serviço) era
  // invisível — só existia o booking_confirmed lá no fim.
  const fire = (event, data = {}) => {
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event, ...data }); } catch (_) {}
  };

  const readStoredMap = key => {
    const merged = new Map();
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const parsed = JSON.parse(storage.getItem(key) || '[]');
        if (Array.isArray(parsed)) parsed.forEach(([itemKey, value]) => merged.set(itemKey, value));
      } catch (_) {}
    }
    return merged;
  };
  const selectedServices = readStoredMap(serviceStorageKey);
  const selectedProducts = readStoredMap(productStorageKey);
  // v29.62.0 — carrinho salvo antes da regra das famílias (ou montado em outra aba) passa
  // pelo crivo ao carregar, e serviço nunca tem quantidade > 1: dois cortes no mesmo horário
  // não existem (pai e filho = Corte de cabelo + Corte de cabelo infantil).
  {
    const kept = normalizeServiceSet([...selectedServices.values()].map(v => ({ name: v.name, price: v.price }))).items.map(v => v.name);
    [...selectedServices.keys()].forEach(k => { if(!kept.includes(k)) selectedServices.delete(k); else selectedServices.get(k).qty = 1; });
  }
  // Sincroniza imediatamente os dois storages para eliminar estados vazios antigos.
  sessionStorage.setItem(serviceStorageKey, JSON.stringify([...selectedServices]));
  localStorage.setItem(serviceStorageKey, JSON.stringify([...selectedServices]));
  sessionStorage.setItem(productStorageKey, JSON.stringify([...selectedProducts]));
  localStorage.setItem(productStorageKey, JSON.stringify([...selectedProducts]));
  const panel = document.querySelector('.service-cart');
  const items = document.getElementById('service-items');
  const totalEl = document.getElementById('service-total');
  const openBtn = document.getElementById('open-service-cart');
  const clearBtn = document.getElementById('clear-services');
  const continueBtn = document.getElementById('continue-services');
  const scheduleBtn = document.getElementById('send-services');
  let panelHidden = true;


  function save(){
    const servicesValue = JSON.stringify([...selectedServices]);
    const productsValue = JSON.stringify([...selectedProducts]);
    sessionStorage.setItem(serviceStorageKey, servicesValue);
    localStorage.setItem(serviceStorageKey, servicesValue);
    sessionStorage.setItem(productStorageKey, productsValue);
    localStorage.setItem(productStorageKey, productsValue);
  }

  function serviceCount(){
    let value = 0;
    selectedServices.forEach(item => value += Number(item.qty || 0));
    return value;
  }

  function productCount(){
    let value = 0;
    selectedProducts.forEach(item => value += Number(item.qty || 0));
    return value;
  }

  function count(){
    return serviceCount() + productCount();
  }

  function render(){
    if(!items || !totalEl) return;
    items.innerHTML = '';
    let total = 0;

    selectedServices.forEach((item, key) => {
      total += Number(item.price || 0) * Number(item.qty || 1);
      const row = document.createElement('div');
      row.className = 'cart-row';
      // v29.62.0: sem botões de quantidade — serviço é 1 por horário (regra das famílias).
      row.innerHTML = `<div class="cart-row-main"><button type="button" class="cart-remove" data-remove-service="${key}" aria-label="Remover ${item.name}" title="Remover serviço">×</button><span>${item.name}<small>${item.time || ''}</small></span></div><div></div>`;
      items.appendChild(row);
    });

    selectedProducts.forEach((item) => {
      total += Number(item.price || 0) * Number(item.qty || 1);
      const row = document.createElement('div');
      row.className = 'cart-row cart-row-muted';
      row.innerHTML = `<div class="cart-row-main"><span>${item.qty}x ${item.name}<small>produto reservado</small></span></div><div></div>`;
      items.appendChild(row);
    });

    if(!selectedServices.size && !selectedProducts.size){
      items.innerHTML = '<span class="empty-cart">Nenhum item selecionado ainda.</span>';
    } else if(!selectedServices.size) {
      const warning = document.createElement('div');
      warning.className = 'empty-cart';
      warning.textContent = 'Escolha pelo menos um serviço para continuar para a agenda.';
      items.appendChild(warning);
    }

    totalEl.textContent = money(total);
    const qty = count();
    const isOpen = qty > 0 && !panelHidden;
    panel?.classList.toggle('active', isOpen);
    document.body.classList.toggle('cart-open', isOpen);
    panel?.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    openBtn?.classList.toggle('show', qty > 0 && panelHidden);
    if(openBtn) openBtn.textContent = `Ver meu carrinho (${qty})`;
    if(scheduleBtn) scheduleBtn.disabled = serviceCount() === 0;
    save();
  }

  function feedback(button){
    const original = button.textContent;
    button.textContent = 'Adicionado ✓';
    button.disabled = true;
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 800);
  }

  // Aviso curto na tela (troca/recusa da regra das famílias). Estilo inline de propósito:
  // não mexe no style.css nem exige bump extra de cache.
  let noticeTimer = null;
  function notice(message){
    if(!message) return;
    let el = document.getElementById('service-rule-notice');
    if(!el){
      el = document.createElement('div');
      el.id = 'service-rule-notice';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);max-width:min(92vw,520px);background:#1c1c1c;color:#fff;padding:12px 16px;border-radius:12px;font-size:.95rem;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:9999;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }

  function addService(button){
    const name = button.dataset.name || '';
    const price = Number(button.dataset.price || 0);
    const time = button.dataset.time || '';
    const duration = parseDuration(time);
    // v29.62.0 — regra das famílias (assets/js/service-rules.js): 1 corte + 1 barba por
    // atendimento; o mais novo substitui o anterior da mesma família, combo que já cobre o
    // pedido recusa, pezinho nunca soma a um corte. Caso real: Augusto Monteiro (22/08/2026)
    // saiu com "Corte + Barboterapia + Barba Express" porque o carrinho deixava.
    const rule = applyServiceRule([...selectedServices.keys()], name);
    notice(rule.message);
    if(!rule.added){ render(); return; }
    [...selectedServices.keys()].forEach(k => { if(!rule.services.includes(k)) selectedServices.delete(k); });
    selectedServices.set(name, {name, price, time, duration, qty:1});
    panelHidden = true;
    fire('service_selected', {item_name:name, value:price});
    feedback(button);
    render();
  }

  function showCart(){
    if(!selectedServices.size && !selectedProducts.size) return;
    panelHidden = false;
    render();
  }

  function prepareAgenda(){
    if(!selectedServices.size) return;
    const services = [];
    selectedServices.forEach(item => {
      for(let i=0; i<Number(item.qty || 1); i++){
        services.push({name:item.name, price:Number(item.price || 0), duration:Number(item.duration || parseDuration(item.time))});
      }
    });
    const products = [];
    selectedProducts.forEach(item => {
      for(let i=0; i<Number(item.qty || 1); i++) products.push({name:item.name, price:Number(item.price || 0)});
    });
    sessionStorage.setItem(agendaServicesKey, JSON.stringify(services));
    sessionStorage.setItem(agendaProductsKey, JSON.stringify(products));
    fire('checkout_step_horario', {
      services: services.map(s => s.name).join(' | '),
      value: services.reduce((sum, s) => sum + Number(s.price || 0), 0),
      items_count: services.length
    });
    window.location.href = '/agendar/horario/';
  }

  document.addEventListener('click', event => {
    const add = event.target.closest('.service-btn');
    if(add){ addService(add); return; }

    const remove = event.target.closest('[data-remove-service]');
    if(remove){ selectedServices.delete(remove.dataset.removeService); render(); return; }

    // v29.62.0: os botões +/− de quantidade de serviço foram removidos (1 por horário).

    if(panel?.classList.contains('active') && !event.target.closest('.service-cart') && !event.target.closest('#open-service-cart')){
      panelHidden = true;
      render();
    }
  });


  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && panel?.classList.contains('active')){
      panelHidden = true;
      render();
    }
  });

  function findServiceButton(name){
    return [...document.querySelectorAll('.service-btn')].find(b => b.dataset.name === name);
  }

  function applyRepeatParam(){
    const repeat = (new URLSearchParams(location.search).get('repeat') || '').trim();
    if(!repeat) return;
    const wholeBtn = findServiceButton(repeat);
    const names = wholeBtn ? [repeat] : repeat.split(' + ').map(n => n.trim());
    let added = false;
    names.forEach(name => {
      const btn = findServiceButton(name);
      if(btn){ addService(btn); added = true; }
    });
    if(added) showCart();
  }

  // ?servico=slug: quem chega de uma página de serviço (ex.: barboterapia) já
  // cai no catálogo com aquele serviço no carrinho, em vez de ter que procurar
  // na lista o que acabou de ler. Elimina uma etapa inteira do funil pra quem
  // vem do orgânico, que é justamente o tráfego que estamos tentando crescer.
  // Casa por slug do data-name (sem acento, minúsculo), pra não depender de o
  // link repetir o nome exato do serviço com pontuação e maiúsculas.
  const slugificar = (texto = '') => texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function applyServicoParam(){
    const alvo = slugificar((new URLSearchParams(location.search).get('servico') || '').trim());
    if(!alvo) return;
    const btn = [...document.querySelectorAll('.service-btn')]
      .find(b => slugificar(b.dataset.name) === alvo);
    if(!btn) return;
    // Idempotente de propósito: o service worker recarrega a página no
    // 'controllerchange' (ver script.js) e o carrinho persiste em storage —
    // sem esta guarda, a segunda carga somava o mesmo serviço de novo e o
    // cliente via 2x Barboterapia, R$ 80, sem ter pedido. Vale também pra
    // quem recarrega na mão ou volta pelo histórico.
    if(selectedServices.has(btn.dataset.name)){ showCart(); return; }
    addService(btn);
    showCart();
    fire('service_preselecionado', { item_name: btn.dataset.name, value: Number(btn.dataset.price || 0) });
  }

  clearBtn?.addEventListener('click', () => {
    selectedServices.clear();
    selectedProducts.clear();
    sessionStorage.removeItem(serviceStorageKey);
    localStorage.removeItem(serviceStorageKey);
    sessionStorage.removeItem(productStorageKey);
    localStorage.removeItem(productStorageKey);
    sessionStorage.removeItem(agendaServicesKey);
    sessionStorage.removeItem(agendaProductsKey);
    panelHidden = true;
    render();
  });
  continueBtn?.addEventListener('click', () => { panelHidden = true; render(); });
  openBtn?.addEventListener('click', showCart);
  scheduleBtn?.addEventListener('click', prepareAgenda);
  applyRepeatParam();
  applyServicoParam();
  render();
})();
