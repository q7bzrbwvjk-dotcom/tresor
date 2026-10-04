// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Erweiterungen: Rückgängig, Speicherstatus, Auswahl, Palette, Import/Export, Zusammenführen, Passphrasen, Passkeys =====================
Object.assign(S,{version:0,savedVersion:0,vc:0,lastSaved:null,sel:new Set(),selMode:false,fileMtime:0});
delete S.dirty;Object.defineProperty(S,'dirty',{get(){return S.version!==S.savedVersion;}});
const findEntry=u=>allEntries(rootGroup(),[],false).find(e=>uuidOf(e)===u);
function startSession(dirty){UNDO.length=0;S.sel.clear();S.selMode=false;S.vc++;S.version=S.vc;S.savedVersion=dirty?-1:S.version;S.lastSaved=null;}

// ---- Rückgängig ----
const UNDO=[];
function checkpoint(label){UNDO.push({label,xml:X.clone(S.db.xml,null),bins:(S.db.binaries||[]).slice(),version:S.version});if(UNDO.length>40)UNDO.shift();}
function undo(){const u=UNDO.pop();if(!u){toast('Nichts zum Rückgängigmachen');return;}
  const eu=S.entry?uuidOf(S.entry):null;const gu=typeof S.group==='object'&&S.group?uuidOf(S.group):S.group;
  S.db.xml=u.xml;S.db.binaries=u.bins;S.version=u.version;S.sel.clear();
  S.entry=eu?findEntry(eu)||null:null;S.group=PSEUDO.includes(gu)?gu:(findGroup(gu)||'all');
  render();updateSaveState();toast(`Rückgängig: ${u.label}`);}
function undoToast(msg){toast(msg,{label:'Rückgängig',fn:undo});}

