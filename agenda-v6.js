(() => {
const SERVICES=[
{name:'Corte + Lavagem',price:50,duration:40},
{name:'Corte de cabelo',price:40,duration:30},
{name:'Corte + Barboterapia',price:80,duration:60},
{name:'Corte + Barba Express',price:65,duration:50},
{name:'Barboterapia com vaporizador de ozônio',price:50,duration:40},
{name:'Barboterapia',price:40,duration:30},
{name:'Barba Express',price:25,duration:20},
{name:'Pezinho (acabamento)',price:15,duration:10},
{name:'Sobrancelha Masculina',price:15,duration:10},
{name:'Depilação nasal (cera quente)',price:25,duration:20},
{name:'Depilação orelhas',price:25,duration:20},
{name:'Freestyle (risquinho)',price:15,duration:10},
{name:'Nevou / Platinado',price:150,duration:120},
{name:'Luzes',price:120,duration:90},
{name:'Alisamento / Relaxamento',price:70,duration:45},
{name:'Pigmentação Capilar (Tintura)',price:50,duration:30},
{name:'Hidratação / Reconstrução Capilar',price:40,duration:20},
{name:'Pigmentação de Barba',price:35,duration:20},
{name:'Pigmentação de Sobrancelha',price:20,duration:20}
];
const cfg=window.BDJ_AGENDA_CONFIG||{}; const configured=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey);
const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const $=id=>document.getElementById(id); let selectedTime=''; let selectedServices=[];
const date=$('agenda-date'), slots=$('agenda-slots'), status=$('agenda-status'), submit=$('agenda-submit'), servicesBox=$('agenda-services');
const pad=n=>String(n).padStart(2,'0'); const money=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const today=new Date(); date.min=`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
function totals(){return selectedServices.reduce((a,i)=>({price:a.price+SERVICES[i].price,duration:a.duration+SERVICES[i].duration}),{price:0,duration:0})}
function renderServices(){servicesBox.innerHTML=SERVICES.map((s,i)=>`<button type="button" class="agenda-service-option" data-index="${i}" aria-pressed="false"><span><strong>${s.name}</strong><small>${s.duration} min</small></span><b>${money(s.price)}</b></button>`).join('');servicesBox.querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.index);const pos=selectedServices.indexOf(i);if(pos>=0)selectedServices.splice(pos,1);else selectedServices.push(i);b.classList.toggle('is-selected',pos<0);b.setAttribute('aria-pressed',String(pos<0));loadSlots();});}
function dayHours(ds){if(!ds)return null;const d=new Date(ds+'T12:00:00');const wd=d.getDay();if(wd===0||wd===1)return null;return wd===6?['08:30','15:00']:['08:30','19:00'];}
async function loadSlots(){selectedTime='';slots.innerHTML='';document.querySelectorAll('.agenda-slot').forEach(x=>x.classList.remove('is-selected'));const ds=date.value;const t=totals();if(!selectedServices.length||!ds){update();return}if(!dayHours(ds)){$('agenda-day-message').textContent='Fechado neste dia.';update();return}$('agenda-day-message').textContent=configured?'Consultando disponibilidade...':'Prévia dos horários';let available=[];if(configured){const {data,error}=await sb.rpc('get_available_slots',{p_date:ds,p_duration_minutes:t.duration});if(error){slots.innerHTML='<p>Não foi possível consultar a agenda.</p>';console.error(error);$('agenda-day-message').textContent='Erro na consulta';return}available=(data||[]).map(x=>x.slot_time.slice(0,5));}
available.forEach(tm=>{const b=document.createElement('button');b.type='button';b.className='agenda-slot';b.textContent=tm;b.setAttribute('aria-pressed','false');b.onclick=()=>{document.querySelectorAll('.agenda-slot').forEach(x=>{x.classList.remove('is-selected');x.setAttribute('aria-pressed','false')});b.classList.add('is-selected');b.setAttribute('aria-pressed','true');selectedTime=tm;update();};slots.appendChild(b)});$('agenda-day-message').textContent=available.length?`${available.length} horários disponíveis`:'Sem horários disponíveis';update();}
function update(){const ds=date.value,n=$('agenda-name').value.trim(),p=$('agenda-phone').value.replace(/\D/g,''),t=totals();let html='<p>Selecione um ou mais serviços, uma data e um horário.</p>';if(selectedServices.length){html=`<ul class="agenda-summary-services">${selectedServices.map(i=>`<li>${SERVICES[i].name}<span>${money(SERVICES[i].price)}</span></li>`).join('')}</ul><p><strong>Total: ${money(t.price)}</strong><br>Tempo estimado: ${t.duration} min</p>`}if(ds)html+=`<p>${new Date(ds+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}${selectedTime?' às '+selectedTime:''}</p>`;$('agenda-summary').innerHTML=html;submit.disabled=!(configured&&selectedServices.length&&ds&&selectedTime&&n&&p.length>=10);}
async function save(){const t=totals();const names=selectedServices.map(i=>SERVICES[i].name);submit.disabled=true;submit.textContent='Enviando...';const phone=$('agenda-phone').value.replace(/\D/g,'');const {error}=await sb.rpc('create_public_booking',{p_customer_name:$('agenda-name').value.trim(),p_customer_phone:phone,p_service_name:names.join(' + '),p_service_price:t.price,p_duration_minutes:t.duration,p_booking_date:date.value,p_start_time:selectedTime,p_notes:$('agenda-notes').value.trim()||null});if(error){alert(error.message.includes('indisponível')?error.message:'Não foi possível agendar. Tente novamente.');submit.textContent='Solicitar agendamento';loadSlots();return}window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'agendamento_proprio_solicitado',servicos:names.join(' | '),data:date.value,hora:selectedTime,valor:t.price});status.innerHTML='<strong>Solicitação recebida!</strong> Aguarde a confirmação pelo WhatsApp.';status.scrollIntoView({behavior:'smooth'});submit.textContent='Solicitação enviada';}
date.addEventListener('change',loadSlots);['agenda-name','agenda-phone','agenda-notes'].forEach(id=>$(id).addEventListener('input',update));submit.addEventListener('click',save);renderServices();if(configured)status.innerHTML='<strong>Agenda própria conectada.</strong> Escolha um ou mais serviços e um horário disponível.';else status.innerHTML='<strong>Versão de preparação.</strong> O banco de dados ainda precisa ser conectado antes da publicação.';update();
})();
