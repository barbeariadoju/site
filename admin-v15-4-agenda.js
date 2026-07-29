// admin-v15-4-agenda.js - parte 4/7 de admin-v15-4.js. Modo Agenda
// (admin-agenda.html): calendario, cards de agendamento, bloqueios de
// horario. bindBookingActions() aqui tambem eh usada por
// admin-v15-4-atendimento.js. Ver header de admin-v15-4-core.js.

  function initAgenda(){selectedDate=new URLSearchParams(location.search).get('data')||isoLocal(new Date());calendarMonth=new Date(selectedDate+'T12:00:00');calendarMonth.setDate(1);$('calendar-prev').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderCalendar()};$('calendar-next').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderCalendar()};$('block-all-day').onchange=()=>{$('block-time-fields').hidden=$('block-all-day').checked};$('block-save').onclick=saveBlock;renderCalendar();loadAgendaDay()}
  function renderCalendar(){setText('calendar-title',calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));const grid=$('calendar-grid'),y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),start=(first.getDay()+6)%7;let html=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=>`<span class="calendar-weekday">${d}</span>`).join('');for(let i=0;i<start;i++)html+='<span class="calendar-day is-empty"></span>';for(let d=1;d<=last.getDate();d++){const dt=new Date(y,m,d),ds=isoLocal(dt),count=allBookings.filter(x=>x.booking_date===ds&&x.status!=='cancelled').length;html+=`<button class="calendar-day ${ds===selectedDate?'is-selected':''} ${ds===isoLocal(new Date())?'is-today':''}" data-date="${ds}"><span>${d}</span>${count?`<small>${count}</small>`:''}</button>`}grid.innerHTML=html;grid.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderCalendar();loadAgendaDay()})}
  async function loadAgendaDay(){setText('agenda-date-title',formatDate(selectedDate));const rows=allBookings.filter(x=>x.booking_date===selectedDate).sort((a,b)=>a.start_time.localeCompare(b.start_time)),list=$('agenda-day-list');list.innerHTML=rows.length?rows.map(bookingCard).join(''):'<div class="admin-empty">Nenhum agendamento nesta data.</div>';bindBookingActions(list);await loadBlocks()}
  function bookingCard(x){const email=x.customer_email?`<a class="admin-contact-link" href="${emailLink(x)}">✉ ${esc(x.customer_email)}</a>`:'';return `<article class="admin-booking-card ${statusClass(x.status)}"><div class="admin-booking-time"><strong>${x.start_time.slice(0,5)}</strong><small>até ${x.end_time?.slice(0,5)||''}</small></div><div class="admin-booking-main"><div class="admin-booking-title"><h3>${esc(x.customer_name)}</h3><span class="admin-status ${statusClass(x.status)}">${statusLabel(x.status)}</span></div><p>${esc(x.service_name)}</p><small>${formatPhone(x.customer_phone)} • ${money(Number(x.service_price||0)+Number(x.products_price||0))} • ${x.duration_minutes} min</small>${email}${productsHtml(x)}${x.notes?`<em>${esc(x.notes)}</em>`:''}</div><div class="admin-booking-actions"><a href="${whatsappLink(x)}" target="_blank" rel="noopener">WhatsApp</a>${x.customer_email?`<a href="${emailLink(x)}">E-mail</a>`:''}${x.status==='pending'?`<button data-status="confirmed" data-id="${x.id}">Confirmar</button>`:''}${['pending','confirmed'].includes(x.status)?`<button data-reschedule="${x.id}">Remarcar</button><button data-status="completed" data-id="${x.id}">Concluir</button><button data-status="no_show" data-id="${x.id}">Ausência</button><button class="is-danger" data-status="cancelled" data-id="${x.id}">Cancelar</button>`:''}<button data-return="${x.id}">Novo retorno</button></div></article>`}
  function bindBookingActions(root){root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,b.dataset.status,b));root.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('bdj-reschedule-id',b.dataset.reschedule);location.href='admin-agendamento.html?modo=remarcar'});root.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>{const x=allBookings.find(r=>r.id===b.dataset.return);prefillReturnStorage(x);location.href='admin-agendamento.html?modo=retorno'})}
  function reviewWhatsAppLink(x){const msg=`Olá, ${x.customer_name}! Obrigado pela preferência. Foi um prazer atender você hoje na Barbearia do Ju. Se puder, deixe sua avaliação no Google: https://g.page/r/CaQfC5axIQQIEBM/review`;return whatsappBusinessUrl(x.customer_phone,msg)}
  function choosePaymentMethod(){
    return new Promise(resolve=>{
      let modal=document.getElementById('payment-method-modal');
      if(!modal){
        const style=document.createElement('style');
        style.textContent='.payment-method-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:18px}.payment-method-grid button{border:1px solid rgba(240,201,135,.28);background:#141414;color:#f3f3f3;border-radius:14px;padding:14px 10px;font:inherit;font-weight:700;cursor:pointer}.payment-method-grid button:hover{border-color:var(--gold);color:var(--gold2)}.payment-method-grid button[data-payment="fidelidade"]{grid-column:1/-1}';
        document.head.appendChild(style);
        modal=document.createElement('div');
        modal.id='payment-method-modal';
        modal.className='admin-modal';
        modal.hidden=true;
        modal.innerHTML='<div class="admin-modal-backdrop" data-payment-cancel></div><section class="admin-modal-card" role="dialog" aria-modal="true"><button type="button" class="admin-modal-close" data-payment-cancel>&times;</button><h2>Concluir atendimento</h2><p class="privacy-note">Escolha a forma de pagamento pra fechar o registro. O pagamento em si acontece normalmente aqui na barbearia, depois do atendimento — isso é só um controle interno pro seu financeiro, o cliente não vê essa tela.</p><div class="payment-method-grid"><button type="button" data-payment="pix">Pix</button><button type="button" data-payment="debito">Débito</button><button type="button" data-payment="credito">Crédito</button><button type="button" data-payment="dinheiro">Dinheiro</button><button type="button" data-payment="fidelidade">Bônus de fidelidade</button></div></section>';
        document.body.appendChild(modal);
      }
      modal.hidden=false;
      const finish=value=>{modal.hidden=true;cleanup();resolve(value)};
      const onCancel=()=>finish(null);
      const onPick=e=>finish(e.currentTarget.dataset.payment);
      const cancelEls=modal.querySelectorAll('[data-payment-cancel]');
      const pickEls=modal.querySelectorAll('[data-payment]');
      function cleanup(){cancelEls.forEach(el=>el.removeEventListener('click',onCancel));pickEls.forEach(el=>el.removeEventListener('click',onPick))}
      cancelEls.forEach(el=>el.addEventListener('click',onCancel));
      pickEls.forEach(el=>el.addEventListener('click',onPick));
    })
  }
  async function setStatus(id,status,trigger=null){
    let paymentMethod=null;
    if(status==='completed'){
      paymentMethod=await choosePaymentMethod();
      if(!paymentMethod)return;
    }else{
      const prompts={no_show:'Registrar ausência?',cancelled:'Cancelar e liberar o horário? O cliente receberá um e-mail de aviso caso tenha e-mail cadastrado.'};
      if(prompts[status]&&!confirm(prompts[status]))return;
    }
    const booking=allBookings.find(x=>x.id===id),button=trigger||document.querySelector(`[data-status="${status}"][data-id="${id}"]`),oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent=({cancelled:'Cancelando…',completed:'Concluindo…',no_show:'Salvando…',confirmed:'Confirmando…'})[status]||'Salvando…'}
    try{
      const body={booking_id:id,status};
      if(paymentMethod)body.payment_method=paymentMethod;
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
