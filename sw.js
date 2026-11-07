const CACHE="suwad-wanasa-shell-v93";
const CORE=["./","./index.html","./styles.css","./delight.css","./app.js","./social.js","./wanasa-voice.js","./online-games.js","./oras-commentator.js","./hussaini-audio.js","./progression.js","./progression.css","./profiles.css","./backend-config.js","./number-input.js","./profiles.css","./game-learning.css","./game-learning.js","./ai-practice.js","./ai-practice.css","./game-ai-practice.js","./game-ai-practice.css","./game-assistant.js","./game-assistant.css","./redesign-2030.css","./standalone-experiences.css","./typing-effects.js","./typing-effects.css","./navigation.js","./who-ai-engine.js","./app-update.js","./chess.js","./chess-game.css","./tavla-rules.js","./snakes-board-art.js","./game-motion.js","./CHESS-LICENSE.txt","./manifest.json","./assets/icon.svg","./assets/apple-touch-icon.png"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SW_ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
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
      .catch(()=>caches.match(request).then(cached=>cached||caches.match(request,{ignoreSearch:true})).then(cached=>{
        if(cached) return cached;
        if(request.mode==="navigate") return caches.match("./index.html");
        return new Response("أنت غير متصل بالإنترنت حالياً.",{
          status:503,
          headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      }))
  );
});


self.addEventListener("push",event=>{
  let payload={title:"سَـوَاد وناسة",body:"عندك إشعار جديد.",url:"./"};
  try{if(event.data)payload={...payload,...event.data.json()}}catch(e){if(event.data)payload.body=event.data.text()}
  event.waitUntil(self.registration.showNotification(payload.title||"سَـوَاد وناسة",{
    body:payload.body||"عندك إشعار جديد.",
    icon:"./assets/apple-touch-icon.png",
    badge:"./assets/apple-touch-icon.png",
    tag:payload.tag||"suwad-social",
    data:{url:payload.url||"./"},
    renotify:false
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"./",self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if(client.url.startsWith(self.location.origin)&&"focus"in client)return client.focus()}
    return clients.openWindow(target);
  }));
});