// ---- Speicherstatus ----
function updateSaveState(){const el=$('saveState');if(!el)return;if(!S.db){el.textContent='';return;}
  const dirty=S.dirty;$('dirtyDot').classList.toggle('hidden',!dirty);let t;
  if(dirty){const i=UNDO.findIndex(u=>u.version===S.savedVersion);const n=i>=0?UNDO.length-i:0;t=n?`${n} ${n===1?'Änderung':'Änderungen'} nicht gespeichert`:'Nicht gespeichert';}
  else if(S.lastSaved){const m=Math.floor((Date.now()-S.lastSaved)/60000);t=m<1?'Gerade gespeichert':m<60?`Gespeichert vor ${m} Min.`:`Gespeichert um ${new Date(S.lastSaved).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;}
  else t='Keine Änderungen';
  el.textContent=t;el.classList.toggle('dirty',dirty);}
setInterval(updateSaveState,30000);

// ---- Speichern mit Konflikterkennung ----
function askChoice(title,text,buttons){return new Promise(res=>{const dlg=$('dlg');
  dlg.innerHTML=`<div class="dlg"><header>${esc(title)}</header><div class="body"><p style="margin:6px 0 0">${text}</p></div><footer>${buttons.map((b,i)=>`<button type="button" class="btn${b.primary?' primary':''}${b.danger?' danger':''}${i===0?' left':''}" data-c="${b.v}">${esc(b.l)}</button>`).join('')}</footer></div>`;
  dlg.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{dlg.close();res(b.dataset.c);});dlg.oncancel=()=>res('cancel');dlg.showModal();});}
async function save(){
  try{
    if(S.fileHandle){const f=await S.fileHandle.getFile();
      if(S.fileMtime&&f.lastModified!==S.fileMtime){
        const c=await askChoice('Die Datei wurde zwischenzeitlich geändert',`„${esc(f.name)}“ wurde nach dem Öffnen von einem anderen Programm oder Gerät gespeichert. Wenn du jetzt überschreibst, gehen diese Änderungen verloren.`,
          [{l:'Abbrechen',v:'cancel'},{l:'Überschreiben',v:'over',danger:true},{l:'Zusammenführen und speichern',v:'merge',primary:true}]);
        if(c==='cancel')return;
        if(c==='merge'){const ok=await mergeBytes(new Uint8Array(await f.arrayBuffer()),f.name,true);if(!ok)return;}}}
    const bytes=await kdbxSave(S.db);
    if(S.fileHandle){const w=await S.fileHandle.createWritable();await w.write(bytes);await w.close();S.fileMtime=(await S.fileHandle.getFile()).lastModified;}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));a.download=dlName();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
    S.fileBytes=bytes;S.savedVersion=S.version;S.lastSaved=Date.now();updateSaveState();
    toast(S.fileHandle?'Gespeichert':`Gespeichert als ${dlName()}`);
  }catch(e){toast('Speichern fehlgeschlagen: '+e.message);}}

// ---- Zusammenführen ----
function progressDialog(title){const dlg=$('dlg');dlg.innerHTML=`<div class="dlg"><header>${esc(title)}</header><div class="body"><div class="progress"><i id="mProg"></i></div><p class="note">Der Schlüssel wird abgeleitet – das kann einige Sekunden dauern.</p></div></div>`;dlg.oncancel=e=>e.preventDefault();dlg.showModal();return x=>{const p=$('mProg');if(p)p.style.width=(x*100)+'%';};}
function askPassword(name){return new Promise(res=>{const dlg=$('dlg');let kf=null;
  dlg.innerHTML=`<form class="dlg" id="apForm"><header>Passwort für „${esc(name)}“</header><div class="body"><p class="note" style="margin-top:4px">Die Datei nutzt ein anderes Master-Passwort als die geöffnete Datenbank.</p>
    <label class="f" for="apPw">Master-Passwort</label><input class="input" type="password" id="apPw" autocomplete="off">
    <label class="f">Schlüsseldatei <span class="muted">(optional)</span></label><div class="inrow"><button type="button" class="btn" id="apKf">Auswählen</button><span class="muted" id="apKfN">Keine</span></div><div class="err" id="apErr"></div></div>
    <footer><button type="button" class="btn" id="apC">Abbrechen</button><button class="btn primary">Öffnen</button></footer></form>`;
  $('apKf').onclick=()=>{const i=document.createElement('input');i.type='file';i.onchange=async()=>{if(i.files[0]){kf=new Uint8Array(await i.files[0].arrayBuffer());$('apKfN').textContent=i.files[0].name;}};i.click();};
  $('apC').onclick=()=>{dlg.close();res(null);};dlg.oncancel=()=>res(null);
  $('apForm').onsubmit=ev=>{ev.preventDefault();const v={pw:$('apPw').value,kf};dlg.close();res(v);};dlg.showModal();$('apPw').focus();});}
async function mergeBytes(bytes,name,quiet){
  let other=null;
  try{const pr=progressDialog('Datei wird geöffnet');other=await kdbxOpen(bytes,null,null,pr,S.db.composite);$('dlg').close();}
  catch(e){$('dlg').close();if(!/Passwort/.test(e.message)){toast(e.message);return false;}
    for(;;){const cred=await askPassword(name);if(!cred)return false;
      try{const pr=progressDialog('Datei wird geöffnet');other=await kdbxOpen(bytes,cred.pw,cred.kf,pr);$('dlg').close();break;}
      catch(err){$('dlg').close();toast(err.message);if(!/Passwort/.test(err.message))return false;}}}
  checkpoint('Zusammenführen');const st=await mergeDb(S.db,other);
  const changed=st.added+st.updated+st.deleted+st.groups+st.moved;
  if(changed){markDirty();}else UNDO.pop();
  S.entry=S.entry&&S.entry.parent?S.entry:null;render();
  if(!quiet||changed){await askChoice('Zusammenführen abgeschlossen',changed?
    `<b>${st.added}</b> ${st.added===1?'neuer':'neue'} und <b>${st.updated}</b> ${st.updated===1?'aktualisierter Eintrag':'aktualisierte Einträge'} übernommen, <b>${st.deleted}</b> gelöscht, <b>${st.groups}</b> neue Gruppen${st.moved?`, <b>${st.moved}</b> verschoben`:''}. Ältere Fassungen liegen jeweils im Verlauf.${quiet?'':' Speichere jetzt, um das Ergebnis zu sichern.'}`
    :'Beide Dateien sind bereits auf demselben Stand – es gab nichts zu übernehmen.',[{l:'OK',v:'ok',primary:true}]);}
  return true;}
function mergeFlow(){const i=document.createElement('input');i.type='file';i.accept='.kdbx';
  i.onchange=async()=>{const f=i.files[0];if(f)await mergeBytes(new Uint8Array(await f.arrayBuffer()),f.name,false);};i.click();}

// ---- Mehrfachauswahl, Ziehen & Ablegen ----
const bulkActive=()=>S.sel.size>1||(S.selMode&&S.sel.size>0);
function listOrder(){return [...document.querySelectorAll('#list .eitem')].map(x=>x.dataset.uuid);}
function selectEntryClick(u,ev){const e=findEntry(u);if(!e)return;
  if(ev&&ev.shiftKey&&S.entry&&!S.selMode){const o=listOrder();let a=o.indexOf(uuidOf(S.entry)),b=o.indexOf(u);if(a<0)a=b;const [lo,hi]=a<b?[a,b]:[b,a];S.sel.clear();for(let i=lo;i<=hi;i++){const x=findEntry(o[i]);if(x)S.sel.add(x);}}
  else if(ev&&(ev.metaKey||ev.ctrlKey)||S.selMode){if(!S.sel.size&&S.entry&&!S.selMode&&S.entry.parent)S.sel.add(S.entry);S.sel.has(e)?S.sel.delete(e):S.sel.add(e);S.entry=e;
    if(!S.selMode&&S.sel.size===1){S.entry=[...S.sel][0];S.sel.clear();}}
  else{S.sel.clear();S.entry=e;reveal=false;markAccess(e);}
  renderList();renderDetail();if(!S.selMode)showView('detail');$('detail').scrollTop=0;}
function groupOptions(sel){const out=[];const bin=recycleBin(false);(function w(g,d){if(g===bin)return;out.push(`<option value="${esc(uuidOf(g))}"${g===sel?' selected':''}>${'\u2003'.repeat(d)}${esc(gName(g))}</option>`);for(const c of X.kids(g,'Group'))w(c,d+1);})(rootGroup(),0);return out.join('');}
function renderBulk(){const list=[...S.sel].filter(e=>e.parent);const n=list.length;const allBin=list.every(inBin)||!binEnabled();
  $('detail').innerHTML=`<div class="dwrap"><div class="dtop"><button class="icon-btn back" data-act="backList" title="Zurück">${ICON.back}</button><div><h1>${n} ${n===1?'Eintrag':'Einträge'} ausgewählt</h1><div class="path">Aktionen gelten für alle ausgewählten Einträge</div></div></div>
    <div class="field"><div class="chips">${list.slice(0,14).map(e=>`<span class="chip">${esc(str(e,'Title')||'Ohne Titel')}</span>`).join('')}${n>14?`<span class="chip">+ ${n-14} weitere</span>`:''}</div></div>
    <div class="field"><div class="k">Verschieben nach</div><div class="inrow"><select class="input" id="bulkGroup">${groupOptions(curGroupEl())}</select><button class="btn primary" data-act="bulkMove">Verschieben</button></div></div>
    <div class="field"><div class="inrow" style="flex-wrap:wrap"><button class="btn danger" data-act="bulkDel">${ICON.trash}${allBin?'Endgültig löschen':'In den Papierkorb'}</button><button class="btn" data-act="bulkClear">Auswahl aufheben</button></div></div>
    <p class="note">⌘-Klick wählt einzelne Einträge, ⇧-Klick einen Bereich, ⌘A alle. Ausgewählte Einträge lassen sich auch auf eine Gruppe in der Seitenleiste ziehen.</p></div>`;}
function moveEntries(list,g){list=list.filter(e=>e.parent&&e.parent!==g);if(!list.length)return;checkpoint(list.length===1?'Verschieben':`${list.length} Einträge verschieben`);
  for(const e of list){moveTo(e,g);touch(e);}S.sel.clear();markDirty();render();undoToast(`${list.length===1?'Eintrag':list.length+' Einträge'} nach „${gName(g)}“ verschoben`);}
async function deleteEntries(list){list=list.filter(e=>e&&e.parent);if(!list.length)return;
  const perm=list.every(e=>inBin(e))||!binEnabled();const n=list.length;const pk=list.some(e=>passkeyOf(e));
  const name=n===1?`„${str(list[0],'Title')||'Ohne Titel'}“`:`${n} Einträge`;
  const c=await askChoice(perm?'Endgültig löschen?':'In den Papierkorb verschieben?',`${esc(name)} ${perm?'werden endgültig gelöscht.':'landen im Papierkorb und lassen sich von dort zurückholen.'}${pk?' <br><br><b>Achtung:</b> Mindestens ein Eintrag enthält einen Passkey. Ohne ihn kannst du dich bei diesem Dienst eventuell nicht mehr anmelden.':''}`,
    [{l:'Abbrechen',v:'cancel'},{l:perm?'Endgültig löschen':'In den Papierkorb',v:'ok',danger:true}]);
  if(c!=='ok')return;checkpoint(n===1?'Löschen':`${n} Einträge löschen`);for(const e of list)deleteEl(e);
  S.sel.clear();if(!S.entry||!S.entry.parent||list.includes(S.entry))S.entry=null;markDirty();render();showView('list');undoToast(perm?(n===1?'Eintrag gelöscht':`${n} Einträge gelöscht`):(n===1?'In den Papierkorb verschoben':`${n} Einträge in den Papierkorb verschoben`));}
document.addEventListener('dragstart',ev=>{const it=ev.target.closest&&ev.target.closest('.eitem');if(!it||!S.db)return;
  const e=findEntry(it.dataset.uuid);const list=S.sel.has(e)&&S.sel.size>1?[...S.sel].map(uuidOf):[it.dataset.uuid];
  ev.dataTransfer.setData('application/x-tresor',list.join(','));ev.dataTransfer.setData('text/plain',str(e,'Title'));ev.dataTransfer.effectAllowed='move';
  document.body.classList.add('dragging');if(list.length>1){const g=document.createElement('div');g.className='dragghost';g.textContent=`${list.length} Einträge`;document.body.appendChild(g);ev.dataTransfer.setDragImage(g,10,10);setTimeout(()=>g.remove(),0);}});
document.addEventListener('dragend',()=>{document.body.classList.remove('dragging');document.querySelectorAll('.drop-on').forEach(x=>x.classList.remove('drop-on'));});
document.addEventListener('dragover',ev=>{const g=ev.target.closest&&ev.target.closest('.gitem[data-uuid]');if(!g||!g.dataset.uuid||!ev.dataTransfer.types.includes('application/x-tresor'))return;ev.preventDefault();ev.dataTransfer.dropEffect='move';
  document.querySelectorAll('.drop-on').forEach(x=>x!==g&&x.classList.remove('drop-on'));g.classList.add('drop-on');});
document.addEventListener('dragleave',ev=>{const g=ev.target.closest&&ev.target.closest('.gitem');if(g&&!g.contains(ev.relatedTarget))g.classList.remove('drop-on');});
document.addEventListener('drop',ev=>{const g=ev.target.closest&&ev.target.closest('.gitem[data-uuid]');if(!g||!g.dataset.uuid)return;const d=ev.dataTransfer.getData('application/x-tresor');if(!d)return;ev.preventDefault();
  document.body.classList.remove('dragging');document.querySelectorAll('.drop-on').forEach(x=>x.classList.remove('drop-on'));
  const tg=findGroup(g.dataset.uuid);if(!tg)return;moveEntries(d.split(',').map(findEntry).filter(Boolean),tg);});

// ---- Passphrasen ----
const PP={words:6,sep:'-',cap:true,num:true};
const LASTGEN={pw:'',bits:0};
function passphrase(o=PP){const w=[];for(let i=0;i<o.words;i++){let x=WORDS[randInt(WORDS.length)];if(o.cap)x=x[0].toUpperCase()+x.slice(1);w.push(x);}if(o.num){w[randInt(w.length)]+=String(randInt(10));}return w.join(o.sep);}
function ppBits(o=PP){return Math.round(o.words*Math.log2(WORDS.length)+(o.num?Math.log2(10*o.words):0));}
function charBits(o=genOpt){const n=['upper','lower','digits','symbols'].filter(k=>o[k]).map(k=>o.noAmbig?CHARSETS[k].replace(AMBIG,''):CHARSETS[k]).join('').length;return Math.round(o.len*Math.log2(n||1));}
function genAny(){const w=genOpt.mode==='words';const pw=w?passphrase():generate();LASTGEN.pw=pw;LASTGEN.bits=w?ppBits():charBits();return pw;}
function mountGen(box,input,onGen){
  const persist=()=>{prefs.genOpt={...genOpt};prefs.pp={...PP};savePrefs();};
  const draw=()=>{const w=genOpt.mode==='words';
    box.innerHTML=`<div class="seg" role="tablist"><button type="button" data-m="chars" class="${w?'':'on'}">Zeichen</button><button type="button" data-m="words" class="${w?'on':''}">Wörter</button></div>`+
    (w?`<div class="inrow"><span class="glab">Wörter <b>${PP.words}</b></span><input type="range" min="3" max="10" value="${PP.words}" data-r="words"><button type="button" class="btn" data-new>${ICON.dice}Neu</button></div>
      <div class="opts"><label>Trenner <select data-o="sep" class="input mini">${[['-','Bindestrich'],['.','Punkt'],[' ','Leerzeichen'],['_','Unterstrich']].map(([v,l])=>`<option value="${v}"${PP.sep===v?' selected':''}>${l}</option>`).join('')}</select></label><label><input type="checkbox" data-o="cap"${PP.cap?' checked':''}>Großbuchstaben</label><label><input type="checkbox" data-o="num"${PP.num?' checked':''}>Ziffer einfügen</label></div>`
    :`<div class="inrow"><span class="glab">Länge <b>${genOpt.len}</b></span><input type="range" min="8" max="64" value="${genOpt.len}" data-r="len"><button type="button" class="btn" data-new>${ICON.dice}Neu</button></div>
      <div class="opts">${[['upper','A–Z'],['lower','a–z'],['digits','0–9'],['symbols','!#$%…'],['noAmbig','Ähnliche Zeichen vermeiden']].map(([k,l])=>`<label><input type="checkbox" data-g="${k}"${genOpt[k]?' checked':''}>${l}</label>`).join('')}</div>`)+
    `<div class="gnote">${w?`≈ ${ppBits()} Bit Zufall – gut zu merken und abzutippen, ideal für Master-Passwörter`:`≈ ${charBits()} Bit Zufall – maximal stark für gespeicherte Passwörter`}</div>`;};
  const gen=()=>{input.value=genAny();input.type='text';onGen&&onGen();};
  box.onclick=ev=>{const m=ev.target.closest('[data-m]');if(m){genOpt.mode=m.dataset.m;persist();draw();gen();return;}if(ev.target.closest('[data-new]'))gen();};
  box.oninput=ev=>{const t=ev.target;if(t.dataset.r==='words'){PP.words=+t.value;}else if(t.dataset.r==='len'){genOpt.len=+t.value;}else return;persist();t.previousElementSibling.querySelector('b').textContent=t.value;gen();box.querySelector('.gnote').textContent=genOpt.mode==='words'?`≈ ${ppBits()} Bit Zufall – gut zu merken und abzutippen, ideal für Master-Passwörter`:`≈ ${charBits()} Bit Zufall – maximal stark für gespeicherte Passwörter`;};
  box.onchange=ev=>{const t=ev.target;if(t.dataset.o){PP[t.dataset.o]=t.type==='checkbox'?t.checked:t.value;}else if(t.dataset.g){genOpt[t.dataset.g]=t.checked;}else return;persist();draw();gen();};
  draw();}
Object.assign(genOpt,{mode:'chars'},prefs.genOpt||{});Object.assign(PP,prefs.pp||{});

// ---- Passkeys (KeePassXC/Strongbox-Format) ----
const isPkKey=k=>k.startsWith('KPEX_PASSKEY_');
function passkeyOf(e){const rp=str(e,'KPEX_PASSKEY_RELYING_PARTY');if(!rp&&!str(e,'KPEX_PASSKEY_PRIVATE_KEY_PEM'))return null;return {rp,user:str(e,'KPEX_PASSKEY_USERNAME')};}

// ---- CSV-Import ----
function importDialog(){const i=document.createElement('input');i.type='file';i.accept='.csv,text/csv,.txt';
  i.onchange=async()=>{const f=i.files[0];if(!f)return;let rows;try{rows=csvParse(await f.text());}catch(e){toast('Die Datei konnte nicht gelesen werden.');return;}
    if(rows.length<2){toast('Die Datei enthält keine Einträge.');return;}
    const fmt=csvDetect(rows[0]);const {records,mapped}=csvRecords(rows);
    if(!mapped.includes('pass')&&!mapped.includes('user')){toast('Keine Spalten für Benutzername oder Passwort gefunden.');return;}
    const dlg=$('dlg');const today=new Date().toLocaleDateString('de-DE');
    dlg.innerHTML=`<form class="dlg" id="imForm"><header>CSV importieren</header><div class="body">
      <p style="margin:4px 0 12px">Erkannt: <b>${esc(fmt)}</b> – ${records.length} Einträge</p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Titel</th><th>Benutzername</th><th>URL</th><th>Passwort</th></tr></thead><tbody>${records.slice(0,5).map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.user)}</td><td>${esc(r.url)}</td><td>${r.pass?'••••••':'–'}</td></tr>`).join('')}</tbody></table></div>
      ${records.length>5?`<p class="note" style="margin-top:6px">… und ${records.length-5} weitere</p>`:''}
      <label class="f" for="imG">In neue Gruppe</label><input class="input" id="imG" value="Import ${esc(fmt)} ${today}">
      <label class="check"><input type="checkbox" id="imF" checked> Ordner als Untergruppen übernehmen</label>
      <label class="check"><input type="checkbox" id="imD" checked> Einträge überspringen, die es schon gibt (gleicher Titel, Benutzername und URL)</label>
      <p class="note warnbox">Lösche die CSV-Datei nach dem Import. Sie enthält deine Passwörter unverschlüsselt.</p></div>
      <footer><button type="button" class="btn" id="imC">Abbrechen</button><button class="btn primary">${records.length} Einträge importieren</button></footer></form>`;
    $('imC').onclick=()=>dlg.close();
    $('imForm').onsubmit=ev=>{ev.preventDefault();checkpoint('Import');
      const key=(t,u,l)=>[t,u,l].map(x=>(x||'').trim().toLowerCase()).join('\u0001');
      const existing=new Set(allEntries(rootGroup()).map(e=>key(str(e,'Title'),str(e,'UserName'),str(e,'URL'))));
      const base=makeGroup($('imG').value.trim()||'Import');insertGroup(rootGroup(),base);const cache=new Map();
      const sub=path=>{if(!$('imF').checked||!path)return base;let segs=path.split(/[\/\\]/).map(s=>s.trim()).filter(Boolean);if(fmt==='KeePassXC'&&segs.length)segs=segs.slice(1);let g=base,k='';
        for(const s of segs){k+='/'+s;if(!cache.has(k)){const ng=makeGroup(s);insertGroup(g,ng);cache.set(k,ng);}g=cache.get(k);}return g;};
      let n=0,skip=0;
      for(const r of records){if($('imD').checked&&existing.has(key(r.title,r.user,r.url))){skip++;continue;}
        const e=makeEntry();setStr(e,'Title',r.title,protDefault('Title'));setStr(e,'UserName',r.user,protDefault('UserName'));setStr(e,'Password',r.pass,true);setStr(e,'URL',r.url,protDefault('URL'));setStr(e,'Notes',r.notes,protDefault('Notes'));
        if(r.totp){try{parseOtpString(r.totp);setStr(e,'otp',/^otpauth:/i.test(r.totp)?r.totp:`otpauth://totp/${encodeURIComponent(r.title)}?secret=${r.totp.toUpperCase().replace(/[\s=-]/g,'')}&period=30&digits=6`,true);}catch(err){setStr(e,'TOTP',r.totp,true);}}
        if(r.tags)X.setText(X.ensure(e,'Tags'),r.tags.split(/[;,]/).map(s=>s.trim()).filter(Boolean).join(';'));
        insertEntry(sub(r.group),e);n++;}
      if(!n&&!cache.size){X.remove(base);UNDO.pop();dlg.close();toast(`Nichts importiert – alle ${skip} Einträge gibt es schon.`);return;}
      S.group=X.kids(base,'Entry').length||!X.kids(base,'Group').length?base:X.kids(base,'Group')[0];S.entry=null;S.query='';$('q').value='';markDirty();dlg.close();render();
      undoToast(`${n} ${n===1?'Eintrag':'Einträge'} importiert${skip?`, ${skip} ${skip===1?'vorhandener':'vorhandene'} übersprungen`:''}`);};
    dlg.showModal();};
  i.click();}

