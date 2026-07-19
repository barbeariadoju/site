const CACHE = 'barbearia-os-v28-0-3';
const OFFLINE = 'index.html';
const CORE = [
  './',
  'index.html',
  '404.html',
  'manifest.webmanifest',
  'admin-manifest.webmanifest',
  'assets/apple-touch-icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/fachada.webp',
  'assets/logo-topo-wide.webp'
];

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
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML sempre tenta a rede primeiro. Cache só serve como contingência offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store', redirect: 'follow' })
        .then(response => response)
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE)))
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
