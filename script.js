document.querySelectorAll('[data-copy]').forEach(btn=>{btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy);const old=btn.textContent;btn.textContent='Copiado!';setTimeout(()=>btn.textContent=old,1600)}catch(e){alert('Copie manualmente: '+btn.dataset.copy)}})});const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}

const backTop=document.querySelector('.back-top');
if(backTop){
  window.addEventListener('scroll',()=>backTop.classList.toggle('show',window.scrollY>500));
  backTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}
const welcome=document.getElementById('welcome-pop');
if(welcome){
  // Exibe o convite de agendamento sempre que a página é aberta.
  // Assim ele continua ajudando na conversão, inclusive durante testes e divulgações.
  setTimeout(()=>{welcome.classList.add('open');welcome.setAttribute('aria-hidden','false')},1200);
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


const suggestionForm=document.getElementById('suggestion-form');
if(suggestionForm){
  suggestionForm.addEventListener('submit',(event)=>{
    event.preventDefault();
    const name=document.getElementById('clientName')?.value.trim();
    const message=document.getElementById('clientMessage')?.value.trim();
    if(!message){alert('Escreva sua dúvida ou sugestão antes de enviar.');return;}
    const text=`Olá Juliano! Vim pelo site da Barbearia do Ju.

${name?`Meu nome é ${name}.
`:''}Minha dúvida/sugestão:
${message}`;
    window.open(`https://wa.me/5511967073038?text=${encodeURIComponent(text)}`,'_blank','noopener');
  });
}
