const CACHE='barbearia-do-ju-v17-agenda-v6';
const CORE=['./','index.html','produtos.html','servicos.html','style.css','script.js','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png','assets/fachada.webp','assets/logo-topo-wide.webp'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url); if(url.origin!==location.origin)return;
 const freshPaths=['/agendar.html','/admin.html','/agenda-v6.js','/agenda-config-v6.js','/admin.js'];
 if(freshPaths.some(p=>url.pathname.endsWith(p))){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('index.html'))));return;}
 event.respondWith(caches.match(event.request).then(cached=>{const network=fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>cached);return cached||network;}));
});
