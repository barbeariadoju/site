// admin-v15-4-agendamento.js - parte 6/7 de admin-v15-4.js. Modo Novo
// agendamento / remarcacao (admin-agendamento.html). Ver header de
// admin-v15-4-core.js.
  function initBookingForm(){$('booking-services').innerHTML=renderServicePicker();bindBookingServicePicker();bindCustomerSearch();bindSlotsPanel();$('booking-phone').oninput=fillKnownCustomer;$('booking-save').onclick=saveBooking;$('booking-date').value=isoLocal(new Date());$('booking-time').value='08:00';const mode=new URLSearchParams(location.search).get('modo');if(mode==='remarcar')loadRescheduleForm();else{loadPrefillForm();bindDraftAutosave()}refreshSlots()}
  // v29.170.0 — HORÁRIOS QUE CABEM (pedido do Juliano, 11/09/2026, 08h43). Na noite anterior ele
  // foi encaixar o Venilson pelo painel e não tinha como saber quais horários comportavam
  // Alisamento + Corte no sábado — acabou abrindo o site como se fosse cliente e mandando print.
  // Agora o próprio formulário mostra, pra data e serviços escolhidos, a mesma grade que o site
  // mostra (get_available_slots_excluding: fim de cada atendimento + grade de 15 em 15, término
  // até 60 min após o fechamento). Clicar num horário preenche o campo. Na remarcação, o próprio
  // agendamento não conta como ocupado (mover 15:00 pra 14:30 é livre). O campo Horário continua
  // livre pra digitar qualquer coisa — a grade é informação, não trava.
  // v29.173.0 — ENCAIXE (pedido do Juliano, 11/09/2026, 11h47, print do celular): tentou remarcar
  // pra 17:50 num dia cheio e o painel recusou. "Me permite excepcionalmente incluir algum cliente
  // entre um e outro, eu sei que faço em menos tempo que o determinado do sistema." A caixa
  // "Permitir encaixe" manda p_allow_overlap=true (migration 151) e as funções do admin pulam só
  // a colisão com outros atendimentos. Site e JuIA continuam sem encaixe: é decisão dele, na hora.
  // Pedido dele na sequência (11h55): "deve me dar uma mensagem pra eu pensar: ambos os serviços
  // consumiriam tantos minutos e assim você terá somente X minutos, prosseguir? Assim eu reflito
  // melhor caso a caso." Antes de salvar com encaixe, o painel soma o que já está no período e
  // mostra a conta; só salva se ele confirmar.
  function encaixeAviso(date,time,duration,excludeId){
    const toMin=t=>{const [a,b]=String(t).slice(0,5).split(':').map(Number);return a*60+b}
    const fmt=x=>`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`
    const s=toMin(time),e=s+Number(duration||0)
    const dia=allBookings.filter(b=>b.booking_date===date&&['pending','confirmed'].includes(b.status)&&b.id!==excludeId)
    const emCima=dia.filter(b=>toMin(b.start_time)<e&&toMin(b.end_time)>s).sort((a,b)=>toMin(a.start_time)-toMin(b.start_time))
    if(!emCima.length)return null
    const inicio=Math.min(s,...emCima.map(b=>toMin(b.start_time))),fim=Math.max(e,...emCima.map(b=>toMin(b.end_time)))
    const soma=Number(duration||0)+emCima.reduce((a,b)=>a+Number(b.duration_minutes||0),0)
    const proximo=dia.filter(b=>toMin(b.start_time)>=fim).sort((a,b)=>toMin(a.start_time)-toMin(b.start_time))[0]
    const lista=emCima.map(b=>`${b.customer_name} às ${String(b.start_time).slice(0,5)} (${b.service_name}, ${b.duration_minutes} min)`).join('; ')
    return `ENCAIXE

Já tem nesse período: ${lista}.

Este novo (${duration} min) mais o que já está marcado somam ${soma} min, e você terá ${fim-inicio} min (${fmt(inicio)} às ${fmt(fim)}) pra fazer tudo.${proximo?` O próximo cliente depois disso é às ${String(proximo.start_time).slice(0,5)}.`:' Depois disso não tem mais ninguém marcado.'}

Prosseguir com o encaixe?`
  }
  let slotsReq=0
  function bindSlotsPanel(){
    $('booking-date')?.addEventListener('change',refreshSlots)
    $('booking-services')?.addEventListener('change',refreshSlots)
    $('booking-time')?.addEventListener('input',markSelectedSlot)
  }
  async function refreshSlots(){
    const box=$('booking-slots'),head=$('booking-slots-count'),hint=$('booking-slots-hint')
    if(!box||!head||!hint)return
    const date=$('booking-date').value,services=selectedServices()
    const duration=services.reduce((a,s)=>a+Number(s.duration||0),0)
    const req=++slotsReq
    if(!date||!duration){box.replaceChildren();head.textContent='';hint.textContent=date?'Escolha o(s) serviço(s) pra ver os horários que cabem.':'Escolha a data.';return}
    hint.textContent='';head.textContent='Consultando…'
    const {data,error}=await sb.rpc('get_available_slots_excluding',{p_date:date,p_duration_minutes:duration,p_exclude_booking_id:$('booking-id').value||null})
    if(req!==slotsReq)return
    if(error){head.textContent='';hint.textContent='Não consegui consultar os horários agora.';console.error(error);return}
    renderAdminSlots((data||[]).map(r=>String(r.slot_time).slice(0,5)),duration)
  }
  function renderAdminSlots(slots,duration){
    const box=$('booking-slots'),head=$('booking-slots-count'),hint=$('booking-slots-hint')
    box.replaceChildren()
    if(!slots.length){head.textContent='Nenhum horário livre';hint.textContent=`Nenhum horário livre comporta ${duration} min nessa data. Pra encaixar mesmo assim, digite o horário e marque "Permitir encaixe" lá embaixo.`;return}
    head.textContent=`${slots.length} horário${slots.length>1?'s':''} comporta${slots.length>1?'m':''} ${duration} min`
    slots.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='agenda-slot';b.dataset.slot=t;b.innerHTML=`<strong>${t}</strong>`;b.onclick=()=>{$('booking-time').value=t;markSelectedSlot();saveDraft()};box.appendChild(b)})
    markSelectedSlot()
  }
  function markSelectedSlot(){const cur=$('booking-time')?.value;document.querySelectorAll('#booking-slots .agenda-slot').forEach(b=>b.classList.toggle('is-selected',b.dataset.slot===cur))}
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
  // Casa o cliente pela chave canonica do telefone (ultimos 8 digitos) e nao
  // pelos digitos exatos: assim 11 9xxxx, 55 11 9xxxx e variacoes de formato
  // caem no mesmo cadastro em vez de virar duas fichas do mesmo cliente.
  function fillKnownCustomer(){
    const digitado=$('booking-name').value.trim(),n=digitado.toLowerCase(),
      chave=phoneKeyDb($('booking-phone').value),
      porTelefone=chave?customers.find(x=>phoneKeyDb(x.phone)===chave):null,
      porNome=porTelefone?null:(n?customers.find(x=>x.name.toLowerCase()===n):null);
    if(porTelefone){
      const divergente=Boolean(digitado)&&porTelefone.name.toLowerCase()!==n;
      $('booking-name').value=porTelefone.name;$('booking-phone').value=porTelefone.phone;
      avisoTelefoneRepetido(divergente?porTelefone.name:null);return
    }
    avisoTelefoneRepetido(null);
    // Match so pelo nome: completa o telefone apenas enquanto ele ainda nao
    // comecou a digitar outro numero, para nao atropelar o que esta digitando.
    if(porNome&&phoneDigits($('booking-phone').value).length<3){$('booking-name').value=porNome.name;$('booking-phone').value=porNome.phone}
  }
  function avisoTelefoneRepetido(nomeSalvo){const el=$('booking-phone-warning');if(!el)return;if(!nomeSalvo){el.hidden=true;el.textContent='';return}el.textContent='⚠ Esse WhatsApp já está cadastrado como '+nomeSalvo+'. Usei o nome do cadastro para não criar uma segunda ficha do mesmo cliente. Se for mesmo outra pessoa, confira o número.';el.hidden=false}
  function selectedServices(){return [...document.querySelectorAll('input[name="booking-service"]:checked')].map(i=>catalog.find(s=>s.name===i.value)).filter(Boolean)}
  function selectServicesByNames(text=''){const names=text.split(' + ').map(s=>s.trim());document.querySelectorAll('input[name="booking-service"]').forEach(i=>{const s=catalog.find(x=>x.name===i.value);i.checked=!!s&&names.includes(s.name);i.dispatchEvent(new Event('change',{bubbles:true}))})}
  function prefillReturnStorage(x){if(!x)return;const d=new Date(x.booking_date+'T12:00:00');d.setDate(d.getDate()+15);sessionStorage.setItem('bdj-prefill-booking',JSON.stringify({name:x.customer_name,phone:x.customer_phone,date:isoLocal(d),time:x.start_time.slice(0,5),services:x.service_name,notes:'Retorno'}))}
  function loadPrefillForm(){const raw=sessionStorage.getItem('bdj-prefill-booking'),cRaw=sessionStorage.getItem('bdj-prefill-customer');if(raw){const x=JSON.parse(raw);fillForm(x);sessionStorage.removeItem('bdj-prefill-booking')}else if(cRaw){const c=JSON.parse(cRaw);fillForm({name:c.name,phone:c.phone,date:isoLocal(new Date()),time:'08:00',services:c.lastServices,notes:'Retorno'});sessionStorage.removeItem('bdj-prefill-customer')}else restoreDraft()}
  function fillForm(x){$('booking-name').value=x.name||'';$('booking-phone').value=x.phone||'';$('booking-date').value=x.date||isoLocal(new Date());$('booking-time').value=x.time||'08:00';$('booking-notes').value=x.notes||'';selectServicesByNames(x.services||'')}
  async function loadRescheduleForm(){const id=sessionStorage.getItem('bdj-reschedule-id');if(!id)return;const x=allBookings.find(r=>r.id===id);if(!x)return;$('booking-id').value=x.id;setText('booking-page-title','Remarcar agendamento');setText('booking-save-label','Salvar remarcação');fillForm({name:x.customer_name,phone:x.customer_phone,date:x.booking_date,time:x.start_time.slice(0,5),services:x.service_name,notes:x.notes||''});$('booking-name').disabled=true;$('booking-phone').disabled=true}
  async function saveBooking(){const services=selectedServices(),msg=$('booking-message');if(!$('booking-name').value.trim()||phoneDigits($('booking-phone').value).length<10||!services.length){msg.textContent='Informe cliente, WhatsApp e ao menos um serviço.';return}const base={p_booking_date:$('booking-date').value,p_start_time:$('booking-time').value,p_service_name:services.map(s=>s.name).join(' + '),p_service_price:services.reduce((a,s)=>a+s.price,0),p_duration_minutes:services.reduce((a,s)=>a+s.duration,0),p_notes:$('booking-notes').value||null,p_allow_outside_hours:Boolean($('booking-allow-outside-hours')?.checked),p_allow_overlap:Boolean($('booking-allow-overlap')?.checked)};if(base.p_allow_overlap){const aviso=encaixeAviso(base.p_booking_date,base.p_start_time,base.p_duration_minutes,$('booking-id').value||null);if(aviso&&!await BDJ_UX.confirm(aviso)){msg.textContent='Encaixe não salvo.';return}}msg.textContent='Salvando...';let error;if($('booking-id').value)({error}=await sb.rpc('admin_reschedule_booking',{p_booking_id:$('booking-id').value,...base}));else({error}=await sb.rpc('admin_create_booking',{p_customer_name:$('booking-name').value.trim(),p_customer_phone:$('booking-phone').value,...base}));if(error){msg.textContent=friendlyDb(error.message);return}sessionStorage.removeItem(DRAFT_KEY);msg.textContent=$('booking-id').value?'Agendamento remarcado.':'Agendamento criado.';setTimeout(()=>location.href=`admin-agenda.html?data=${$('booking-date').value}`,700)}
