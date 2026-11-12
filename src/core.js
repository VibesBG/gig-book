/* Pure logic shared by the app and the tests. No DOM access here. */
const CHORD=/^[A-G](#|b)?(maj7|maj9|maj|min|m7|m9|m6|m|dim7|dim|aug|sus2|sus4|sus|add9|add11|5|6|7|9|11|13|\(\+oct\))*(\/[A-G](#|b)?)?$/;
const isChordWord=w=>{const p=w.split(/-|→|\.\.\./).filter(Boolean);return p.length>0&&p.every(x=>CHORD.test(x))};
function tokens(line){
  const out=[];
  line.split('│').forEach(seg=>{
    seg=seg.trim(); if(!seg) return;
    seg.split(/(\/[^\/]+\/)/).forEach(part=>{
      part=part.trim(); if(!part) return;
      let m=part.match(/^\/x(\d+)\/$/);
      if(m){out.push({k:'rep',v:'×'+m[1]});return}
      if(/^\/.+\/$/.test(part)){out.push({k:'loud',v:part.slice(1,-1).trim()});return}
      m=part.match(/^×\s*(\d+)$/);
      if(m){out.push({k:'rep',v:'×'+m[1]});return}
      const w=part.split(/\s+/); let i=0;
      while(i<w.length&&isChordWord(w[i])) i++;
      if(i>0) out.push({k:'ch',v:w.slice(0,i).join(' ')});
      if(i<w.length) out.push({k:'note',v:w.slice(i).join(' ')});
    });
  });
  return out;
}

/* ---------- typed chart <-> sections ---------- */
// A chord line has a bar (| or │) or starts with a chord. Anything else is a section label.
const isChordLine=l=>/[|│]/.test(l)||isChordWord(l.split(/\s+/)[0]);
function parseChart(text){
  const out=[]; let cur=null, blank=false;
  String(text||'').replace(/\r/g,'').split('\n').forEach(raw=>{
    const l=raw.trim();
    if(!l){ blank=true; return; }
    if(isChordLine(l)){
      // a bar before the repeat mark keeps "Am/G  /x2/" from reading as a /…/ note
      let line=l.replace(/\|/g,'│').replace(/\s*\(?\s*[x×]\s*(\d+)\s*\)?\s*$/i,(m,n)=>' │  /x'+n+'/').replace(/│\s*│(  \/x\d+\/)$/,'│$1');
      if(!cur||(blank&&cur.c.length)){ cur={l:'',c:[]}; out.push(cur); }
      cur.c.push(line);
    } else {
      cur={l:l.replace(/^\[\s*|\s*\]$/g,'').replace(/\s*:$/,'').trim(),c:[]}; out.push(cur);
    }
    blank=false;
  });
  return out;
}
function chartLine(line){
  const m=line.match(/^(.*?)\s*\/x(\d+)\/\s*$/);
  let body=(m?m[1]:line).replace(/│/g,'|').trim().replace(/^\|\s*/,'').replace(/\s*\|$/,'').trim();
  if(!/\|/.test(body)&&!isChordWord(body.split(/\s+/)[0]||'')) body='| '+body; // keep it a chord line on the way back
  return body+(m?'  x'+m[2]:'');
}
function serializeChart(sections){
  return (sections||[]).map(s=>[s.l?s.l:null].concat(s.c.map(chartLine)).filter(x=>x!==null).join('\n')).join('\n\n');
}

/* ---------- gigs and files ---------- */
const newId=now=>'u'+now.toString(36);
const clone=o=>JSON.parse(JSON.stringify(o));
// Files come from other people: keep only the fields the app knows, with the right types.
const str=v=>typeof v==='string'?v:(typeof v==='number'?String(v):'');
function sanitizeSong(x){
  if(!x||typeof x!=='object') return null;
  if(typeof x.break==='string') return {break:x.break};
  const title=str(x.title).trim(); if(!title) return null;
  const capo=str(x.capo).trim();
  const y={title,key:str(x.key).trim()||'C',capo:/^[0-9]$/.test(capo)&&capo!=='0'?capo:'',
    sections:(Array.isArray(x.sections)?x.sections:[]).filter(s=>s&&typeof s==='object').map(s=>({l:str(s.l),c:(Array.isArray(s.c)?s.c:[]).filter(l=>typeof l==='string')}))};
  if(str(x.artist)) y.artist=str(x.artist);
  if('bpm' in x){ const b=parseInt(x.bpm,10); y.bpm=(String(b)===str(x.bpm).trim()&&b>=30&&b<=300)?b:null; }
  if('beats' in x){ const b=parseInt(x.beats,10); if(String(b)===str(x.beats).trim()&&b>=2&&b<=12) y.beats=b; }
  if(x.web===true) y.web=true;
  if(Array.isArray(x.sources)) y.sources=x.sources.filter(u=>typeof u==='string'&&/^https?:\/\//i.test(u));
  if(str(x.webNote)) y.webNote=str(x.webNote);
  if(x.tip&&typeof x.tip==='object') y.tip={en:str(x.tip.en),bg:str(x.tip.bg)};
  return y;
}
function sanitizeGig(g){
  if(!g||typeof g.id!=='string'||!/^[a-z0-9]+$/.test(g.id)||typeof g.name!=='string'||!Array.isArray(g.sets)) return null;
  return {id:g.id,name:g.name,sets:g.sets.filter(s=>s&&typeof s==='object').map(s=>({name:str(s.name),songs:(Array.isArray(s.songs)?s.songs:[]).map(sanitizeSong).filter(Boolean)}))};
}
const sanitizeGigs=a=>Array.isArray(a)?a.map(sanitizeGig).filter(Boolean):[];
function validateGigFile(o){
  if(!o||o.kind!=='setlists-gigs'||!Array.isArray(o.gigs)) return {ok:false,error:'not a setlist file'};
  const gigs=sanitizeGigs(o.gigs);
  return gigs.length===o.gigs.length?{ok:true,gigs}:{ok:false,error:'broken gig in file'};
}
const makeGigFile=(gigs,today)=>({kind:'setlists-gigs',v:1,made:today,gigs:clone(gigs)});
const importConflicts=(existing,incoming)=>incoming.filter(g=>existing.some(e=>e.id===g.id)).map(g=>g.id);
function applyImport(existing,incoming,mode){
  const out=clone(existing);
  clone(incoming).forEach(g=>{
    const i=out.findIndex(e=>e.id===g.id);
    if(i<0){ out.push(g); return; }
    if(mode==='replace'){ out[i]=g; return; }
    let n=2; while(out.some(e=>e.id===g.id+n)) n++;
    g.id=g.id+n; g.name=g.name+' ('+n+')'; out.push(g);
  });
  return out;
}

/* ---------- gig editor list ---------- */
function flattenGig(gig){
  const items=[];
  gig.sets.forEach((s,i)=>{
    if(s.name||i>0) items.push({k:'set',name:s.name});
    s.songs.forEach(x=>items.push(x.break!==undefined?{k:'break',text:x.break}:{k:'song',song:x}));
  });
  return items;
}
function unflattenGig(items){
  const sets=[];
  items.forEach(it=>{
    if(it.k==='set'){ sets.push({name:it.name,songs:[]}); return; }
    if(!sets.length) sets.push({name:'',songs:[]});
    sets[sets.length-1].songs.push(it.k==='break'?{break:it.text}:it.song);
  });
  return sets;
}

/* ---------- auto-scroll timing ---------- */
// One chord box between bar lines = one bar. A ×N repeat plays the bars since the previous
// repeat (or the start of the line) N times: "│ C │ G │ /x3/ │ D │" = C G C G C G D.
function lineBeats(line,beatsPerBar){
  let bars=0, group=0;
  tokens(line).forEach(x=>{ if(x.k==='ch') group++; else if(x.k==='rep'){ bars+=group*(parseInt(x.v.slice(1),10)||1); group=0; } });
  return Math.max(1,bars+group)*(beatsPerBar||4);
}
// Every chord line of the song in screen order, with its start and length in beats.
function songTimeline(sections,beatsPerBar){
  const out=[]; let at=0;
  (sections||[]).forEach(s=>s.c.forEach(line=>{ const b=lineBeats(line,beatsPerBar); out.push({start:at,beats:b}); at+=b; }));
  return out;
}

/* ---------- share links ---------- */
// A share link is <app address>#get=<code>. Everything after # stays on the phones: GitHub never sees it.
// code = "z" + base64url(deflate(JSON)), or "j" + base64url(JSON) where the browser can't compress.
function b64uEnc(bytes){ let s=''; for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64uDec(s){ const b=atob(String(s).replace(/-/g,'+').replace(/_/g,'/').replace(/\s+/g,'')); const out=new Uint8Array(b.length); for(let i=0;i<b.length;i++) out[i]=b.charCodeAt(i); return out; }
const pipeBytes=(bytes,stream)=>new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(b=>new Uint8Array(b));
async function packShare(obj,noZip){
  const raw=new TextEncoder().encode(JSON.stringify(obj));
  if(!noZip&&typeof CompressionStream==='function'){ try{ return 'z'+b64uEnc(await pipeBytes(raw,new CompressionStream('deflate-raw'))); }catch(e){} }
  return 'j'+b64uEnc(raw);
}
async function unpackShare(code){
  code=String(code||''); const kind=code[0]; let bytes=b64uDec(code.slice(1));
  if(kind==='z'){ if(typeof DecompressionStream!=='function') throw new Error('old browser'); bytes=await pipeBytes(bytes,new DecompressionStream('deflate-raw')); }
  else if(kind!=='j') throw new Error('not a share code');
  return JSON.parse(new TextDecoder().decode(bytes));
}
// The part of a link after #get= (the link may have been pasted with text around it).
const shareCodeOf=text=>{ const m=String(text||'').match(/#get=([A-Za-z0-9_-]+)/); return m?m[1]:null; };
const senderName=v=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,40):'';
// Keep only the chosen songs (by position in the gig); sets left empty are dropped.
function pickSongs(gig,keep){
  let i=0;
  return {id:gig.id,name:gig.name,sets:gig.sets.map(s=>({name:s.name,songs:s.songs.filter(x=>(x.title===undefined&&x.t===undefined)?true:keep.has(i++))}))
    .map(s=>({name:s.name,songs:s.songs.filter((x,k,a)=>!(x.break!==undefined&&(k===0||k===a.length-1||a[k-1].break!==undefined)))}))
    .filter(s=>s.songs.some(x=>x.title!==undefined||x.t!==undefined))};
}
