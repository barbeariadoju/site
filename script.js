document.querySelectorAll('[data-copy]').forEach(btn=>{btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);const old=btn.textContent;btn.textContent='Copiado!';setTimeout(()=>btn.textContent=old,1600)}catch(e){alert('Copie manualmente: '+btn.dataset.copy)}})});const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=28.16.1',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}));let bdjSwReloaded=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(bdjSwReloaded)return;bdjSwReloaded=true;window.location.reload()})}

const backTop=document.querySelector('.back-top');
if(backTop){
  window.addEventListener('scroll',()=>backTop.classList.toggle('show',window.scrollY>500));
  backTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}
const welcome=document.getElementById('welcome-pop');
if(welcome){
  const popupKey='bdj_welcome_seen_at';
  const lastSeen=Number(localStorage.getItem(popupKey)||0);
  const thirtyDays=30*24*60*60*1000;
  if(!lastSeen || Date.now()-lastSeen>thirtyDays){
    setTimeout(()=>{welcome.classList.add('open');welcome.setAttribute('aria-hidden','false');localStorage.setItem(popupKey,String(Date.now()))},1200);
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

// clique_agendamento: entrada no funil. O evento já estava declarado como
// evento principal no GA4, mas nada no site disparava — ou seja, tínhamos o
// fim do funil (booking_confirmed) sem o começo, e sem começo não dá pra
// calcular onde as pessoas desistem. Só conta quem ENTRA no funil: cliques
// feitos de dentro de /agendar/ são ignorados, senão "Ir direto à agenda"
// e os botões internos inflariam o topo do funil.
document.addEventListener('click',(event)=>{
  const link=event.target.closest('a[href]');
  if(!link)return;
  let alvo;
  try{alvo=new URL(link.getAttribute('href'),window.location.href)}catch(e){return}
  if(alvo.host!==window.location.host)return;
  if(!/^\/agendar(\/|\.html|$)/.test(alvo.pathname))return;
  if(/^\/agendar\//.test(window.location.pathname))return;
  window.dataLayer=window.dataLayer||[];
  window.dataLayer.push({
    event:'clique_agendamento',
    origem_pagina:window.location.pathname,
    posicao_cta:(link.closest('[id]')||{}).id||'sem-secao'
  });
});

