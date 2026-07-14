(()=>{
  const form=document.getElementById('contact-form');
  if(!form)return;
  const cfg=window.BDJ_AGENDA_CONFIG||{};
  const status=document.getElementById('form-status');
  const button=document.getElementById('contact-submit');
  const name=document.getElementById('nome');
  const phone=document.getElementById('whatsapp');
  const message=document.getElementById('mensagem');
  const honey=form.querySelector('[name="website"]');
  const digits=v=>String(v||'').replace(/\D/g,'');
  const setStatus=(text,type='')=>{status.textContent=text;status.dataset.state=type};
  phone?.addEventListener('input',()=>{
    let v=digits(phone.value).slice(0,11);
    if(v.length>6)phone.value=`(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if(v.length>2)phone.value=`(${v.slice(0,2)}) ${v.slice(2)}`;
    else phone.value=v;
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const payload={
      name:name.value.trim(),
      phone:digits(phone.value),
      message:message.value.trim(),
      website:honey?.value||'',
      page_url:location.href,
      user_agent:navigator.userAgent
    };
    if(payload.name.length<2){setStatus('Digite seu nome completo.','error');name.focus();return}
    if(payload.phone.length<10){setStatus('Digite um WhatsApp com DDD.','error');phone.focus();return}
    if(payload.message.length<10){setStatus('Escreva uma mensagem com pelo menos 10 caracteres.','error');message.focus();return}
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){setStatus('O formulário está temporariamente indisponível. Fale pelo WhatsApp.','error');return}
    button.disabled=true;button.textContent='Enviando…';setStatus('Registrando sua mensagem…','loading');
    try{
      const res=await fetch(`${cfg.supabaseUrl}/functions/v1/contact-form`,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':cfg.supabaseAnonKey,'Authorization':`Bearer ${cfg.supabaseAnonKey}`},
        body:JSON.stringify(payload)
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Falha ao enviar.');
      form.reset();
      setStatus(data.email_sent===false?'Mensagem recebida e salva. Retornaremos pelo WhatsApp assim que possível.':'Mensagem enviada! Retornaremos assim que possível.','success');
    }catch(err){
      console.error(err);
      setStatus('Não foi possível enviar agora. Use o WhatsApp ao lado para falar conosco.','error');
    }finally{button.disabled=false;button.textContent='📩 Enviar mensagem'}
  });
})();
