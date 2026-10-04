// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== Argon2 im Worker (Fallback: Hauptthread) =====
const A2=argon2Factory();
const workerSrc=argon2Factory.toString()+';const A=argon2Factory();onmessage=e=>{try{const r=A.argon2({...e.data,onProgress:x=>postMessage({progress:x})});postMessage({result:r});}catch(err){postMessage({error:String(err)});}};';
function argon2Run(params,onProgress){
  return new Promise((res,rej)=>{
    const fallback=()=>setTimeout(()=>{try{res(A2.argon2({...params,onProgress}));}catch(e){rej(e);}},30);
    let w;try{w=new Worker(URL.createObjectURL(new Blob([workerSrc],{type:'text/javascript'})));}catch(e){return fallback();}
    w.onmessage=e=>{const d=e.data;if(d.progress!==undefined){onProgress&&onProgress(d.progress);return;}w.terminate();d.error?rej(new Error(d.error)):res(d.result);};
    w.onerror=e=>{e.preventDefault();w.terminate();fallback();};
    w.postMessage(params);});}

// ===== App-Einstellungen (nur auf diesem Gerät) =====
const PREF_DEF={theme:'auto',idle:10,lockOnHide:false,dateSuffix:true,compact:false,groupsHidden:false};
let prefs={...PREF_DEF};try{Object.assign(prefs,JSON.parse(localStorage.getItem('tresor-prefs')||'{}'));}catch(e){}
function savePrefs(){try{localStorage.setItem('tresor-prefs',JSON.stringify(prefs));}catch(e){}applyPrefs();}
function applyPrefs(){const r=document.documentElement;if(prefs.theme==='auto')delete r.dataset.theme;else r.dataset.theme=prefs.theme;
  document.body.classList.toggle('compact',!!prefs.compact);document.body.classList.toggle('no-groups',!!prefs.groupsHidden);document.body.classList.toggle('focus',!!prefs.focus);}

// ===== Zustand =====
const S={copied:null,db:null,fileName:'',fileBytes:null,fileHandle:null,keyFile:null,keyFileName:'',dirty:false,group:'all',entry:null,query:'',pending:false};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON={
  folder:'<svg class="i" viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3z"/></svg>',
  all:'<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>',
  trash:'<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  copy:'<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>',
  eye:'<svg class="i" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg class="i" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  ext:'<svg class="i" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  edit:'<svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  plus:'<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back:'<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  dice:'<svg class="i" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".8"/><circle cx="15" cy="15" r=".8"/><circle cx="15" cy="9" r=".8"/><circle cx="9" cy="15" r=".8"/></svg>',
  dl:'<svg class="i" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  shield:'<svg class="i" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  check:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  clip:'<svg class="i" viewBox="0 0 24 24"><path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/></svg>',
  list:'<svg class="i" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  search:'<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
  dots:'<svg class="i" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
};
function toast(msg,action){const t=$('toast');t.innerHTML='';const sp=document.createElement('span');sp.textContent=msg;t.appendChild(sp);
  if(action){const b=document.createElement('button');b.type='button';b.textContent=action.label;b.onclick=()=>{t.classList.remove('on');action.fn();};t.appendChild(b);}
  t.classList.toggle('act',!!action);t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),action?6500:2200);}

// ===== Datenmodell auf dem XML-Baum =====
const STD=['Title','UserName','Password','URL','Notes'];
const meta=()=>X.kid(S.db.xml,'Meta');
const rootGroup=()=>X.kid(X.kid(S.db.xml,'Root'),'Group');
const uuidOf=el=>X.text(X.kid(el,'UUID'));
const gName=g=>X.text(X.kid(g,'Name'))||'Ohne Namen';
function str(e,k){for(const s of X.kids(e,'String'))if(X.text(X.kid(s,'Key'))===k)return X.text(X.kid(s,'Value'));return '';}
function strEl(e,k){return X.kids(e,'String').find(s=>X.text(X.kid(s,'Key'))===k);}
function setStr(e,k,v,prot){
  let s=strEl(e,k);
  if(!s){s=X.el('String');X.append(s,X.el('Key',k));X.append(s,X.el('Value'));
    const ss=X.kids(e,'String');let idx;
    if(ss.length)idx=e.children.indexOf(ss[ss.length-1])+1;
    else{const nx=e.children.find(c=>c.name==='Binary'||c.name==='AutoType'||c.name==='History');idx=nx?e.children.indexOf(nx):e.children.length;}
    X.insertAt(e,s,idx);}
  const val=X.kid(s,'Value');X.setText(val,v);if(prot)val.attrs.Protected='True';else delete val.attrs.Protected;}
function delStr(e,k){const s=strEl(e,k);if(s)X.remove(s);}
function isProt(e,k){const s=strEl(e,k);return !!s&&X.kid(s,'Value').attrs.Protected==='True';}
function protDefault(k){const map={Title:'ProtectTitle',UserName:'ProtectUserName',Password:'ProtectPassword',URL:'ProtectURL',Notes:'ProtectNotes'};
  if(!map[k])return false;const mp=X.kid(meta(),'MemoryProtection');const v=X.text(X.kid(mp,map[k]));return k==='Password'?v!=='False':v==='True';}
function setTime(el,k,d){const T=X.ensure(el,'Times');X.setText(X.ensure(T,k),timeStr(S.db,d));}
function getTime(el,k){return parseTime(S.db,X.text(X.kid(X.kid(el,'Times'),k)));}
function touch(el){const n=new Date();setTime(el,'LastModificationTime',n);setTime(el,'LastAccessTime',n);}
function binUuid(){return X.text(X.kid(meta(),'RecycleBinUUID'));}
function binEnabled(){return X.text(X.kid(meta(),'RecycleBinEnabled'))!=='False';}
function findGroup(uuid,g=rootGroup()){if(!uuid)return null;if(uuidOf(g)===uuid)return g;for(const c of X.kids(g,'Group')){const r=findGroup(uuid,c);if(r)return r;}return null;}
function recycleBin(create){let b=findGroup(binUuid());if(b||!create)return b;
  b=makeGroup('Papierkorb',43);X.append(b,X.el('EnableAutoType','false'));X.append(b,X.el('EnableSearching','false'));X.append(rootGroup(),b);
  X.setText(X.ensure(meta(),'RecycleBinUUID'),uuidOf(b));X.setText(X.ensure(meta(),'RecycleBinChanged'),timeStr(S.db));return b;}
function inBin(el){const b=recycleBin(false);if(!b)return false;for(let p=el;p;p=p.parent)if(p===b)return true;return false;}
function allEntries(g,out=[],skipBin=true){const b=skipBin?recycleBin(false):null;
  for(const e of X.kids(g,'Entry'))out.push(e);for(const c of X.kids(g,'Group'))if(c!==b)allEntries(c,out,skipBin);return out;}
function groupPath(el){const names=[];for(let p=el.parent;p&&p.name==='Group';p=p.parent)names.unshift(gName(p));return names.join(' / ');}
function makeGroup(name,icon){const g=X.el('Group');for(const [k,v] of [['UUID',newUuid()],['Name',name],['Notes',''],['IconID',String(icon??48)]])X.append(g,X.el(k,v));
  X.append(g,timesEl(S.db));X.append(g,X.el('IsExpanded','True'));X.append(g,X.el('LastTopVisibleEntry','AAAAAAAAAAAAAAAAAAAAAA=='));return g;}
function insertEntry(g,e){const fg=g.children.find(c=>typeof c!=='string'&&c.name==='Group');if(fg)X.insertAt(g,e,g.children.indexOf(fg));else X.append(g,e);}
function insertGroup(parent,g){X.append(parent,g);}
function makeEntry(){const e=X.el('Entry');X.append(e,X.el('UUID',newUuid()));X.append(e,X.el('IconID','0'));X.append(e,X.el('ForegroundColor'));X.append(e,X.el('BackgroundColor'));X.append(e,X.el('OverrideURL'));X.append(e,X.el('Tags'));X.append(e,timesEl(S.db));
  for(const k of STD)setStr(e,k,'',protDefault(k));
  const at=X.append(e,X.el('AutoType'));X.append(at,X.el('Enabled','True'));X.append(at,X.el('DataTransferObfuscation','0'));X.append(e,X.el('History'));return e;}
function pushHistory(e){const h=X.ensure(e,'History');const c=X.clone(e,null);const ch=X.kid(c,'History');if(ch)X.remove(ch);X.append(h,c);
  const max=parseInt(X.text(X.kid(meta(),'HistoryMaxItems'))||'10',10);if(max>=0)while(X.kids(h,'Entry').length>max)X.remove(X.kids(h,'Entry')[0]);}
function moveTo(el,g){X.remove(el);if(el.name==='Entry')insertEntry(g,el);else insertGroup(g,el);setTime(el,'LocationChanged',new Date());}
function recordDeleted(el){const d=X.ensure(X.kid(S.db.xml,'Root'),'DeletedObjects');const o=X.el('DeletedObject');X.append(o,X.el('UUID',uuidOf(el)));X.append(o,X.el('DeletionTime',timeStr(S.db)));X.append(d,o);
  if(el.name==='Group'){for(const c of X.kids(el,'Entry'))recordDeleted(c);for(const c of X.kids(el,'Group'))recordDeleted(c);}}
