// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 7: Gruppenverwaltung =====================
const isUnderG=(g,anc)=>{for(let p=g;p;p=p.parent)if(p===anc)return true;return false;};
function groupStats(g){let e=0,s=0;(function w(x){e+=X.kids(x,'Entry').length;for(const c of X.kids(x,'Group')){s++;w(c);}})(g);return {e,s};}
const plural=(n,a,b)=>`${n} ${n===1?a:b}`;
// ---- Kontextmenü einer Gruppe ----
function groupMenu(g,anchor){if(!g)return;const dlg=$('dlg');const root=g===rootGroup(),bin=g===recycleBin(false);const perm=bin||inBin(g)||!binEnabled();const st=groupStats(g);
  const items=[
    !bin&&['edit','edit','Bearbeiten','Name, Symbol und Ort ändern'],
    !bin&&['sub','folder','Neue Untergruppe',`Innerhalb von „${gName(g)}“`],
    !bin&&['entry','plus','Neuer Eintrag hier',''],
    !root&&!bin&&['move','folderOpen','Verschieben nach …',''],
    !bin&&st.e>0&&['bundle','pkg','Als Kundenmappe exportieren …',''],
    bin&&(st.e||st.s)&&['empty','trash','Papierkorb leeren',`${plural(st.e,'Eintrag','Einträge')} endgültig löschen`],
    !root&&!bin&&['del','trash',perm?'Endgültig löschen':'Löschen',perm?'Kann nicht rückgängig gemacht werden – außer direkt danach':'Wandert mit Inhalt in den Papierkorb']].filter(Boolean);
  dlg.innerHTML=`<div class="dlg menu"><header><span class="mhead">${groupIcon(g)}<span>${esc(gName(g))}<small>${root?'Hauptgruppe der Datenbank · ':''}${plural(st.e,'Eintrag','Einträge')}${st.s?' · '+plural(st.s,'Untergruppe','Untergruppen'):''}</small></span></span></header>
    <div class="mlist">${items.map(([k,ic,l,d])=>`<button type="button" class="mitem${k==='del'||k==='empty'?' danger':''}" data-m="${k}">${kpSvg(0,ic)}<span><b>${l}</b>${d?`<small>${esc(d)}</small>`:''}</span></button>`).join('')}</div>
    <footer><button type="button" class="btn" id="mC">Schließen</button></footer></div>`;
  dlg.querySelectorAll('.mitem').forEach(b=>{const k=b.dataset.m;if(k==='entry')b.querySelector('svg').outerHTML=ICON.plus;if(k==='edit')b.querySelector('svg').outerHTML=ICON.edit;});
  $('mC').onclick=()=>dlg.close();
  dlg.querySelector('.mlist').onclick=ev=>{const b=ev.target.closest('[data-m]');if(!b)return;const k=b.dataset.m;dlg.close();
    if(k==='edit')groupDialog(g);else if(k==='sub')groupDialog(null,g);else if(k==='entry'){S.group=g;S.entry=null;render();openEditor(null);}
    else if(k==='move')moveGroupDialog(g);else if(k==='bundle')bundleDialog(g);else if(k==='del')deleteGroup(g);else if(k==='empty')emptyBin();};
  dlg.showModal();}
