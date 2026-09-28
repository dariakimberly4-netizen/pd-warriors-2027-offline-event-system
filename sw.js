const CACHE='pdw27-offline-event-v6';
const ASSETS=[
 './orbit-v6.html','./styles-v6.css?v=6','./app-v6.js?v=6','./manifest.webmanifest',
 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install',e=>{
 self.skipWaiting();
 e.waitUntil(caches.open(CACHE).then(async cache=>{
   for(const asset of ASSETS){
     try{
       const r=await fetch(asset,{cache:'reload'});
       if(r.ok)await cache.put(asset,r);
     }catch{}
   }
 }))
});

self.addEventListener('activate',e=>e.waitUntil(Promise.all([
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
 self.clients.claim()
])));

self.addEventListener('fetch',e=>{
 if(e.request.mode==='navigate'){
   e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match('./orbit-v6.html')));
   return;
 }
 e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
   if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
   return r;
 }).catch(()=>caches.match(e.request)))
});