function deleteEl(el){
  if(binEnabled()&&!inBin(el)&&el!==recycleBin(false)){moveTo(el,recycleBin(true));return 'bin';}
  recordDeleted(el);X.remove(el);return 'gone';}
function expired(e){const T=X.kid(e,'Times');if(X.text(X.kid(T,'Expires'))!=='True')return false;const d=getTime(e,'ExpiryTime');return d&&d<new Date();}
function tagsOf(e){return X.text(X.kid(e,'Tags')).split(/[;,]/).map(s=>s.trim()).filter(Boolean);}
const curGroupEl=()=>(typeof S.group!=='object'||!S.group)?rootGroup():S.group;
function customIconSrc(uuid){if(!uuid||/^A+=*$/.test(uuid))return null;const ci=X.kids(X.kid(meta(),'CustomIcons'),'Icon').find(i=>X.text(X.kid(i,'UUID'))===uuid);
  if(!ci)return null;const d=X.text(X.kid(ci,'Data')).replace(/\s/g,'');return d&&/^[A-Za-z0-9+/=]+$/.test(d)?'data:image/png;base64,'+d:null;}
function markDirty(){S.version=++S.vc;updateSaveState();}

// ===== Anzeige-Helfer =====
function hue(s){let h=0;for(const c of s)h=(h*31+c.codePointAt(0))>>>0;return h%360;}
function iconBadge(title,iconId,customUuid,big,col){const t=title||'?';const cls='mono-badge'+(big?' big':'');const src=customIconSrc(customUuid);
  if(src)return `<span class="${cls} img"><img src="${src}" alt=""></span>`;
  const st=col||`background:hsl(${hue(t)} 32% 42%)`;
  if(iconId>0&&KP_MAP[iconId])return `<span class="${cls}" style="${st}">${kpSvg(iconId)}</span>`;
  const ch=[...t.trim()][0]||'?';return `<span class="${cls}" style="${st}">${esc(ch.toUpperCase())}</span>`;}
function entryBadge(e,big){return iconBadge(str(e,'Title')||hostOf(str(e,'URL')),parseInt(X.text(X.kid(e,'IconID'))||'0',10),X.text(X.kid(e,'CustomIconUUID')),big,badgeStyle(e));}
function groupIcon(g){if(g===recycleBin(false))return ICON.trash;const src=customIconSrc(X.text(X.kid(g,'CustomIconUUID')));if(src)return `<img class="gimg" src="${src}" alt="">`;
  const id=parseInt(X.text(X.kid(g,'IconID'))||'48',10);return id===48||id===49||id===0?ICON.folder:kpSvg(id);}
function tiles(pw,show){
  if(!show)return `<div class="tiles">${'<span class="tile dot"><b>•</b><small>&nbsp;</small></span>'.repeat(8)}</div>`;
  if(!pw)return '<span class="muted">Kein Passwort</span>';
  return `<div class="tiles">${[...pw].map((c,i)=>{const cls=/[0-9]/.test(c)?'d':/[\p{L}]/u.test(c)?'':c===' '?'sp':'s';return `<span class="tile ${cls}"><b>${esc(c)}</b><small>${i+1}</small></span>`;}).join('')}</div>`;}
function fmtDate(d){return d?d.toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}):'–';}
function safeUrl(u){if(!u)return null;const x=/^[a-z][a-z0-9+.-]*:/i.test(u)?u:'https://'+u;return /^(https?|ftp):/i.test(x)?x:null;}

// ===== Sicherheitsbericht =====
function pwSince(e){const pw=str(e,'Password');const hist=X.kids(X.kid(e,'History'),'Entry');
  for(let i=hist.length-1;i>=0;i--)if(str(hist[i],'Password')!==pw)return getTime(hist[i+1]||e,'LastModificationTime');
  return getTime(e,'CreationTime')||(hist[0]&&getTime(hist[0],'LastModificationTime'));}
function analyze(){const es=allEntries(rootGroup());const byPw=new Map();
  for(const e of es){const p=str(e,'Password');if(p){if(!byPw.has(p))byPw.set(p,[]);byPw.get(p).push(e);}}
  const reused=es.filter(e=>{const p=str(e,'Password');return p&&byPw.get(p).length>1;});
  const weak=es.filter(e=>{const p=str(e,'Password');return p&&entropy(p)<50;});
  const exp=es.filter(expired);
  const year=365*864e5;const old=es.filter(e=>{if(!str(e,'Password'))return false;const d=pwSince(e);return d&&Date.now()-d>year;});
  const soon=es.filter(e=>expiresSoon(e));const dups=findDuplicates();
  const all=new Set([...reused,...weak,...exp,...old,...soon,...dups.flat()]);
  return {reused,weak,exp,old,soon,dups,byPw,count:all.size,total:es.length};}

// ===== Rendern =====
function render(){renderGroups();renderList();renderDetail();$('dbName').textContent=X.text(X.kid(meta(),'DatabaseName'))||S.fileName;}
function renderGroups(){
  const root=rootGroup();const bin=recycleBin(false);
  const row=(g,depth)=>{const sel=S.group===g;const n=X.kids(g,'Entry').length;
    const u=esc(uuidOf(g));const canDrag=g!==rootGroup()&&g!==bin;
    return `<div class="grow" data-uuid="${u}"${canDrag?' draggable="true"':''}><button class="gitem${sel?' sel':''}" data-act="group" data-uuid="${u}" style="padding-left:${8+depth*16}px">${groupIcon(g)}<span class="nm">${esc(gName(g))}</span><span class="cnt">${n||''}</span></button><button class="gmore" data-act="gmenu" data-uuid="${u}" title="Gruppe „${esc(gName(g))}“ verwalten" aria-label="Gruppe verwalten">${ICON.dots}</button></div>`+
      X.kids(g,'Group').filter(c=>c!==bin).map(c=>row(c,depth+1)).join('');};
  $('groups').innerHTML=`<div class="gsec">Bibliothek</div><button class="gitem${S.group==='home'?' sel':''}" data-act="pseudo" data-g="home">${kpSvg(0,'home')}<span class="nm">Übersicht</span></button>
    <button class="gitem${S.group==='all'?' sel':''}" data-act="group" data-uuid="">${ICON.all}<span class="nm">Alle Einträge</span><span class="cnt">${allEntries(root).length}</span></button>
    ${(()=>{const nf=allEntries(root).filter(isFav).length,nr=recentList().length;return (nf?`<button class="gitem${S.group==='fav'?' sel':''}" data-act="pseudo" data-g="fav"><span class="gstar">★</span><span class="nm">Favoriten</span><span class="cnt">${nf}</span></button>`:'')+(nr?`<button class="gitem${S.group==='recent'?' sel':''}" data-act="pseudo" data-g="recent">${kpSvg(0,'clock')}<span class="nm">Zuletzt verwendet</span></button>`:'');})()}
    <button class="gitem${S.group==='report'?' sel':''}" data-act="report">${ICON.shield}<span class="nm">Sicherheit</span>${(()=>{const n=analyze().count;return n?`<span class="cnt warn">${n}</span>`:'<span class="cnt">✓</span>';})()}</button>
    <div class="ghead"><span>Gruppen</span><button class="icon-btn" data-act="newGroup" title="Neue Gruppe">${ICON.plus}</button></div>
    ${row(root,0)}<button class="gitem gadd" data-act="newGroup">${ICON.plus}<span class="nm">Neue Gruppe</span></button>${bin?row(bin,0):''}`;}
function currentEntries(){
  const q=S.query.trim().toLowerCase();
  let list;
  if(!q&&S.group==='recent')return recentList();
  if(!q&&S.group==='fav')return allEntries(rootGroup()).filter(isFav).sort((a,b)=>str(a,'Title').localeCompare(str(b,'Title'),'de',{sensitivity:'base'}));
  if(q){list=allEntries(rootGroup()).filter(e=>{
      const hay=[...X.kids(e,'String').filter(s=>{const k=X.text(X.kid(s,'Key'));return k!=='Password'&&k!=='otp'&&!k.startsWith('TimeOtp')&&k!=='KPEX_PASSKEY_PRIVATE_KEY_PEM';}).map(s=>X.text(X.kid(s,'Value'))),X.text(X.kid(e,'Tags'))].join('\n').toLowerCase();
      return q.split(/\s+/).every(w=>hay.includes(w));});}
  else if(typeof S.group!=='object')list=allEntries(rootGroup());
  else list=X.kids(S.group,'Entry');
  return list.sort((a,b)=>str(a,'Title').localeCompare(str(b,'Title'),'de',{sensitivity:'base'}));}