// ---- Erstellen / Bearbeiten ----
groupDialog=function(g,parent0){const dlg=$('dlg');const isNew=!g;const root=g&&g===rootGroup();
  const parent=isNew?(parent0||curGroupEl()):g.parent;let icon=g?parseInt(X.text(X.kid(g,'IconID'))||'48',10):48;let iconChanged=false;
  const opts=[];const bin=recycleBin(false);(function w(x,d){if(x===bin||(g&&isUnderG(x,g)))return;opts.push(`<option value="${esc(uuidOf(x))}"${x===parent?' selected':''}>${'\u2003'.repeat(d)}${esc(gName(x))}</option>`);for(const c of X.kids(x,'Group'))w(c,d+1);})(rootGroup(),0);
  dlg.innerHTML=`<form class="dlg" id="gForm"><header>${isNew?'Neue Gruppe':root?'Datenbank-Hauptgruppe bearbeiten':'Gruppe bearbeiten'}</header><div class="body">
    <label class="f" for="gName">Name</label><div class="inrow"><button type="button" class="iconpick" id="gIco" title="Symbol wählen"></button><input class="input" id="gName" value="${esc(g?gName(g):'')}" placeholder="z. B. Kunde Müller GmbH" required></div>
    <div class="icogrid hidden" id="gIcoGrid">${KP_MAP.map((n,i)=>`<button type="button" data-ico="${i}" title="${esc(KP_NAMES[i])}">${kpSvg(i)}</button>`).join('')}</div>
    ${root?'':`<label class="f" for="gPar">Liegt in</label><select class="input" id="gPar">${opts.join('')}</select>`}
    <label class="f" for="gNotes">Notizen <span class="muted">(optional)</span></label><textarea class="input" id="gNotes" style="min-height:64px">${esc(g?X.text(X.kid(g,'Notes')):'')}</textarea>
  </div><footer>${!isNew&&!root?`<button type="button" class="btn danger left" id="gDel">${ICON.trash}Löschen</button>`:''}<button type="button" class="btn" id="gCancel">Abbrechen</button><button class="btn primary">${isNew?'Gruppe anlegen':'Speichern'}</button></footer></form>`;
  const drawIco=()=>{$('gIco').innerHTML=`<span class="mono-badge gbadge">${icon===48||icon===49||icon===0?ICON.folder:kpSvg(icon)}</span>`;dlg.querySelectorAll('[data-ico]').forEach(b=>b.classList.toggle('on',+b.dataset.ico===icon));};drawIco();
  $('gIco').onclick=()=>$('gIcoGrid').classList.toggle('hidden');
  $('gIcoGrid').onclick=ev=>{const b=ev.target.closest('[data-ico]');if(!b)return;icon=+b.dataset.ico;iconChanged=true;drawIco();$('gIcoGrid').classList.add('hidden');};
  $('gCancel').onclick=()=>dlg.close();if($('gDel'))$('gDel').onclick=()=>{dlg.close();deleteGroup(g);};
  $('gForm').onsubmit=ev=>{ev.preventDefault();const name=$('gName').value.trim();if(!name)return;const par=$('gPar')?findGroup($('gPar').value):null;
    checkpoint(isNew?'Gruppe anlegen':'Gruppe bearbeiten');let target=g;
    if(isNew){target=makeGroup(name,icon);insertGroup(par||rootGroup(),target);}
    else{X.setText(X.ensure(target,'Name'),name);if(iconChanged){X.setText(X.ensure(target,'IconID'),String(icon));const cu=X.kid(target,'CustomIconUUID');if(cu)X.remove(cu);}
      if(par&&par!==target.parent&&!isUnderG(par,target)){X.remove(target);X.append(par,target);setTime(target,'LocationChanged',new Date());}}
    X.setText(X.ensure(target,'Notes'),$('gNotes').value);touch(target);
    S.group=target;S.entry=null;markDirty();dlg.close();render();showView('list');undoToast(isNew?`Gruppe „${name}“ angelegt`:'Gruppe gespeichert');};
  dlg.showModal();if(isNew)$('gName').focus();};
// ---- Verschieben ----
function moveGroupDialog(g){const dlg=$('dlg');const opts=[];const bin=recycleBin(false);
  (function w(x,d){if(x===bin||isUnderG(x,g))return;opts.push(`<option value="${esc(uuidOf(x))}"${x===g.parent?' selected':''}>${'\u2003'.repeat(d)}${esc(gName(x))}</option>`);for(const c of X.kids(x,'Group'))w(c,d+1);})(rootGroup(),0);
  dlg.innerHTML=`<form class="dlg narrow" id="mvG"><header>„${esc(gName(g))}“ verschieben</header><div class="body"><label class="f" for="mvTo">Neuer Ort</label><select class="input" id="mvTo">${opts.join('')}</select>
    <p class="note">Einträge und Untergruppen werden mit verschoben. Tipp: Am Computer kannst du Gruppen auch in der Seitenleiste auf eine andere Gruppe ziehen.</p></div>
    <footer><button type="button" class="btn" id="mvC">Abbrechen</button><button class="btn primary">Verschieben</button></footer></form>`;
  $('mvC').onclick=()=>dlg.close();$('mvG').onsubmit=ev=>{ev.preventDefault();const t=findGroup($('mvTo').value);dlg.close();moveGroupTo(g,t);};dlg.showModal();}
