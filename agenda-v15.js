import { money, fmtDuration, addMinutes, addDaysISO, isOpenDay, closingMinutes, prettyDate, nextOpenDay } from './assets/js/booking-format.js?v=28.16.2';

(() => {
  const cfg=window.BDJ_AGENDA_CONFIG||{};
  const configured=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey);
  const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  const $=id=>document.getElementById(id);
  const allServices=window.BDJ_SERVICES||[];
  let services=JSON.parse(sessionStorage.getItem('bdj_selected_services_v15')||'[]');
  let products=JSON.parse(sessionStorage.getItem('bdj_selected_products_v15')||'[]');
  let selectedTime='', step=1, slotsRequestId=0, waitlistOfferDate='';
  // Catálogo único em products-catalog-v1.js (mesmo padrão de allServices/BDJ_SERVICES) —
  // antes era uma cópia local que já tinha ficado desatualizada (faltava Pasta Modeladora,
  // Shampoo Caspbell e os energéticos Monster). Só entram aqui os produtos com `for` não-vazio
  // (sugestão contextual durante o agendamento); o catálogo completo (bebidas etc.) fica só
  // pro balcão/admin, que registra qualquer venda.
  const productCatalog=(window.BDJ_PRODUCTS||[]).filter(p=>Array.isArray(p.for)&&p.for.length);
  const total=()=>({duration:services.reduce((a,b)=>a+Number(b.duration||0),0),servicePrice:services.reduce((a,b)=>a+Number(b.price||0),0),productPrice:products.reduce((a,b)=>a+Number(b.price||0),0)});
  const spNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
  function firstEligibleDate(){
    const now=spNow(),today=`${now.year}-${now.month}-${now.day}`;
    if(!isOpenDay(today))return nextOpenDay(today,1);
    const current=Number(now.hour)*60+Number(now.minute),needed=current+15+total().duration;
    return needed<=closingMinutes(today)?today:nextOpenDay(today,1);
  }
  function saveState(){sessionStorage.setItem('bdj_selected_services_v15',JSON.stringify(services));sessionStorage.setItem('bdj_selected_products_v15',JSON.stringify(products));}
  function fire(event,data={}){window.dataLayer=window.dataLayer||[];window.dataLayer.push({event,...data});}
  function serviceIndex(name){return allServices.findIndex(s=>s.name===name)}
  function renderSelected(){
    const box=$('selected-services-v15'), empty=$('empty-services-v15'); box.innerHTML='';
    if(!services.length){
      empty.hidden=false;
      $('service-upsell-v15').hidden=true;
      const nextButton=document.querySelector('[data-next-step="2"]');
      if(nextButton){nextButton.disabled=true;nextButton.setAttribute('aria-disabled','true');}
      return;
    }
    empty.hidden=true;
    $('service-upsell-v15').hidden=false;
    const nextButton=document.querySelector('[data-next-step="2"]');
    if(nextButton){nextButton.disabled=false;nextButton.setAttribute('aria-disabled','false');}
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
  async function go(n){
    if(n===2&&!services.length)return;
    if(n===3&&!selectedTime)return;
    step=n;
    const panels=[...document.querySelectorAll('[data-step]')];
    panels.forEach(x=>x.hidden=Number(x.dataset.step)!==n);
    document.querySelectorAll('[data-progress-step]').forEach(x=>{
      const p=Number(x.dataset.progressStep);
      x.classList.toggle('is-active',p===n);
      x.classList.toggle('is-complete',p<n);
      x.disabled=p>n;
      x.setAttribute('aria-current',p===n?'step':'false');
    });
    updateSummary();
    if(n===2&&!$('agenda-date').value){$('agenda-date').value=firstEligibleDate();await loadSlots({autoAdvance:true,reason:'initial'})}
    requestAnimationFrame(()=>{
      const panel=document.querySelector(`[data-step="${n}"]`);
      const flowStart=document.querySelector('.booking-progress');
      const target=flowStart||panel;
      if(target){
        const top=target.getBoundingClientRect().top+window.scrollY-(window.innerWidth<=700?6:12);
        window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
      }
      if(panel)setTimeout(()=>panel.focus({preventScroll:true}),420);
      if(n===3)setTimeout(()=>$('agenda-name').focus({preventScroll:true}),520);
    });
  }
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
  function showWaitlistOffer(date){
    waitlistOfferDate=date;
    const box=$('agenda-waitlist-offer');if(!box)return;
    $('waitlist-date-label').textContent=prettyDate(date);
    box.hidden=false;
    const form=$('agenda-waitlist-form');if(form)form.hidden=true;
    if($('waitlist-message'))$('waitlist-message').textContent='';
  }
  function hideWaitlistOffer(){
    waitlistOfferDate='';
    const box=$('agenda-waitlist-offer');if(box)box.hidden=true;
  }
  async function submitWaitlist(){
    const msg=$('waitlist-message'),name=$('waitlist-name').value.trim(),phone=$('waitlist-phone').value.replace(/\D/g,'');
    if(name.length<2||phone.length<10){msg.textContent='Informe nome e WhatsApp válidos.';return}
    const email=$('waitlist-email').value.trim()||null;
    const period=document.querySelector('input[name="waitlist-period"]:checked')?.value||'qualquer';
    const t=total(),btn=$('waitlist-submit');
    btn.disabled=true;btn.textContent='Enviando...';msg.textContent='';
    const {data,error}=await sb.functions.invoke('join-waitlist',{body:{
      customer_name:name,customer_phone:phone,customer_email:email,
      preferred_date:waitlistOfferDate,preferred_period:period,
      service_name:services.map(s=>s.name).join(' + ')||null,
      service_price:t.servicePrice||null,duration_minutes:t.duration||null
    }});
    btn.disabled=false;btn.textContent='Entrar na lista de espera';
    if(error||!data?.ok){msg.textContent='Não foi possível registrar agora. Tente novamente em instantes.';return}
    fire('waitlist_joined',{booking_date:waitlistOfferDate});
    const box=$('agenda-waitlist-offer');
    box.innerHTML=`<strong>Prontinho! Você está na lista para ${prettyDate(waitlistOfferDate)}.</strong><small>Se abrir uma vaga, chamamos você no WhatsApp.</small>`;
  }
  async function loadSlots(options={}){
    const requestId=++slotsRequestId;
    selectedTime='';let date=$('agenda-date').value,box=$('agenda-slots');box.innerHTML='<div class="booking-slots-loading">Consultando os melhores horários…</div>';
    const requestedDate=date;
    hideWaitlistOffer();
    if(!date||!services.length){$('agenda-day-message').textContent='Escolha uma data';updateSummary();return}
    fire('date_selected',{booking_date:date});$('agenda-day-message').textContent='Consultando...';
    try{
      if(!isOpenDay(date)){
        const next=await findNextDateWithSlots(date,false);
        if(requestId!==slotsRequestId)return;
        if(next){$('agenda-date').value=next.date;date=next.date;renderSlots(next.slots);$('agenda-day-message').textContent=`Fechado nessa data. Próximo dia disponível: ${prettyDate(date)}`;updateSummary();return}
      }
      let slots=await fetchAvailableSlots(date);
      if(!slots.length&&options.autoAdvance!==false){
        const next=await findNextDateWithSlots(date,false);
        if(requestId!==slotsRequestId)return;
        if(next){
          $('agenda-date').value=next.date;date=next.date;slots=next.slots;renderSlots(slots);
          const prefix=options.reason==='initial'?'Próximo dia disponível':'Sem horários nessa data. Próximo dia disponível';
          $('agenda-day-message').textContent=`${prefix}: ${prettyDate(date)}`;
          if(options.reason==='manual'&&isOpenDay(requestedDate))showWaitlistOffer(requestedDate);
          updateSummary();return
        }
      }
      if(requestId!==slotsRequestId)return;
      renderSlots(slots);
      $('agenda-day-message').textContent=slots.length?`${slots.length} horários disponíveis`:'Sem horários disponíveis';
      if(!slots.length&&isOpenDay(requestedDate))showWaitlistOffer(requestedDate);
      updateSummary();
    }catch(error){if(requestId!==slotsRequestId)return;box.innerHTML='<div class="booking-empty-note"><strong>Não foi possível consultar agora.</strong><small>Tente novamente em alguns instantes.</small></div>';$('agenda-day-message').textContent='Erro na consulta';console.error(error)}
  }
  function renderSlots(slots){
    const box=$('agenda-slots');box.replaceChildren();
    if(!slots.length){
      box.innerHTML='<div class="booking-empty-note"><strong>Essa data ficou sem vagas.</strong><small>Escolha outra data no calendário para consultar novos horários.</small></div>';
      return;
    }
    slots.forEach(time=>{
      const b=document.createElement('button');b.type='button';b.className='agenda-slot';b.innerHTML=`<strong>${time}</strong><small>disponível</small>`;
      b.onclick=()=>{
        document.querySelectorAll('.agenda-slot').forEach(x=>x.classList.remove('is-selected'));
        b.classList.add('is-selected');selectedTime=time;fire('time_selected',{booking_time:time});updateSummary();
        const action=document.querySelector('[data-step="2"] .booking-actions-v14');
        if(action&&window.innerWidth<=700)setTimeout(()=>action.scrollIntoView({behavior:'smooth',block:'end'}),120);
      };
      box.appendChild(b)
    });
  }
  // v28.68.0 — Pix antecipado. "Já fiz o Pix" NÃO confirma pagamento: só sinaliza pro
  // Juliano conferir o comprovante (ver comentário da migration 096). Copiar a chave usa
  // clipboard API com fallback pra execCommand, porque em WebView de app (Instagram, por
  // exemplo) navigator.clipboard costuma vir bloqueado.
  function bindPixOffer(bookingCode,managementToken,valor){
    const box=$('pix-offer'); if(!box)return;
    const statusEl=$('pix-status');
    // v29.54.0 — caso Nado (20/08/2026): cliente copiou a chave, pagou e nunca tocou em
    // "Já fiz o Pix" — o Juliano só soube depois do atendimento. Copiar a chave agora
    // também avisa o servidor (event:'copied' → push "de olho no extrato"), uma vez só.
    // Fire-and-forget: falha de rede aqui não pode atrapalhar a cópia nem a tela.
    let copiaAvisada=false;
    const avisarCopia=(texto)=>{
      if(copiaAvisada)return; copiaAvisada=true;
      const chave=texto.includes('@')?'picpay':'pagbank';
      try{
        fetch(`${cfg.supabaseUrl}/functions/v1/prepay-declare`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({booking_code:bookingCode,token:managementToken,key:chave,event:'copied'})
        }).catch(()=>{});
      }catch{}
    };
    const copiar=async(texto,botao)=>{
      let ok=false;
      try{ await navigator.clipboard.writeText(texto); ok=true; }
      catch{ try{ const ta=document.createElement('textarea'); ta.value=texto; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); ok=document.execCommand('copy'); document.body.removeChild(ta); }catch{ ok=false } }
      const antes=botao.querySelector('small').textContent;
      botao.querySelector('small').textContent=ok?'copiado ✅':'copie manualmente';
      botao.classList.toggle('is-copied',ok);
      setTimeout(()=>{botao.querySelector('small').textContent=antes;botao.classList.remove('is-copied')},2600);
      if(ok){fire('pix_key_copied',{value:valor});avisarCopia(texto);}
    };
    box.querySelectorAll('[data-pix-copy]').forEach(b=>b.onclick=()=>copiar(b.dataset.pixCopy,b));
    $('pix-later').onclick=()=>{
      fire('pix_declined',{value:valor});
      box.innerHTML='<p class="pix-offer-lead">Sem problema — é só pagar na barbearia depois do atendimento. Até breve! 💈</p>';
    };
    // v29.3.0 — passa pela function em vez da RPC direta: ela registra E dispara o push
    // pro Juliano na hora, dizendo pra qual chave conferir. Antes a declaração morria no
    // banco e ele só descobria se abrisse o painel.
    const declarar=async(chave,botao)=>{
      const antes=botao.textContent;
      botao.disabled=true; botao.textContent='Registrando…';
      let ok=false;
      try{
        const r=await fetch(`${cfg.supabaseUrl}/functions/v1/prepay-declare`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({booking_code:bookingCode,token:managementToken,key:chave})
        });
        ok=(await r.json().catch(()=>({}))).ok===true;
      }catch{ ok=false }
      if(!ok){
        statusEl.textContent='Não consegui registrar agora, mas fique tranquilo: leve o comprovante que acertamos na hora.';
        botao.disabled=false; botao.textContent=antes;
        return;
      }
      fire('pix_declared',{value:valor,chave});
      box.innerHTML='<strong class="pix-offer-title">Recebemos seu aviso! 🙏</strong><p class="pix-offer-lead">Seu horário está garantido. O Juliano confere o Pix e te avisa por aqui quando o pagamento cair — se faltar alguma coisa, a gente fala com você antes. Não precisa fazer mais nada. 💈</p>';
    };
    // A chave de e-mail (PicPay) é a primeira opção por decisão do Juliano em 08/08/2026,
    // então é ela que o botão principal declara. Quem preferiu o celular usa o link abaixo.
    $('pix-done').onclick=(e)=>declarar('picpay',e.target);
    const outra=$('pix-outra-chave');
    if(outra)outra.onclick=(e)=>{e.preventDefault();declarar('pagbank',outra)};
  }
  // v29.22.0 — Fase 2: Checkout PagBank. O botão leva pra página segura do PagBank
  // (Pix, crédito ou débito à vista) e a confirmação volta AUTOMÁTICA pelo webhook:
  // o cliente recebe no WhatsApp sem o Juliano conferir extrato. Se a API não responder
  // (conta fora da allowlist, token ausente, erro), caímos no fluxo manual da Fase 1 —
  // a chave copiável abaixo — sem o cliente perceber quebra.
  function pixFallbackHtml(totalPagar){
    return `<div class="pix-offer" id="pix-offer">
        <strong class="pix-offer-title">Quer já deixar pago?</strong>
        <p class="pix-offer-lead">Adiantando agora pelo Pix, quando terminar o corte é só levantar da cadeira e seguir seu dia — sem parar pra pagar, sem fila no balcão.</p>
        <p class="pix-offer-note">💳 O pagamento com <b>cartão online</b> está chegando — por enquanto é Pix pela chave abaixo, ou pague no local (lá o cartão passa normal na maquininha).</p>
        <div class="pix-offer-total">Total: <b>${money(totalPagar)}</b></div>
        <div class="pix-keys">
          <button type="button" class="pix-key" data-pix-copy="contato@barbeariadoju.com.br"><span>Chave Pix · e-mail</span><b>contato@barbeariadoju.com.br</b><small>toque para copiar</small></button>
          <button type="button" class="pix-key" data-pix-copy="11967073038"><span>Ou pelo celular</span><b>11967073038</b><small>toque para copiar</small></button>
        </div>
        <p class="pix-offer-note">No seu banco vai aparecer <b>Juliano Bruno Lopes Padilha</b>, no <b>PicPay</b> — é o titular da Barbearia do Ju. Pode confirmar tranquilo.<br>Depois de pagar, toque abaixo — o Juliano confere e já deixa registrado.</p>
        <div class="pix-offer-actions">
          <button type="button" class="btn primary" id="pix-done">✅ Já fiz o Pix</button>
          <button type="button" class="btn ghost" id="pix-later">Prefiro pagar no local</button>
        </div>
        <p class="pix-offer-status" id="pix-status" role="status"></p>
        <p class="pix-offer-note"><a href="#" id="pix-outra-chave">Paguei pela chave do celular</a></p>
      </div>`;
  }
  function payOfferHtml(totalPagar){
    return `<div class="pix-offer" id="pay-offer">
        <strong class="pix-offer-title">Quer já deixar pago?</strong>
        <p class="pix-offer-lead">Pagando agora, quando terminar o corte é só levantar da cadeira e seguir seu dia — sem parar pra pagar, sem fila no balcão.</p>
        <div class="pix-offer-total">Total: <b>${money(totalPagar)}</b></div>
        <p class="pix-offer-note">Você paga na página segura do <b>PagBank</b> — Pix, crédito ou débito — e a confirmação chega no seu WhatsApp na hora, automática.</p>
        <div class="pix-offer-actions">
          <button type="button" class="btn primary" id="pay-now">💳 Pagar agora — Pix ou cartão</button>
          <button type="button" class="btn ghost" id="pay-later">Prefiro pagar no local</button>
        </div>
        <p class="pix-offer-status" id="pay-status" role="status"></p>
      </div>`;
  }
  function bindPayOffer(bookingCode,managementToken,valor){
    const box=$('pay-offer'); if(!box)return;
    $('pay-later').onclick=()=>{
      fire('pix_declined',{value:valor});
      box.innerHTML='<p class="pix-offer-lead">Sem problema — é só pagar na barbearia depois do atendimento. Até breve! 💈</p>';
    };
    $('pay-now').onclick=async(e)=>{
      const b=e.target; b.disabled=true; b.textContent='Abrindo pagamento…';
      let resp=null;
      try{
        const r=await fetch(`${cfg.supabaseUrl}/functions/v1/pagbank-checkout`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({booking_code:bookingCode,token:managementToken})
        });
        resp=await r.json().catch(()=>null);
      }catch{ resp=null }
      if(resp&&resp.ok&&resp.pay_url){ fire('checkout_opened',{value:valor}); location.href=resp.pay_url; return }
      if(resp&&resp.ok&&resp.already_paid){ box.innerHTML='<strong class="pix-offer-title">Pagamento já confirmado ✅</strong><p class="pix-offer-lead">Está tudo certo — não precisa fazer mais nada. 💈</p>'; return }
      // Fase 1 como fallback: troca o bloco inteiro pela chave copiável.
      box.outerHTML=pixFallbackHtml(valor);
      bindPixOffer(bookingCode,managementToken,valor);
    };
  }
  async function submit(){
    const t=total(), names=services.map(s=>s.name), email=$('agenda-email').value.trim()||null;
    $('agenda-submit').disabled=true;$('agenda-submit').textContent='Confirmando...';
    const {data:result,error}=await sb.functions.invoke('create-public-booking',{body:{customer_name:$('agenda-name').value.trim(),customer_phone:$('agenda-phone').value.replace(/\D/g,''),customer_email:email,birth_date:$('agenda-birth')?.value||null,service_name:names.join(' + '),service_price:t.servicePrice,duration_minutes:t.duration,booking_date:$('agenda-date').value,start_time:selectedTime,notes:$('agenda-notes').value.trim()||null,selected_products:products}});
    const bookingError=error?.message||result?.error||'';
    if(error||!result?.ok){alert(bookingError.includes('indisponível')||bookingError.includes('bloqueado')||bookingError.includes('antecedência')?bookingError:'Não foi possível agendar. Tente novamente.');$('agenda-submit').textContent='Confirmar agendamento';$('agenda-submit').disabled=false;await loadSlots();return}
    fire('booking_confirmed',{services:names.join(' | '),value:t.servicePrice+t.productPrice,products:products.map(p=>p.name).join(' | ')});
    sessionStorage.removeItem('bdj_selected_services_v15');sessionStorage.removeItem('bdj_selected_products_v15');
    const manageUrl=result.manage_url||'';
    // v28.68.0 — Pix antecipado (Fase 1). Aparece SÓ depois do horário confirmado: pedir
    // pagamento antes de garantir a vaga derrubaria agendamento. O apelo é TEMPO, não
    // desconto — num serviço de R$40 desconto corrói margem, e o ganho real pro cliente é
    // sair da cadeira e seguir a rotina sem parar pra pagar. Recusar é um clique, sem
    // fricção: a ideia é oferecer, nunca impor.
    const totalPagar=t.servicePrice+t.productPrice;
    // v29.22.0 — a oferta agora é o Checkout PagBank (Pix ou cartão, confirmação
    // automática). O HTML da Fase 1 virou pixFallbackHtml() e só entra se a API falhar.
    const payHtml=payOfferHtml(totalPagar);
    $('agenda-status').innerHTML=`<strong>Agendamento confirmado com sucesso!</strong><span> Seu horário já está reservado na Barbearia do Ju.</span>${manageUrl?`<div class="booking-success-actions"><a class="btn primary" href="${manageUrl}">Acompanhar ou alterar meu agendamento</a><small>Guarde este link para reagendar ou cancelar, caso necessário.</small></div>`:''}${result.booking_code&&result.management_token?payHtml:''}`;
    if(result.booking_code&&result.management_token)bindPayOffer(result.booking_code,result.management_token,totalPagar);
    const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();
    document.body.classList.add('booking-complete');
    $('agenda-status').classList.add('is-success');
    const viewport=document.querySelector('meta[name="viewport"]');
    if(viewport){viewport.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1');setTimeout(()=>viewport.setAttribute('content','width=device-width,initial-scale=1'),450)}
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'smooth'}));
    $('agenda-submit').textContent='Agendamento confirmado';
  }
  document.addEventListener('click',e=>{
    const rm=e.target.closest('[data-remove-service]');if(rm){services.splice(Number(rm.dataset.removeService),1);selectedTime='';renderSelected();return}
    const add=e.target.closest('[data-add-service]');if(add){const s=allServices[Number(add.dataset.addService)];services.push({name:s.name,price:s.price,duration:s.duration});selectedTime='';fire('upsell_service_added',{item_name:s.name,value:s.price});renderSelected();return}
    const prod=e.target.closest('[data-product]');if(prod){const p=productCatalog.find(x=>x.name===prod.dataset.product);const i=products.findIndex(x=>x.name===p.name);if(i>=0)products.splice(i,1);else{products.push({name:p.name,price:p.price});fire('product_added_booking',{item_name:p.name,value:p.price})}renderProducts();updateSummary();saveState();return}
  });
  document.querySelectorAll('[data-next-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.nextStep)));document.querySelectorAll('[data-prev-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.prevStep)));document.querySelectorAll('[data-progress-step]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.progressStep);if(n<=step)go(n)});
  $('agenda-date').onchange=()=>loadSlots({autoAdvance:true,reason:'manual'});['agenda-name','agenda-phone','agenda-email','agenda-notes'].forEach(id=>$(id).oninput=updateSummary);$('agenda-submit').onclick=submit;
  $('waitlist-open-form')?.addEventListener('click',()=>{$('agenda-waitlist-form').hidden=false;$('waitlist-name')?.focus()});
  $('waitlist-submit')?.addEventListener('click',submitWaitlist);
  const now=spNow();$('agenda-date').min=`${now.year}-${now.month}-${now.day}`;
  renderSelected();$('agenda-status').innerHTML=configured?'<strong>Agenda online.</strong> Confira seu atendimento e escolha o melhor horário.':'<strong>Configuração pendente.</strong> O banco ainda precisa ser conectado.';go(1);
})();