function eRow(e,sub){const t=str(e,'Title')||'Ohne Titel';
  const sel=bulkActive()||S.selMode?S.sel.has(e):S.entry===e;
  return `<button class="eitem${sel?' sel':''}" data-act="entry" draggable="true" data-uuid="${esc(uuidOf(e))}">${S.selMode?`<span class="ck${S.sel.has(e)?' on':''}">${ICON.check}</span>`:''}${entryBadge(e)}<span class="tx"><div class="t">${esc(t)}${isFav(e)?'<span class="favstar" title="Favorit">★</span>':''}${expired(e)?'<span class="tag-exp">abgelaufen</span>':expiresSoon(e)?'<span class="tag-soon">läuft bald ab</span>':''}${passkeyOf(e)?'<span class="tag-pk">Passkey</span>':''}</div><div class="s">${esc(sub)||'&nbsp;'}</div></span></button>`;}
function renderReport(){
  const r=analyze();let h=`<div class="lhead"><h2>Sicherheit</h2></div>`;
  h+=`<div class="rsum"><b>${r.count?`${r.count} von ${r.total} Einträgen brauchen Aufmerksamkeit`:'Alles in Ordnung'}</b><span>${r.count?'Bearbeite die Einträge unten und vergib neue Passwörter.':'Keine schwachen, mehrfach verwendeten, alten oder ablaufenden Passwörter und keine Duplikate gefunden.'}</span></div>`;
  const sec=(title,list,sub,hint)=>{if(!list.length)return '';return `<div class="lsec"><span>${title}</span><span>${list.length}</span></div><div class="lhint">${hint}</div>`+list.sort((a,b)=>str(a,'Title').localeCompare(str(b,'Title'),'de')).map(e=>eRow(e,sub(e))).join('');};
  h+=sec('Mehrfach verwendet',r.reused,e=>'Gleich wie: '+r.byPw.get(str(e,'Password')).filter(x=>x!==e).map(x=>str(x,'Title')||'Ohne Titel').join(', '),'Wird ein Dienst gehackt, sind alle Konten mit diesem Passwort gefährdet.');
  h+=sec('Schwach',r.weak,e=>`Etwa ${entropy(str(e,'Password'))} Bit – Ziel: mindestens 64`,'Kurz oder aus wenigen Zeichenarten – mit dem Generator ersetzen.');
  if(r.dups.length)h+=`<div class="lsec"><span>Doppelte Einträge</span><span>${r.dups.length}</span></div><div class="lhint">Gleiche Website und gleicher Benutzername – meist nach einem Import. <button class="linkbtn" data-act="dups">Prüfen und zusammenführen</button></div>`+r.dups.map(g=>eRow(g[0],`${g.length}× vorhanden: `+g.map(groupPath).join(', '))).join('');
  h+=sec('Läuft bald ab',r.soon,e=>'Läuft ab am '+getTime(e,'ExpiryTime').toLocaleDateString('de-DE'),'Innerhalb der nächsten 30 Tage – rechtzeitig ein neues Passwort vergeben.');
  h+=sec('Abgelaufen',r.exp,e=>'Abgelaufen am '+fmtDate(getTime(e,'ExpiryTime')),'Das hinterlegte Ablaufdatum ist überschritten.');
  h+=sec('Älter als ein Jahr',r.old,e=>'Unverändert seit '+(pwSince(e)||new Date()).toLocaleDateString('de-DE'),'Bei wichtigen Konten lohnt sich ein regelmäßiger Wechsel.');
  $('list').innerHTML=h;}
function renderList(){
  if(S.group==='report'&&!S.query.trim())return renderReport();
  const list=currentEntries();const q=S.query.trim();
  const title=q?`Suche: ${q}`:S.group==='all'||S.group==='home'?'Alle Einträge':S.group==='fav'?'Favoriten':S.group==='recent'?'Zuletzt verwendet':gName(S.group);
  const isGroup=!q&&typeof S.group==='object';
  let h=`<div class="lhead"><h2>${esc(title)}</h2><button class="btn ghost small" data-act="selMode">${S.selMode?'Fertig':'Auswählen'}</button><button class="icon-btn" data-act="density" title="${prefs.compact?'Normale Liste':'Kompakte Liste'}">${ICON.list}</button>${isGroup?`<button class="icon-btn" data-act="gmenu" data-uuid="${esc(uuidOf(S.group))}" title="Gruppe verwalten">${ICON.dots}</button>`:''}</div>`;
  if(!list.length&&!q&&isGroup&&X.kids(S.group,'Group').length)h+=`<div class="empty"><b>Keine Einträge direkt in dieser Gruppe</b>Die Einträge liegen in den Untergruppen links.</div>`;
  else if(!list.length)h+=q?`<div class="empty"><b>Keine Treffer</b>Gesucht wird in Titel, Benutzername, URL, Notizen, Tags und eigenen Feldern.</div>`
    :`<div class="empty"><b>Noch keine Einträge</b>${isGroup?`In „${esc(gName(S.group))}“ liegt noch nichts.`:'Die Datenbank ist noch leer.'}<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary" data-act="entryHere">${ICON.plus}Neuer Eintrag</button>${isGroup?`<button class="btn" data-act="gmenu" data-uuid="${esc(uuidOf(S.group))}">${ICON.dots}Gruppe verwalten</button>`:''}</div></div>`;
  for(const e of list){const sub=q||typeof S.group!=='object'?[str(e,'UserName'),groupPath(e)].filter(Boolean).join(' – '):(str(e,'UserName')||str(e,'URL'));h+=eRow(e,sub);}
  $('list').innerHTML=h;}
