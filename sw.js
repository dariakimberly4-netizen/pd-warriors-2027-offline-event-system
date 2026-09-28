const CACHE='pdw27-offline-event-v3';
const ASSETS=[
 './','./index.html','./styles.css?v=3','./app.js?v=3','./manifest.webmanifest',
 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async cache=>{
    for(const asset of ASSETS){
      try{
        const response=await fetch(asset,{cache:'reload'});
        if(response.ok)await cache.put(asset,response);
      }catch{}
    }
  }))
});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]))
});

self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
        }
        return response;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    fetch(e.request,{cache:'no-store'}).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(e.request,copy));
      }
      return response;
    }).catch(()=>caches.match(e.request))
  )
});