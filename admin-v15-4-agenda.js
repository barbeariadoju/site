// admin-v15-4-agenda.js - parte 4/7 de admin-v15-4.js. Modo Agenda
// (admin-agenda.html): calendario, cards de agendamento, bloqueios de
// horario. bindBookingActions() aqui tambem eh usada por
// admin-v15-4-atendimento.js. Ver header de admin-v15-4-core.js.

  function initAgenda(){selectedDate=new URLSearchParams(location.search).get('data')||isoLocal(new Date());calendarMonth=new Date(selectedDate+'T12:00:00');calendarMonth.setDate(1);$('calendar-prev').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);refreshCalendar()};$('calendar-next').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);refreshCalendar()};$('block-all-day').onchange=()=>{const allDay=$('block-all-day').checked;$('block-time-fields').hidden=allDay;$('block-range-wrap').hidden=!allDay;if(!allDay)$('block-range-end').value=''};$('block-save').onclick=saveBlock;refreshCalendar();loadAgendaDay()}
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
  // Card colapsado por padrão (só resumo: hora/nome/status/total) — pedido do Juliano
  // depois que os campos de preço/pagamento (v28.22-28.23) deixaram o card alto demais,
  // forçando rolar muito com vários agendamentos no dia. Clique no resumo expande o
  // detalhe completo (serviço, telefone, preços, pagamento, produtos, ações). Reaproveitado
  // por admin-v15-4-atendimento.js via bookingCardHtml() pra manter o mesmo visual.
  function bookingCardHtml(x,actionsHtml){
    const email=x.customer_email?`<a class="admin-contact-link" href="${emailLink(x)}">✉ ${esc(x.customer_email)}</a>`:'';
    const total=money(Number(x.service_price||0)+Number(x.products_price||0));
    // v28.68.0: cliente que avisou ter feito o Pix antecipado. É DECLARAÇÃO do cliente, não
    // confirmação de pagamento — por isso o texto pede conferência em vez de afirmar "pago".
    // v29.3.0: a declaração agora diz PARA QUAL CHAVE, pra abrir o app certo de primeira,
    // e ganha o botão de confirmar — que avisa o cliente por WhatsApp.
    const prepayKeyLabel=x.prepay_key==='picpay'?'PicPay · e-mail contato@barbeariadoju.com.br':'PagBank · celular 11967073038';
    // v29.22.0: prepay_key='checkout' é pagamento pela API PagBank, confirmado por
    // webhook — nasce já confirmado, sem botão de conferência (nada a conferir).
    // v29.84.0: o selo diz COMO o cliente pagou (Pix/débito/crédito) — o webhook já
    // gravava payments.method, só ninguém mostrava (pedido do Juliano, caso Pedro 28/08).
    const paidOnline=(x.payments||[]).find(p=>p&&p.status==='paid'&&p.method);
    const onlineVia=paidOnline?({pix:'Pix',credito:'cartão de crédito',debito:'cartão de débito'}[paidOnline.method]||paidOnline.method):'';
    const prepay=x.prepay_declared_at
      ? (x.prepay_confirmed_at
        ? (x.prepay_key==='checkout'
          ? `<span class="admin-prepay-flag is-confirmed" title="Pago pelo Checkout PagBank — confirmação automática">✅ Pago online (PagBank${onlineVia?` · ${onlineVia}`:''}) — automático</span>`
          : `<span class="admin-prepay-flag is-confirmed" title="Você confirmou o recebimento">✅ Pix recebido e confirmado</span>`)
        : `<span class="admin-prepay-flag" title="O cliente declarou ter pago por Pix — confira o comprovante">💸 Cliente diz ter adiantado por Pix<br><small>Conferir em: <b>${esc(prepayKeyLabel)}</b></small></span><button type="button" class="btn primary admin-prepay-confirm" data-confirm-prepay="${x.id}">✅ Confirmar que o Pix caiu</button>`)
      : '';
    const prepayMini=x.prepay_declared_at?`<span class="admin-prepay-dot" title="${x.prepay_confirmed_at?(onlineVia?`Pago online · ${onlineVia}`:'Pix confirmado'):'Pix antecipado declarado'}">${x.prepay_confirmed_at?'✅':'💸'}</span>`:'';
    return `<article class="admin-booking-card ${statusClass(x.status)}" data-booking-card="${x.id}"><button type="button" class="admin-booking-summary" data-toggle-card aria-expanded="false"><span class="admin-booking-time-mini">${x.start_time.slice(0,5)}</span><span class="admin-booking-summary-main"><strong>${esc(x.customer_name)}${prepayMini}</strong>${visitBadgeHtml(x)}<small>${esc(x.service_name)}</small></span><span class="admin-status ${statusClass(x.status)}">${statusLabel(x.status)}</span><span class="admin-booking-summary-total">${total}</span><span class="admin-booking-chevron">⌄</span></button><div class="admin-booking-detail"><div class="admin-booking-detail-inner"><small class="admin-services-full">✂ ${esc(x.service_name)}</small><small>${formatPhone(x.customer_phone)} • até ${x.end_time?.slice(0,5)||''} • ${x.duration_minutes} min</small>${prepay}${priceSummaryHtml(x)}${email}${productsHtml(x)}${x.notes?`<em>${esc(x.notes)}</em>`:''}<div class="admin-booking-actions">${actionsHtml}</div></div></div></article>`
  }
  function bookingCard(x){
    // Excluir registro só aparece pra CANCELADOS — pedido do Juliano (31/07/2026) pra
    // limpar um teste dele mesmo da tela sem apagar histórico de cliente real (cancelamento
    // de cliente de verdade continua visível por padrão). RLS trava a mesma regra no banco
    // (policy "admin delete cancelled bookings", só status='cancelled') — isto aqui é só a
    // UI, a permissão de verdade está no servidor.
    const deleteHtml=x.status==='cancelled'?`<button class="is-danger" data-delete-booking="${x.id}">🗑 Excluir registro</button>`:'';
    // v28.60.0 — Reativar cancelado (caso Kelvin: robô liberou a vaga às 12:00, cliente
    // confirmou 12:01 e não havia caminho de volta). Só aparece se o horário ainda não
    // passou; a RPC admin_reactivate_booking valida colisão/bloqueio no servidor.
    // v28.65.1: o botão sumia quando o horário passava, e aí não havia MAIS NENHUM caminho
    // de volta (o modal "✎ Editar" não tem campo de data/hora). Agora ele fica sempre
    // disponível pra cancelado: se o horário original já passou, a própria reativação pede
    // um horário novo. Quem valida é o servidor, que recusa qualquer horário no passado.
    const notPast=x.booking_date>isoLocal(new Date())||(x.booking_date===isoLocal(new Date())&&x.start_time>new Date().toTimeString().slice(0,8));
    const reactivateHtml=x.status==='cancelled'?`<button data-reactivate="${x.id}" data-past="${notPast?'0':'1'}">↩️ Reativar${notPast?'':' (escolher horário)'}</button>`:'';
    const actionsHtml=`<a href="${whatsappLink(x)}" target="_blank" rel="noopener">WhatsApp</a>${x.customer_email?`<a href="${emailLink(x)}">E-mail</a>`:''}${x.status==='pending'?`<button data-status="confirmed" data-id="${x.id}">Confirmar</button>`:''}${['pending','confirmed'].includes(x.status)?`<button data-reschedule="${x.id}">Remarcar</button><button data-status="completed" data-id="${x.id}">Concluir</button><button data-status="no_show" data-id="${x.id}">Ausência</button><button class="is-danger" data-status="cancelled" data-id="${x.id}">Cancelar</button>`:''}<button data-edit="${x.id}">✎ Editar</button><button data-return="${x.id}">Novo retorno</button>${reactivateHtml}${deleteHtml}`;
    return bookingCardHtml(x,actionsHtml)
  }
  async function deleteBooking(id,trigger){
    const booking=allBookings.find(x=>x.id===id);
    if(!booking)return;
    if(!confirm(`Excluir definitivamente o agendamento cancelado de ${esc(booking.customer_name)} (${formatDate(booking.booking_date)} às ${booking.start_time.slice(0,5)})?\n\nIsso remove o registro da tela pra sempre — use só pra testes/lixo, não pra cancelamentos reais de cliente que você queira manter no histórico.`))return;
    if(trigger){trigger.disabled=true;trigger.textContent='Excluindo…'}
    const {error}=await sb.from('bookings').delete().eq('id',id).eq('status','cancelled');
    if(error){alert(error.message);if(trigger){trigger.disabled=false;trigger.textContent='🗑 Excluir registro'}return}
    await loadBaseData();if(page==='atendimento')renderServiceMode();else{renderCalendar();await loadAgendaDay()}
  }
  function bindBookingActions(root){root.querySelectorAll('[data-toggle-card]').forEach(b=>b.onclick=()=>{const detail=b.closest('.admin-booking-card').querySelector('.admin-booking-detail');const opening=!detail.classList.contains('is-open');detail.classList.toggle('is-open',opening);b.setAttribute('aria-expanded',String(opening))});root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,b.dataset.status,b));root.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('bdj-reschedule-id',b.dataset.reschedule);location.href='admin-agendamento.html?modo=remarcar'});root.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>{const x=allBookings.find(r=>r.id===b.dataset.return);prefillReturnStorage(x);location.href='admin-agendamento.html?modo=retorno'});root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editBooking(b.dataset.edit,b));root.querySelectorAll('[data-delete-booking]').forEach(b=>b.onclick=()=>deleteBooking(b.dataset.deleteBooking,b));root.querySelectorAll('[data-reactivate]').forEach(b=>b.onclick=()=>reactivateBooking(b.dataset.reactivate,b));root.querySelectorAll('[data-confirm-prepay]').forEach(b=>b.onclick=()=>confirmPrepay(b.dataset.confirmPrepay,b))}

  // v29.3.0 — confirma que o Pix caiu e avisa o cliente pelo WhatsApp. É o que fecha
  // o ciclo: até aqui o cliente pagava, avisava, e nunca recebia retorno nenhum.
  async function confirmPrepay(id,btn){
    if(!confirm('Confirmar que o Pix deste cliente caiu na conta?\n\nEle vai receber um aviso no WhatsApp.'))return;
    const antes=btn.textContent; btn.disabled=true; btn.textContent='Confirmando…';
    try{
      const {data:{session}}=await sb.auth.getSession();
      const r=await fetch(`${cfg.supabaseUrl}/functions/v1/prepay-confirm`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token||''}`},
        body:JSON.stringify({booking_id:id})
      });
      const out=await r.json().catch(()=>({}));
      if(!out.ok){btn.disabled=false;btn.textContent=antes;alert(out.message||'Não foi possível confirmar.');return}
      if(!out.avisou)alert('Confirmado! Mas não consegui avisar o cliente pelo WhatsApp — vale mandar uma mensagem manual.');
      await loadAgendaDay();
    }catch(e){console.error(e);btn.disabled=false;btn.textContent=antes;alert('Não foi possível confirmar agora.')}
  }
  // v28.65.0 — caso Moisés: o cancelado era 18:00–18:50 e outro cliente entrou das 17:00 às
  // 18:15 no meio tempo, então reativar batia em 'horario_ocupado' e a única saída oferecida
  // era criar um agendamento do zero por "Novo retorno" — perdendo o registro original.
  // Agora, quando o horário está ocupado, dá pra escolher outro na hora e reativar o MESMO
  // agendamento (preserva histórico, serviço, produtos e observações).
  async function reactivateBooking(id,trigger){
    const booking=allBookings.find(x=>x.id===id);
    if(!booking)return;
    if(!confirm(`Reativar o agendamento de ${booking.customer_name} (${formatDate(booking.booking_date)} às ${booking.start_time.slice(0,5)})? Ele volta como CONFIRMADO.`))return;
    const restore=()=>{if(trigger){trigger.disabled=false;trigger.textContent='↩️ Reativar'}};
    if(trigger){trigger.disabled=true;trigger.textContent='Reativando…'}

    let {error}=await sb.rpc('admin_reactivate_booking',{p_booking_id:id});

    if(error&&String(error.message||'').includes('horario_ocupado')){
      const dur=booking.duration_minutes||30;
      const {data:slots}=await sb.rpc('get_available_slots',{p_date:booking.booking_date,p_duration_minutes:dur});
      const livres=(Array.isArray(slots)?slots:[]).map(s=>String(s.slot_time||s.start_time||s).slice(0,5)).filter(Boolean);
      const sugestao=livres.length?`\n\nHorários livres em ${formatDate(booking.booking_date)} (${dur} min):\n${livres.join('  ·  ')}`:'\n\nNão há horário livre na grade desse dia — você ainda pode digitar um horário manualmente (ex.: logo após o atendimento anterior).';
      const escolha=prompt(`Esse horário já foi ocupado por outro agendamento.\n\nDigite o novo horário para reativar (formato HH:MM), ou cancele para desistir.${sugestao}`,livres[0]||booking.start_time.slice(0,5));
      if(escolha===null){restore();return}
      const hora=String(escolha).trim();
      if(!/^\d{1,2}:\d{2}$/.test(hora)){alert('Horário inválido. Use o formato HH:MM, por exemplo 18:15.');restore();return}
      const normalizado=hora.padStart(5,'0')+':00';
      ({error}=await sb.rpc('admin_reactivate_booking',{p_booking_id:id,p_new_start_time:normalizado}));
    }

    if(error){
      const msg=String(error.message||'').includes('horario_ocupado')
        ?'Esse horário também está ocupado (outro agendamento ou bloqueio de agenda). Tente outro horário.'
        :error.message;
      alert(msg);
      restore();
      return
    }
    await loadBaseData();if(page==='atendimento')renderServiceMode();else{renderCalendar();await loadAgendaDay()}
  }
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
    // Combos compostos pela JuIA juntam NOMES COMPLETOS do catálogo com " + " — e alguns
    // nomes do catálogo também têm "+" no próprio nome ("Corte + Lavagem"). O split
    // direto quebrava "Corte + Lavagem + Sobrancelha Masculina" em pedaços inexistentes
    // ("Corte", "Lavagem") e só pré-marcava a sobrancelha (caso real do Guilherme,
    // 04/08/2026 — risco de concluir registrando só parte do serviço). Segmentação
    // gulosa: casa o nome de catálogo mais longo no início do restante; sem match,
    // consome até o próximo "+" como pedaço avulso (comportamento antigo).
    const sorted=catalog.map(s=>s.name).sort((a,b)=>b.length-a.length)
    const found=[]
    let rest=name
    while(rest){
      const hit=sorted.find(n=>rest.toLowerCase().startsWith(n.toLowerCase())&&(rest.length===n.length||/^\s*\+/.test(rest.slice(n.length))))
      if(hit){
        found.push(hit)
        rest=rest.slice(hit.length).replace(/^\s*\+\s*/,'').trim()
      }else{
        const idx=rest.indexOf('+')
        const piece=(idx===-1?rest:rest.slice(0,idx)).trim()
        if(piece)found.push(piece)
        rest=idx===-1?'':rest.slice(idx+1).trim()
      }
    }
    return found
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
    style.textContent='.payment-method-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}.payment-method-grid button{border:1px solid rgba(240,201,135,.28);background:#141414;color:#f3f3f3;border-radius:14px;padding:14px 10px;font:inherit;font-weight:700;cursor:pointer}.payment-method-grid button:hover{border-color:var(--gold);color:var(--gold2)}.payment-method-grid button[data-payment="fidelidade"],.payment-method-grid button[data-payment-option="fidelidade"]{grid-column:1/-1}.payment-method-grid button.is-selected{border-color:var(--gold);background:rgba(240,201,135,.12);color:var(--gold2)}.products-modal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0}.products-modal-option{display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 10px;cursor:pointer;font-size:.88rem}.products-modal-option:has(input:checked){border-color:var(--gold);background:rgba(240,201,135,.08)}.products-modal-option small{display:block;color:#999}.booking-edit-card{max-height:88vh;overflow:auto}@media(max-width:600px){.products-modal-grid{grid-template-columns:1fr}}.checkout-total strong{display:block;color:var(--gold2);font-size:1.02rem;line-height:1.15;white-space:nowrap}.checkout-total small{display:block;color:#9a9a9a;font-size:.7rem;margin-top:2px}.checkout-total em{display:block;color:#8fd694;font-style:normal;font-size:.7rem;margin-top:1px}.checkout-footer{position:sticky;bottom:-1px;z-index:6;display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,#1b1712,#0f0c09);border:1px solid rgba(240,201,135,.4);border-radius:13px;padding:8px 12px;margin-top:16px;box-shadow:0 -8px 22px rgba(0,0,0,.55)}.checkout-footer .checkout-total{flex:1;min-width:0;padding:0;margin:0}.checkout-footer [data-payment-confirm]{width:auto;white-space:nowrap;padding:11px 18px;font-size:.9rem;margin:0}.booking-edit-card h3{font-size:.95rem;margin:14px 0 6px}.booking-edit-card .payment-method-grid{gap:8px;margin-top:6px}.booking-edit-card .payment-method-grid button{padding:10px 8px;font-size:.9rem;border-radius:12px}.checkout-split-toggle{display:block;background:none;border:none;color:#999;font:inherit;font-size:.84rem;cursor:pointer;padding:8px 0 0;text-align:left}.checkout-split-toggle:hover{color:var(--gold2)}@keyframes bdj-payment-flash{0%,100%{box-shadow:none}50%{box-shadow:0 0 0 3px rgba(240,201,135,.6)}}.payment-flash{animation:bdj-payment-flash 1s ease 2;border-radius:14px}';
    document.head.appendChild(style);
  }
  // Serviço editável já no "Concluir" (não só no "✎ Editar" depois) — pedido do Juliano
  // após caso real: corte + sobrancelha no balcão, só o corte estava no agendamento
  // original, e não dava pra marcar o serviço extra na hora de concluir.
  //
  // Ganhou um 2º seletor de pagamento OPCIONAL só pros produtos (v28.23.0) — caso real:
  // corte pago no Pix, mas o cliente comprou uma água na hora de sair e pagou no Débito.
  // Por isso deixou de ser "1 clique no pagamento já fecha": agora tem botão "Concluir
  // atendimento" no final, pra dar tempo de escolher os 2 pagamentos antes de enviar.
  function choosePaymentMethod(booking={}){
    return new Promise(resolve=>{
      ensureModalStyles();
      let modal=document.getElementById('payment-method-modal');
      if(!modal){
        modal=document.createElement('div');
        modal.id='payment-method-modal';
        modal.className='admin-modal';
        modal.hidden=true;
        modal.innerHTML='<div class="admin-modal-backdrop" data-payment-cancel></div><section class="admin-modal-card booking-edit-card" role="dialog" aria-modal="true"><button type="button" class="admin-modal-close" data-payment-cancel>&times;</button><h2>Concluir atendimento</h2><p class="privacy-note">Confira o que foi feito de verdade e escolha a forma de pagamento — controle interno pro Financeiro, o cliente não vê esta tela.</p><h3 style="margin-top:14px">Serviço realizado</h3><div data-service-slot></div><h3 style="margin:16px 0 4px">Produtos vendidos <small class="field-help" style="font-weight:400">opcional</small></h3><div data-products-slot></div><h3 style="margin:16px 0 4px">Forma de pagamento</h3><div data-payment-slot></div><button type="button" class="checkout-split-toggle" data-split-toggle>▸ Produtos pagos de outra forma? (raro)</button><div data-products-payment-wrap hidden><h3 style="margin:10px 0 4px">Pagamento dos produtos <small class="field-help" style="font-weight:400">só se for diferente do serviço</small></h3><div data-products-payment-slot></div></div><h3 style="margin:16px 0 4px">Caixinha 💰 <small class="field-help" style="font-weight:400">opcional</small></h3><input type="number" data-tip-amount min="0" step="0.01" inputmode="decimal" placeholder="0,00" style="width:100%;background:#090909;color:var(--text);border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit"><small class="field-help" style="display:block;margin:4px 0 10px">Gorjeta que o cliente deu além do valor. Não entra no faturamento — fica registrada no mês (Financeiro) e no atendimento.</small><label class="admin-checkbox-row" style="margin-top:6px"><input type="checkbox" data-courtesy><small>🎁 Cortesia — por conta da casa (funcionário, gentileza). Sai com R$ 0 no Financeiro, sem forma de pagamento e sem ponto de fidelidade.</small></label><input type="text" data-courtesy-reason maxlength="120" placeholder="Motivo (ex.: João, funcionário)" hidden style="width:100%;background:#090909;color:var(--text);border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit;margin-top:6px"><h3 style="margin:16px 0 4px">Cliente antigo (opcional)</h3><label style="display:block;color:var(--gold2);font-size:.84rem;font-weight:800;margin:0 0 6px">Pontos de fidelidade extra<input type="number" data-loyalty-delta min="-50" max="50" step="1" placeholder="0" style="width:100%;background:#090909;color:var(--text);border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit;margin-top:6px"></label><small class="field-help" style="display:block;margin:-2px 0 10px">Carimbos do cartão de papel de antes do sistema, positivo pra somar. Além do ponto normal que esse atendimento já credita sozinho.</small><label style="display:block;color:var(--gold2);font-size:.84rem;font-weight:800;margin:10px 0 6px">Nº desta visita, contando desde antes do sistema<input type="number" data-visit-number min="1" max="500" step="1" style="width:100%;background:#090909;color:var(--text);border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit;margin-top:6px"></label><small class="field-help" style="display:block;margin:-2px 0 10px">Só preencha se o sistema estiver contando errado — ex.: se este é o 6º corte dele contando os de antes do sistema, digite 6. A etiqueta (1ª visita/recorrente) passa a seguir esse número.</small><div data-google-review-block><label class="admin-checkbox-row" style="margin-top:10px"><input type="checkbox" data-request-google-review checked><small>Pedir avaliação no Google se o cliente ficar satisfeito na pesquisa</small></label><label class="admin-checkbox-row" style="margin-top:6px"><input type="checkbox" data-already-reviewed><small>⭐ Este cliente JÁ avaliou no Google — não pedir mais (fica salvo no cadastro dele)</small></label></div><p class="privacy-note" data-already-reviewed-note hidden style="margin-top:10px">⭐ Este cliente já avaliou no Google — o pedido de avaliação não será enviado.</p><div class="checkout-footer"><div data-checkout-total></div><button type="button" class="btn primary" data-payment-confirm>Concluir ✓</button></div></section>';
        document.body.appendChild(modal);
      }
      modal.querySelector('[data-service-slot]').innerHTML=serviceChecklistHtml(booking.service_name);
      modal.querySelector('[data-products-slot]').innerHTML=productChecklistHtml(parseProducts(booking));
      // v29.49.0 — caso Frei Bartolomeu (19/08): pagou adiantado no Pix (confirmado), e o modal
      // de conclusão ainda perguntava a forma de pagamento. Pix antecipado confirmado = pré-seleciona
      // Pix e avisa; dá pra trocar se por acaso o registro estiver errado.
      const prepaid=!!(booking.prepay_declared_at&&booking.prepay_confirmed_at);
      modal.querySelector('[data-payment-slot]').innerHTML=(prepaid?'<p class="privacy-note" style="margin:4px 0 8px">💸 Este cliente já pagou antecipado no Pix (confirmado por você) — forma de pagamento preenchida.</p>':'')+paymentPickerHtml(prepaid?'pix':'');
      modal.querySelector('[data-products-payment-slot]').innerHTML=paymentPickerHtml('');
      modal.querySelector('[data-request-google-review]').checked=true;
      // v29.65.0 — pedido do Juliano (22/08/2026): um clique "já avaliou no Google" que fica
      // salvo no cadastro (customer_profiles.google_reviewed) — quem já tem a marca nem vê
      // mais a opção de pedir avaliação ao concluir. O flag é lido pelo webhook na pesquisa
      // (customer_already_reviewed, migration 128), então o link do Google não sai mais.
      const reviewBlock=modal.querySelector('[data-google-review-block]');
      const reviewedNote=modal.querySelector('[data-already-reviewed-note]');
      const alreadyBox=modal.querySelector('[data-already-reviewed]');
      alreadyBox.checked=false;
      const reviewProfile=(typeof customerProfiles!=='undefined'?customerProfiles:[]).find(p=>p.phone&&booking.customer_phone&&phoneKey(p.phone)===phoneKey(booking.customer_phone));
      const jaAvaliou=!!(reviewProfile&&(reviewProfile.google_reviewed||reviewProfile.google_review_declared_at));
      reviewBlock.hidden=jaAvaliou;
      reviewedNote.hidden=!jaAvaliou;
      if(jaAvaliou)modal.querySelector('[data-request-google-review]').checked=false;
      const onAlreadyToggle=()=>{if(alreadyBox.checked)modal.querySelector('[data-request-google-review]').checked=false};
      alreadyBox.addEventListener('change',onAlreadyToggle);
      modal.querySelector('[data-loyalty-delta]').value='';
      // v29.20.0 — caixinha e cortesia zeradas a cada abertura do modal
      modal.querySelector('[data-tip-amount]').value='';
      const courtesyBox=modal.querySelector('[data-courtesy]');
      const courtesyReasonInput=modal.querySelector('[data-courtesy-reason]');
      courtesyBox.checked=false;
      courtesyReasonInput.hidden=true;
      courtesyReasonInput.value='';
      const onCourtesyToggle=()=>{
        courtesyReasonInput.hidden=!courtesyBox.checked;
        // cortesia normalmente é funcionário/amigo — não faz sentido pedir avaliação no Google
        if(courtesyBox.checked)modal.querySelector('[data-request-google-review]').checked=false;
      };
      courtesyBox.addEventListener('change',onCourtesyToggle);
      // Placeholder mostra o que o sistema já conta pra esta reserva — o Juliano só digita
      // se discordar (caso Tatiane 12/08: a palavra dele é o dado, o checkbox chutava 6).
      const visitInput=modal.querySelector('[data-visit-number]');
      visitInput.value='';
      visitInput.placeholder=booking.id?`o sistema conta ${visitNumber(booking)}ª`:'';
      let selectedPayment=prepaid?'pix':'',selectedProductsPayment='';
      // v29.84.0 — "checkout" na conclusão (pedido do Juliano, 28/08): total a cobrar sempre
      // visível, descontando o que já foi pago online (Checkout PagBank grava payments.amount_cents;
      // Pix antecipado manual confirmado vale o preço do serviço da reserva).
      const totalBox=modal.querySelector('[data-checkout-total]');
      const paidRow=(booking.payments||[]).find(p=>p&&p.status==='paid');
      const paidLabel=paidRow?({pix:'Pix',credito:'crédito',debito:'débito'}[paidRow.method]||'online'):'Pix';
      const paidValue=paidRow?Number(paidRow.amount_cents||0)/100:(prepaid?Number(booking.service_price||0):0);
      const renderTotal=()=>{
        const sv=readChecklistServices(modal).reduce((a,s)=>a+Number(s.price||0),0);
        const pr=readChecklistProducts(modal).reduce((a,p)=>a+Number(p.price||0),0);
        const isCourtesy=courtesyBox.checked;
        const svShow=isCourtesy?0:sv;
        const due=Math.max(0,svShow+pr-paidValue);
        totalBox.innerHTML=`<div class="checkout-total"><strong>Total a cobrar: ${money(due)}</strong><small>${isCourtesy?'🎁 cortesia (serviço R$ 0)':`serviços ${money(svShow)}`} · produtos ${money(pr)}${paidValue>0?` · <em style="display:inline">✅ pago online (${paidLabel}) −${money(paidValue)}</em>`:''}</small></div>`;
      };
      // v29.86.2 (caso Nelson 109→144): recalcula em QUALQUER mudança no modal, não só nas
      // que a gente previu — o render é barato e idempotente, e um total teimando em ficar
      // velho é pior que um recálculo a mais. Junto: sem rolagem interna nas listas (v29.86.2),
      // nada fica marcado fora da vista.
      const onAnyItemChange=()=>renderTotal();
      modal.addEventListener('change',onAnyItemChange);
      // Toggle do caso raro "produto pago diferente" — recolhido por padrão (enxugada de 28/08)
      const splitToggle=modal.querySelector('[data-split-toggle]');
      const splitWrap=modal.querySelector('[data-products-payment-wrap]');
      splitWrap.hidden=true;
      splitToggle.textContent='▸ Produtos pagos de outra forma? (raro)';
      const onSplitToggle=()=>{
        splitWrap.hidden=!splitWrap.hidden;
        splitToggle.textContent=(splitWrap.hidden?'▸':'▾')+' Produtos pagos de outra forma? (raro)';
        if(splitWrap.hidden){selectedProductsPayment='';splitWrap.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.remove('is-selected'))}
      };
      splitToggle.addEventListener('click',onSplitToggle);
      renderTotal();
      modal.hidden=false;
      // v29.57.0 — caso Aletéia (21/08/2026): a trava da v29.49.0 decidia com o que a PÁGINA
      // tinha carregado. O Pix dela foi registrado e confirmado com a Agenda já aberta, então
      // o modal abriu achando que não havia pagamento nenhum e perguntou a forma de novo —
      // logo pra uma cliente que já tinha pago. Agora o estado do Pix é conferido DIRETO NO
      // BANCO na hora de abrir. E ganha o aviso que faltava: cliente que declarou o Pix e
      // ainda NÃO teve confirmação aparece em destaque, porque a hora de conferir o extrato
      // é essa, antes de fechar o atendimento.
      if(booking.id){
        sb.from('bookings').select('prepay_declared_at,prepay_confirmed_at').eq('id',booking.id).maybeSingle().then(({data:fresh})=>{
          if(!fresh||modal.hidden)return;
          const slot=modal.querySelector('[data-payment-slot]');
          if(!slot)return;
          const jaPago=!!(fresh.prepay_declared_at&&fresh.prepay_confirmed_at);
          const soDeclarado=!!(fresh.prepay_declared_at&&!fresh.prepay_confirmed_at);
          if(jaPago&&!prepaid){
            slot.innerHTML='<p class="privacy-note" style="margin:4px 0 8px">💸 Este cliente já pagou antecipado no Pix (confirmado por você) — forma de pagamento preenchida.</p>'+paymentPickerHtml('pix');
            selectedPayment='pix';
          }else if(soDeclarado){
            slot.insertAdjacentHTML('afterbegin','<p class="privacy-note" style="margin:4px 0 8px;color:var(--gold2);font-weight:700">⚠️ Este cliente diz ter pago por Pix e você ainda não confirmou o recebimento. Confira o extrato antes de concluir.</p>');
          }
        }).catch(()=>{});
      }
      const finish=value=>{modal.hidden=true;cleanup();resolve(value)};
      const onCancel=()=>finish(null);
      const paymentSlot=modal.querySelector('[data-payment-slot]');
      const productsPaymentSlot=modal.querySelector('[data-products-payment-slot]');
      const onPaymentClick=e=>{
        const btn=e.target.closest('[data-payment-option]');
        if(!btn)return;
        selectedPayment=selectedPayment===btn.dataset.paymentOption?'':btn.dataset.paymentOption;
        paymentSlot.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.toggle('is-selected',b.dataset.paymentOption===selectedPayment));
      };
      const onProductsPaymentClick=e=>{
        const btn=e.target.closest('[data-payment-option]');
        if(!btn)return;
        selectedProductsPayment=selectedProductsPayment===btn.dataset.paymentOption?'':btn.dataset.paymentOption;
        productsPaymentSlot.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.toggle('is-selected',b.dataset.paymentOption===selectedProductsPayment));
      };
      const onConfirm=()=>{
        const services=readChecklistServices(modal);
        if(!services.length){alert('Selecione ao menos um serviço.');return}
        // v29.20.0: cortesia dispensa forma de pagamento (não há pagamento)
        const isCourtesy=courtesyBox.checked;
        // v29.88.0 (pedido do Juliano, 28/08): faltou pagamento → além do aviso, a tela rola
        // sozinha até a seção e ela pisca — ele só escolhe e finaliza, sem procurar onde é.
        if(!selectedPayment&&!isCourtesy){
          alert('Escolha a forma de pagamento (ou marque Cortesia se for por conta da casa).');
          paymentSlot.scrollIntoView({behavior:'smooth',block:'center'});
          paymentSlot.classList.remove('payment-flash');void paymentSlot.offsetWidth;paymentSlot.classList.add('payment-flash');
          return
        }
        finish({
          payment:isCourtesy?(selectedPayment||''):selectedPayment,
          products_payment_method:selectedProductsPayment||null,
          products:readChecklistProducts(modal),
          service:{name:services.map(s=>s.name).join(' + '),price:services.reduce((a,s)=>a+s.price,0),duration_minutes:services.reduce((a,s)=>a+s.duration,0)},
          request_google_review:modal.querySelector('[data-request-google-review]').checked&&!alreadyBox.checked&&!jaAvaliou,
          mark_google_reviewed:alreadyBox.checked,
          loyalty_delta:Number(modal.querySelector('[data-loyalty-delta]').value)||0,
          visit_number:Math.floor(Number(modal.querySelector('[data-visit-number]').value))||0,
          tip_amount:Math.max(0,Number(modal.querySelector('[data-tip-amount]').value))||0,
          courtesy:isCourtesy,
          courtesy_reason:isCourtesy?courtesyReasonInput.value.trim():'',
        });
      };
      const cancelEls=modal.querySelectorAll('[data-payment-cancel]');
      const confirmEl=modal.querySelector('[data-payment-confirm]');
      function cleanup(){cancelEls.forEach(el=>el.removeEventListener('click',onCancel));paymentSlot.removeEventListener('click',onPaymentClick);productsPaymentSlot.removeEventListener('click',onProductsPaymentClick);confirmEl.removeEventListener('click',onConfirm);courtesyBox.removeEventListener('change',onCourtesyToggle);alreadyBox.removeEventListener('change',onAlreadyToggle);modal.removeEventListener('change',onAnyItemChange);splitToggle.removeEventListener('click',onSplitToggle)}
      cancelEls.forEach(el=>el.addEventListener('click',onCancel));
      paymentSlot.addEventListener('click',onPaymentClick);
      productsPaymentSlot.addEventListener('click',onProductsPaymentClick);
      confirmEl.addEventListener('click',onConfirm);
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
        modal.innerHTML='<div class="admin-modal-backdrop" data-edit-cancel></div><section class="admin-modal-card booking-edit-card" role="dialog" aria-modal="true"><button type="button" class="admin-modal-close" data-edit-cancel>&times;</button><h2>✎ Editar atendimento</h2><p class="privacy-note">Ajuste o que foi realizado de verdade — funciona pra qualquer agendamento (site ou balcão), concluído ou não.</p><h3 style="margin-top:14px">Serviço realizado</h3><div data-service-slot></div><h3 style="margin-top:16px">Produtos vendidos <small class="field-help" style="font-weight:400">opcional</small></h3><div data-products-slot></div><h3 style="margin-top:16px">Forma de pagamento <small class="field-help" style="font-weight:400">opcional</small></h3><div data-payment-slot></div><button type="button" class="checkout-split-toggle" data-split-toggle>▸ Produtos pagos de outra forma? (raro)</button><div data-products-payment-wrap hidden><h3 style="margin:10px 0 4px">Pagamento dos produtos <small class="field-help" style="font-weight:400">só se for diferente do serviço</small></h3><div data-products-payment-slot></div></div><button type="button" class="btn primary" data-edit-save style="width:100%;margin-top:16px">Salvar alterações</button></section>';
        document.body.appendChild(modal);
      }
      modal.querySelector('[data-service-slot]').innerHTML=serviceChecklistHtml(booking.service_name);
      modal.querySelector('[data-products-slot]').innerHTML=productChecklistHtml(parseProducts(booking));
      modal.querySelector('[data-payment-slot]').innerHTML=paymentPickerHtml(booking.payment_method||'');
      modal.querySelector('[data-products-payment-slot]').innerHTML=paymentPickerHtml(booking.products_payment_method||'');
      let selectedPayment=booking.payment_method||'',selectedProductsPayment=booking.products_payment_method||'';
      // v29.84.0 — caso raro recolhido por padrão; abre já expandido se o registro tem
      // pagamento de produto diferente gravado (senão o dado ficaria invisível ao editar).
      const splitToggle=modal.querySelector('[data-split-toggle]');
      const splitWrap=modal.querySelector('[data-products-payment-wrap]');
      splitWrap.hidden=!selectedProductsPayment;
      splitToggle.textContent=(splitWrap.hidden?'▸':'▾')+' Produtos pagos de outra forma? (raro)';
      const onSplitToggle=()=>{
        splitWrap.hidden=!splitWrap.hidden;
        splitToggle.textContent=(splitWrap.hidden?'▸':'▾')+' Produtos pagos de outra forma? (raro)';
        if(splitWrap.hidden){selectedProductsPayment='';splitWrap.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.remove('is-selected'))}
      };
      splitToggle.addEventListener('click',onSplitToggle);
      modal.hidden=false;
      const finish=value=>{modal.hidden=true;cleanup();resolve(value)};
      const onCancel=()=>finish(null);
      const paymentSlot=modal.querySelector('[data-payment-slot]');
      const productsPaymentSlot=modal.querySelector('[data-products-payment-slot]');
      const onPaymentClick=e=>{
        const btn=e.target.closest('[data-payment-option]');
        if(!btn)return;
        selectedPayment=selectedPayment===btn.dataset.paymentOption?'':btn.dataset.paymentOption;
        paymentSlot.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.toggle('is-selected',b.dataset.paymentOption===selectedPayment));
      };
      const onProductsPaymentClick=e=>{
        const btn=e.target.closest('[data-payment-option]');
        if(!btn)return;
        selectedProductsPayment=selectedProductsPayment===btn.dataset.paymentOption?'':btn.dataset.paymentOption;
        productsPaymentSlot.querySelectorAll('[data-payment-option]').forEach(b=>b.classList.toggle('is-selected',b.dataset.paymentOption===selectedProductsPayment));
      };
      const onSave=()=>{
        const services=readChecklistServices(modal);
        if(!services.length){alert('Selecione ao menos um serviço.');return}
        finish({
          service:{name:services.map(s=>s.name).join(' + '),price:services.reduce((a,s)=>a+s.price,0),duration_minutes:services.reduce((a,s)=>a+s.duration,0)},
          products:readChecklistProducts(modal),
          payment_method:selectedPayment||null,
          products_payment_method:selectedProductsPayment||null,
        });
      };
      const cancelEls=modal.querySelectorAll('[data-edit-cancel]');
      const saveEl=modal.querySelector('[data-edit-save]');
      function cleanup(){cancelEls.forEach(el=>el.removeEventListener('click',onCancel));paymentSlot.removeEventListener('click',onPaymentClick);productsPaymentSlot.removeEventListener('click',onProductsPaymentClick);saveEl.removeEventListener('click',onSave);splitToggle.removeEventListener('click',onSplitToggle)}
      cancelEls.forEach(el=>el.addEventListener('click',onCancel));
      paymentSlot.addEventListener('click',onPaymentClick);
      productsPaymentSlot.addEventListener('click',onProductsPaymentClick);
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
      if(result.products_payment_method)body.products_payment_method=result.products_payment_method;
      const {data,error}=await sb.functions.invoke('admin-booking-status',{body});
      if(error||data?.error){alert(data?.error||error?.message||'Não foi possível salvar as alterações.');return}
      await loadBaseData();if(page==='atendimento')renderServiceMode();else{renderCalendar();await loadAgendaDay()}
    }finally{if(trigger&&trigger.isConnected){trigger.disabled=false;trigger.textContent=oldText}}
  }
  async function setStatus(id,status,trigger=null){
    let paymentMethod=null,completionProducts=null,completionService=null,completionProductsPayment=null,completionRequestGoogleReview=null,completionMarkGoogleReviewed=false,completionLoyaltyDelta=0,completionVisitNumber=0,completionTipAmount=0,completionCourtesy=false,completionCourtesyReason='';
    if(status==='completed'){
      const booking=allBookings.find(x=>x.id===id);
      const choice=await choosePaymentMethod(booking||{});
      if(!choice)return;
      paymentMethod=choice.payment;
      completionProducts=choice.products;
      completionService=choice.service;
      completionProductsPayment=choice.products_payment_method;
      completionRequestGoogleReview=choice.request_google_review;
      completionMarkGoogleReviewed=Boolean(choice.mark_google_reviewed);
      completionLoyaltyDelta=choice.loyalty_delta||0;
      completionVisitNumber=choice.visit_number||0;
      completionTipAmount=choice.tip_amount||0;
      completionCourtesy=Boolean(choice.courtesy);
      completionCourtesyReason=choice.courtesy_reason||'';
    }else{
      const prompts={no_show:'Registrar ausência?',cancelled:'Cancelar e liberar o horário? O cliente receberá um e-mail de aviso caso tenha e-mail cadastrado.'};
      if(prompts[status]&&!confirm(prompts[status]))return;
    }
    const booking=allBookings.find(x=>x.id===id),button=trigger||document.querySelector(`[data-status="${status}"][data-id="${id}"]`),oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent=({cancelled:'Cancelando…',completed:'Concluindo…',no_show:'Salvando…',confirmed:'Confirmando…'})[status]||'Salvando…'}
    try{
      const body={booking_id:id,status};
      if(paymentMethod)body.payment_method=paymentMethod;
      if(completionProductsPayment)body.products_payment_method=completionProductsPayment;
      if(completionProducts)body.selected_products=completionProducts;
      if(completionService)body.service=completionService;
      if(typeof completionRequestGoogleReview==='boolean')body.request_google_review=completionRequestGoogleReview;
      // v29.65.0 — "já avaliou no Google": grava no cadastro (function) e atualiza o cache local
      // na hora, pra próxima conclusão deste cliente já abrir sem a opção de pedir avaliação.
      if(completionMarkGoogleReviewed){
        body.mark_google_reviewed=true;
        const prof=(typeof customerProfiles!=='undefined'?customerProfiles:[]).find(p=>p.phone&&booking?.customer_phone&&phoneKey(p.phone)===phoneKey(booking.customer_phone));
        if(prof){prof.google_reviewed=true;prof.google_review_declared_at=prof.google_review_declared_at||new Date().toISOString()}
      }
      // v29.12.0: extras (pontos antigos + cliente recorrente) vão JUNTO no mesmo pedido.
      // Antes eram um sb.rpc separado daqui do navegador, e em 11/08/2026 falharam calados
      // em 3 conclusões seguidas. Agora quem chama a RPC é a própria function, com o JWT de
      // admin já validado, e devolve em data.extras se aplicou ou o motivo da recusa.
      if(completionLoyaltyDelta)body.loyalty_delta=completionLoyaltyDelta;
      if(completionVisitNumber>=1)body.visit_number=completionVisitNumber;
      // v29.20.0: caixinha (fora do faturamento) e cortesia (serviço por conta da casa)
      if(completionTipAmount>0)body.tip_amount=completionTipAmount;
      if(completionCourtesy){body.courtesy=true;if(completionCourtesyReason)body.courtesy_reason=completionCourtesyReason}
      const {data,error}=await sb.functions.invoke('admin-booking-status',{body});
      if(error||data?.error){const raw=data?.error||error?.message||'';alert(raw.includes('non-2xx')?'Não foi possível concluir esta ação. Atualize a página e tente novamente.':raw||'Não foi possível atualizar o agendamento.');return}
      if(data?.extras?.attempted&&!data.extras.applied){alert(`Atendimento concluído, mas os extras (pontos de fidelidade / nº da visita) NÃO foram salvos: ${data.extras.error||'motivo desconhecido'}`)}
      await loadBaseData();if(page==='atendimento')renderServiceMode();else{renderCalendar();await loadAgendaDay()}
      if(status==='cancelled'){
        if(data?.email?.skipped)alert('Agendamento cancelado. O cliente não recebeu e-mail porque não há e-mail cadastrado.');
        else if(data?.email?.attempted&&!data?.email?.sent)alert(`Agendamento cancelado, mas o e-mail não pôde ser enviado.

${data?.email?.error||'Verifique os registros da função.'}`);
        else if(data?.email?.sent)alert('Agendamento cancelado e e-mail enviado ao cliente.')
      }
      // v29.12.0: o texto antigo dizia "em aproximadamente 2 horas" e que sem e-mail não
      // haveria pesquisa — as duas coisas ficaram falsas: a pesquisa sai pelo WhatsApp e
      // agora é disparada na hora da conclusão (o cron de 15 min virou só rede de segurança).
      if(status==='completed'&&booking){alert('Atendimento concluído. A pesquisa de satisfação já foi disparada pelo WhatsApp do cliente.')}
    }finally{if(button&&button.isConnected){button.disabled=false;button.textContent=oldText}}
  }
  async function loadBlocks(){const box=$('agenda-block-list'),{data,error}=await sb.from('schedule_blocks').select('*').eq('block_date',selectedDate).order('start_time',{ascending:true,nullsFirst:true});if(error){box.innerHTML=`<div class="admin-empty">${esc(error.message)}</div>`;return}box.innerHTML=(data||[]).length?data.map(x=>`<div class="admin-block-row"><div><strong>${x.all_day?'Dia inteiro':`${x.start_time.slice(0,5)}–${x.end_time.slice(0,5)}`}</strong><small>${esc(x.reason||'Bloqueio administrativo')}</small></div><button data-delete-block="${x.id}">Liberar</button></div>`).join(''):'<div class="admin-empty">Nenhum bloqueio nesta data.</div>';box.querySelectorAll('[data-delete-block]').forEach(b=>b.onclick=()=>deleteBlock(b.dataset.deleteBlock))}
  // v28.31.1: bloqueio em INTERVALO de dias (pedido do Juliano, 31/07/2026, depois de uma
  // viagem em que ele teve que bloquear dia a dia) — só disponível com "Fechar o dia
  // inteiro" marcado (bloqueio parcial de horário não faz sentido replicado por vários
  // dias). Cria uma linha por dia, cada uma "dia inteiro", mesmo motivo em todas — e é
  // exatamente essa lista (schedule_blocks all_day=true) que a JuIA agora lê pra saber
  // que está fechada excepcionalmente (ver ju-ia-site/index.ts).
  async function saveBlock(){
   const allDay=$('block-all-day').checked,start=$('block-start').value,end=$('block-end').value,rangeEnd=$('block-range-end').value,msg=$('block-message')
   if(!allDay&&(!start||!end||start>=end)){msg.textContent='Informe um intervalo válido.';return}
   const reason=$('block-reason').value.trim()||null
   let dates=[selectedDate]
   if(allDay&&rangeEnd){
    if(rangeEnd<selectedDate){msg.textContent='A data final precisa ser depois da inicial.';return}
    dates=[]
    const cursor=new Date(selectedDate+'T12:00:00'),last=new Date(rangeEnd+'T12:00:00')
    while(cursor<=last){dates.push(isoLocal(cursor));cursor.setDate(cursor.getDate()+1)}
    if(dates.length>60){msg.textContent='Intervalo grande demais (máximo 60 dias). Confira as datas.';return}
   }
   msg.textContent='Salvando...'
   const rows=dates.map(d=>({block_date:d,all_day:allDay,start_time:allDay?null:start,end_time:allDay?null:end,reason}))
   const {error}=await sb.from('schedule_blocks').insert(rows)
   msg.textContent=error?error.message:(dates.length>1?`${dates.length} dias bloqueados.`:'Bloqueio criado.')
   if(!error){$('block-reason').value='';$('block-range-end').value='';await refreshCalendar();await loadBlocks()}
  }
  async function deleteBlock(id){if(!confirm('Liberar este bloqueio?'))return;const {error}=await sb.from('schedule_blocks').delete().eq('id',id);if(error)alert(error.message);else loadBlocks()}