// ---- CSV-Export ----
function exportDialog(){const dlg=$('dlg');const n=allEntries(rootGroup()).length;
  dlg.innerHTML=`<form class="dlg" id="exForm"><header>Als CSV exportieren</header><div class="body">
    <p style="margin:6px 0 0">Exportiert ${n} Einträge (ohne Papierkorb) im KeePassXC-Format. Bitwarden, 1Password und die meisten Browser können diese Datei importieren.</p>
    <p class="note warnbox">Die CSV-Datei ist <b>nicht verschlüsselt</b>. Jeder, der sie öffnet, sieht alle Passwörter. Nutze sie nur für einen Umzug und lösche sie danach sofort.</p>
    <label class="check"><input type="checkbox" id="exOk"> Mir ist klar, dass die Datei unverschlüsselt ist</label>
    <label class="f" for="exPw">Master-Passwort zur Bestätigung</label><input class="input" type="password" id="exPw" autocomplete="current-password"></div>
    <footer><button type="button" class="btn" id="exC">Abbrechen</button><button class="btn primary" id="exGo" disabled>Exportieren</button></footer></form>`;
  $('exOk').onchange=()=>$('exGo').disabled=!$('exOk').checked;$('exC').onclick=()=>dlg.close();
  $('exForm').onsubmit=async ev=>{ev.preventDefault();if(!await verifyMaster($('exPw').value)){$('exPw').select();toast('Das Master-Passwort stimmt nicht.');return;}const lines=[['Group','Title','Username','Password','URL','Notes','TOTP','Icon','Last Modified','Created'].map(csvCell).join(',')];
    for(const e of allEntries(rootGroup())){const path=[];for(let p=e.parent;p&&p.name==='Group';p=p.parent)path.unshift(gName(p));
      const iso=k=>{const d=getTime(e,k);return d?d.toISOString():'';};
      lines.push([path.join('/'),str(e,'Title'),str(e,'UserName'),str(e,'Password'),str(e,'URL'),str(e,'Notes'),otpEditValue(e),X.text(X.kid(e,'IconID'))||'0',iso('LastModificationTime'),iso('CreationTime')].map(csvCell).join(','));}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv'}));a.download=dlName().replace(/\.kdbx$/,'')+'_Export.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    dlg.close();toast('Export erstellt – bitte nach Gebrauch löschen');};
  dlg.showModal();}

