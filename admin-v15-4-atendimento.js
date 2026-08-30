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
    box.innerHTML=rows.length?rows.map(x=>{
      const actionsHtml=`${primeiraVezHtml(x)}<a href="${whatsappLink(x)}" target="_blank" rel="noopener">WhatsApp</a>${x.status==='pending'?`<button data-status="confirmed" data-id="${x.id}">Confirmar</button>`:''}${['pending','confirmed'].includes(x.status)?`<button class="is-primary" data-status="completed" data-id="${x.id}">Concluir</button><button data-reschedule="${x.id}">Remarcar</button><button data-status="no_show" data-id="${x.id}">Ausência</button>`:''}<button data-edit="${x.id}">✎ Editar</button><button data-return="${x.id}">Retorno</button>`;
      return bookingCardHtml(x,actionsHtml)
    }).join(''):'<div class="admin-empty">Nenhum atendimento para hoje.</div>';
    bindBookingActions(box);
    box.querySelectorAll('[data-firsttime]').forEach(b=>b.onclick=()=>marcarPrimeiraVez(b));
  }

  // v29.98.0 — pergunta de dois estados na cadeira (pedido do Juliano). Grava em
  // customer_profiles.prior_visits pela MESMA rota da conclusao: a Edge Function
  // admin-booking-status, que chama admin_apply_completion_extras com o JWT de admin ja
  // validado. NAO chamar a RPC direto daqui - foi assim que em 11/08/2026 tres marcacoes
  // sumiram caladas (ver comentario da v29.12.0 na function).
  // A RPC recebe o Nº TOTAL da visita: 1 = primeira vez (prior_visits 0), 2 = ja e
  // cliente (prior_visits 1).
  function primeiraVezHtml(x){
    if(!podeMarcarPrimeiraVez(x))return '';
    return `<div class="admin-firsttime"><small>O sistema nunca viu este cliente. Ele ja cortou aqui antes?</small><div class="admin-firsttime-opts"><button type="button" class="is-on" data-firsttime="${x.id}" data-firsttime-n="1">É a primeira vez</button><button type="button" data-firsttime="${x.id}" data-firsttime-n="2">Já é cliente</button></div><em data-firsttime-msg></em></div>`
  }
  async function marcarPrimeiraVez(btn){
    const wrap=btn.closest('.admin-firsttime'),id=btn.dataset.firsttime,n=Number(btn.dataset.firsttimeN);
    const opts=[...wrap.querySelectorAll('[data-firsttime]')],msg=wrap.querySelector('[data-firsttime-msg]');
    opts.forEach(b=>b.disabled=true);msg.textContent='Salvando...';
    let data,error;
    try{({data,error}=await sb.functions.invoke('admin-booking-status',{body:{booking_id:id,visit_number:n}}))}catch(e){error=e}
    opts.forEach(b=>b.disabled=false);
    // extras.applied=false significa que a function respondeu ok mas a gravacao falhou -
    // exatamente o caso que passava batido antes, entao aqui ele conta como erro.
    if(error||data?.error||(data?.extras?.attempted&&!data.extras.applied)){
      msg.textContent='Não salvou: '+(data?.extras?.error||data?.error||error?.message||'tente de novo.');return
    }
    opts.forEach(b=>b.classList.toggle('is-on',b===btn));
    msg.textContent=n>1?'✓ Salvo como cliente antigo — a etiqueta passa a contar a partir da 2ª visita.':'✓ Salvo como primeira vez.';
    // Atualiza o cadastro em memoria e so a etiqueta deste cartao, sem re-renderizar a
    // lista: um re-render faria o controle sumir na hora do clique (ele so aparece pra
    // quem tem prior_visits zerado) e um clique errado ficaria sem como desfazer.
    const bk=allBookings.find(b=>b.id===id);if(!bk)return;
    const prof=customerProfiles.find(p=>phoneKey(p.phone)===phoneKey(bk.customer_phone));
    if(prof)prof.prior_visits=n-1;
    const badge=document.querySelector(`[data-booking-card="${id}"] .admin-visit-badge`);
    if(badge)badge.outerHTML=visitBadgeHtml(bk);
  }