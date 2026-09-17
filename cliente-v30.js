// v29.202.0 — Área do cliente atrás de um código por WhatsApp (auditoria de 17/09/2026, decisão
// do Juliano). Antes: telefone → get_public_customer_summary direto com a chave anônima, e quem
// soubesse o número de alguém via o próximo horário dele. Agora: telefone → código de 6 dígitos no
// WhatsApp → resumo. A sessão (token de 12 h) fica no sessionStorage pra recarregar sem novo código.
(()=>{
  const cfg=window.BDJ_AGENDA_CONFIG||{},$=id=>document.getElementById(id),digits=s=>String(s||'').replace(/\D/g,'');
  const endpoint=cfg.supabaseUrl?`${cfg.supabaseUrl}/functions/v1/cliente-area`:'';
  const TOKEN_KEY='bdj-client-token',PHONE_KEY='bdj-client-phone';
  let pendingPhone='';
  function dateBR(s){return s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}):''}
  function msg(t){$('client-message').textContent=t}
  async function call(payload){
    if(!endpoint||!cfg.supabaseAnonKey)throw new Error('Não foi possível conectar ao sistema.');
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabaseAnonKey,'Authorization':`Bearer ${cfg.supabaseAnonKey}`},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||data?.error)throw new Error(data?.error||'Não foi possível consultar agora.');
    return data;
  }
  function showStep(step){
    $('client-step-phone').hidden=step!=='phone';
    $('client-step-code').hidden=step!=='code';
    if(step==='code')setTimeout(()=>$('client-code')?.focus(),50);
  }
  async function sendCode(){
    const phone=digits($('client-phone').value);
    if(phone.length<10){msg('Informe um WhatsApp válido com DDD.');return}
    $('client-consult').disabled=true;msg('Enviando o código pelo WhatsApp...');
    try{
      const data=await call({action:'send',phone});
      pendingPhone=phone;
      $('client-code').value='';
      showStep('code');
      msg(data.message||'Código enviado.');
    }catch(e){msg(e.message)}
    finally{$('client-consult').disabled=false}
  }
  async function verifyCode(){
    const code=digits($('client-code').value);
    if(code.length!==6){msg('Digite os 6 dígitos do código.');return}
    $('client-verify').disabled=true;msg('Conferindo...');
    try{
      const data=await call({action:'verify',phone:pendingPhone,code});
      try{sessionStorage.setItem(TOKEN_KEY,data.token);sessionStorage.setItem(PHONE_KEY,pendingPhone)}catch{}
      render(data.summary);
    }catch(e){msg(e.message)}
    finally{$('client-verify').disabled=false}
  }
  async function resume(token){
    msg('Consultando...');
    try{const data=await call({action:'resume',token});render(data.summary)}
    catch(e){try{sessionStorage.removeItem(TOKEN_KEY)}catch{};showStep('phone');msg('')}
  }
  function render(data){
    if(!data?.found){msg('Não encontramos um cadastro nesse número. Você pode agendar normalmente e seu histórico será iniciado.');showStep('phone');return}
    $('client-login').hidden=true;$('client-result').hidden=false;
    $('client-name').textContent=`Olá, ${data.first_name}!`;
    $('client-points').textContent=`${Number(data.points||0)}/10`;
    $('client-progress-bar').style.width=`${Math.min(100,Number(data.points||0)*10)}%`;
    $('client-reward-text').textContent=Number(data.rewards_available||0)>0?`Você tem ${data.rewards_available} corte(s) gratuito(s) disponível(is)!`:`Faltam ${Math.max(0,10-Number(data.points||0))} cortes para sua próxima recompensa.`;
    $('client-visits').textContent=Number(data.completed_visits||0);
    if(data.next_booking){$('client-next-title').textContent=`${dateBR(data.next_booking.date)} às ${data.next_booking.time}`;$('client-next-text').textContent=`${data.next_booking.services} • ${data.next_booking.status==='confirmed'?'Confirmado':data.next_booking.status==='pending'?'Aguardando confirmação':data.next_booking.status}`}
    else{$('client-next-title').textContent='Nenhum horário marcado';$('client-next-text').textContent='Escolha um serviço e reserve seu próximo atendimento.'}
    if(data.last_visit){$('client-last-title').textContent=dateBR(data.last_visit);$('client-last-text').textContent=data.last_services||'';$('client-repeat').href=`/agendar/?repeat=${encodeURIComponent(data.last_services||'')}#servicos`}
    else{$('client-last-title').textContent='Ainda sem atendimento concluído';$('client-last-text').textContent='Seu histórico aparecerá aqui após o primeiro atendimento.';$('client-repeat').textContent='Agendar primeiro atendimento'}
    msg('');
  }
  function reset(){
    try{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(PHONE_KEY)}catch{}
    $('client-result').hidden=true;$('client-login').hidden=false;showStep('phone');msg('');$('client-phone').focus();
  }
  $('client-consult')?.addEventListener('click',sendCode);
  $('client-phone')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendCode()});
  $('client-verify')?.addEventListener('click',verifyCode);
  $('client-code')?.addEventListener('keydown',e=>{if(e.key==='Enter')verifyCode()});
  $('client-resend')?.addEventListener('click',()=>{showStep('phone');msg('')});
  $('client-change')?.addEventListener('click',reset);
  let savedToken='',savedPhone='';
  try{savedToken=sessionStorage.getItem(TOKEN_KEY)||'';savedPhone=sessionStorage.getItem(PHONE_KEY)||''}catch{}
  if(savedPhone)$('client-phone').value=savedPhone;
  if(savedToken)resume(savedToken);
})();
