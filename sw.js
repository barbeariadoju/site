const CACHE = 'barbearia-os-v29-210-1';
// v29.205.0 — sem rede, uma navegação que não está no cache cai numa página própria de
// "sem conexão" (com telefone e endereço), e não mais na home pública — que era o que o
// app do painel mostrava pro Juliano quando a internet caía no meio do atendimento.
const OFFLINE = 'offline.html';
// Dados do painel guardados pra leitura sem internet. Nome fixo: sobrevive às trocas de versão
// (a versão nova do site não apaga a última agenda que o Juliano viu).
const CACHE_DADOS = 'barbearia-os-dados-painel';
const CORE = [
  './',
  'index.html',
  'offline.html',
  '404.html',
  'manifest.webmanifest',
  'admin-manifest.webmanifest',
  'assets/apple-touch-icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-192.png',
  'assets/icon-maskable-512.png',
  'assets/fachada.webp',
  'assets/logo-topo-wide.webp',
  'assets/logo-topo-wide-800.webp'
];

// Resposta que veio de um redirecionamento (ex.: /agendar -> /agendar/) não pode ser usada numa
// navegação: o navegador recusa e a tela fica em erro. Refaz a resposta "limpa".
const semRedirect = r => (r && r.redirected) ? new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }) : r;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      for (const asset of CORE) {
        try { await cache.add(new Request(asset, { cache: 'reload' })); } catch (_) {}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE && key !== CACHE_DADOS).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // v29.205.7 — leitura do painel sem internet: consultas GET do Supabase feitas por uma tela do
  // painel vão pra rede primeiro e guardam a última resposta NO APARELHO; sem rede, a tela mostra
  // a última versão (com aviso — admin-pwa.js). Nada que grava passa aqui (só GET em /rest/v1/).
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith((async () => {
      const cli = event.clientId ? await self.clients.get(event.clientId) : null;
      const doPainel = cli && new URL(cli.url).pathname.startsWith('/admin');
      if (!doPainel) return fetch(req);
      try {
        const r = await fetch(req);
        if (r.ok) { const c = await caches.open(CACHE_DADOS); await c.put(req.url, r.clone()); }
        return r;
      } catch (e) {
        const guardado = await caches.match(req.url, { cacheName: CACHE_DADOS });
        if (guardado) return guardado;
        throw e;
      }
    })());
    return;
  }
  // Biblioteca do Supabase (jsdelivr, versão fixa + SRI): cache primeiro, pra o painel abrir sem internet.
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@supabase/')) {
    event.respondWith(caches.match(req).then(c => c || fetch(req).then(async r => { if (r.ok) { const k = await caches.open(CACHE_DADOS); await k.put(req, r.clone()); } return r; })));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // HTML sempre tenta a rede primeiro. Cache só serve como contingência offline.
  // v29.205.7 — as telas do painel ficam guardadas (sem o ?app=1 etc.) pra abrir sem internet.
  if (req.mode === 'navigate' && url.pathname.startsWith('/admin')) {
    event.respondWith(
      fetch(req, { cache: 'no-store', redirect: 'follow' })
        .then(async response => {
          if (response.ok && !response.redirected) { const c = await caches.open(CACHE); await c.put(url.origin + url.pathname, response.clone()); }
          return response;
        })
        .catch(async () => semRedirect((await caches.match(url.origin + url.pathname)) || (await caches.match(OFFLINE))))
    );
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store', redirect: 'follow' })
        .then(response => response)
        .catch(async () => semRedirect((await caches.match(req)) || (await caches.match(OFFLINE))))
    );
    return;
  }

  // CSS e JavaScript nunca devem ficar presos em versão antiga ou resposta inválida.
  if (req.destination === 'style' || req.destination === 'script' || /\.(css|js)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req, { cache: 'no-cache', redirect: 'follow' })
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(req, response.clone());
          }
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Vídeo e áudio usam Range requests (resposta 206), que a Cache API não
  // suporta armazenar (cache.put lança erro em respostas parciais e o
  // fetch acaba resolvendo como falho). Repassa direto para a rede.
  if (req.destination === 'video' || req.destination === 'audio' || /\.(mp4|webm|mov|m4v|mp3)$/i.test(url.pathname)) {
    event.respondWith(fetch(req));
    return;
  }

  // Imagens e fontes: cache primeiro, com atualização em segundo plano.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, response.clone());
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data?.text() || 'Novo agendamento.' }; }
  const title = data.title || 'Barbearia do Ju';
  const options = {
    body: data.body || 'Novo agendamento aguardando confirmação.',
    icon: data.icon || '/assets/icon-192.png',
    badge: data.badge || '/assets/icon-192.png',
    tag: data.tag || 'booking-notification',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [220, 100, 220],
    timestamp: Date.now(),
    data: { url: data.url || '/admin-agenda.html?app=1', type: data.type || 'booking' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin-agenda.html?app=1', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