function moveGroupTo(g,t){if(!t||t===g.parent||isUnderG(t,g)||g===rootGroup())return;checkpoint('Gruppe verschieben');X.remove(g);X.append(t,g);setTime(g,'LocationChanged',new Date());touch(g);markDirty();render();undoToast(`„${gName(g)}“ nach „${gName(t)}“ verschoben`);}
// ---- Löschen ----
async function deleteGroup(g){if(!g||g===rootGroup())return;const st=groupStats(g);const bin=g===recycleBin(false);const perm=bin||inBin(g)||!binEnabled();
  const what=st.e||st.s?` mit ${[st.e?plural(st.e,'Eintrag','Einträgen'):'',st.s?plural(st.s,'Untergruppe','Untergruppen'):''].filter(Boolean).join(' und ')}`:'';
  const pk=allEntries(g,[],false).some(passkeyOf);
  const c=await askChoice(perm?'Gruppe endgültig löschen?':'Gruppe löschen?',`„${esc(gName(g))}“${what} ${perm?'wird endgültig gelöscht.':'wird in den <b>Papierkorb</b> verschoben. Von dort kannst du sie zurückholen oder endgültig löschen.'}${pk?'<br><br><b>Achtung:</b> Die Gruppe enthält mindestens einen Passkey.':''}`,
    [{l:'Abbrechen',v:'cancel'},{l:perm?'Endgültig löschen':'In den Papierkorb',v:'ok',danger:true}]);
  if(c!=='ok')return;checkpoint('Gruppe löschen');
  if(bin){recordDeleted(g);X.remove(g);X.setText(X.ensure(meta(),'RecycleBinUUID'),'AAAAAAAAAAAAAAAAAAAAAA==');}else deleteEl(g);
  if(S.group===g||(typeof S.group==='object'&&S.group&&!S.group.parent))S.group='all';if(S.entry&&!S.entry.parent)S.entry=null;
  markDirty();render();showView('list');undoToast(perm?'Gruppe endgültig gelöscht':'Gruppe in den Papierkorb verschoben');}
async function emptyBin(){const b=recycleBin(false);if(!b)return;const st=groupStats(b);
  const c=await askChoice('Papierkorb leeren?',`${plural(st.e,'Eintrag','Einträge')}${st.s?' und '+plural(st.s,'Gruppe','Gruppen'):''} werden endgültig gelöscht.`,[{l:'Abbrechen',v:'cancel'},{l:'Endgültig löschen',v:'ok',danger:true}]);
  if(c!=='ok')return;checkpoint('Papierkorb leeren');for(const x of [...X.kids(b,'Entry'),...X.kids(b,'Group')]){recordDeleted(x);X.remove(x);}
  if(S.entry&&!S.entry.parent)S.entry=null;markDirty();render();undoToast('Papierkorb geleert');}
// ---- Gruppen per Ziehen verschieben (Desktop) ----
document.addEventListener('dragstart',ev=>{const r=ev.target.closest&&ev.target.closest('.grow[draggable=true]');if(!r||!S.db)return;
  ev.dataTransfer.setData('application/x-tresor-group',r.dataset.uuid);ev.dataTransfer.effectAllowed='move';document.body.classList.add('dragging');});
document.addEventListener('dragover',ev=>{if(!ev.dataTransfer.types.includes('application/x-tresor-group'))return;const g=ev.target.closest&&ev.target.closest('.gitem[data-uuid]');if(!g||!g.dataset.uuid)return;
  ev.preventDefault();document.querySelectorAll('.drop-on').forEach(x=>x!==g&&x.classList.remove('drop-on'));g.classList.add('drop-on');});
document.addEventListener('drop',ev=>{const u=ev.dataTransfer.getData('application/x-tresor-group');if(!u)return;const g=ev.target.closest&&ev.target.closest('.gitem[data-uuid]');
  document.body.classList.remove('dragging');document.querySelectorAll('.drop-on').forEach(x=>x.classList.remove('drop-on'));if(!g||!g.dataset.uuid)return;ev.preventDefault();
  const src=findGroup(u),dst=findGroup(g.dataset.uuid);if(!src||!dst)return;if(dst===recycleBin(false)){deleteGroup(src);return;}if(isUnderG(dst,src)){toast('Eine Gruppe kann nicht in sich selbst verschoben werden.');return;}moveGroupTo(src,dst);});
// ---- Klicks ----
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='gmenu'){ev.stopPropagation();groupMenu(findGroup(b.dataset.uuid)||rootGroup(),b);}
  else if(a==='entryHere'){openEditor(null);}});