let reveal=false;
function renderDetail(){
  if(bulkActive()){startOtp(null);return renderBulk();}
  const e=S.entry;const d=$('detail');
  if(!e||!e.parent){S.entry=null;startOtp(null);d.innerHTML=`<div class="empty" style="padding-top:18vh"><b>Kein Eintrag ausgewählt</b>Wähle links einen Eintrag aus.<br><span class="hide-narrow"><kbd>⌘</kbd><kbd>K</kbd> sucht Einträge und Befehle, <kbd>?</kbd> zeigt alle Tastenkürzel.</span></div>`;return;}
  const t=str(e,'Title')||'Ohne Titel',u=str(e,'UserName'),pw=str(e,'Password'),url=str(e,'URL'),notes=str(e,'Notes');
  const cp=(k,label)=>{const c=S.copied&&S.copied.e===e&&S.copied.k===k&&Date.now()-S.copied.t<30000;
    return `<button class="icon-btn cbtn${c?' copied':''}" data-act="copy" data-key="${esc(k)}" title="${esc(label)} kopieren">${c?ICON.check+`<svg class="cring" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" style="animation-delay:-${((Date.now()-S.copied.t)/1000).toFixed(2)}s"/></svg>`:ICON.copy}</button>`;};
  let h=`<div class="dwrap"><div class="dtop"><button class="icon-btn back" data-act="backList" title="Zurück">${ICON.back}</button>${entryBadge(e,true)}<div style="min-width:0"><h1>${esc(t)}</h1><div class="path">${esc(groupPath(e))}</div></div>
    <div class="acts"><button class="icon-btn star${isFav(e)?' on':''}" data-act="fav" title="${isFav(e)?'Aus Favoriten entfernen':'Als Favorit markieren'} (⌘D)">${isFav(e)?'★':'☆'}</button><button class="icon-btn hide-narrow" data-act="print" title="Drucken (⌘P)">${kpSvg(0,'printer')}</button><button class="btn" data-act="edit">${ICON.edit}<span class="hide-narrow">Bearbeiten</span></button><button class="icon-btn" data-act="delEntry" title="${inBin(e)?'Endgültig löschen':'In den Papierkorb'}">${ICON.trash}</button></div></div>`;
  if(u)h+=`<div class="field"><div class="k">Benutzername</div><div class="row"><div class="v">${esc(u)}</div>${cp('UserName','Benutzername')}</div></div>`;
  if(pw||(!passkeyOf(e)&&!X.kids(e,'String').some(s=>!STD.includes(X.text(X.kid(s,'Key')))&&X.text(X.kid(s,'Value')))&&!str(e,'Notes')))h+=`<div class="field"><div class="k">Passwort</div><div class="row"><div class="v" style="padding-top:2px">${tiles(pw,reveal)}</div>
    <button class="icon-btn" data-act="reveal" title="${reveal?'Verbergen':'Anzeigen'}">${reveal?ICON.eyeOff:ICON.eye}</button>${pw?cp('Password','Passwort'):''}</div></div>`;
  const otp=otpConfig(e);
  if(otp)h+=otp.error?`<div class="field"><div class="k">Einmalcode (2FA)</div><div class="v" style="color:var(--danger)">Der 2FA-Schlüssel ist ungültig: ${esc(otp.error)}</div></div>`
    :`<div class="field"><div class="k">Einmalcode (2FA)</div><div class="row" style="align-items:center"><div class="v" style="padding:0"><span class="otp mono" id="otpCode">··· ···</span></div><svg class="oring" id="otpRing" viewBox="0 0 30 30" aria-label="Restzeit"><circle class="bg" cx="15" cy="15" r="12"/><circle class="fg" cx="15" cy="15" r="12"/><text x="15" y="19" text-anchor="middle" id="otpLeft"></text></svg>${cp('#otp','Einmalcode')}</div></div>`;
  if(url){const su=safeUrl(url);h+=`<div class="field"><div class="k">URL</div><div class="row"><div class="v">${su?`<a href="${esc(su)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`:esc(url)}</div>${su?`<a class="icon-btn" href="${esc(su)}" target="_blank" rel="noopener noreferrer" title="Öffnen">${ICON.ext}</a>`:''}${cp('URL','URL')}</div></div>`;}
  if(notes)h+=`<div class="field"><div class="k">Notizen</div><div class="v"><pre>${esc(notes)}</pre></div></div>`;
  const pk=passkeyOf(e);
  if(pk)h+=`<div class="field"><div class="k">Passkey</div><div class="pk">${kpSvg(0,'userkey')}<div><b>${esc(pk.rp||'Unbekannter Dienst')}</b><span>${pk.user?'Benutzer: '+esc(pk.user):'Ohne Benutzername'}</span></div></div><p class="note" style="margin-top:8px">Anmelden mit diesem Passkey geht über die KeePassXC-Browsererweiterung oder Strongbox. Tresor bewahrt ihn sicher auf und überträgt ihn beim Speichern unverändert.</p></div>`;
  for(const s of X.kids(e,'String')){const k=X.text(X.kid(s,'Key'));if(STD.includes(k)||isPkKey(k)||(otp&&!otp.error&&OTP_KEYS.includes(k)))continue;const prot=X.kid(s,'Value').attrs.Protected==='True';const v=X.text(X.kid(s,'Value'));if(!v)continue;
    h+=`<div class="field"><div class="k">${esc(k)}</div><div class="row"><div class="v">${prot&&!reveal?'<span class="muted">••••••••</span>':`<pre class="${prot?'mono':''}">${esc(v)}</pre>`}</div>${cp(k,k)}</div></div>`;}
  const bins=X.kids(e,'Binary');
  h+=`<div class="field"><div class="k">Anhänge</div>${bins.map((b,i)=>`<div class="row"><div class="v">${ICON.clip} ${esc(X.text(X.kid(b,'Key')))} <span class="muted" style="font-size:13px">${fmtSize(attData(b))}</span></div><button class="icon-btn" data-act="att" data-i="${i}" title="Herunterladen">${ICON.dl}</button><button class="icon-btn" data-act="attDel" data-i="${i}" title="Anhang entfernen">${ICON.trash}</button></div>`).join('')}
    <button class="btn ghost" data-act="attAdd" style="margin-top:4px">${ICON.plus}Anhang hinzufügen</button></div>`;
  const tg=tagsOf(e).filter(t=>!/^(favorit|favorite|favourite|sensibel|sensitive)$/i.test(t));if(tg.length)h+=`<div class="field"><div class="k">Tags</div><div class="chips">${tg.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></div>`;
  const T=X.kid(e,'Times');const exp=X.text(X.kid(T,'Expires'))==='True';
  h+=`<div class="field"><div class="meta-grid"><span>Erstellt</span><span>${fmtDate(getTime(e,'CreationTime'))}</span><span>Geändert</span><span>${fmtDate(getTime(e,'LastModificationTime'))}</span>${exp?`<span>Läuft ab</span><span style="${expired(e)?'color:var(--danger)':''}">${fmtDate(getTime(e,'ExpiryTime'))}</span>`:''}</div></div>`;
  h+=historyHtml(e);
  h+='</div>';d.innerHTML=h;startOtp(otp&&!otp.error?otp:null);}
// Anhänge
function attData(b){try{const v=X.kid(b,'Value');const ref=v.attrs.Ref;if(ref===undefined)return unb64(X.text(v)).length;
  if(S.db.major===4)return (S.db.binaries[+ref]||{data:{length:0}}).data.length;
  const mb=X.kids(X.kid(meta(),'Binaries'),'Binary').find(x=>x.attrs.ID===ref);return mb?(mb.attrs.Compressed==='True'?-1:unb64(X.text(mb)).length):0;}catch(e){return 0;}}
function fmtSize(n){if(n<0)return '';return n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';}
async function addAttachment(e,file){
  if(file.size>20*1048576&&!confirm(`„${file.name}“ ist ${fmtSize(file.size)} groß. Große Anhänge machen die Datenbank langsam. Trotzdem hinzufügen?`))return;
  const data=new Uint8Array(await file.arrayBuffer());let name=file.name;const names=X.kids(e,'Binary').map(b=>X.text(X.kid(b,'Key')));
  for(let i=2;names.includes(name);i++)name=file.name.replace(/(\.[^.]*)?$/,m=>` (${i})`+m);
  checkpoint('Anhang hinzufügen');pushHistory(e);let ref;
  if(S.db.major===4){ref=String(S.db.binaries.length);S.db.binaries.push({flags:0,data});}
  else{const pool=X.ensure(meta(),'Binaries');const ids=X.kids(pool,'Binary').map(b=>+b.attrs.ID);ref=String(ids.length?Math.max(...ids)+1:0);
    X.append(pool,X.el('Binary',b64(await gzip(data)),{ID:ref,Compressed:'True'}));}
  const be=X.el('Binary');X.append(be,X.el('Key',name));X.append(be,X.el('Value',null,{Ref:ref}));
  const nx=e.children.find(c=>typeof c!=='string'&&(c.name==='AutoType'||c.name==='History'));if(nx)X.insertAt(e,be,e.children.indexOf(nx));else X.append(e,be);
  touch(e);markDirty();renderDetail();undoToast('Anhang hinzugefügt');}
// TOTP-Anzeige
let otpTimer=null;
function startOtp(cfg){clearInterval(otpTimer);otpTimer=null;if(!cfg)return;
  const C=2*Math.PI*12;let lastCtr=-1;
  const tick=async()=>{const el=$('otpCode');if(!el){clearInterval(otpTimer);return;}
    const now=Date.now();const left=cfg.period-Math.floor(now/1000)%cfg.period;const ctr=Math.floor(now/1000/cfg.period);
    if(ctr!==lastCtr){lastCtr=ctr;const c=await totpCode(cfg,now);if(sensLocked()){el.textContent='••• •••';el.dataset.code='';}else{el.textContent=c.length===6?c.slice(0,3)+' '+c.slice(3):c.length===8?c.slice(0,4)+' '+c.slice(4):c;el.dataset.code=c;}}
    const fg=$('otpRing').querySelector('.fg');fg.style.strokeDasharray=C;fg.style.strokeDashoffset=C*(1-left/cfg.period);
    $('otpRing').classList.toggle('low',left<=5);$('otpLeft').textContent=left;};
  tick();otpTimer=setInterval(tick,1000);}

// ===== Zwischenablage =====
let clipTimer=null;
function markCopied(k){S.copied={e:S.entry,k,t:Date.now()};renderDetail();}
async function copyText(t){try{await navigator.clipboard.writeText(t);}catch(e){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
  clearTimeout(clipTimer);clipTimer=setTimeout(async()=>{try{await navigator.clipboard.writeText('');}catch(e){}if(S.copied){S.copied=null;if(S.db)renderDetail();}},30000);}

// ===== Passwortgenerator =====
const CHARSETS={upper:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',lower:'abcdefghijklmnopqrstuvwxyz',digits:'0123456789',symbols:'!#$%&*+-=?@^_~.,:;()[]{}/'};
const AMBIG=/[Il1O0o|`'"]/g;
const genOpt={len:20,upper:true,lower:true,digits:true,symbols:true,noAmbig:true};
function randInt(n){const lim=Math.floor(4294967296/n)*n;const b=new Uint32Array(1);do crypto.getRandomValues(b);while(b[0]>=lim);return b[0]%n;}
function generate(o=genOpt){const sets=['upper','lower','digits','symbols'].filter(k=>o[k]).map(k=>o.noAmbig?CHARSETS[k].replace(AMBIG,''):CHARSETS[k]);
  if(!sets.length)return '';const all=sets.join('');let out;
  do{out=Array.from({length:o.len},()=>all[randInt(all.length)]);}while(o.len>=sets.length&&!sets.every(s=>out.some(c=>s.includes(c))));
  return out.join('');}
function entropy(pw){if(!pw)return 0;let n=0;if(/[a-z]/.test(pw))n+=26;if(/[A-Z]/.test(pw))n+=26;if(/[0-9]/.test(pw))n+=10;if(/[^a-zA-Z0-9]/.test(pw))n+=32;
  const uniq=new Set(pw).size;return Math.round(Math.log2(n||1)*pw.length*Math.min(1,uniq/Math.max(4,pw.length*0.6)));}
function meterHtml(pw){const b=pw&&LASTGEN.pw===pw?LASTGEN.bits:entropy(pw);const lvl=b<40?1:b<64?2:b<90?3:4;const lab=pw?['','Schwach','Mittel','Stark','Sehr stark'][lvl]+` · ${b} Bit`:'';
  return [1,2,3,4].map(i=>`<i class="${pw&&i<=lvl?'on':''}"></i>`).join('')+`<span>${lab}</span>`;}

// ===== Eintrag bearbeiten =====
function openEditor(entry,tplKey){
  const isNew=!entry;const e=entry;
  const otpInit=e?otpEditValue(e):'';let iconSel=e?parseInt(X.text(X.kid(e,'IconID'))||'0',10):0;const hasCustomIcon=!!(e&&customIconSrc(X.text(X.kid(e,'CustomIconUUID'))));let iconChanged=false;
  const custom=e?X.kids(e,'String').filter(s=>!STD.includes(X.text(X.kid(s,'Key')))&&!(otpInit&&OTP_KEYS.includes(X.text(X.kid(s,'Key'))))&&!isPkKey(X.text(X.kid(s,'Key')))).map(s=>({k:X.text(X.kid(s,'Key')),v:X.text(X.kid(s,'Value')),p:X.kid(s,'Value').attrs.Protected==='True'})):[];
  const T=e?X.kid(e,'Times'):null;const exp=e&&X.text(X.kid(T,'Expires'))==='True';const expD=e?getTime(e,'ExpiryTime'):null;
  const targetGroup=e?e.parent:curGroupEl();
  const groupsOpts=[];const bin=recycleBin(false);
  (function walk(g,d){if(g===bin)return;groupsOpts.push(`<option value="${esc(uuidOf(g))}"${g===targetGroup?' selected':''}>${'\u2003'.repeat(d)}${esc(gName(g))}</option>`);for(const c of X.kids(g,'Group'))walk(c,d+1);})(rootGroup(),0);
  const pw0=e?str(e,'Password'):genAny();
  const dlg=$('dlg');
  dlg.innerHTML=`<form class="dlg" method="dialog" id="edForm"><header>${isNew?'Neuer Eintrag':'Eintrag bearbeiten'}</header><div class="body">
    ${isNew?`<div class="tplrow" id="tplRow">${tplList().map((t,i)=>`<button type="button" class="tplchip${i===0?' on':''}" data-tpl="${esc(t.id)}">${kpSvg(t.icon)}${esc(t.name)}</button>`).join('')}<button type="button" class="tplchip manage" data-act="tplManage" title="Kategorien verwalten">${kpSvg(0,'gear')}Verwalten</button></div>`:''}
    <label class="f" for="edTitle">Titel</label><div class="inrow"><button type="button" class="iconpick" id="icoBtn" title="Symbol wählen"></button><input class="input" id="edTitle" value="${esc(e?str(e,'Title'):'')}" required></div>
    <div class="icogrid hidden" id="icoGrid"><button type="button" data-ico="0" title="Monogramm (Standard)" class="mono-ico">Aa</button>${KP_MAP.map((n,i)=>i?`<button type="button" data-ico="${i}" title="${esc(KP_NAMES[i])}">${kpSvg(i)}</button>`:'').join('')}</div>
    <label class="f" for="edUser">Benutzername</label><input class="input" id="edUser" value="${esc(e?str(e,'UserName'):X.text(X.kid(meta(),'DefaultUserName')))}" autocomplete="off">
    <label class="f" for="edPw">Passwort</label>
    <div class="inrow"><input class="input mono" id="edPw" type="password" value="${esc(pw0)}" autocomplete="new-password"><button type="button" class="icon-btn" data-reveal="edPw" title="Anzeigen">${ICON.eye}</button><button type="button" class="icon-btn" id="genToggle" title="Generator">${ICON.dice}</button></div>
    <div class="meter" id="edMeter">${meterHtml(pw0)}</div>
    <div class="gen hidden" id="genBox"></div>
    <label class="f" for="edOtp">2FA-Schlüssel <span class="muted">(Base32-Schlüssel oder otpauth://-Link, optional)</span></label>
    <input class="input mono" id="edOtp" value="${esc(otpInit)}" autocomplete="off" spellcheck="false" placeholder="z. B. JBSW Y3DP EHPK 3PXP">
    <div class="err" id="otpErr" style="min-height:0;margin-top:4px"></div>
    <label class="f" for="edUrl">URL</label><input class="input" id="edUrl" value="${esc(e?str(e,'URL'):'')}" inputmode="url" autocomplete="off">
    <label class="f" for="edNotes">Notizen</label><textarea class="input" id="edNotes">${esc(e?str(e,'Notes'):'')}</textarea>
    <div class="two"><div><label class="f" for="edGroup">Gruppe</label><select class="input" id="edGroup">${groupsOpts.join('')}</select></div>
      <div><label class="f" for="edTags">Tags</label><input class="input" id="edTags" value="${esc(e?tagsOf(e).filter(t=>!/^(favorit|favorite|favourite|sensibel|sensitive)$/i.test(t)).join(', '):'')}" placeholder="z. B. arbeit, bank"></div></div>
    <label class="check"><input type="checkbox" id="edExp"${exp?' checked':''}> Läuft ab am</label>
    <div class="inrow" style="flex-wrap:wrap"><input class="input${exp?'':' hidden'}" type="date" id="edExpD" value="${expD&&exp?expD.toISOString().slice(0,10):''}" style="max-width:190px"><span class="presets">In <button type="button" class="btn small" data-act="expPreset" data-m="3">3 Monaten</button><button type="button" class="btn small" data-act="expPreset" data-m="6">6 Monaten</button><button type="button" class="btn small" data-act="expPreset" data-m="12">1 Jahr</button></span></div>
    <label class="check"><input type="checkbox" id="edSens"${e&&isSens(e)?' checked':''}> Sensibel – Anzeigen und Kopieren nur nach erneuter Eingabe des Master-Passworts</label>
    <label class="f">Eigene Felder</label><div id="cfList"></div>
    <button type="button" class="btn ghost" id="cfAdd" style="margin-top:6px">${ICON.plus}Feld hinzufügen</button>
  </div><footer><button type="button" class="btn" value="cancel" id="edCancel">Abbrechen</button><button class="btn primary" id="edSave" value="ok">${isNew?'Eintrag anlegen':'Änderungen speichern'}</button></footer></form>`;
  const cfs=custom.slice();
  const drawCf=()=>{$('cfList').innerHTML=cfs.map((c,i)=>`<div class="cf"><input class="input" data-cf="k" data-i="${i}" value="${esc(c.k)}" placeholder="Name"><input class="input${c.p?' mono':''}" data-cf="v" data-i="${i}" value="${esc(c.v)}" type="${c.p?'password':'text'}" placeholder="Wert"><label class="check" style="margin:0" title="Geschützt (verborgen anzeigen)"><input type="checkbox" data-cf="p" data-i="${i}"${c.p?' checked':''}>🔒</label><button type="button" class="icon-btn" data-cf="del" data-i="${i}" title="Entfernen">×</button></div>`).join('');};
  drawCf();
  const drawIco=()=>{$('icoBtn').innerHTML=hasCustomIcon&&!iconChanged?entryBadge(e):iconBadge($('edTitle').value||'?',iconSel,null);
    dlg.querySelectorAll('[data-ico]').forEach(b=>b.classList.toggle('on',+b.dataset.ico===iconSel&&(iconChanged||!hasCustomIcon)));};
  drawIco();$('edTitle').addEventListener('input',drawIco);
  if(isNew)$('tplRow').onclick=ev=>{const b=ev.target.closest('[data-tpl]');if(!b)return;const t=tplGet(b.dataset.tpl);
    dlg.querySelectorAll('[data-tpl]').forEach(x=>x.classList.toggle('on',x===b));
    const keep=new Map(cfs.map(c=>[c.k,c.v]));cfs.length=0;for(const [k,p,def] of t.fields)cfs.push({k,v:keep.get(k)||def||'',p:!!p});drawCf();
    iconSel=t.icon;iconChanged=true;drawIco();$('edTags').value=t.tags||'';$('edSens').checked=!!t.sens;$('edUrl').placeholder=t.url||'';if(t.url&&/:\/\/./.test(t.url)&&!$('edUrl').value)$('edUrl').value=t.url;
    const vis=(id,on)=>{const el=$(id);const lab=dlg.querySelector(`label[for="${id}"]`);[lab,el.closest('.inrow')||el].forEach(x=>x&&x.classList.toggle('hidden',!on));};
    vis('edUser',!t.hide.includes('user'));vis('edUrl',!t.hide.includes('url'));vis('edOtp',!t.hide.includes('otp'));
    const pwOn=!t.hide.includes('pw');vis('edPw',pwOn);$('edMeter').classList.toggle('hidden',!pwOn);
    if(!pwOn){$('genBox').classList.add('hidden');pw.value='';}else if(!pw.value)pw.value=genAny();upd();
    $('edTitle').placeholder=t.id==='login'?'':t.name;$('edTitle').focus();};
  $('icoBtn').onclick=()=>$('icoGrid').classList.toggle('hidden');
  $('icoGrid').onclick=ev=>{const b=ev.target.closest('[data-ico]');if(!b)return;iconSel=+b.dataset.ico;iconChanged=true;drawIco();$('icoGrid').classList.add('hidden');};
  $('edOtp').oninput=()=>{const v=$('edOtp').value.trim();let m='';if(v&&v!==otpInit){try{parseOtpString(v);}catch(err){m=err.message;}}$('otpErr').textContent=m;};
  const pw=$('edPw');const upd=()=>{$('edMeter').innerHTML=meterHtml(pw.value);};
  pw.addEventListener('input',upd);
  $('genToggle').onclick=()=>{$('genBox').classList.toggle('hidden');};mountGen($('genBox'),pw,upd);
  $('edExp').onchange=()=>$('edExpD').classList.toggle('hidden',!$('edExp').checked);
  $('cfAdd').onclick=()=>{cfs.push({k:'',v:'',p:false});drawCf();dlg.querySelector(`[data-cf=k][data-i="${cfs.length-1}"]`).focus();};
  $('cfList').oninput=$('cfList').onchange=ev=>{const t=ev.target;const i=+t.dataset.i;if(!t.dataset.cf)return;
    if(t.dataset.cf==='k')cfs[i].k=t.value;else if(t.dataset.cf==='v')cfs[i].v=t.value;else if(t.dataset.cf==='p'&&ev.type==='change'){cfs[i].p=t.checked;drawCf();}};
  $('cfList').onclick=ev=>{const b=ev.target.closest('[data-cf=del]');if(b){cfs.splice(+b.dataset.i,1);drawCf();}};
  $('edCancel').onclick=()=>dlg.close();
  $('edForm').onsubmit=ev=>{ev.preventDefault();
    const names=cfs.map(c=>c.k.trim()).filter(Boolean);
    if(names.some(n=>STD.includes(n))){toast('Eigene Felder dürfen nicht wie Standardfelder heißen.');return;}
    if(new Set(names).size!==names.length){toast('Zwei eigene Felder haben denselben Namen.');return;}
    if(names.some(n=>isPkKey(n))){toast('Namen mit „KPEX_PASSKEY_“ sind für Passkeys reserviert.');return;}
    if(names.some(n=>OTP_KEYS.includes(n))){toast('Für 2FA bitte das Feld „2FA-Schlüssel“ verwenden.');return;}
    const otpVal=$('edOtp').value.trim();let otpStore=null;
    if(otpVal!==otpInit&&otpVal){try{parseOtpString(otpVal);}catch(err){$('otpErr').textContent=err.message;$('edOtp').focus();return;}
      otpStore=/^otpauth:/i.test(otpVal)?otpVal:`otpauth://totp/${encodeURIComponent($('edTitle').value||'Konto')}:${encodeURIComponent($('edUser').value||'')}?secret=${otpVal.toUpperCase().replace(/[\s=-]/g,'')}&period=30&digits=6&issuer=${encodeURIComponent($('edTitle').value||'Konto')}`;}
    checkpoint(isNew?'Eintrag anlegen':'Eintrag bearbeiten');
    let target=e;
    if(isNew){target=makeEntry();}else pushHistory(target);
    setStr(target,'Title',$('edTitle').value,isProt(target,'Title')||protDefault('Title'));
    setStr(target,'UserName',$('edUser').value,isProt(target,'UserName')||protDefault('UserName'));
    setStr(target,'Password',pw.value,true);
    setStr(target,'URL',$('edUrl').value,isProt(target,'URL')||protDefault('URL'));
    setStr(target,'Notes',$('edNotes').value,isProt(target,'Notes')||protDefault('Notes'));
    for(const s of X.kids(target,'String')){const k=X.text(X.kid(s,'Key'));if(!STD.includes(k)&&!names.includes(k)&&!OTP_KEYS.includes(k)&&!isPkKey(k))X.remove(s);}
    if(otpVal!==otpInit){for(const k of OTP_KEYS)delStr(target,k);if(otpStore)setStr(target,'otp',otpStore,true);}
    if(iconChanged){X.setText(X.ensure(target,'IconID'),String(iconSel));const cu=X.kid(target,'CustomIconUUID');if(cu)X.remove(cu);}
    for(const c of cfs)if(c.k.trim())setStr(target,c.k.trim(),c.v,c.p);
    {const tg=$('edTags').value.split(/[;,]/).map(s=>s.trim()).filter(Boolean).filter(t=>!/^(favorit|favorite|favourite|sensibel|sensitive)$/i.test(t));
      if(!isNew&&isFav(e))tg.push('Favorit');if($('edSens').checked)tg.push('Sensibel');X.setText(X.ensure(target,'Tags'),tg.join(';'));}
    const T=X.ensure(target,'Times');
    if($('edExp').checked&&$('edExpD').value){X.setText(X.ensure(T,'Expires'),'True');setTime(target,'ExpiryTime',new Date($('edExpD').value+'T00:00:00'));}
    else X.setText(X.ensure(T,'Expires'),'False');
    touch(target);
    const g=findGroup($('edGroup').value)||rootGroup();
    if(isNew)insertEntry(g,target);else if(target.parent!==g)moveTo(target,g);
    S.entry=target;S.sel.clear();markDirty();dlg.close();render();undoToast(isNew?'Eintrag angelegt':'Änderungen übernommen');showView('detail');};
  dlg.showModal();$('edTitle').focus();if(isNew){const k=tplKey||(tplList()[0]||{}).id;const tb=k&&dlg.querySelector(`[data-tpl="${CSS.escape(k)}"]`);if(tb&&(tplKey||k!=='login'))tb.click();}}

// ===== Gruppen =====
function groupDialog(g){
  const dlg=$('dlg');const isNew=!g;
  const canDel=g&&g!==rootGroup();
  dlg.innerHTML=`<form class="dlg" id="gForm"><header>${isNew?'Neue Gruppe':'Gruppe bearbeiten'}</header><div class="body">
    <label class="f" for="gName">Name</label><input class="input" id="gName" value="${esc(g?gName(g):'')}" required>
    ${isNew?`<p class="note">Wird angelegt in: ${esc(gName(curGroupEl()))}</p>`:''}
  </div><footer>${!isNew?`<button type="button" class="btn" data-act="bundle" data-uuid="${esc(uuidOf(g))}">Als Kundenmappe …</button>`:''}${canDel?`<button type="button" class="btn danger left" id="gDel">${ICON.trash}${inBin(g)||g===recycleBin(false)?'Endgültig löschen':'Löschen'}</button>`:''}<button type="button" class="btn" id="gCancel">Abbrechen</button><button class="btn primary">${isNew?'Gruppe anlegen':'Speichern'}</button></footer></form>`;
  $('gCancel').onclick=()=>dlg.close();
  if(canDel)$('gDel').onclick=()=>{const n=allEntries(g,[],false).length;
    if(!confirm(n?`Die Gruppe „${gName(g)}“ mit ${n} Einträgen löschen?`:`Die Gruppe „${gName(g)}“ löschen?`))return;
    checkpoint('Gruppe löschen');if(g===recycleBin(false)){recordDeleted(g);X.remove(g);X.setText(X.ensure(meta(),'RecycleBinUUID'),'AAAAAAAAAAAAAAAAAAAAAA==');}else deleteEl(g);
    S.group='all';S.entry=null;markDirty();dlg.close();render();undoToast('Gruppe gelöscht');};
  $('gForm').onsubmit=ev=>{ev.preventDefault();const name=$('gName').value.trim();if(!name)return;checkpoint(isNew?'Gruppe anlegen':'Gruppe umbenennen');
    if(isNew){const parent=curGroupEl();const ng=makeGroup(name);insertGroup(parent,ng);S.group=ng;}
    else{X.setText(X.ensure(g,'Name'),name);touch(g);}
    markDirty();dlg.close();render();};
  dlg.showModal();$('gName').focus();}

// ===== Einstellungen / Master-Passwort =====
function settingsDialog(){
  const dlg=$('dlg');const kdfU=hex(S.db.kdf.$UUID.v);
  const kdfName=kdfU===KDF_ARGON2D?'Argon2d':kdfU===KDF_ARGON2ID?'Argon2id':'AES-KDF';
  dlg.innerHTML=`<form class="dlg" id="sForm"><header>Einstellungen</header><div class="body">
    <label class="f" for="sName">Name</label><input class="input" id="sName" value="${esc(X.text(X.kid(meta(),'DatabaseName')))}">
    <label class="f" for="sUser">Standard-Benutzername für neue Einträge</label><input class="input" id="sUser" value="${esc(X.text(X.kid(meta(),'DefaultUserName')))}">
    <label class="check"><input type="checkbox" id="sBin"${binEnabled()?' checked':''}> Gelöschte Einträge zuerst in den Papierkorb</label>
    <label class="f">Master-Passwort ändern <span class="muted">(leer lassen, um es zu behalten)</span></label>
    <div class="two"><input class="input" type="password" id="sPw" placeholder="Neues Passwort" autocomplete="new-password"><input class="input" type="password" id="sPw2" placeholder="Wiederholen" autocomplete="new-password"></div>
    <div class="meter" id="sMeter"></div>
    <div class="progress hidden" id="sProg"><i></i></div>
    <h3 class="sh">Schutz gegen Passwort-Raten</h3><div id="kdfBox"><p class="note">Wird gemessen …</p></div>
    <h3 class="sh">Daten</h3>
    <div class="inrow" style="flex-wrap:wrap;margin-top:10px"><button type="button" class="btn" data-act="imp">CSV importieren …</button><button type="button" class="btn" data-act="exp">Als CSV exportieren …</button><button type="button" class="btn" data-act="mrg">Mit anderer .kdbx zusammenführen …</button><button type="button" class="btn" data-act="sheet">Notfallblatt drucken …</button><button type="button" class="btn" data-act="tplManage">Kategorien verwalten …</button><button type="button" class="btn" data-act="dups">Duplikate suchen …</button></div>
    <p class="note">Zusammenführen übernimmt Änderungen aus einer anderen Fassung dieser Datenbank, z. B. vom iPad – der jeweils neuere Stand gewinnt, ältere landen im Verlauf.</p>
    <h3 class="sh">Diese App auf diesem Gerät</h3>
    <div class="two"><div><label class="f" for="pTheme">Darstellung</label><select class="input" id="pTheme">${[['auto','Wie System'],['light','Hell'],['dark','Dunkel']].map(([v,l])=>`<option value="${v}"${prefs.theme===v?' selected':''}>${l}</option>`).join('')}</select></div>
      <div><label class="f" for="pIdle">Automatisch sperren nach</label><select class="input" id="pIdle">${[[1,'1 Minute'],[5,'5 Minuten'],[10,'10 Minuten'],[30,'30 Minuten'],[0,'Nie']].map(([v,l])=>`<option value="${v}"${prefs.idle===v?' selected':''}>${l}</option>`).join('')}</select></div></div>
    <label class="check"><input type="checkbox" id="pHide"${prefs.lockOnHide?' checked':''}> Sperren, sobald der Tab verlassen oder der Bildschirm gesperrt wird</label>
    <label class="check"><input type="checkbox" id="pDate"${prefs.dateSuffix?' checked':''}> Datum und Uhrzeit an heruntergeladene Dateien anhängen</label>
    <label class="check"><input type="checkbox" id="pCompact"${prefs.compact?' checked':''}> Kompakte Liste</label>
    <p class="note">Format: KDBX ${S.db.major}.${S.db.minor} · ${S.db.cipher===CIPHER_CHACHA?'ChaCha20':'AES-256'} · ${kdfName}${S.keyFile?' · mit Schlüsseldatei (bleibt erhalten)':''}<br>Datei: ${esc(S.fileName)}</p>
  </div><footer><button type="button" class="btn" id="sCancel">Abbrechen</button><button class="btn primary" id="sOk">Übernehmen</button></footer></form>`;
  $('sPw').oninput=()=>$('sMeter').innerHTML=meterHtml($('sPw').value);
  $('sCancel').onclick=()=>dlg.close();
  $('sForm').onsubmit=async ev=>{ev.preventDefault();
    checkpoint('Einstellungen');const m=meta();X.setText(X.ensure(m,'DatabaseName'),$('sName').value);X.setText(X.ensure(m,'DatabaseNameChanged'),timeStr(S.db));
    X.setText(X.ensure(m,'DefaultUserName'),$('sUser').value);X.setText(X.ensure(m,'RecycleBinEnabled'),$('sBin').checked?'True':'False');
    Object.assign(prefs,{theme:$('pTheme').value,idle:+$('pIdle').value,lockOnHide:$('pHide').checked,dateSuffix:$('pDate').checked,compact:$('pCompact').checked});savePrefs();resetIdle();
    const p1=$('sPw').value,p2=$('sPw2').value;
    if((p1||p2)&&p1!==p2){toast('Die Passwörter stimmen nicht überein.');return;}
    const nk=kdfChoice();
    if(p1||nk){$('sOk').disabled=true;$('sProg').classList.remove('hidden');
      if(nk)S.db.kdf=nk;else S.db.kdf.S.v=rnd(32);if(S.db.major===4)S.db.kdfRaw=writeVarDict(S.db.kdf);
      if(p1)S.db.composite=await compositeKey(p1,S.keyFile);
      S.db.transformed=await runKdf(S.db.kdf,S.db.composite,x=>$('sProg').firstChild.style.width=(x*100)+'%');
      if(p1)X.setText(X.ensure(m,'MasterKeyChanged'),timeStr(S.db));
      toast(p1&&nk?'Master-Passwort und Schutzstufe geändert – jetzt speichern':p1?'Master-Passwort geändert – jetzt speichern':'Neue Schutzstufe übernommen – jetzt speichern');}
    markDirty();dlg.close();render();};
  dlg.showModal();mountSetKdf($('kdfBox'));}

// ===== Speichern =====
function dlName(){const base=(S.fileName||'Passwoerter.kdbx').replace(/\.kdbx$/i,'').replace(/_\d{4}-\d{2}-\d{2}_\d{4}$/,'');
  if(!prefs.dateSuffix)return base+'.kdbx';const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${base}_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.kdbx`;}

// ===== Sperren / Entsperren =====
async function lock(){
  if(!S.db)return;
  if(S.dirty){try{S.fileBytes=await kdbxSave(S.db);S.pending=true;}catch(e){}}
  clearInterval(otpTimer);S.copied=null;S.sensUntil=0;UNDO.length=0;S.sel.clear();S.selMode=false;S.db=null;S.entry=null;S.group='all';S.query='';reveal=false;$('q').value='';
  $('dlg').open&&$('dlg').close();$('app').classList.add('hidden');$('lock').classList.remove('hidden');
  $('detail').innerHTML='';$('list').innerHTML='';$('groups').innerHTML='';
  $('pendingNote').classList.toggle('hidden',!S.pending);
  $('dropName').textContent=S.fileName||'.kdbx-Datei auswählen';$('dropHint').textContent=S.fileName?'Andere Datei wählen':'oder hierher ziehen';
  $('pwOpen').value='';$('pwOpen').focus();}
function enterApp(){
  $('lock').classList.add('hidden');$('app').classList.remove('hidden');
  S.group='home';S.entry=null;S.sensUntil=0;updateSaveState();render();showView(matchMedia('(max-width:980px)').matches?'detail':'list');resetIdle();notifyExpiry();}
function showView(v){document.body.classList.remove('v-groups','v-detail');if(v==='groups')document.body.classList.add('v-groups');if(v==='detail')document.body.classList.add('v-detail');}

// Inaktivität: nach 10 Minuten sperren
let idleT;function resetIdle(){clearTimeout(idleT);if(S.db&&prefs.idle>0)idleT=setTimeout(lock,prefs.idle*60*1000);}
let pickingFile=false;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&prefs.lockOnHide&&S.db&&!pickingFile)lock();});
['pointerdown','keydown','scroll'].forEach(ev=>addEventListener(ev,resetIdle,{passive:true,capture:true}));
addEventListener('beforeunload',ev=>{if(S.dirty){ev.preventDefault();ev.returnValue='';}});

// ===== Tresor-Rad (dreht sich während der Schlüsselableitung) =====
(function drawDial(){let s='<circle cx="200" cy="200" r="190" stroke="currentColor" stroke-width="1" fill="none" opacity=".35"/><circle cx="200" cy="200" r="118" stroke="currentColor" stroke-width="1.5" fill="none"/><g class="rot" id="dialRot">';
  for(let i=0;i<100;i++){const a=i*3.6*Math.PI/180;const r1=i%10===0?150:i%5===0?158:162;const x1=200+Math.sin(a)*r1,y1=200-Math.cos(a)*r1,x2=200+Math.sin(a)*172,y2=200-Math.cos(a)*172;s+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="${i%10===0?2:1}"/>`;
    if(i%10===0)s+=`<text x="${(200+Math.sin(a)*135).toFixed(1)}" y="${(200-Math.cos(a)*135+4).toFixed(1)}" text-anchor="middle" font-size="12" fill="currentColor" font-family="ui-monospace,monospace">${i}</text>`;}
  s+='<circle cx="200" cy="200" r="174" stroke="currentColor" stroke-width="1" fill="none"/></g><path d="M200 14 l-7 -12 h14z" fill="currentColor"/><circle cx="200" cy="200" r="70" stroke="currentColor" stroke-width="1" fill="none" opacity=".5"/><circle cx="200" cy="200" r="6" fill="currentColor"/>';
  $('dial').innerHTML=s;})();
function throttled(fn){let last=-1,raf=0,v=0;return x=>{v=x;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(v!==last){last=v;fn(v);}});};}
let dialX=0,dialRaf=0;function dialTo(x){dialX=x;if(dialRaf)return;dialRaf=requestAnimationFrame(()=>{dialRaf=0;const r=$('dialRot');if(r)r.style.transform=`rotate(${(dialX*720).toFixed(1)}deg)`;});}

// ===== Entsperren-Bildschirm: Ereignisse =====
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('fOpen').classList.toggle('hidden',b.dataset.tab!=='open');$('fNew').classList.toggle('hidden',b.dataset.tab!=='new');});
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-reveal]');if(!b)return;const i=$(b.dataset.reveal);i.type=i.type==='password'?'text':'password';b.innerHTML=i.type==='password'?ICON.eye:ICON.eyeOff;});
async function pickFile(){
  if(window.showOpenFilePicker){try{const [h]=await showOpenFilePicker({types:[{description:'KeePass',accept:{'application/octet-stream':['.kdbx']}}]});const f=await h.getFile();setFile(f,h);return;}catch(e){if(e.name==='AbortError')return;}}
  $('fileIn').click();}
