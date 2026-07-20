(() => {
  const serviceStorageKey = 'bdj_services_v1';
  const productStorageKey = 'bdj_cart_v1';
  const agendaServicesKey = 'bdj_selected_services_v15';
  const agendaProductsKey = 'bdj_selected_products_v15';

  const selectedServices = new Map(JSON.parse(sessionStorage.getItem(serviceStorageKey) || '[]'));
  const selectedProducts = new Map(JSON.parse(sessionStorage.getItem(productStorageKey) || '[]'));
  const panel = document.querySelector('.service-cart');
  const items = document.getElementById('service-items');
  const totalEl = document.getElementById('service-total');
  const openBtn = document.getElementById('open-service-cart');
  const clearBtn = document.getElementById('clear-services');
  const continueBtn = document.getElementById('continue-services');
  const scheduleBtn = document.getElementById('send-services');
  let panelHidden = true;

  const money = value => Number(value).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
  const parseDuration = value => {
    const text = String(value || '').trim().toLowerCase();
    const hours = Number((text.match(/(\d+)h/) || [0,0])[1]);
    const minutes = Number((text.match(/(\d+)\s*min/) || [0,0])[1]);
    return hours * 60 + minutes || 30;
  };

  function save(){
    sessionStorage.setItem(serviceStorageKey, JSON.stringify([...selectedServices]));
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
      row.innerHTML = `<div class="cart-row-main"><button type="button" class="cart-remove" data-remove-service="${key}" aria-label="Remover ${item.name}" title="Remover serviço">×</button><span>${item.qty}x ${item.name}<small>${item.time || ''}</small></span></div><div class="cart-qty-actions"><button type="button" data-dec-service="${key}" aria-label="Diminuir ${item.name}">−</button><button type="button" data-inc-service="${key}" aria-label="Aumentar ${item.name}">+</button></div>`;
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

  function addService(button){
    const name = button.dataset.name || '';
    const price = Number(button.dataset.price || 0);
    const time = button.dataset.time || '';
    const duration = parseDuration(time);
    const item = selectedServices.get(name) || {name, price, time, duration, qty:0};
    item.qty += 1;
    item.price = price;
    item.time = time;
    item.duration = duration;
    selectedServices.set(name, item);
    panelHidden = true;
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
    window.location.href = '/agendar.html';
  }

  document.addEventListener('click', event => {
    const add = event.target.closest('.service-btn');
    if(add){ addService(add); return; }

    const remove = event.target.closest('[data-remove-service]');
    if(remove){ selectedServices.delete(remove.dataset.removeService); render(); return; }

    const inc = event.target.closest('[data-inc-service]');
    if(inc){ const item=selectedServices.get(inc.dataset.incService); if(item){item.qty+=1; render();} return; }

    const dec = event.target.closest('[data-dec-service]');
    if(dec){ const item=selectedServices.get(dec.dataset.decService); if(item){item.qty-=1; if(item.qty<=0) selectedServices.delete(dec.dataset.decService); render();} return; }

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

  clearBtn?.addEventListener('click', () => {
    selectedServices.clear();
    sessionStorage.removeItem(serviceStorageKey);
    sessionStorage.removeItem(agendaServicesKey);
    panelHidden = true;
    render();
  });
  continueBtn?.addEventListener('click', () => { panelHidden = true; render(); });
  openBtn?.addEventListener('click', showCart);
  scheduleBtn?.addEventListener('click', prepareAgenda);
  render();
})();
