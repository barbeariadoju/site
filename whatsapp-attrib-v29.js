/* Atribuição de WhatsApp — v29.2.0
 *
 * Quando alguém sai do site pro WhatsApp, o vínculo com a visita se perde: a
 * conversa começa do zero e o agendamento que nasce dela fica órfão de origem.
 * Como ~90% dos agendamentos vêm da JuIA no WhatsApp, isso deixava a maior parte
 * do resultado invisível pro Google Ads.
 *
 * Aqui a gente gruda um código curto no texto da mensagem e guarda, no servidor,
 * de qual visita ele veio. A JuIA lê esse código na primeira mensagem.
 *
 * Regra de ouro deste arquivo: NADA aqui pode impedir o cliente de abrir o
 * WhatsApp. Toda falha é engolida e o clique segue normal.
 */
(() => {
  'use strict';

  var CFG = window.BDJ_AGENDA_CONFIG || {};
  var ENDPOINT = CFG.supabaseUrl ? CFG.supabaseUrl + '/functions/v1/whatsapp-attribution' : null;
  var GCLID_KEY = 'bdj_gclid_v1';
  var GCLID_TTL = 90 * 24 * 60 * 60 * 1000; // 90 dias, mesma janela do Ads

  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }

  // Guarda o gclid assim que a pessoa chega pelo anúncio — ela pode navegar
  // várias páginas antes de clicar no WhatsApp.
  function rememberGclid() {
    try {
      var g = param('gclid') || param('wbraid') || param('gbraid');
      if (g) localStorage.setItem(GCLID_KEY, JSON.stringify({ v: g, t: Date.now() }));
    } catch (e) { /* modo privado, tudo bem */ }
  }

  function readGclid() {
    try {
      var raw = localStorage.getItem(GCLID_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.v || (Date.now() - o.t) > GCLID_TTL) return null;
      return o.v;
    } catch (e) { return null; }
  }

  // client_id do GA4 vive no cookie _ga como GA1.1.<id>.<ts>
  function gaClientId() {
    try {
      var m = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  function newToken() {
    var s = 'abcdefghijkmnopqrstuvwxyz23456789'; // sem l/1/0/o pra não confundir
    var out = '';
    try {
      var buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      for (var i = 0; i < 8; i++) out += s[buf[i] % s.length];
    } catch (e) {
      for (var j = 0; j < 8; j++) out += s[Math.floor(Math.random() * s.length)];
    }
    return out;
  }

  function record(token) {
    if (!ENDPOINT) return;
    var payload = JSON.stringify({
      token: token,
      ga_client_id: gaClientId(),
      gclid: readGclid(),
      landing_page: location.pathname + location.search,
      referrer: document.referrer || null,
      utm_source: param('utm_source'),
      utm_medium: param('utm_medium'),
      utm_campaign: param('utm_campaign')
    });
    try {
      // sendBeacon sobrevive à navegação pro WhatsApp; fetch nem sempre.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
        return;
      }
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    } catch (e) { /* segue o jogo */ }
  }

  // Só marca links que levam a uma conversa (wa.me / api.whatsapp.com).
  function isWhatsappLink(href) {
    return /(^|\/\/)(wa\.me|api\.whatsapp\.com)/i.test(href || '');
  }

  function tag(href, token) {
    try {
      var url = new URL(href, location.href);
      var text = url.searchParams.get('text') || 'Olá! Vim pelo site da Barbearia do Ju.';
      if (/\[#[a-z0-9]{6,12}\]/i.test(text)) return href; // já marcado
      url.searchParams.set('text', text + '\n\n[#' + token + ']');
      return url.toString();
    } catch (e) { return href; }
  }

  function onClick(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a || !isWhatsappLink(a.getAttribute('href'))) return;
    try {
      var token = newToken();
      record(token);
      a.setAttribute('href', tag(a.getAttribute('href'), token));
    } catch (e) { /* nunca bloquear o clique */ }
  }

  rememberGclid();
  document.addEventListener('click', onClick, true);
})();
