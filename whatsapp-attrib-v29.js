/* Atribuição de WhatsApp — v29.139.0
 *
 * Quando alguém sai do site pro WhatsApp, o vínculo com a visita se perde: a
 * conversa começa do zero e o agendamento que nasce dela fica órfão de origem.
 * Como ~90% dos agendamentos vêm da JuIA no WhatsApp, isso deixava a maior parte
 * do resultado invisível pro Google Ads.
 *
 * Aqui a gente gruda um código curto no texto da mensagem e guarda, no servidor,
 * de qual visita ele veio. A JuIA lê esse código na primeira mensagem.
 *
 * v29.139.0 — iPhone: o Google manda TRÊS identificadores de clique diferentes, e
 * eles NÃO são intercambiáveis. `gclid` é o normal; `wbraid` e `gbraid` aparecem em
 * tráfego de iOS quando o usuário não deu consentimento de rastreamento (ATT), que
 * na base de clientes daqui é gente demais pra ignorar. Até a v29.138.0 os três
 * caíam na mesma variável e iam para a coluna de gclid na importação — e o Google
 * DESCARTA em silêncio uma linha cujo gclid ele não reconhece. Agora cada um viaja
 * no seu próprio campo.
 *
 * Regra de ouro deste arquivo: NADA aqui pode impedir o cliente de abrir o
 * WhatsApp. Toda falha é engolida e o clique segue normal.
 */
(() => {
  'use strict';

  var CFG = window.BDJ_AGENDA_CONFIG || {};
  var ENDPOINT = CFG.supabaseUrl ? CFG.supabaseUrl + '/functions/v1/whatsapp-attribution' : null;
  var CLICKID_KEY = 'bdj_gclid_v1';
  var CLICKID_TTL = 90 * 24 * 60 * 60 * 1000; // 90 dias, mesma janela do Ads
  var TIPOS = ['gclid', 'wbraid', 'gbraid'];

  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }

  // Guarda o identificador do clique assim que a pessoa chega pelo anúncio — ela
  // pode navegar várias páginas antes de clicar no WhatsApp. Guarda também QUAL dos
  // três é: mandar um wbraid no campo de gclid faz a conversão ser descartada.
  function rememberClickId() {
    try {
      for (var i = 0; i < TIPOS.length; i++) {
        var v = param(TIPOS[i]);
        if (v) {
          localStorage.setItem(CLICKID_KEY, JSON.stringify({ v: v, t: Date.now(), k: TIPOS[i] }));
          return;
        }
      }
    } catch (e) { /* modo privado, tudo bem */ }
  }

  function readClickId() {
    try {
      var raw = localStorage.getItem(CLICKID_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.v || (Date.now() - o.t) > CLICKID_TTL) return null;
      // registros gravados antes da v29.139.0 não têm `k`; eram sempre tratados
      // como gclid, então seguem assim.
      return { v: o.v, k: TIPOS.indexOf(o.k) >= 0 ? o.k : 'gclid' };
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
    var click = readClickId();
    var corpo = {
      token: token,
      ga_client_id: gaClientId(),
      gclid: null,
      wbraid: null,
      gbraid: null,
      landing_page: location.pathname + location.search,
      referrer: document.referrer || null,
      utm_source: param('utm_source'),
      utm_medium: param('utm_medium'),
      utm_campaign: param('utm_campaign')
    };
    if (click) corpo[click.k] = click.v;
    var payload = JSON.stringify(corpo);
    try {
      // sendBeacon sobrevive à navegação pro WhatsApp; fetch nem sempre.
      //
      // ARMADILHA (descoberta testando ao vivo, v29.2.0): o Blob PRECISA ir como
      // text/plain. Com application/json o navegador exige uma verificação prévia
      // de CORS, e sendBeacon não sabe fazê-la — a requisição morre em silêncio,
      // sem erro no console. O servidor lê o corpo como JSON de qualquer forma.
      if (navigator.sendBeacon) {
        if (navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'text/plain;charset=UTF-8' }))) return;
      }
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: payload, keepalive: true }).catch(function () {});
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

  rememberClickId();
  document.addEventListener('click', onClick, true);
})();
