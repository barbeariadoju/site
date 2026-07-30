// admin-v15-4-agendamento.js - parte 6/7 de admin-v15-4.js. Modo Novo
// agendamento / remarcacao (admin-agendamento.html). Ver header de
// admin-v15-4-core.js.
  function initBookingForm(){$('booking-services').innerHTML=renderServicePicker();bindBookingServicePicker();bindCustomerSearch();$('booking-phone').oninput=fillKnownCustomer;$('booking-save').onclick=saveBooking;$('booking-date').value=isoLocal(new Date());$('booking-time').value='08:00';const mode=new URLSearchParams(location.search).get('modo');if(mode==='remarcar')loadRescheduleForm();else{loadPrefillForm();bindDraftAutosave()}}
  // Busca de cliente com dropdown próprio (nome + telefone), no lugar do <input list>+
  // <datalist> nativo — dois problemas reais: 1) o popup nativo do navegador "sequestra"
  // as setas do teclado pra navegar a lista em vez de mover o cursor no texto, impedindo
  // corrigir o que já foi digitado; 2) datalist só devolve o texto da opção escolhida, sem
  // metadado nenhum — com dois clientes de mesmo nome (ex.: "Carlos Rodrigues" duas vezes),
  // não tinha como saber qual foi escolhido, e fillKnownCustomer sempre pegava o primeiro
  // match por nome. Reaproveita o mesmo padrão/CSS já usado no Atendimento Balcão, mas
  // filtra em memória (lista de clientes já carregada) em vez de consultar o banco.
  function bindCustomerSearch(){
    const input=$('booking-name'),box=$('booking-customer-results');
    if(!input||!box)return;
    input.addEventListener('input',()=>{renderCustomerResults(input.value)});
    input.addEventListener('focus',()=>{if(box.innerHTML&&input.value.trim().length>=2)box.hidden=false});
    document.addEventListener('click',e=>{if(!e.target.closest('.balcao-customer-search'))box.hidden=true});
  }
  function renderCustomerResults(term){
    const box=$('booking-customer-results');
    if(!box)return;
    const q=normalizeSearch(term);
    if(q.length<2){box.hidden=true;box.innerHTML='';return}
    const matches=customers.filter(c=>normalizeSearch(c.name).includes(q)).slice(0,8);
    box.hidden=false;
    box.innerHTML=matches.length
      ?matches.map(c=>`<button type="button" data-pick-customer="${c.phone}"><strong>${esc(c.name)}</strong><small>${formatPhone(c.phone)}</small></button>`).join('')
      :'<div class="is-empty">Nenhum cliente encontrado — pode continuar digitando pra cadastrar um novo.</div>';
    box.querySelectorAll('[data-pick-customer]').forEach(btn=>btn.onclick=()=>{
      const c=customers.find(x=>x.phone===btn.dataset.pickCustomer);
      if(!c)return;
      $('booking-name').value=c.name;
      $('booking-phone').value=formatPhone(c.phone);
      box.hidden=true;box.innerHTML='';
      saveDraft();
    });
  }
  // Rascunho salvo a cada mudança (sessionStorage) — caso real: Juliano preenchia data/hora
  // de um agendamento novo, navegava pra outra tela pra conferir algo e voltava, e o
  // formulário tinha voltado tudo pro padrão (hoje, 08:00), perdendo o que já tinha digitado.
  // Só ativo no fluxo normal de "novo agendamento" — remarcação/retorno já têm seu próprio
  // preenchimento e não devem ser sobrescritos por um rascunho velho.
  const DRAFT_KEY='bdj-agendamento-draft';
  function saveDraft(){
    if($('booking-id').value)return;
    sessionStorage.setItem(DRAFT_KEY,JSON.stringify({
      name:$('booking-name').value,
      phone:$('booking-phone').value,
      date:$('booking-date').value,
      time:$('booking-time').value,
      notes:$('booking-notes').value,
      services:selectedServices().map(s=>s.name),
    }));
  }
  function restoreDraft(){
    const raw=sessionStorage.getItem(DRAFT_KEY);
    if(!raw)return false;
    try{
      const d=JSON.parse(raw);
      fillForm({name:d.name,phone:d.phone,date:d.date,time:d.time,notes:d.notes,services:(d.services||[]).join(' + ')});
      return true;
    }catch{return false}
  }
  function bindDraftAutosave(){
    ['booking-name','booking-phone','booking-date','booking-time','booking-notes'].forEach(id=>$(id)?.addEventListener('input',saveDraft));
    $('booking-services')?.addEventListener('change',saveDraft);
  }

  function bindBookingServicePicker(){
    const box=$('booking-services');
    if(!box)return;
    const update=()=>{
      box.querySelectorAll('.booking-service-option').forEach(label=>{
        const input=label.querySelector('input[name="booking-service"]');
        label.classList.toggle('is-selected',Boolean(input?.checked));
      });
      const chosen=selectedServices();
      let summary=$('booking-service-summary');
      if(!summary){
        summary=document.createElement('div');
        summary.id='booking-service-summary';
        summary.className='booking-service-summary';
        box.parentNode.insertBefore(summary,box.nextSibling);
      }
      if(!chosen.length){summary.innerHTML='<span>Nenhum serviço selecionado.</span>';return}
      const duration=chosen.reduce((a,s)=>a+Number(s.duration||0),0);
      const total=chosen.reduce((a,s)=>a+Number(s.price||0),0);
      summary.innerHTML=`<strong>${chosen.length} serviço${chosen.length>1?'s':''} selecionado${chosen.length>1?'s':''}</strong><span>${duration} min • ${money(total)}</span>`;
    };
    box.addEventListener('change',update);
    box.querySelectorAll('.booking-service-option').forEach(label=>label.addEventListener('click',e=>{
      if(e.target.matches('input'))return;
      const input=label.querySelector('input[name="booking-service"]');
      if(input){input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));e.preventDefault()}
    }));
    update();
  }

  function renderServicePicker(){const groups={};catalog.forEach(s=>(groups[s.category]??=[]).push(s));return Object.entries(groups).map(([cat,items])=>`<section class="booking-service-group"><h3>${esc(cat)}</h3><div>${items.map(s=>`<label class="booking-service-option"><input type="checkbox" name="booking-service" value="${esc(s.name)}"><span><strong>${esc(s.name)}</strong><small>${s.duration} min • ${money(s.price)}</small><i>✓</i></span></label>`).join('')}</div></section>`).join('')}
  function fillKnownCustomer(){const n=$('booking-name').value.trim().toLowerCase(),p=phoneDigits($('booking-phone').value),c=customers.find(x=>x.phone===p||x.name.toLowerCase()===n);if(c){$('booking-name').value=c.name;$('booking-phone').value=c.phone}}
  function selectedServices(){return [...document.querySelectorAll('input[name="booking-service"]:checked')].map(i=>catalog.find(s=>s.name===i.value)).filter(Boolean)}
  function selectServicesByNames(text=''){const names=text.split(' + ').map(s=>s.trim());document.querySelectorAll('input[name="booking-service"]').forEach(i=>{const s=catalog.find(x=>x.name===i.value);i.checked=!!s&&names.includes(s.name);i.dispatchEvent(new Event('change',{bubbles:true}))})}
  function prefillReturnStorage(x){if(!x)return;const d=new Date(x.booking_date+'T12:00:00');d.setDate(d.getDate()+15);sessionStorage.setItem('bdj-prefill-booking',JSON.stringify({name:x.customer_name,phone:x.customer_phone,date:isoLocal(d),time:x.start_time.slice(0,5),services:x.service_name,notes:'Retorno'}))}
  function loadPrefillForm(){const raw=sessionStorage.getItem('bdj-prefill-booking'),cRaw=sessionStorage.getItem('bdj-prefill-customer');if(raw){const x=JSON.parse(raw);fillForm(x);sessionStorage.removeItem('bdj-prefill-booking')}else if(cRaw){const c=JSON.parse(cRaw);fillForm({name:c.name,phone:c.phone,date:isoLocal(new Date()),time:'08:00',services:c.lastServices,notes:'Retorno'});sessionStorage.removeItem('bdj-prefill-customer')}else restoreDraft()}
  function fillForm(x){$('booking-name').value=x.name||'';$('booking-phone').value=x.phone||'';$('booking-date').value=x.date||isoLocal(new Date());$('booking-time').value=x.time||'08:00';$('booking-notes').value=x.notes||'';selectServicesByNames(x.services||'')}
  async function loadRescheduleForm(){const id=sessionStorage.getItem('bdj-reschedule-id');if(!id)return;const x=allBookings.find(r=>r.id===id);if(!x)return;$('booking-id').value=x.id;setText('booking-page-title','Remarcar agendamento');setText('booking-save-label','Salvar remarcação');fillForm({name:x.customer_name,phone:x.customer_phone,date:x.booking_date,time:x.start_time.slice(0,5),services:x.service_name,notes:x.notes||''});$('booking-name').disabled=true;$('booking-phone').disabled=true}
  async function saveBooking(){const services=selectedServices(),msg=$('booking-message');if(!$('booking-name').value.trim()||phoneDigits($('booking-phone').value).length<10||!services.length){msg.textContent='Informe cliente, WhatsApp e ao menos um serviço.';return}const base={p_booking_date:$('booking-date').value,p_start_time:$('booking-time').value,p_service_name:services.map(s=>s.name).join(' + '),p_service_price:services.reduce((a,s)=>a+s.price,0),p_duration_minutes:services.reduce((a,s)=>a+s.duration,0),p_notes:$('booking-notes').value||null,p_allow_outside_hours:Boolean($('booking-allow-outside-hours')?.checked)};msg.textContent='Salvando...';let error;if($('booking-id').value)({error}=await sb.rpc('admin_reschedule_booking',{p_booking_id:$('booking-id').value,...base}));else({error}=await sb.rpc('admin_create_booking',{p_customer_name:$('booking-name').value.trim(),p_customer_phone:$('booking-phone').value,...base}));if(error){msg.textContent=friendlyDb(error.message);return}sessionStorage.removeItem(DRAFT_KEY);msg.textContent=$('booking-id').value?'Agendamento remarcado.':'Agendamento criado.';setTimeout(()=>location.href=`admin-agenda.html?data=${$('booking-date').value}`,700)}
