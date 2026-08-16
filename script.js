document.querySelectorAll('[data-copy]').forEach(btn=>{btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);const old=btn.textContent;btn.textContent='Copiado!';setTimeout(()=>btn.textContent=old,1600)}catch(e){alert('Copie manualmente: '+btn.dataset.copy)}})});const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=28.16.1',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}));let bdjSwReloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(bdjSwReloaded)return;bdjSwReloaded=true;window.location.reload()})}

const backTop=document.querySelector('.back-top');
if(backTop){
  window.addEventListener('scroll',()=>backTop.classList.toggle('show',window.scrollY>500));
  backTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}
// O popup abria 1,2s depois do load, em cima do hero, e interceptava o clique
// no CTA principal de quem chegava pela primeira vez. Agora só aparece depois
// que a pessoa rola além do hero SEM ter clicado em agendar — ou seja, pega
// justamente quem não converteu de primeira, que é o público que ele deveria
// ter desde o começo. Mantém o limite de 1 exibição a cada 30 dias.
const welcome=document.getElementById('welcome-pop');
if(welcome){
  const popupKey='bdj_welcome_seen_at';
  const lastSeen=Number(localStorage.getItem(popupKey)||0);
  const thirtyDays=30*24*60*60*1000;
  if(!lastSeen || Date.now()-lastSeen>thirtyDays){
    const hero=document.getElementById('topo');
    let jaMostrou=false;
    const mostrar=()=>{
      if(jaMostrou)return;
      jaMostrou=true;
      welcome.classList.add('open');
      welcome.setAttribute('aria-hidden','false');
      localStorage.setItem(popupKey,String(Date.now()));
      window.dataLayer=window.dataLayer||[];
      window.dataLayer.push({event:'popup_boas_vindas_exibido'});
    };
    // quem clica em agendar antes de rolar nunca vê o popup: já converteu.
    document.addEventListener('click',(e)=>{
      if(e.target.closest('a[href*="/agendar"]'))jaMostrou=true;
    },true);
    if(hero&&'IntersectionObserver' in window){
      const heroObs=new IntersectionObserver((entries)=>{
        entries.forEach((entry)=>{
          if(!entry.isIntersecting){heroObs.disconnect();mostrar()}
        });
      },{threshold:0});
      heroObs.observe(hero);
    }else{
      // sem hero ou sem suporte: cai pro tempo, mas generoso o bastante pra
      // não atropelar a primeira decisão.
      setTimeout(mostrar,15000);
    }
  }
}
document.querySelector('.welcome-close')?.addEventListener('click',()=>{welcome?.classList.remove('open');welcome?.setAttribute('aria-hidden','true')});
welcome?.addEventListener('click',(e)=>{if(e.target===welcome){welcome.classList.remove('open');welcome.setAttribute('aria-hidden','true')}});

// Glow dinâmico: o brilho acompanha o ponteiro em todos os elementos interativos.
document.querySelectorAll('a, button, .link-card, .product-card, .product-photo, .previsit-card, .faq-list details, .google-review-card, .suggestion-section').forEach((el)=>{
  el.addEventListener('pointermove',(event)=>{
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  });
  el.addEventListener('pointerleave',()=>{
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
  });
});

// Nota: a lógica do formulário de contato (máscara, validação e envio) vive
// inteira em contact-form-v24-5.js — não duplicar aqui, senão os dois
// listeners de 'submit' competem e o status/botão pisca com texto errado.

// clique_agendamento vive em funnel-events-v29.js, carregado em todas as
// páginas públicas. Aqui só rodaria em 3 delas.

