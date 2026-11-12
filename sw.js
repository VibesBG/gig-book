// Offline support. The app is saved on the first visit, so it opens at a venue with no internet.
// Online it takes the newest version, but if the signal is weak (no answer in 3 s) it opens the saved copy.
const CACHE='chords-sheet-v4';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(k=>k.addAll(['./','manifest.webmanifest','icon-192.png','icon-512.png'])).catch(()=>{}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&/^(chords-sheet|setlists)-/.test(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url), font=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  const sdk=u.hostname==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/');   // the sync code, so it starts offline too
  if(u.origin!==location.origin&&!font&&!sdk) return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{
    // only good answers are saved: never an error page or a Wi-Fi login page
    const net=fetch(r).then(res=>{ if((res.ok&&!res.redirected)||(font&&res.type==='opaque')){ const c=res.clone(); caches.open(CACHE).then(k=>k.put(r,c)); } return res; });
    if(!hit) return net.catch(()=>caches.match('./').then(m=>m||Response.error()));
    return Promise.race([net.then(res=>res.ok?res:hit,()=>hit),new Promise(ok=>setTimeout(()=>ok(hit),3000))]);
  }));
});