// ---- Befehlspalette ----
function goGroup(g){S.group=g;if(g==='home')S.entry=null;S.query='';$('q').value='';S.sel.clear();render();showView(g==='home'?'detail':'list');}
function commands(){return [
  ['Neuer Eintrag','⌘⇧N',()=>openEditor(null)],['Neue Gruppe','',()=>groupDialog(null)],['Speichern','⌘S',save],['Rückgängig','⌘Z',undo],
  ['Sicherheitsbericht öffnen','',()=>goGroup('report')],['Favoriten anzeigen','',()=>goGroup('fav')],['Zuletzt verwendet','',()=>goGroup('recent')],
  ['Als Favorit markieren / entfernen','⌘D',()=>S.entry&&toggleFav(S.entry)],['Eintrag drucken …','⌘P',()=>S.entry?printEntryDialog(S.entry):toast('Wähle zuerst einen Eintrag aus')],
  ['Notfallblatt drucken …','',sheetDialog],['Doppelte Einträge zusammenführen …','',dupDialog],['Fokus-Modus ein/aus','⌘\\',toggleFocus],['Alle Einträge anzeigen','',()=>goGroup('all')],
  ['CSV importieren …','',importDialog],['Als CSV exportieren …','',exportDialog],['Mit anderer .kdbx-Datei zusammenführen …','',mergeFlow],
  ['Passwort generieren und kopieren','',()=>{const p=genAny();copyText(p);toast('Neues Passwort kopiert');}],
  ['Passphrase generieren und kopieren','',()=>{const p=passphrase();copyText(p);toast('Neue Passphrase kopiert');}],
  ['Mehrere Einträge auswählen','',()=>{S.selMode=true;S.sel.clear();renderList();}],
  ['Einstellungen','',settingsDialog],['Tastenkürzel anzeigen','?',shortcutsDialog],['Sperren','',lock],['Übersicht','',()=>goGroup('home')],['Kundenmappe erstellen …','',()=>bundleDialog()],['Kategorien verwalten …','',()=>tplManager()],...tplList().map(t=>['Neuer Eintrag: '+t.name,'',()=>openEditor(null,t.id)])];}
