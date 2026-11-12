/* Pure logic shared by the app and the tests. No DOM access here. */
const CHORD=/^[A-G](#|b)?(maj13|maj11|maj9|maj7|maj|M7|min|m7b5|m11|m9|m7|m6|m|dim7|dim|°7|°|ø7|ø|aug|\+|sus2|sus4|sus|add2|add4|add9|add11|6\/9|b5|#5|b9|#9|#11|b13|5|6|7|9|11|13|\((maj7|\+oct|[#b]?\d+)\))*(\/[A-G](#|b)?)?$/;
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
const PART_WORD=/^(part|section|част|частта|секция|дял)$/i;
const isChordLine=l=>{ if(/[|│]/.test(l)) return true; const w=l.split(/\s+/); return isChordWord(w[0])&&!(w.length===2&&PART_WORD.test(w[1])); };
function parseChart(text){
  const out=[]; let cur=null, blank=false;
  String(text||'').replace(/\r/g,'').split('\n').forEach(raw=>{
    const l=raw.trim();
    if(!l){ blank=true; return; }
    if(isChordLine(l)){
      // a bar before the repeat mark keeps "Am/G  /x2/" from reading as a /…/ note
      let line=l.replace(/\|/g,'│').replace(/\s*\(?\s*(?:[x×х]\s*(\d+)|(\d+)\s*[x×х])\s*\)?\s*$/i,(m,a,b)=>' │  /x'+(a||b)+'/').replace(/│\s*│(  \/x\d+\/)$/,'│$1');
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
  return (sections||[]).map(s=>[s.l?(isChordLine(s.l)?'['+s.l+']':s.l):null].concat(s.c.map(chartLine)).filter(x=>x!==null).join('\n')).join('\n\n');
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
  const hasChords=Array.isArray(x.sections)&&x.sections.length>0;
  const y={title,key:str(x.key).trim()||(hasChords?'C':''),capo:/^[0-9]$/.test(capo)&&capo!=='0'?capo:'',
    sections:(Array.isArray(x.sections)?x.sections:[]).filter(s=>s&&typeof s==='object').map(s=>({l:str(s.l),c:(Array.isArray(s.c)?s.c:[]).filter(l=>typeof l==='string')}))};
  if(str(x.artist)) y.artist=str(x.artist);
  if('bpm' in x){ const b=parseInt(x.bpm,10); y.bpm=(String(b)===str(x.bpm).trim()&&b>=30&&b<=300)?b:null; }
  if('beats' in x){ const b=parseInt(x.beats,10); if(String(b)===str(x.beats).trim()&&b>=2&&b<=12) y.beats=b; }
  if(x.web===true) y.web=true;
  if(Array.isArray(x.sources)) y.sources=x.sources.filter(u=>typeof u==='string'&&/^https?:\/\//i.test(u));
  if(str(x.webNote)) y.webNote=str(x.webNote);
  if(x.tip&&typeof x.tip==='object') y.tip={en:str(x.tip.en),bg:str(x.tip.bg)};
  if(typeof x.lyrics==='string'&&x.lyrics.trim()) y.lyrics=x.lyrics.replace(/\r/g,'').slice(0,30000);
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
// Updating a gig from a file someone sent: their songs come in, and songs you have that
// weren't in the file stay (added at the end), so a partial send never deletes anything.
function keepMissing(local,incoming,tk){
  const out=clone(incoming); if(!local) return out;
  const have=new Set(); out.sets.forEach(s=>s.songs.forEach(x=>{ if(x[tk]!==undefined) have.add(x[tk]); }));
  const extra=[]; local.sets.forEach(s=>s.songs.forEach(x=>{ if(x[tk]!==undefined&&!have.has(x[tk])){ have.add(x[tk]); extra.push(clone(x)); } }));
  if(extra.length){ if(!out.sets.length) out.sets.push({name:'',songs:[]}); out.sets[out.sets.length-1].songs.push(...extra); }
  return out;
}
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
const BARLIKE=/^(N\.?C\.?|%|[A-H][#b]?[^\s\/]*(\/[A-H][#b]?)?)$/;
function lineBeats(line,beatsPerBar){
  let bars=0, group=0; const barred=/│/.test(line);
  String(line).split('│').forEach(seg=>{
    seg=seg.trim(); if(!seg) return;
    const r=seg.match(/\/x(\d+)\/\s*$/)||seg.match(/^×\s*(\d+)$/);
    const body=seg.replace(/\/x\d+\/\s*$/,'').replace(/^×\s*\d+$/,'').trim();
    // a box is a bar when it holds a chord, even one the app doesn't know, or N.C. or %; words like "riff" don't count
    const words=body.split(/\s+/).filter(w=>isChordWord(w)||BARLIKE.test(w));
    if(words.length) group+=barred?1:words.length;   // without bar lines ("G D Am C") each chord is a bar
    if(r){ bars+=group*(parseInt(r[1],10)||1); group=0; }
  });
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

/* ---------- lyrics ---------- */
// Titles match across chords and lyrics whatever the case, spacing or punctuation.
const norm=t=>String(t).toLowerCase().replace(/[’`]/g,"'").replace(/[^\p{L}\p{N}]/gu,'');
const stKey=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const LABEL_WORDS='chorus|verse|bridge|pre-?chorus|intro|outro|refrain|hook|interlude|coda|tag|solo|припев|куплет|бридж|мост|интро|финал|рефрен|соло';
// a label may carry a repeat: "Chorus x2", "Припев (2х)", "Chorus ×2"
const LABEL=new RegExp('^\\[?\\s*(('+LABEL_WORDS+')(\\s*\\d+)?(\\s*\\(?\\s*(?:[xх×]\\s*\\d+|\\d+\\s*[xх×])\\s*\\)?)?)\\s*\\]?\\s*:?$','i');
const CHORUSY=/^(chorus|refrain|hook|припев|рефрен)/i;
function labelOf(line){
  const l=line.trim(); let m=l.match(LABEL); if(m) return m[1].replace(/\s+/g,' ');
  m=l.match(/^\[\s*([^\]]{1,30}?)\s*\]$/); return m?m[1]:null;
}
// Lyrics text -> stanzas; the chorus (marked, or repeated word for word) is shaded.
function parseLyrics(text){
  const stanzas=String(text||'').replace(/\r/g,'').split(/\n\s*\n/).map(s=>s.replace(/^\n+|\s+$/g,'')).filter(Boolean).map(s=>{
    const lines=s.split('\n'); const label=labelOf(lines[0]);
    return {label,lines:label?lines.slice(1):lines};
  });
  const count={}; stanzas.forEach(s=>{ if(s.lines.length){ const k=stKey(s.lines.join('\n')); count[k]=(count[k]||0)+1; } });
  stanzas.forEach(s=>{ s.rep=!!(s.label&&CHORUSY.test(s.label))||(s.lines.length>0&&count[stKey(s.lines.join('\n'))]>1); });
  return stanzas;
}
// Search: ignore case, accents (й→и, ѝ→и, é→e), apostrophes (don’t = dont) and extra spaces.
// Returns the folded text and, for each folded character, where it came from in the original.
function foldMap(s){ let f='', map=[]; s=String(s);
  for(let i=0;i<s.length;i++){ const c=s[i]; if(/['’‘`´]/.test(c)) continue;
    const d=c.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase(); if(/\s/.test(d)&&/\s$/.test(f)) continue;
    for(const ch of d){ f+=/\s/.test(ch)?' ':ch; map.push(i); } }
  return {f,map}; }
const fold=s=>foldMap(s).f.trim();

// Files from the old Gig Lyrics app: {kind:'lyrics-pack', gigs:[{id,name,sets:[{name,songs:[{t,a,x}]}]}], texts:{x:text}}
function sanitizeLyricsPack(o){
  if(!o||o.kind!=='lyrics-pack'||!Array.isArray(o.gigs)) return null;
  const texts=Object.create(null); Object.entries(o.texts&&typeof o.texts==='object'?o.texts:{}).forEach(([k,v])=>{ if(typeof v==='string') texts[k]=v; });
  const gigs=o.gigs.filter(g=>g&&typeof g.id==='string'&&/^[a-z0-9]+$/.test(g.id)&&typeof g.name==='string'&&Array.isArray(g.sets))
    .map(g=>({id:g.id,name:g.name,sets:g.sets.filter(s=>s&&typeof s==='object').map(s=>({name:str(s.name),songs:(Array.isArray(s.songs)?s.songs:[])
      .filter(x=>x&&typeof x==='object'&&str(x.t).trim()).map(x=>({t:str(x.t).trim(),a:str(x.a),x:str(x.x)}))}))}));
  return {gigs,texts};
}
// Put lyrics into chord gigs. Songs get their lyrics by title (from any lyrics gig); lyrics gigs
// that aren't here yet come in as new gigs; songs a lyrics gig has that its chord gig lacks are added.
// editOf(title) may return your own fixed lyrics for a title, which win.
function mergeLyricsPack(gigs,pack,editOf){
  const out=clone(gigs), own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const textOf=x=>{ const e=editOf&&editOf(x.t); if(typeof e==='string'&&e.trim()) return e; return x.x&&own(pack.texts,x.x)?pack.texts[x.x]:''; };
  const byTitle=Object.create(null);
  pack.gigs.forEach(g=>g.sets.forEach(s=>s.songs.forEach(x=>{ const k=norm(x.t), t=textOf(x); if(t&&!(k in byTitle)) byTitle[k]=t; })));
  const lyr=t=>byTitle[norm(t)]||'';
  out.forEach(g=>g.sets.forEach(s=>s.songs.forEach(x=>{ if(x.title&&!x.lyrics&&lyr(x.title)) x.lyrics=lyr(x.title); })));
  const toSong=x=>{ const y={title:x.t,key:'',capo:'',sections:[]}; if(x.a) y.artist=x.a; const t=textOf(x)||lyr(x.t); if(t) y.lyrics=t; return y; };
  pack.gigs.forEach(lg=>{
    const g=out.find(e=>e.id===lg.id);
    if(!g){ out.push({id:lg.id,name:lg.name,sets:lg.sets.map(s=>({name:s.name,songs:s.songs.map(toSong)}))}); return; }
    const have=new Set(); g.sets.forEach(s=>s.songs.forEach(x=>{ if(x.title) have.add(norm(x.title)); }));
    const extra=[]; lg.sets.forEach(s=>s.songs.forEach(x=>{ const k=norm(x.t); if(!have.has(k)){ have.add(k); extra.push(toSong(x)); } }));
    if(extra.length){ if(!g.sets.length) g.sets.push({name:'',songs:[]}); g.sets[g.sets.length-1].songs.push(...extra); }
  });
  return out;
}
