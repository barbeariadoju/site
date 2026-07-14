const CACHE = 'barbearia-os-v24-5-0';
const CORE = [
  './',
  'index.html',
  'servicos.html',
  'produtos.html',
  'cliente.html',
  '404.html',
  'privacidade.html',
  'style.css?v=24.3',
  'script.js?v=24.3',
  'privacy-consent-v22-4.js?v=24.3',
  'manifest.webmanifest',
  'admin-manifest.webmanifest',
  'admin-pwa.js?v=24.3',
  'assets/apple-touch-icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/fachada.webp',
  'assets/logo-topo-wide.webp'
];

const NEVER_CACHE = [
  '/agendar.html',
  '/cliente.html',
  '/admin.html',
  '/admin-agenda.html',
  '/admin-atendimento.html',
  '/admin-agendamento.html',
  '/admin-clientes.html',
  '/admin-assistente.html',
  '/admin-mensagens.html',
  '/agenda-config-v6.js',
  '/agenda-v15.js',
  '/cliente-v23.js',
  '/juia-chat.js',
  '/service-cart-v22-5.js',
  '/services-catalog-v7.js',
  '/admin-v15-4.js',
  '/admin-assistente-v16.js',
  '/admin-messages-v24-5.js',
  '/contact-form-v24-5.js',
  '/admin-ux-v22-4.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (NEVER_CACHE.some(path => url.pathname.endsWith(path))) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
