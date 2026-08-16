// clique_agendamento: entrada no funil.
//
// O evento já estava declarado como evento principal no GA4, mas nada no site
// disparava — tínhamos o fim do funil (booking_confirmed) sem o começo, e sem
// começo não dá pra calcular onde as pessoas desistem.
//
// Mora num arquivo próprio, e não no script.js, porque o script.js só é
// carregado em index.html, produtos.html e agendar/index.html. As 34 páginas
// públicas restantes — todas as de serviço, o blog, o hub de serviços — têm
// CTA de agendar e ficariam sem medição nenhuma, que é justamente o tráfego
// de SEO que queremos medir.
(() => {
  // Guarda contra dupla inclusão: se a página carregar este arquivo duas vezes,
  // o listener dispararia o evento em duplicidade e inflaria o topo do funil.
  if (window.__bdjFunnelEventsLoaded) return;
  window.__bdjFunnelEventsLoaded = true;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    let alvo;
    try { alvo = new URL(link.getAttribute('href'), window.location.href); } catch (e) { return; }
    if (alvo.host !== window.location.host) return;
    if (!/^\/agendar(\/|\.html|$)/.test(alvo.pathname)) return;

    // Cliques feitos de dentro de /agendar/ não são entrada no funil: contar
    // "Ir direto à agenda" e os botões internos infla o topo e faz a taxa de
    // conversão parecer pior do que é.
    if (/^\/agendar\//.test(window.location.pathname)) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'clique_agendamento',
      origem_pagina: window.location.pathname,
      posicao_cta: (link.closest('[id]') || {}).id || 'sem-secao'
    });
  });
})();