async function setFile(f,handle){S.fileName=f.name;S.fileBytes=new Uint8Array(await f.arrayBuffer());S.fileHandle=handle||null;S.fileMtime=f.lastModified||0;S.pending=false;$('pendingNote').classList.add('hidden');
  $('dropName').textContent=f.name;$('dropHint').textContent=handle?'Speichern schreibt direkt in diese Datei':'Speichern lädt eine neue Version herunter';$('openErr').textContent='';$('pwOpen').focus();}
$('drop').onclick=pickFile;$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickFile();}};
$('fileIn').onchange=e=>{if(e.target.files[0])setFile(e.target.files[0]);};
['dragover','dragenter'].forEach(t=>$('drop').addEventListener(t,e=>{e.preventDefault();$('drop').classList.add('over');}));
['dragleave','drop'].forEach(t=>$('drop').addEventListener(t,e=>{e.preventDefault();$('drop').classList.remove('over');}));
$('drop').addEventListener('drop',async e=>{const it=e.dataTransfer.items&&e.dataTransfer.items[0];
  if(it&&it.getAsFileSystemHandle){try{const h=await it.getAsFileSystemHandle();if(h&&h.kind==='file'){setFile(await h.getFile(),h);return;}}catch(err){}}
  const f=e.dataTransfer.files[0];if(f)setFile(f);});
