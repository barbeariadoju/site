(() => {
  const KEY = 'bdj_cookie_consent_v1';
  const current = localStorage.getItem(KEY);
  const gtag = (...args) => { window.dataLayer = window.dataLayer || []; window.dataLayer.push(args); };
  function update(value){
    const granted = value === 'accepted';
    gtag('consent','update',{
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied'
    });
    localStorage.setItem(KEY,value);
    document.querySelector('.cookie-banner')?.remove();
  }
  if(current) return;
  const banner=document.createElement('section');
  banner.className='cookie-banner';
  banner.setAttribute('role','dialog');
  banner.setAttribute('aria-label','Preferências de privacidade');
  banner.innerHTML=`<div><strong>Privacidade e cookies</strong><p>Usamos ferramentas de medição para melhorar o site e os anúncios. Você pode aceitar ou continuar apenas com os recursos essenciais.</p><a href="privacidade.html">Ler a Política de Privacidade</a></div><div class="cookie-actions"><button type="button" data-cookie="essential">Somente essenciais</button><button class="is-primary" type="button" data-cookie="accepted">Aceitar</button></div>`;
  document.body.appendChild(banner);
  banner.querySelector('[data-cookie="essential"]').onclick=()=>update('essential');
  banner.querySelector('[data-cookie="accepted"]').onclick=()=>update('accepted');
})();
