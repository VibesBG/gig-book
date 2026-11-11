// Offline support: always try the network first, fall back to the last saved copy.
const CACHE='setlists-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(u.origin!==location.origin&&!/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return;
  e.respondWith(fetch(r).then(res=>{ const c=res.clone(); caches.open(CACHE).then(k=>k.put(r,c)); return res; })
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./'))));
});