function openPalette(){const dlg=$('dlg');let items=[],idx=0;
  dlg.innerHTML=`<div class="dlg pal"><div class="palin">${ICON.search||''}<input class="input" id="palQ" placeholder="Eintrag, Gruppe oder Befehl suchen …" autocomplete="off" spellcheck="false"></div><div class="pallist" id="palL"></div><div class="palfoot"><span><kbd>↑</kbd><kbd>↓</kbd> auswählen</span><span><kbd>↵</kbd> öffnen</span><span><kbd>⌘</kbd><kbd>↵</kbd> Passwort kopieren</span><span><kbd>esc</kbd> schließen</span></div></div>`;
  const draw=()=>{const q=$('palQ').value.trim().toLowerCase();const ws=q.split(/\s+/).filter(Boolean);const m=t=>ws.every(w=>t.toLowerCase().includes(w));
    const cmds=commands().filter(c=>!q||m(c[0])).map(c=>({kind:'cmd',label:c[0],hint:c[1],run:c[2]}));
    const groups=[];if(q)(function w(g){if(m(gName(g)))groups.push({kind:'grp',label:gName(g),hint:'Gruppe',el:g});for(const c of X.kids(g,'Group'))w(c);})(rootGroup());
    const ents=q?allEntries(rootGroup()).filter(e=>m([str(e,'Title'),str(e,'UserName'),str(e,'URL')].join(' '))).slice(0,30).map(e=>({kind:'ent',label:str(e,'Title')||'Ohne Titel',hint:[str(e,'UserName'),groupPath(e)].filter(Boolean).join(' – '),el:e})):[];
    items=q?[...ents,...groups,...cmds]:cmds;idx=Math.min(idx,Math.max(0,items.length-1));
    $('palL').innerHTML=items.length?items.map((it,i)=>`<button type="button" class="palit${i===idx?' on':''}" data-i="${i}">${it.kind==='ent'?entryBadge(it.el):it.kind==='grp'?ICON.folder:'<span class="palcmd">›</span>'}<span class="tx"><span class="t">${esc(it.label)}</span>${it.hint&&it.kind!=='cmd'?`<span class="s">${esc(it.hint)}</span>`:''}</span>${it.kind==='cmd'&&it.hint?`<kbd>${esc(it.hint)}</kbd>`:''}</button>`).join(''):'<div class="empty" style="padding:24px">Nichts gefunden</div>';
    const on=$('palL').querySelector('.on');if(on)on.scrollIntoView({block:'nearest'});};
  const run=(it,copy)=>{if(!it)return;dlg.close();
    if(it.kind==='cmd')it.run();else if(it.kind==='grp')goGroup(it.el);
    else if(copy){if(sensLocked(it.el)){S.group='all';S.entry=it.el;render();showView('detail');unlockSensitive();return;}copyText(str(it.el,'Password'));toast(`Passwort von „${it.label}“ kopiert – wird in 30 s geleert`);}
    else{S.group='all';S.query='';$('q').value='';S.sel.clear();S.entry=it.el;reveal=false;markAccess(it.el);render();showView('detail');}};
  $('palQ').oninput=()=>{idx=0;draw();};
  $('palQ').onkeydown=ev=>{ev.stopPropagation();if(ev.key==='Escape'){ev.preventDefault();dlg.close();return;}if(ev.key==='ArrowDown'){ev.preventDefault();idx=Math.min(items.length-1,idx+1);draw();}else if(ev.key==='ArrowUp'){ev.preventDefault();idx=Math.max(0,idx-1);draw();}
    else if(ev.key==='Enter'){ev.preventDefault();run(items[idx],ev.metaKey||ev.ctrlKey);}};
  $('palL').onclick=ev=>{const b=ev.target.closest('[data-i]');if(b)run(items[+b.dataset.i],ev.metaKey||ev.ctrlKey);};
  dlg.oncancel=null;draw();dlg.showModal();$('palQ').focus();}
