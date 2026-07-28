// admin-v15-4-agendamento.js - parte 6/7 de admin-v15-4.js. Modo Novo
// agendamento / remarcacao (admin-agendamento.html). Ver header de
// admin-v15-4-core.js.
  function initBookingForm(){$('booking-services').innerHTML=renderServicePicker();bindBookingServicePicker();const dl=$('booking-customer-list');dl.innerHTML=customers.map(c=>`<option value="${esc(c.name)}" data-phone="${c.phone}"></option>`).join('');$('booking-name').oninput=fillKnownCustomer;$('booking-phone').oninput=fillKnownCustomer;$('booking-save').onclick=saveBooking;$('booking-date').value=isoLocal(new Date());$('booking-time').value='08:00';const mode=new URLSearchParams(location.search).get('modo');if(mode==='remarcar')loadRescheduleForm();else loadPrefillForm()}

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
  function loadPrefillForm(){const raw=sessionStorage.getItem('bdj-prefill-booking'),cRaw=sessionStorage.getItem('bdj-prefill-customer');if(raw){const x=JSON.parse(raw);fillForm(x);sessionStorage.removeItem('bdj-prefill-booking')}else if(cRaw){const c=JSON.parse(cRaw);fillForm({name:c.name,phone:c.phone,date:isoLocal(new Date()),time:'08:00',services:c.lastServices,notes:'Retorno'});sessionStorage.removeItem('bdj-prefill-customer')}}
  function fillForm(x){$('booking-name').value=x.name||'';$('booking-phone').value=x.phone||'';$('booking-date').value=x.date||isoLocal(new Date());$('booking-time').value=x.time||'08:00';$('booking-notes').value=x.notes||'';selectServicesByNames(x.services||'')}
  async function loadRescheduleForm(){const id=sessionStorage.getItem('bdj-reschedule-id');if(!id)return;const x=allBookings.find(r=>r.id===id);if(!x)return;$('booking-id').value=x.id;setText('booking-page-title','Remarcar agendamento');setText('booking-save-label','Salvar remarcação');fillForm({name:x.customer_name,phone:x.customer_phone,date:x.booking_date,time:x.start_time.slice(0,5),services:x.service_name,notes:x.notes||''});$('booking-name').disabled=true;$('booking-phone').disabled=true}
  async function saveBooking(){const services=selectedServices(),msg=$('booking-message');if(!$('booking-name').value.trim()||phoneDigits($('booking-phone').value).length<10||!services.length){msg.textContent='Informe cliente, WhatsApp e ao menos um serviço.';return}const base={p_booking_date:$('booking-date').value,p_start_time:$('booking-time').value,p_service_name:services.map(s=>s.name).join(' + '),p_service_price:services.reduce((a,s)=>a+s.price,0),p_duration_minutes:services.reduce((a,s)=>a+s.duration,0),p_notes:$('booking-notes').value||null,p_allow_outside_hours:Boolean($('booking-allow-outside-hours')?.checked)};msg.textContent='Salvando...';let error;if($('booking-id').value)({error}=await sb.rpc('admin_reschedule_booking',{p_booking_id:$('booking-id').value,...base}));else({error}=await sb.rpc('admin_create_booking',{p_customer_name:$('booking-name').value.trim(),p_customer_phone:$('booking-phone').value,...base}));if(error){msg.textContent=friendlyDb(error.message);return}msg.textContent=$('booking-id').value?'Agendamento remarcado.':'Agendamento criado.';setTimeout(()=>location.href=`admin-agenda.html?data=${$('booking-date').value}`,700)}
