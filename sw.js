const CACHE='pdw27-offline-event-v1';
const ASSETS=[
 './','./index.html','./styles.css?v=1','./app.js?v=1','./manifest.webmanifest',
 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(async c=>{for(const a of ASSETS){try{const r=await fetch(a,{cache:'reload'});if(r.ok)await c.put(a,r)}catch{}}}))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)))});
