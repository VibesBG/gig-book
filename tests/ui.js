// Tiny UI test helper: loads ../index.html in an iframe with prepared localStorage.
let n=0; const fails=[]; const frame=document.createElement('iframe'); frame.style.cssText='width:500px;height:900px'; document.body.appendChild(frame);
function ok(name,cond,info){ if(cond) n++; else fails.push('FAIL: '+name+(info!==undefined?' got '+JSON.stringify(info):'')); }
function open(hash,ls){ return new Promise(res=>{ localStorage.clear(); Object.entries(ls||{}).forEach(([k,v])=>localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v)));
  frame.onload=()=>setTimeout(()=>res(frame.contentDocument),300); frame.src='../index.html?'+Math.random()+(hash||''); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(tests){ for(const [name,fn] of tests){ try{ await fn(); }catch(e){ fails.push('ERROR: '+name+' '+e.message); } }
  const out=document.createElement('pre'); out.id='out'; out.textContent=fails.length?fails.join('\n'):'PASS '+n; document.body.appendChild(out); }
