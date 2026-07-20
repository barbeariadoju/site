document.querySelectorAll('[data-copy]').forEach(btn=>{btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);const old=btn.textContent;btn.textContent='Copiado!';setTimeout(()=>btn.textContent=old,1600)}catch(e){alert('Copie manualmente: '+btn.dataset.copy)}})});const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=28.0.11',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}))}

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




// Formulário de contato: máscara, validação e prevenção de cliques duplicados.
const contactForm=document.getElementById('contact-form');
const whatsappInput=document.getElementById('whatsapp');
const contactSubmit=document.getElementById('contact-submit');
const formStatus=document.getElementById('form-status');

function formatPhone(value){
  const digits=value.replace(/\D/g,'').slice(0,11);
  if(digits.length<=2) return digits;
  if(digits.length<=6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if(digits.length<=10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

whatsappInput?.addEventListener('input',()=>{
  whatsappInput.value=formatPhone(whatsappInput.value);
  whatsappInput.setCustomValidity('');
});

contactForm?.addEventListener('submit',(event)=>{
  const digits=whatsappInput?.value.replace(/\D/g,'')||'';
  if(digits.length<10||digits.length>11){
    event.preventDefault();
    whatsappInput?.setCustomValidity('Digite um WhatsApp válido com DDD.');
    whatsappInput?.reportValidity();
    whatsappInput?.focus();
    return;
  }
  whatsappInput?.setCustomValidity('');
  if(contactSubmit){
    contactSubmit.disabled=true;
    contactSubmit.textContent='Enviando…';
  }
  if(formStatus) formStatus.textContent='A página de confirmação será aberta em uma nova guia.';
  window.setTimeout(()=>{
    if(contactSubmit){contactSubmit.disabled=false;contactSubmit.textContent='📩 Enviar mensagem';}
  },4000);
});

