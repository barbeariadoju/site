// admin-v15-4-atendimento.js - parte 3/7 de admin-v15-4.js. Modo Servico
// (admin-atendimento.html). Usa bindBookingActions, definida na parte
// admin-v15-4-agenda.js - funciona porque as duas carregam juntas no mesmo
// escopo (ver header de admin-v15-4-core.js).
  function initServiceMode(){
    $('service-refresh')?.addEventListener('click',async()=>{await loadBaseData();renderServiceMode()});
    renderServiceMode();
  }
  function renderServiceMode(){
    const today=isoLocal(new Date());
    const rows=allBookings.filter(x=>x.booking_date===today&&x.status!=='cancelled').sort((a,b)=>a.start_time.localeCompare(b.start_time));
    const active=rows.filter(x=>['pending','confirmed'].includes(x.status));
    const completed=rows.filter(x=>x.status==='completed');
    setText('service-remaining',active.length);
    setText('service-confirmed',rows.filter(x=>x.status==='confirmed').length);
    setText('service-completed',completed.length);
    setText('service-revenue',money(completed.reduce((a,x)=>a+Number(x.service_price||0)+Number(x.products_price||0),0)));
    const box=$('service-mode-list');
    if(!box)return;
    box.innerHTML=rows.length?rows.map(x=>`<article class="service-mode-card ${statusClass(x.status)}"><div class="service-mode-time"><strong>${x.start_time.slice(0,5)}</strong><small>${x.end_time?.slice(0,5)||''}</small></div><div class="service-mode-info"><div><h3>${esc(x.customer_name)}</h3><span class="admin-status ${statusClass(x.status)}">${statusLabel(x.status)}</span></div><p>${esc(x.service_name)}</p><small>${formatPhone(x.customer_phone)} • ${money(Number(x.service_price||0)+Number(x.products_price||0))}</small>${productsHtml(x)}</div><div class="service-mode-actions"><a href="${whatsappLink(x)}" target="_blank" rel="noopener">WhatsApp</a>${x.status==='pending'?`<button data-status="confirmed" data-id="${x.id}">Confirmar</button>`:''}${['pending','confirmed'].includes(x.status)?`<button class="is-primary" data-status="completed" data-id="${x.id}">Concluir</button><button data-reschedule="${x.id}">Remarcar</button><button data-status="no_show" data-id="${x.id}">Ausência</button>`:''}<button data-products="${x.id}">🛍 Produtos</button><button data-return="${x.id}">Retorno</button></div></article>`).join(''):'<div class="admin-empty">Nenhum atendimento para hoje.</div>';
    bindBookingActions(box);
  }