function shortcutsDialog(){const dlg=$('dlg');const K=[['⌘ K','Befehle und Einträge suchen'],['⌘ D','Favorit an/aus'],['⌘ P','Eintrag drucken'],['⌘ \\','Fokus-Modus'],['⌘ F','Liste durchsuchen'],['↑ ↓','Vorheriger / nächster Eintrag'],['↵','Eintrag bearbeiten'],['⌘ C','Passwort kopieren'],['⌘ B','Benutzername kopieren'],['⌘ ⇧ N','Neuer Eintrag'],['⌘ S','Speichern'],['⌘ Z','Rückgängig'],['⌘ A','Alle Einträge der Liste auswählen'],['⌘ Klick / ⇧ Klick','Mehrere Einträge auswählen'],['⌫','Auswahl löschen'],['esc','Auswahl aufheben'],['?','Diese Übersicht']];
  dlg.innerHTML=`<div class="dlg"><header>Tastenkürzel</header><div class="body"><table class="tbl keys">${K.map(([k,l])=>`<tr><td>${k.split(' / ').map(x=>`<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(l)}</td></tr>`).join('')}</table><p class="note">Unter Windows gilt Strg statt ⌘.</p></div><footer><button class="btn primary" id="kOk">Schließen</button></footer></div>`;
  $('kOk').onclick=()=>dlg.close();dlg.showModal();}

// ---- Tastatur ----
function moveSel(d){const o=listOrder();if(!o.length)return;let i=S.entry?o.indexOf(uuidOf(S.entry)):-1;i=i<0?(d>0?0:o.length-1):Math.max(0,Math.min(o.length-1,i+d));
  S.sel.clear();S.entry=findEntry(o[i]);reveal=false;markAccess(S.entry);renderList();renderDetail();const b=document.querySelector(`#list .eitem[data-uuid="${CSS.escape(o[i])}"]`);if(b){b.focus({preventScroll:true});b.scrollIntoView({block:'nearest'});}}
document.addEventListener('keydown',e=>{
  if(!S.db||e.defaultPrevented)return;const mod=e.metaKey||e.ctrlKey;const k=e.key.toLowerCase();
  if(mod&&k==='k'){e.preventDefault();if($('dlg').open)$('dlg').close();openPalette();return;}
  if($('dlg').open)return;
  const ae=document.activeElement;const inField=/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
  if(mod&&k==='s'){e.preventDefault();save();return;}
  if(mod&&k==='f'){e.preventDefault();$('q').focus();$('q').select();return;}
  if(mod&&e.shiftKey&&k==='n'){e.preventDefault();openEditor(null);return;}
  if(inField){if(ae===$('q')){if(e.key==='Escape'){$('q').value='';S.query='';renderList();$('q').blur();}else if(e.key==='ArrowDown'){e.preventDefault();$('q').blur();moveSel(1);}}return;}
  if(mod&&k==='z'&&!e.shiftKey){e.preventDefault();undo();return;}
  if(mod&&k==='e'&&S.entry){e.preventDefault();openEditor(S.entry);return;}
  if(mod&&k==='a'){e.preventDefault();S.sel=new Set(listOrder().map(findEntry).filter(Boolean));if(S.sel.size===1){S.entry=[...S.sel][0];S.sel.clear();}renderList();renderDetail();return;}
  if(mod&&k==='c'&&S.entry&&!window.getSelection().toString()){e.preventDefault();copyText(str(S.entry,'Password'));markCopied('Password');toast('Passwort kopiert – wird in 30 s geleert');return;}
  if(mod&&k==='b'&&S.entry){e.preventDefault();copyText(str(S.entry,'UserName'));markCopied('UserName');toast('Benutzername kopiert – wird in 30 s geleert');return;}
  if(mod||e.altKey)return;
  const onBtn=(ae.tagName==='BUTTON'||ae.tagName==='A')&&!ae.classList.contains('eitem');
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();moveSel(e.key==='ArrowDown'?1:-1);}
  else if(e.key==='Enter'&&S.entry&&!onBtn&&!bulkActive()){e.preventDefault();openEditor(S.entry);}
  else if((e.key==='Delete'||e.key==='Backspace')&&(S.entry||S.sel.size)){e.preventDefault();deleteEntries(bulkActive()?[...S.sel]:[S.entry]);}
  else if(e.key==='Escape'&&(S.sel.size||S.selMode)){S.sel.clear();S.selMode=false;renderList();renderDetail();}
  else if(e.key==='?'){shortcutsDialog();}
  else if(e.key==='/'){e.preventDefault();$('q').focus();}
});