$('kfBtn').onclick=()=>$('kfIn').click();
$('kfIn').onchange=async e=>{const f=e.target.files[0];if(!f)return;S.keyFile=new Uint8Array(await f.arrayBuffer());S.keyFileName=f.name;$('kfName').textContent=f.name;$('kfClear').classList.remove('hidden');};
$('kfClear').onclick=()=>{S.keyFile=null;$('kfName').textContent='Keine';$('kfClear').classList.add('hidden');$('kfIn').value='';};
$('fOpen').onsubmit=async ev=>{ev.preventDefault();
  if(!S.fileBytes){$('openErr').textContent='Wähle zuerst eine .kdbx-Datei aus.';return;}
  const btn=$('openBtn');btn.disabled=true;$('openErr').textContent='';$('prog').classList.remove('hidden');const bar=$('prog').firstChild;bar.style.width='0';
  try{S.db=await kdbxOpen(S.fileBytes,$('pwOpen').value,S.keyFile,throttled(x=>{bar.style.width=(x*100)+'%';dialTo(x);}));
    $('pwOpen').value='';startSession(S.pending);S.pending=false;enterApp();}
  catch(e){$('openErr').textContent=e.message||String(e);dialTo(0);}
  finally{btn.disabled=false;$('prog').classList.add('hidden');}};
