(() => {
  const cfg=window.BDJ_AGENDA_CONFIG||{};
  const configured=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey);
  const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  const $=id=>document.getElementById(id), money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const allServices=window.BDJ_SERVICES||[];
  let services=JSON.parse(sessionStorage.getItem('bdj_selected_services_v15')||'[]');
  let products=JSON.parse(sessionStorage.getItem('bdj_selected_products_v15')||'[]');
  let selectedTime='', step=1;
  const productCatalog=[
    {name:'Pasta Matte 150g',price:34,for:['Corte','Lavagem','Luzes','Platinado']},
    {name:'Gel Cola Black Shark Barber',price:16,for:['Corte','Freestyle']},
    {name:'Óleo Para Barba 30mL',price:36,for:['Barba','Barboterapia']},
    {name:'Balm Para Barba 150g',price:35,for:['Barba','Barboterapia']},
    {name:'Shampoo Para Barba 240mL',price:35,for:['Barba','Barboterapia']},
    {name:'Pomada em pó',price:35,for:['Corte','Freestyle']}
  ];
  const total=()=>({duration:services.reduce((a,b)=>a+Number(b.duration||0),0),servicePrice:services.reduce((a,b)=>a+Number(b.price||0),0),productPrice:products.reduce((a,b)=>a+Number(b.price||0),0)});
  const fmtDuration=m=>m>=60?(m%60?`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`:`${m/60}h`):`${m} min`;
  const addMinutes=(time,mins)=>{const [h,m]=time.split(':').map(Number),d=new Date(2000,0,1,h,m+mins);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  const spNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
  const addDaysISO=(iso,days)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  const dayOfWeek=iso=>new Date(`${iso}T12:00:00Z`).getUTCDay();
  const isOpenDay=iso=>{const d=dayOfWeek(iso);return d>=2&&d<=6};
  const closingMinutes=iso=>dayOfWeek(iso)===6?15*60:19*60;
  const prettyDate=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  function firstEligibleDate(){
    const now=spNow(),today=`${now.year}-${now.month}-${now.day}`;
    if(!isOpenDay(today))return nextOpenDay(today,1);
    const current=Number(now.hour)*60+Number(now.minute),needed=current+15+total().duration;
    return needed<=closingMinutes(today)?today:nextOpenDay(today,1);
  }
  function nextOpenDay(iso,step=1){let d=iso;for(let i=0;i<8;i++){d=addDaysISO(d,step);if(isOpenDay(d))return d}return d}
  function saveState(){sessionStorage.setItem('bdj_selected_services_v15',JSON.stringify(services));sessionStorage.setItem('bdj_selected_products_v15',JSON.stringify(products));}
  function fire(event,data={}){window.dataLayer=window.dataLayer||[];window.dataLayer.push({event,...data});}
  function serviceIndex(name){return allServices.findIndex(s=>s.name===name)}
  function renderSelected(){
    const box=$('selected-services-v15'), empty=$('empty-services-v15'); box.innerHTML='';
    if(!services.length){empty.hidden=false;$('service-upsell-v15').hidden=true;document.querySelector('[data-next-step="2"]').disabled=true;return}
    empty.hidden=true;$('service-upsell-v15').hidden=false;document.querySelector('[data-next-step="2"]').disabled=false;
    box.innerHTML=`<div class="booking-selected-list">${services.map((s,i)=>`<article class="booking-selected-item"><div><strong>${s.name}</strong><small>${fmtDuration(s.duration)} · ${money(s.price)}</small></div><button type="button" data-remove-service="${i}" aria-label="Remover ${s.name}">×</button></article>`).join('')}</div>`;
    const names=services.map(s=>s.name).join(' ');
    const suggestions=[];
    const add=n=>{const i=serviceIndex(n);if(i>=0&&!services.some(s=>s.name===n)&&!suggestions.includes(i))suggestions.push(i)};
    if(/Corte|Lavagem|Luzes|Platinado|Relaxamento/.test(names)){add('Sobrancelha Masculina');add('Barba Express');add('Depilação nasal (cera quente)');add('Hidratação / Reconstrução Capilar')}
    if(/Barba|Barboterapia/.test(names)){add('Pigmentação de Barba');add('Depilação nasal (cera quente)');add('Sobrancelha Masculina')}
    if(!suggestions.length){add('Sobrancelha Masculina');add('Depilação nasal (cera quente)')}
    $('service-suggestions-v15').innerHTML=suggestions.slice(0,4).map(i=>{const s=allServices[i];return `<button type="button" class="booking-suggestion-card" data-add-service="${i}"><span>＋</span><strong>${s.name}</strong><small>+ ${fmtDuration(s.duration)} · ${money(s.price)}</small></button>`}).join('');
    renderProducts();updateSummary();saveState();
  }
  function renderProducts(){
    const names=services.map(s=>s.name).join(' ');
    let list=productCatalog.filter(p=>p.for.some(k=>names.includes(k))).slice(0,4);if(!list.length)list=productCatalog.slice(0,4);
    $('product-suggestions-v15').innerHTML=list.map(p=>{const active=products.some(x=>x.name===p.name);return `<button type="button" class="booking-suggestion-card ${active?'is-selected':''}" data-product="${p.name}"><span>${active?'✓':'＋'}</span><strong>${p.name}</strong><small>${money(p.price)}</small></button>`}).join('');
  }
  function updateSummary(){
    const t=total(); let html=services.length?`<ul class="agenda-summary-services">${services.map(s=>`<li><span>${s.name}</span><b>${money(s.price)}</b></li>`).join('')}</ul>`:'<p>Escolha seus serviços.</p>';
    if(products.length)html+=`<p class="eyebrow summary-subtitle">Produtos separados</p><ul class="agenda-summary-services">${products.map(p=>`<li><span>${p.name}</span><b>${money(p.price)}</b></li>`).join('')}</ul>`;
    html+=`<div class="booking-summary-total"><span>Total estimado</span><strong>${money(t.servicePrice+t.productPrice)}</strong></div><p class="booking-summary-duration">Atendimento: <strong>${fmtDuration(t.duration)}</strong></p>`;
    const d=$('agenda-date').value;if(d)html+=`<div class="booking-summary-date"><span>Data</span><strong>${new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</strong></div>`;
    if(selectedTime)html+=`<div class="booking-summary-time"><span>Horário</span><strong>${selectedTime} às ${addMinutes(selectedTime,t.duration)}</strong></div>`;
    $('agenda-summary').innerHTML=html;$('review-summary').innerHTML=html;
    $('review-client-note').textContent=[$('agenda-name').value,$('agenda-phone').value,$('agenda-email').value].filter(Boolean).join(' · ');
    updateButtons();
  }
  function validPhone(){return $('agenda-phone').value.replace(/\D/g,'').length>=10}
  function updateButtons(){
    document.querySelector('[data-next-step="3"]').disabled=!selectedTime;
    document.querySelector('[data-next-step="4"]').disabled=!($('agenda-name').value.trim().length>=2&&validPhone()&&(!$('agenda-email').value||$('agenda-email').checkValidity()));
    $('agenda-submit').disabled=!(configured&&services.length&&selectedTime&&$('agenda-name').value.trim().length>=2&&validPhone());
  }
  async function go(n){if(n===2&&!services.length)return;if(n===3&&!selectedTime)return;step=n;document.querySelectorAll('[data-step]').forEach(x=>x.hidden=Number(x.dataset.step)!==n);document.querySelectorAll('[data-progress-step]').forEach(x=>x.classList.toggle('is-active',Number(x.dataset.progressStep)<=n));window.scrollTo({top:0,behavior:'smooth'});updateSummary();if(n===2&&!$('agenda-date').value){$('agenda-date').value=firstEligibleDate();await loadSlots({autoAdvance:true,reason:'initial'})}}
  async function fetchAvailableSlots(date){
    const {data,error}=await sb.rpc('get_available_slots',{p_date:date,p_duration_minutes:total().duration});
    if(error)throw error;
    let slots=(data||[]).map(r=>String(r.slot_time).slice(0,5));
    const now=spNow(),todaySp=`${now.year}-${now.month}-${now.day}`;
    if(date===todaySp){const minMinutes=Number(now.hour)*60+Number(now.minute)+15;slots=slots.filter(time=>{const [h,m]=time.split(':').map(Number);return h*60+m>=minMinutes})}
    return slots;
  }
  async function findNextDateWithSlots(startDate,includeStart=false){
    let date=includeStart?startDate:addDaysISO(startDate,1);
    for(let i=0;i<30;i++){
      if(isOpenDay(date)){
        const slots=await fetchAvailableSlots(date);
        if(slots.length)return {date,slots};
      }
      date=addDaysISO(date,1);
    }
    return null;
  }
  async function loadSlots(options={}){
    selectedTime='';let date=$('agenda-date').value,box=$('agenda-slots');box.innerHTML='';
    if(!date||!services.length){$('agenda-day-message').textContent='Escolha uma data';updateSummary();return}
    fire('date_selected',{booking_date:date});$('agenda-day-message').textContent='Consultando...';
    try{
      if(!isOpenDay(date)){
        const next=await findNextDateWithSlots(date,false);
        if(next){$('agenda-date').value=next.date;date=next.date;renderSlots(next.slots);$('agenda-day-message').textContent=`Fechado nessa data. Próximo dia disponível: ${prettyDate(date)}`;updateSummary();return}
      }
      let slots=await fetchAvailableSlots(date);
      if(!slots.length&&options.autoAdvance!==false){
        const next=await findNextDateWithSlots(date,false);
        if(next){$('agenda-date').value=next.date;date=next.date;slots=next.slots;renderSlots(slots);const prefix=options.reason==='initial'?'Próximo dia disponível':'Sem horários nessa data. Próximo dia disponível';$('agenda-day-message').textContent=`${prefix}: ${prettyDate(date)}`;updateSummary();return}
      }
      renderSlots(slots);
      $('agenda-day-message').textContent=slots.length?`${slots.length} horários disponíveis`:'Sem horários disponíveis';updateSummary();
    }catch(error){box.innerHTML='<p>Não foi possível consultar os horários.</p>';$('agenda-day-message').textContent='Erro na consulta';console.error(error)}
  }
  function renderSlots(slots){
    const box=$('agenda-slots');box.innerHTML='';
    if(!slots.length){box.innerHTML='<p class="booking-empty-note">Nenhum horário disponível para este atendimento.</p>';return}
    slots.forEach(time=>{const b=document.createElement('button');b.type='button';b.className='agenda-slot';b.innerHTML=`<strong>${time}</strong><small>disponível</small>`;b.onclick=()=>{document.querySelectorAll('.agenda-slot').forEach(x=>x.classList.remove('is-selected'));b.classList.add('is-selected');selectedTime=time;fire('time_selected',{booking_time:time});updateSummary()};box.appendChild(b)});
  }
  async function submit(){
    const t=total(), names=services.map(s=>s.name), email=$('agenda-email').value.trim()||null;
    $('agenda-submit').disabled=true;$('agenda-submit').textContent='Enviando...';
    const {error}=await sb.rpc('create_public_booking_v15',{p_customer_name:$('agenda-name').value.trim(),p_customer_phone:$('agenda-phone').value.replace(/\D/g,''),p_customer_email:email,p_service_name:names.join(' + '),p_service_price:t.servicePrice,p_duration_minutes:t.duration,p_booking_date:$('agenda-date').value,p_start_time:selectedTime,p_notes:$('agenda-notes').value.trim()||null,p_selected_products:products});
    if(error){alert(error.message.includes('indisponível')||error.message.includes('bloqueado')?error.message:'Não foi possível agendar. Tente novamente.');$('agenda-submit').textContent='Enviar solicitação';$('agenda-submit').disabled=false;await loadSlots();return}
    fire('booking_submitted',{services:names.join(' | '),value:t.servicePrice+t.productPrice,products:products.map(p=>p.name).join(' | ')});
    sessionStorage.removeItem('bdj_selected_services_v15');sessionStorage.removeItem('bdj_selected_products_v15');
    $('agenda-status').innerHTML='<strong>Solicitação recebida!</strong> Seu horário está aguardando confirmação. Você poderá receber o retorno pelo WhatsApp e, futuramente, também pelo e-mail informado.';$('agenda-status').classList.add('is-success');$('agenda-status').scrollIntoView({behavior:'smooth'});$('agenda-submit').textContent='Solicitação enviada';
  }
  document.addEventListener('click',e=>{
    const rm=e.target.closest('[data-remove-service]');if(rm){services.splice(Number(rm.dataset.removeService),1);selectedTime='';renderSelected();return}
    const add=e.target.closest('[data-add-service]');if(add){const s=allServices[Number(add.dataset.addService)];services.push({name:s.name,price:s.price,duration:s.duration});selectedTime='';fire('upsell_service_added',{item_name:s.name,value:s.price});renderSelected();return}
    const prod=e.target.closest('[data-product]');if(prod){const p=productCatalog.find(x=>x.name===prod.dataset.product);const i=products.findIndex(x=>x.name===p.name);if(i>=0)products.splice(i,1);else{products.push({name:p.name,price:p.price});fire('product_added_booking',{item_name:p.name,value:p.price})}renderProducts();updateSummary();saveState();return}
  });
  document.querySelectorAll('[data-next-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.nextStep)));document.querySelectorAll('[data-prev-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.prevStep)));
  $('agenda-date').onchange=()=>loadSlots({autoAdvance:true,reason:'manual'});['agenda-name','agenda-phone','agenda-email','agenda-notes'].forEach(id=>$(id).oninput=updateSummary);$('agenda-submit').onclick=submit;
  const now=spNow();$('agenda-date').min=`${now.year}-${now.month}-${now.day}`;
  renderSelected();$('agenda-status').innerHTML=configured?'<strong>Agenda online.</strong> Confira seu atendimento e escolha o melhor horário.':'<strong>Configuração pendente.</strong> O banco ainda precisa ser conectado.';go(1);
})();
