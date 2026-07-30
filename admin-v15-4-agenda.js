// admin-v15-4-agenda.js - parte 4/7 de admin-v15-4.js. Modo Agenda
// (admin-agenda.html): calendario, cards de agendamento, bloqueios de
// horario. bindBookingActions() aqui tambem eh usada por
// admin-v15-4-atendimento.js. Ver header de admin-v15-4-core.js.

  function initAgenda(){selectedDate=new URLSearchParams(location.search).get('data')||isoLocal(new Date());calendarMonth=new Date(selectedDate+'T12:00:00');calendarMonth.setDate(1);$('calendar-prev').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);refreshCalendar()};$('calendar-next').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);refreshCalendar()};$('block-all-day').onchange=()=>{$('block-time-fields').hidden=$('block-all-day').checked};$('block-save').onclick=saveBlock;refreshCalendar();loadAgendaDay()}
  // Bloqueios do mês inteiro (pedido do Juliano: ver de relance no calendário quais dias
  // estão fechados/bloqueados sem precisar clicar em cada um). Separado de loadBlocks()
  // (que só busca o dia selecionado, pro painel de baixo) porque aqui precisa do mês todo.
  async function loadMonthBlocks(){const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=isoLocal(new Date(y,m,1)),last=isoLocal(new Date(y,m+1,0));const {data}=await sb.from('schedule_blocks').select('block_date,all_day').gte('block_date',first).lte('block_date',last);monthBlocks=data||[]}
  async function refreshCalendar(){await loadMonthBlocks();renderCalendar()}
  function renderCalendar(){setText('calendar-title',calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));const grid=$('calendar-grid'),y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),start=(first.getDay()+6)%7;let html=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<span class="calendar-weekday">${d}</span>`).join('');for(let i=0;i<start;i++)html+='<span class="calendar-day is-empty"></span>';for(let d=1;d<=last.getDate();d++){const dt=new Date(y,m,d),ds=isoLocal(dt),count=allBookings.filter(x=>x.booking_date===ds&&x.status!=='cancelled').length;
   // Dia fechado (não atende): domingo/segunda, igual o resto do sistema (agenda pública,
   // JuIA, admin_create_booking) já trata como fixo, sem tabela de horário de funcionamento.
   const closed=dt.getDay()===0||dt.getDay()===1;
   const dayBlocks=(monthBlocks||[]).filter(b=>b.block_date===ds);
   const fullyBlocked=dayBlocks.some(b=>b.all_day);
   const partiallyBlocked=!fullyBlocked&&dayBlocks.length>0;
   const flag=closed?'<i class="day-flag day-flag-closed" title="Não atende">🚫</i>':fullyBlocked?'<i class="day-flag day-flag-locked" title="Dia bloqueado">🔒</i>':partiallyBlocked?'<i class="day-flag day-flag-partial" title="Bloqueio parcial">⏰</i>':'';
   html+=`<button class="calendar-day ${ds===selectedDate?'is-selected':''} ${ds===isoLocal(new Date())?'is-today':''}" data-date="${ds}">${flag}<span>${d}</span>${count?`<small>${count}</small>`:''}</button>`}grid.innerHTML=html;grid.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderCalendar();loadAgendaDay()})}
  async function loadAgendaDay(){setText('agenda-date-title',formatDate(selectedDate));const rows=allBookings.filter(x=>x.booking_date===selectedDate).sort((a,b)=>a.start_time.localeCompare(b.start_time)),list=$('agenda-day-list');list.innerHTML=rows.length?rows.map(bookingCard).join(''):'<div class="admin-empty">Nenhum agendamento nesta data.</div>';bindBookingActions(list);await loadBlocks()}
  function bookingCard(x){const email=x.customer_email?`<a class="admin-contact-link" href="${emailLink(x)}">✉ ${esc(x.customer_email)}</a>`:'';return `<article class="admin-booking-card ${statusClass(x.status)}"><div class="admin-booking-time"><strong>${x.start_time.slice(0,5)}</strong><small>até ${x.end_time?.slice(0,5)||''}</small></div><div class="admin-booking-main"><div class="admin-booking-title"><h3>${esc(x.customer_name)}</h3><span class="admin-status ${statusClass(x.status)}">${statusLabel(x.status)}</span></div><p>${esc(x.service_name)}</p><small>${formatPhone(x.customer_phone)} • ${x.duration_minutes} min</small>${priceSummaryHtml(x)}${email}${productsHtml(x)}${x.notes?`<em>${esc(x.notes)}</em>`:''}</div><div class="admin-booking-actions"><a href="${whatsappLink(x)}" target="_blank" rel="noopener">WhatsApp</a>${x.customer_email?`<a href="${emailLink(x)}">E-mail</a>`:''}${x.status==='pending'?`<button data-status="confirmed" data-id="${x.id}">Confirmar</button>`:''}${['pending','confirmed'].includes(x.status)?`<button data-reschedule="${x.id}">Remarcar</button><button data-status="completed" data-id="${x.id}">Concluir</button><button data-status="no_show" data-id="${x.id}">Ausência</button><button class="is-danger" data-status="cancelled" data-id="${x.id}">Cancelar</button>`:''}<button data-edit="${x.id}">✎ Editar</button><button data-return="${x.id}">Novo retorno</button></div></article>`}
  function bindBookingActions(root){root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,b.dataset.status,b));root.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('bdj-reschedule-id',b.dataset.reschedule);location.href='admin-agendamento.html?modo=remarcar'});root.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>{const x=allBookings.find(r=>r.id===b.dataset.return);prefillReturnStorage(x);location.href='admin-agendamento.html?modo=retorno'});root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editBooking(b.dataset.edit,b))}
  function reviewWhatsAppLink(x){const msg=`Olá, ${x.customer_name}! Obrigado pela preferência. Foi um prazer atender você hoje na Barbearia do Ju. Se puder, deixe sua avaliação no Google: https://g.page/r/CaQfC5axIQQIEBM/review`;return whatsappBusinessUrl(x.customer_phone,msg)}
  // Grade de produtos reaproveitada tanto no modal de "Concluir" (produtos vendidos junto
  // do fechamento) quanto no modal "✎ Editar atendimento" (corrigir serviço/produtos/
  // pagamento de um atendimento já existente, site ou balcão, em qualquer status — pedido
  // do Juliano pra não precisar reconstruir isso em cada tela separada).
  function productChecklistHtml(existingProducts=[]){
    const selectedNames=new Set(existingProducts.map(p=>p.name));
    return `<div class="products-modal-grid">${productCatalog.map(p=>`<label class="products-modal-option"><input type="checkbox" data-product-name="${esc(p.name)}" data-product-price="${p.price}" ${selectedNames.has(p.name)?'checked':''}><span><strong>${esc(p.name)}</strong><small>${money(p.price)}</small></span></label>`).join('')}</div>`
  }
  function readChecklistProducts(modal){
    return [...modal.querySelectorAll('[data-product-name]:checked')].map(i=>({name:i.dataset.productName,price:Number(i.dataset.productPrice)}))
  }
  // Serviço realmente executado pode divergir do que foi agendado (ex.: cliente pediu outro
  // serviço na hora) — grade igual à de produtos, mas pra serviços, pré-marcada com o que já
  // está no registro. Tenta bater o nome inteiro primeiro (cobre combos do próprio catálogo,
  // ex. "Corte + Lavagem", que têm "+" no nome e quebrariam se só desse split direto) e só
  // separa por "+" se não achar exato (cobre combinações de serviços distintos).
  function matchCurrentServiceNames(serviceName){
    const name=String(serviceName||'').trim()
    if(catalog.some(s=>s.name===name))return [name]
    return name.split('+').map(s=>s.trim()).filter(Boolean)
  }
  function serviceChecklistHtml(currentServiceName=''){
    const selectedNames=new Set(matchCurrentServiceNames(currentServiceName))
    const groups={}
    catalog.forEach(s=>(groups[s.category]??=[]).push(s))
    return Object.entries(groups).map(([cat,items])=>`<section class="booking-service-group"><h3>${esc(cat)}</h3><div>${items.map(s=>`<label class="booking-service-option"><input type="checkbox" data-service-name="${esc(s.name)}" data-service-price="${s.price}" data-service-duration="${s.duration}" ${selectedNames.has(s.name)?'checked':''}><span><strong>${esc(s.name)}</strong><small>${s.duration} min • ${money(s.price)}</small><i>✓</i></span></label>`).join('')}</div></section>`).join('')
  }
  function readChecklistServices(modal){
    return [...modal.querySelectorAll('[data-service-name]:checked')].map(i=>({name:i.dataset.serviceName,price:Number(i.dataset.servicePrice),duration:Number(i.dataset.serviceDuration)}))
  }
  function paymentPickerHtml(current=''){
    const methods=[['pix','Pix'],['debito','Débito'],['credito','Crédito'],['dinheiro','Dinheiro'],['fidelidade','Bônus de fidelidade']]
    return `<div class="payment-method-grid" data-payment-picker>${methods.map(([v,l])=>`<button type="button" data-payment-option="${v}" class="${current===v?'is-selected':''}">${l}</button>`).join('')}</div>`
  }
  function ensureModalStyles(){
    if(document.getElementById('booking-modals-style'))return;
    const style=document.createElement('style');
    style.id='booking-modals-style';
    style.textContent='.payment-method-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}.payment-method-grid button{border:1px solid rgba(240,201,135,.28);background:#141414;color:#f3f3f3;border-radius:14px;padding:14px 10px;font:inherit;font-weight:700;cursor:pointer}.payment-method-grid button:hover{border-color:var(--gold);color:var(--gold2)}.payment-method-grid button[data-payment="fidelidade"],.payment-method-grid button[data-payment-option="fidelidade"]{grid-column:1/-1}.payment-method-grid button.is-selected{border-color:var(--gold);background:rgba(240,201,135,.12);color:var(--gold2)}.products-modal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0;max-height:220px;overflow:auto}.products-modal-option{display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 10px;cursor:pointer;font-size:.88rem}.products-modal-option:has(input:checked){border-color:var(--gold);background:rgba(240,201,135,.08)}.products-modal-option small{display:block;color:#999}.booking-edit-card{max-height:88vh;overflow:auto}.booking-edit-card [data-service-slot]{max-height:220px;overflow:auto}@media(max-width:600px){.products-modal-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }
  // Serviço editável já no "Concluir" (não só no "✎ Editar" depois) — pedido do Juliano
  // após caso real: corte + sobrancelha no balcão, só o corte estava no agendamento
  // original, e não dava pra marcar o serviço extra na hora de concluir.
  function choosePaymentMethod(booking={}){
    return new Promise(resolve=>{
      ensureModalStyles();
      let modal=document.getElementById('payment-method-modal');
      if(!modal){
        modal=document.createElement('div');
        modal.id='payment-method-modal';
        modal.className='admin-modal';
        modal.hidden=true;
        modal.innerHTML='<div class="admin-modal-backdrop" data-payment-cancel></div><section class="admin-modal-card booking-edit-card" role="dialog" aria-modal="true"><button type="button" class="admin-modal-close" data-payment-cancel>&times;</button><h2>Concluir atendimento</h2><p class="privacy-note">Confira o serviço realmente feito e escolha a forma de pagamento pra fechar o registro. O pagamento em si acontece normalmente aqui na barbearia, depois do atendimento — isso é só um controle interno pro seu financeiro, o cliente não vê essa tela.</p><h3 style="margin-top:14px">Serviço realizado</h3><div data-service-slot></div><h3 style="margin:16px 0 4px">Produtos vendidos <small class="field-help" style="font-weight:400">opcional</small></h3><div data-products-slot></div><div class="payment-method-grid"><button type="button" data-payment="pix">Pix</button><button type="button" data-payment="debito">Débito</button><button type="button" data-payment="credito">Crédito</button><button type="button" data-payment="dinheiro">Dinheiro</button><button type="button" data-payment="fidelidade">Bônus de fidelidade</button></div></section>';
        document.body.appendChild(modal);
      }
      modal.querySelector('[data-service-slot]').innerHTML=serviceChecklistHtml(booking.service_name);
      modal.querySelector('[data-products-slot]').innerHTML=productChecklistHtml(parseProducts(booking));
      modal.hidden=false;
      const finish=value=>{modal.hidden=true;cleanup();resolve(value)};
      const onCancel=()=>finish(null);
      const onPick=e=>{
        const services=readChecklistServices(modal);
        if(!services.length){alert('Selecione ao menos um serviço.');return}
        finish({
          payment:e.currentTarget.dataset.payment,
          products:readChecklistProducts(modal),
          service:{name:services.map(s=>s.name).join(' + '),price:services.reduce((a,s)=>a+s.price,0),duration_minutes:services.reduce((a,s)=>a+s.duration,0)},
        });
      };
      const cancelEls=modal.querySelectorAll('[data-payment-cancel]');
      const pickEls=modal.querySelectorAll('[data-payment]');
      function cleanup(){cancelEls.forEach(el=>el.removeEventListener('click',onCancel));pickEls.forEach(el=>el.removeEventListener('click',onPick))}
      cancelEls.forEach(el=>el.addEventListener('click',onCancel));
      pickEls.forEach(el=>el.addEventListener('click',onPick));
    })
  }
  // Modal "✎ Editar atendimento" — corrige serviço realmente executado, produtos vendidos
  // e forma de pagamento de um atendimento que já existe (concluído ou não, site ou
  // balcão), sem depender do fluxo de "Concluir". Caso real: cliente agendou um serviço
  // no site mas na hora pediu outro + comprou produto, e o corte foi registrado errado
  // porque "Concluir" só captura pagamento/produtos do momento da conclusão. Resolve com
  // {service,products,payment_method} ou null se cancelado. Pagamento é opcional aqui
  // (diferente do fluxo de conclusão, que exige) — dá pra só corrigir depois.
  function chooseBookingEdits(booking){
    return new Promise(resolve=>{
      ensureModalStyles();
      let modal=document.getElementById('booking-edit-modal');
      if(!modal){
        modal=document.createElement('div');
        modal.id='booking-edit-modal';
        modal.className='admin-modal';
        modal.hidden=true;
        modal.innerHTML='<div class="admin-modal-backdrop" data-edit-cancel></div><section class="admin-modal-card booking-edit-card" role="dialog" aria-modal="true"><button type="button" class="admin-modal-close" data-edit-cancel>&times;</button><h2>✎ Editar atendimento</h2><p class="privacy-note">Ajuste o que foi realizado de verdade — funciona pra qualquer agendamento (site ou balcão), concluído ou não.</p><h3 style="margin-top:14px">Serviço realizado</h3><div data-service-slot></div><h3 style="margin-top:16px">Produtos vendidos <small class="field-help" style="font-weight:400">opcional</small></h3><div data-products-slot></div><h3 style="margin-top:16px">Forma de pagamento <small class="field-help" style="font-weight:400">opcional</small></h3><div data-payment-slot></div><button type="button" class="btn primary" data-edit-save style="width:100%;margin-top:16px">Salvar alterações</button></section>';
        document.body.appendChild(modal);
      }
      modal.querySelector('[data-service-slot]').innerHTML=serviceChecklistHtml(booking.service_name);
      modal.querySelector('[data-products-slot]').innerHTML=productChecklistHtml(parseProducts(booking));
      modal.querySelector('[data-payment-slot]').innerHTML=paymentPickerHtml(booking.payment_method||'');
      let selectedPayment=booking.payment_method||'';
      modal.hidden=false;
      const finish=value=>{modal.hidden=true;cleanup();resolve(value)};
      const onCancel=()=>finish(null);
      const paymentSlot=modal.querySelector('[data-payment-slot]');
      const onPaymentClick=e=>{
        const btn=e.target.closest('[data-payment-option]');
        if(!btn)return;
        selectedPayment=selectedPayment===btn.dataset.paymentOption?'':btn.dataset.paymentOption;
        paymentSlot.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.toggle('is-selected',b.dataset.paymentOption===selectedPayment));
      };
      const onSave=()=>{
        const services=readChecklistServices(modal);
        if(!services.length){alert('Selecione ao menos um serviço.');return}
        finish({
          service:{name:services.map(s=>s.name).join(' + '),price:services.reduce((a,s)=>a+s.price,0),duration_minutes:services.reduce((a,s)=>a+s.duration,0)},
          products:readChecklistProducts(modal),
          payment_method:selectedPayment||null,
        });
      };
      const cancelEls=modal.querySelectorAll('[data-edit-cancel]');
      const saveEl=modal.querySelector('[data-edit-save]');
      function cleanup(){cancelEls.forEach(el=>el.removeEventListener('click',onCancel));paymentSlot.removeEventListener('click',onPaymentClick);saveEl.removeEventListener('click',onSave)}
      cancelEls.forEach(el=>el.addEventListener('click',onCancel));
      paymentSlot.addEventListener('click',onPaymentClick);
      saveEl.addEventListener('click',onSave);
    })
  }
  async function editBooking(id,trigger=null){
    const booking=allBookings.find(x=>x.id===id);
    if(!booking)return;
    const result=await chooseBookingEdits(booking);
    if(!result)return;
    const oldText=trigger?.textContent;
    if(trigger){trigger.disabled=true;trigger.textContent='Salvando…'}
    try{
      const body={booking_id:id,service:result.service,selected_products:result.products};
      if(result.payment_method)body.payment_method=result.payment_method;
      const {data,error}=await sb.functions.invoke('admin-booking-status',{body});
      if(error||data?.error){alert(data?.error||error?.message||'Não foi possível salvar as alterações.');return}
      await loadBaseData();if(page==='atendimento')renderServiceMode();else{renderCalendar();await loadAgendaDay()}
    }finally{if(trigger&&trigger.isConnected){trigger.disabled=false;trigger.textContent=oldText}}
  }
  async function setStatus(id,status,trigger=null){
    let paymentMethod=null,completionProducts=null,completionService=null;
    if(status==='completed'){
      const booking=allBookings.find(x=>x.id===id);
      const choice=await choosePaymentMethod(booking||{});
      if(!choice)return;
      paymentMethod=choice.payment;
      completionProducts=choice.products;
      completionService=choice.service;
    }else{
      const prompts={no_show:'Registrar ausência?',cancelled:'Cancelar e liberar o horário? O cliente receberá um e-mail de aviso caso tenha e-mail cadastrado.'};
      if(prompts[status]&&!confirm(prompts[status]))return;
    }
    const booking=allBookings.find(x=>x.id===id),button=trigger||document.querySelector(`[data-status="${status}"][data-id="${id}"]`),oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent=({cancelled:'Cancelando…',completed:'Concluindo…',no_show:'Salvando…',confirmed:'Confirmando…'})[status]||'Salvando…'}
    try{
      const body={booking_id:id,status};
      if(paymentMethod)body.payment_method=paymentMethod;
      if(completionProducts)body.selected_products=completionProducts;
      if(completionService)body.service=completionService;
      const {data,error}=await sb.functions.invoke('admin-booking-status',{body});
      if(error||data?.error){const raw=data?.error||error?.message||'';alert(raw.includes('non-2xx')?'Não foi possível concluir esta ação. Atualize a página e tente novamente.':raw||'Não foi possível atualizar o agendamento.');return}
      await loadBaseData();if(page==='atendimento')renderServiceMode();else{renderCalendar();await loadAgendaDay()}
      if(status==='cancelled'){
        if(data?.email?.skipped)alert('Agendamento cancelado. O cliente não recebeu e-mail porque não há e-mail cadastrado.');
        else if(data?.email?.attempted&&!data?.email?.sent)alert(`Agendamento cancelado, mas o e-mail não pôde ser enviado.

${data?.email?.error||'Verifique os registros da função.'}`);
        else if(data?.email?.sent)alert('Agendamento cancelado e e-mail enviado ao cliente.')
      }
      if(status==='completed'&&booking){alert(booking.customer_email?'Atendimento concluído. A pesquisa de satisfação será enviada automaticamente em aproximadamente 2 horas.':'Atendimento concluído. A pesquisa automática não será enviada porque o cliente não possui e-mail cadastrado.')}
    }finally{if(button&&button.isConnected){button.disabled=false;button.textContent=oldText}}
  }
  async function loadBlocks(){const box=$('agenda-block-list'),{data,error}=await sb.from('schedule_blocks').select('*').eq('block_date',selectedDate).order('start_time',{ascending:true,nullsFirst:true});if(error){box.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return}box.innerHTML=(data||[]).length?data.map(x=>`<div class="admin-block-row"><div><strong>${x.all_day?'Dia inteiro':`${x.start_time.slice(0,5)}–${x.end_time.slice(0,5)}`}</strong><small>${esc(x.reason||'Bloqueio administrativo')}</small></div><button data-delete-block="${x.id}">Liberar</button></div>`).join(''):'<div class="admin-empty">Nenhum bloqueio nesta data.</div>';box.querySelectorAll('[data-delete-block]').forEach(b=>b.onclick=()=>deleteBlock(b.dataset.deleteBlock))}
  async function saveBlock(){const allDay=$('block-all-day').checked,start=$('block-start').value,end=$('block-end').value,msg=$('block-message');if(!allDay&&(!start||!end||start>=end)){msg.textContent='Informe um intervalo válido.';return}msg.textContent='Salvando...';const {error}=await sb.from('schedule_blocks').insert({block_date:selectedDate,all_day:allDay,start_time:allDay?null:start,end_time:allDay?null:end,reason:$('block-reason').value.trim()||null});msg.textContent=error?error.message:'Bloqueio criado.';if(!error){$('block-reason').value='';await loadBlocks()}}
  async function deleteBlock(id){if(!confirm('Liberar este bloqueio?'))return;const {error}=await sb.from('schedule_blocks').delete().eq('id',id);if(error)alert(error.message);else loadBlocks()}