$('newPw').oninput=()=>$('newMeter').innerHTML=meterHtml($('newPw').value);
$('fNew').onsubmit=async ev=>{ev.preventDefault();
  const p1=$('newPw').value,p2=$('newPw2').value,name=$('newName').value.trim()||'Passwörter';
  if(!p1){$('newErr').textContent='Lege ein Master-Passwort fest.';return;}
  if(p1!==p2){$('newErr').textContent='Die Passwörter stimmen nicht überein.';return;}
  $('newErr').textContent='';$('prog2').classList.remove('hidden');const bar=$('prog2').firstChild;
  try{S.db=await kdbxCreate(name,p1,null,throttled(x=>{bar.style.width=(x*100)+'%';dialTo(x);}),kdfFromPreset(NEWKDF,4));
    S.keyFile=null;S.fileHandle=null;S.fileMtime=0;S.fileName=name.replace(/[\\/:*?"<>|]/g,'_')+'.kdbx';S.fileBytes=null;startSession(true);$('newPw').value=$('newPw2').value='';enterApp();toast('Datenbank erstellt – speichern nicht vergessen');}
  catch(e){$('newErr').textContent=e.message;}finally{$('prog2').classList.add('hidden');}};

// ===== App: Ereignisse =====
$('q').addEventListener('input',e=>{S.query=e.target.value;renderList();showView('list');});
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='report'){S.group='report';S.query='';$('q').value='';renderGroups();renderList();showView('list');}
  else if(a==='density'){prefs.compact=!prefs.compact;savePrefs();renderList();}
  else if(a==='menu'){if(matchMedia('(max-width:980px)').matches)showView(document.body.classList.contains('v-groups')?'list':'groups');else{prefs.groupsHidden=!prefs.groupsHidden;savePrefs();}}
  else if(a==='copyOtp'){}
  else if(a==='attAdd'){const inp=document.createElement('input');inp.type='file';const e=S.entry;pickingFile=true;
    inp.onchange=()=>{pickingFile=false;if(inp.files[0])addAttachment(e,inp.files[0]);};inp.addEventListener('cancel',()=>pickingFile=false);setTimeout(()=>pickingFile=false,60000);inp.click();}
  else if(a==='attDel'){const bel=X.kids(S.entry,'Binary')[+b.dataset.i];if(!bel||!confirm(`Anhang „${X.text(X.kid(bel,'Key'))}“ entfernen? Er bleibt im Verlauf erhalten.`))return;
    checkpoint('Anhang entfernen');pushHistory(S.entry);X.remove(bel);touch(S.entry);markDirty();renderDetail();undoToast('Anhang entfernt');}
  else if(a==='group'){S.group=b.dataset.uuid?findGroup(b.dataset.uuid):'all';S.query='';$('q').value='';renderGroups();renderList();showView('list');}
  else if(a==='entry'){selectEntryClick(b.dataset.uuid,ev);}
  else if(a==='reveal'){reveal=!reveal;renderDetail();}
  else if(a==='copy'){const k=b.dataset.key;const val=k==='#otp'?($('otpCode')||{}).dataset?.code:str(S.entry,k);if(!val)return;
    await copyText(val);setTime(S.entry,'LastAccessTime',new Date());markCopied(k);
    toast((k==='Password'?'Passwort':k==='UserName'?'Benutzername':k==='#otp'?'Einmalcode':k)+' kopiert – wird in 30 s geleert');}
  else if(a==='edit')openEditor(S.entry);
  else if(a==='newEntry')openEditor(null);
  else if(a==='delEntry'){deleteEntries([S.entry]);}
  else if(a==='restore'){const e=S.entry;const h=X.kids(X.kid(e,'History'),'Entry')[+b.dataset.i];if(!h||!confirm('Diese frühere Version wiederherstellen? Der aktuelle Stand wandert in den Verlauf.'))return;
    checkpoint('Version wiederherstellen');pushHistory(e);for(const s of X.kids(e,'String'))X.remove(s);for(const bn of X.kids(e,'Binary'))X.remove(bn);
    const at=e.children.find(c=>typeof c!=='string'&&(c.name==='Binary'||c.name==='AutoType'||c.name==='History'));let idx=at?e.children.indexOf(at):e.children.length;
    for(const s of X.kids(h,'String'))X.insertAt(e,X.clone(s,e),idx++);
    {const at2=e.children.find(c=>typeof c!=='string'&&(c.name==='AutoType'||c.name==='History'));let j=at2?e.children.indexOf(at2):e.children.length;for(const bn of X.kids(h,'Binary'))X.insertAt(e,X.clone(bn,e),j++);}touch(e);markDirty();renderDetail();renderList();undoToast('Version wiederhergestellt');}
  else if(a==='att'){const bel=X.kids(S.entry,'Binary')[+b.dataset.i];const name=X.text(X.kid(bel,'Key'));const v=X.kid(bel,'Value');let data;
    try{const ref=v.attrs.Ref;
      if(ref!==undefined){if(S.db.major===4)data=S.db.binaries[+ref].data;else{const mb=X.kids(X.kid(meta(),'Binaries'),'Binary').find(x=>x.attrs.ID===ref);data=unb64(X.text(mb));if(mb.attrs.Compressed==='True')data=await gunzip(data);}}
      else data=unb64(X.text(v));
      const a2=document.createElement('a');a2.href=URL.createObjectURL(new Blob([data]));a2.download=name;document.body.appendChild(a2);a2.click();a2.remove();}
    catch(e){toast('Anhang konnte nicht gelesen werden.');}}
  else if(a==='newGroup')groupDialog(null);
  else if(a==='groupMenu')groupDialog(S.group);
  else if(a==='save')save();
  else if(a==='lock')lock();
  else if(a==='settings')settingsDialog();
  else if(a==='backList'){showView('list');}
});

