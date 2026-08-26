(() => {
  const KEY = 'bdj_cookie_consent_v1';
  const current = localStorage.getItem(KEY);
  // v29.76.0 — o GTM só reconhece comando de consent quando recebe um objeto `arguments`
  // de verdade (o padrão oficial do gtag). A versão antiga empurrava um Array
  // (`push(args)` de arrow function com rest) e o GTM IGNORAVA o consent update: quem
  // clicava "Aceitar" continuava como negado até a PRÓXIMA página (quando o script do
  // <head> relê o localStorage). Descoberto em 26/08 investigando por que 145 cliques
  // de anúncio viravam 6 sessões no GA4.
  function gtag(){ (window.dataLayer = window.dataLayer || []).push(arguments); }
  function update(value){
    const granted = value === 'accepted';
    // v29.77.0 (decisão do Juliano, 26/08): a medição de audiência (analytics_storage)
    // fica SEMPRE concedida — padrão comum no Brasil sob LGPD e o que permite enxergar
    // as sessões no GA4 (antes, quem não clicava "Aceitar" era invisível e 145 cliques
    // de anúncio viravam 6 sessões). O banner passa a decidir só os cookies de ANÚNCIO
    // (ad_storage/ad_user_data/ad_personalization): "Aceitar" concede, "Somente
    // essenciais" nega. O default no <head> das páginas segue a mesma regra.
    gtag('consent','update',{
      analytics_storage: 'granted',
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
  banner.innerHTML=`<div><strong>Privacidade e cookies</strong><p>Usamos medição de audiência de forma agregada para melhorar o site. Você pode aceitar também os cookies de anúncios ou continuar apenas com os essenciais.</p><a href="privacidade.html">Ler a Política de Privacidade</a></div><div class="cookie-actions"><button type="button" data-cookie="essential">Somente essenciais</button><button class="is-primary" type="button" data-cookie="accepted">Aceitar</button></div>`;
  document.body.appendChild(banner);
  banner.querySelector('[data-cookie="essential"]').onclick=()=>update('essential');
  banner.querySelector('[data-cookie="accepted"]').onclick=()=>update('accepted');
})();