// ---- Zusätzliche Klickaktionen ----
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='bulkMove'){const g=findGroup($('bulkGroup').value);if(g)moveEntries([...S.sel],g);}
  else if(a==='bulkDel')deleteEntries([...S.sel]);
  else if(a==='bulkClear'){S.sel.clear();S.selMode=false;renderList();renderDetail();}
  else if(a==='selMode'){S.selMode=!S.selMode;S.sel.clear();renderList();renderDetail();}
  else if(a==='palette')openPalette();
  else if(a==='undo')undo();
  else if(a==='imp'){$('dlg').close();importDialog();}
  else if(a==='exp'){$('dlg').close();exportDialog();}
  else if(a==='mrg'){$('dlg').close();mergeFlow();}
  else if(a==='keys'){$('dlg').close();shortcutsDialog();}
});
// Neue Datenbank: Passphrase vorschlagen
$('ppSuggest').onclick=()=>{const p=passphrase({...PP,words:Math.max(PP.words,6)});LASTGEN.pw=p;LASTGEN.bits=ppBits({...PP,words:Math.max(PP.words,6)});$('newPw').value=p;$('newPw2').value=p;$('newPw').type='text';$('newMeter').innerHTML=meterHtml(p);$('ppHint').classList.remove('hidden');};

applyPrefs();
