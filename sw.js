const CACHE="suwad-wanasa-shell-v53";
const CORE=["./","./index.html","./styles.css","./delight.css?v=20261102-04","./app.js?v=20261102-14","./social.js","./online-games.js?v=20261102-10","./hussaini-audio.js?v=20261102-03","./progression.js","./progression.css","./backend-config.js","./manifest.json","./assets/icon.svg","./assets/animations/home-section-motifs.gif?v=1","./ai-companions.css?v=20261102-01","./liar-online.css?v=20261102-01","./domino-online.css?v=20261102-01","./ai-companions.js?v=20261102-05"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("suwad-wanasa-shell-")&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

// Always try the network first so users receive the newest JavaScript and styles.
// Use the cached copy only when the device is offline.
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET") return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  event.respondWith(
    fetch(request,{cache:"no-cache"})
      .then(response=>{
        if(response && response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(request,{ignoreSearch:true}).then(cached=>{
        if(cached) return cached;
        if(request.mode==="navigate") return caches.match("./index.html");
        return new Response("أنت غير متصل بالإنترنت حالياً.",{
          status:503,
          headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      }))
  );
});
