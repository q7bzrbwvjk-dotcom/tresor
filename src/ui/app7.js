// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 8: Kategorien (Vorlagen) verwalten =====================
const TPL_KEY='Tresor.Templates';
const DEFAULT_TPLS=()=>[
  {id:'login',name:'Login',icon:0,fields:[],hide:[],tags:'',sens:false,url:''},
  {id:'wlan',name:'WLAN',icon:12,fields:[['SSID',0,''],['Verschlüsselung',0,'WPA2/WPA3']],hide:['user','url','otp'],tags:'wlan',sens:false,url:''},
  {id:'server',name:'Server / SSH',icon:3,fields:[['Host',0,''],['Port',0,'22'],['SSH-Schlüssel',1,'']],hide:[],tags:'',sens:false,url:'ssh://'},
  {id:'card',name:'Kreditkarte',icon:66,fields:[['Karteninhaber',0,''],['Kartennummer',1,''],['Gültig bis',0,''],['Prüfnummer (CVC)',1,''],['PIN',1,'']],hide:['user','pw','url','otp'],tags:'',sens:true,url:''},
  {id:'license',name:'Softwarelizenz',icon:47,fields:[['Produkt',0,''],['Lizenzschlüssel',1,''],['Lizenziert für',0,''],['Kaufdatum',0,'']],hide:['pw','otp'],tags:'',sens:false,url:''},
  {id:'customer',name:'Kundenzugang',icon:5,fields:[['Kunde',0,''],['Kundennummer',0,''],['Ansprechpartner',0,''],['Telefon',0,'']],hide:[],tags:'kunde',sens:false,url:''},
  {id:'note',name:'Sichere Notiz',icon:7,fields:[],hide:['user','pw','url','otp'],tags:'',sens:false,url:''}];
function tplItem(){const cd=X.kid(meta(),'CustomData');return cd?X.kids(cd,'Item').find(i=>X.text(X.kid(i,'Key'))===TPL_KEY):null;}
function tplList(){if(!S.db)return DEFAULT_TPLS();const it=tplItem();if(it){try{const l=JSON.parse(X.text(X.kid(it,'Value')));if(Array.isArray(l))return l;}catch(e){}}return DEFAULT_TPLS();}
function tplGet(id){return tplList().find(t=>t.id===id)||tplList()[0];}
function tplStore(list,label){checkpoint(label);const cd=X.ensure(meta(),'CustomData');let it=tplItem();
  if(!it){it=X.el('Item');X.append(it,X.el('Key',TPL_KEY));X.append(it,X.el('Value'));X.append(cd,it);}
  X.setText(X.kid(it,'Value'),JSON.stringify(list));markDirty();}
const tplSummary=t=>{const std=[['user','Benutzer'],['pw','Passwort'],['url','URL'],['otp','2FA']].filter(([k])=>!t.hide.includes(k)).map(x=>x[1]);
  return [std.join(', ')||'keine Standardfelder',t.fields.length?`${t.fields.length} ${t.fields.length===1?'eigenes Feld':'eigene Felder'}`:'',t.sens?'sensibel':''].filter(Boolean).join(' · ');};

// ---- Übersicht aller Kategorien ----
function tplManager(after){const dlg=$('dlg');const draw=()=>{const l=tplList();
  dlg.innerHTML=`<div class="dlg"><header>Kategorien</header><div class="body">
    <p class="note" style="margin:0 0 10px">Kategorien sind Vorlagen für neue Einträge: welche Felder es gibt, welches Symbol und welche Tags. Sie werden in dieser Datenbank gespeichert. Änderungen gelten für neue Einträge – bestehende bleiben unverändert.</p>
    <div class="tpllist">${l.map((t,i)=>`<div class="tplli"><span class="mono-badge gbadge">${kpSvg(t.icon)}</span><button type="button" class="tplmain" data-e="${esc(t.id)}"><b>${esc(t.name)}</b><small>${esc(tplSummary(t))}</small></button>
      <span class="tplord"><button type="button" class="icon-btn" data-u="${i}" title="Nach oben"${i?'':' disabled'}><svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="icon-btn" data-d="${i}" title="Nach unten"${i<l.length-1?'':' disabled'}><svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></span></div>`).join('')}</div>
    <button type="button" class="btn" id="tplNew" style="margin-top:12px">${ICON.plus}Neue Kategorie</button></div>
    <footer><button type="button" class="btn left" id="tplReset">Standard wiederherstellen</button><button type="button" class="btn primary" id="tplClose">Fertig</button></footer></div>`;
  const move=(i,d)=>{const l=tplList();const j=i+d;if(j<0||j>=l.length)return;[l[i],l[j]]=[l[j],l[i]];tplStore(l,'Kategorien sortieren');draw();};
  dlg.querySelector('.tpllist').onclick=ev=>{const e=ev.target.closest('[data-e]'),u=ev.target.closest('[data-u]'),d=ev.target.closest('[data-d]');
    if(e)tplEditor(e.dataset.e,()=>tplManager(after));else if(u)move(+u.dataset.u,-1);else if(d)move(+d.dataset.d,1);};
  $('tplNew').onclick=()=>tplEditor(null,()=>tplManager(after));
  $('tplReset').onclick=async()=>{const c=await askChoice('Standard-Kategorien wiederherstellen?','Deine eigenen und geänderten Kategorien werden durch die sieben Standard-Kategorien ersetzt. Bestehende Einträge bleiben unverändert.',[{l:'Abbrechen',v:'cancel'},{l:'Wiederherstellen',v:'ok',danger:true}]);
    if(c==='ok'){tplStore(DEFAULT_TPLS(),'Kategorien zurücksetzen');undoToast('Standard-Kategorien wiederhergestellt');}tplManager(after);};
  $('tplClose').onclick=()=>{dlg.close();render();if(after)after();};dlg.oncancel=()=>{render();};};
  draw();if(!dlg.open)dlg.showModal();}

// ---- Kategorie bearbeiten / anlegen ----
function tplEditor(id,back){const dlg=$('dlg');const isNew=!id;const src=isNew?{id:'t'+hex(rnd(5)),name:'',icon:0,fields:[],hide:[],tags:'',sens:false,url:''}:JSON.parse(JSON.stringify(tplGet(id)));
  const t=src;const fields=t.fields.map(f=>({k:f[0],p:!!f[1],v:f[2]||''}));const isLogin=t.id==='login';
  dlg.innerHTML=`<form class="dlg" id="teForm"><header>${isNew?'Neue Kategorie':'Kategorie bearbeiten'}</header><div class="body">
    <label class="f" for="teName">Name</label><div class="inrow"><button type="button" class="iconpick" id="teIco" title="Symbol wählen"></button><input class="input" id="teName" value="${esc(t.name)}" placeholder="z. B. Router, Mailkonto, Bankkonto" required></div>
    <div class="icogrid hidden" id="teIcoGrid">${KP_MAP.map((n,i)=>`<button type="button" data-ico="${i}" title="${esc(KP_NAMES[i])}">${kpSvg(i)}</button>`).join('')}</div>
    <label class="f">Standardfelder</label><div class="stdf">${[['user','Benutzername'],['pw','Passwort'],['url','URL'],['otp','2FA-Schlüssel']].map(([k,l])=>`<label class="chk"><input type="checkbox" data-std="${k}"${t.hide.includes(k)?'':' checked'}><span>${l}</span></label>`).join('')}</div>
    <label class="f">Eigene Felder</label><div id="teF"></div>
    <button type="button" class="btn ghost" id="teAdd" style="margin-top:6px">${ICON.plus}Feld hinzufügen</button>
    <div class="two"><div><label class="f" for="teTags">Tags für neue Einträge</label><input class="input" id="teTags" value="${esc(t.tags||'')}" placeholder="z. B. kunde, netzwerk"></div>
      <div><label class="f" for="teUrl">URL-Vorgabe</label><input class="input" id="teUrl" value="${esc(t.url||'')}" placeholder="z. B. https:// oder ssh://"></div></div>
    <label class="check"><input type="checkbox" id="teSens"${t.sens?' checked':''}> Neue Einträge als sensibel markieren (Anzeigen nur nach Master-Passwort)</label>
    <div class="tplprev"><span class="muted">Vorschau</span><div id="tePrev"></div></div></div>
    <footer>${!isNew&&!isLogin?`<button type="button" class="btn danger left" id="teDel">${ICON.trash}Löschen</button>`:''}<button type="button" class="btn" id="teC">Zurück</button><button class="btn primary">${isNew?'Kategorie anlegen':'Speichern'}</button></footer></form>`;
  const drawIco=()=>{$('teIco').innerHTML=`<span class="mono-badge gbadge">${kpSvg(t.icon)}</span>`;dlg.querySelectorAll('[data-ico]').forEach(b=>b.classList.toggle('on',+b.dataset.ico===t.icon));};
  const prev=()=>{const hide=[...dlg.querySelectorAll('[data-std]')].filter(c=>!c.checked).map(c=>c.dataset.std);const std=[['user','Benutzername'],['pw','Passwort'],['url','URL'],['otp','2FA']].filter(([k])=>!hide.includes(k)).map(x=>x[1]);
    $('tePrev').innerHTML=`<div class="tplchip on">${kpSvg(t.icon)}${esc($('teName').value||'Neue Kategorie')}</div><span class="prevf">${['Titel',...std,...fields.filter(f=>f.k.trim()).map(f=>f.k+(f.p?' 🔒':''))].map(x=>`<span>${esc(x)}</span>`).join('')}</span>`;};
  const drawF=()=>{$('teF').innerHTML=fields.length?fields.map((f,i)=>`<div class="tef"><input class="input" data-fk="${i}" value="${esc(f.k)}" placeholder="Feldname"><input class="input" data-fv="${i}" value="${esc(f.v)}" placeholder="Vorgabewert (optional)">
      <label class="chk sm" title="Geschützt – wird verdeckt angezeigt"><input type="checkbox" data-fp="${i}"${f.p?' checked':''}><span>🔒</span></label>
      <button type="button" class="icon-btn" data-fu="${i}" title="Nach oben"${i?'':' disabled'}><svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="icon-btn" data-fx="${i}" title="Entfernen">×</button></div>`).join(''):'<p class="note" style="margin:0">Keine eigenen Felder – z. B. „Kundennummer“, „PIN“ oder „Seriennummer“ hinzufügen.</p>';prev();};
  drawIco();drawF();
  $('teIco').onclick=()=>$('teIcoGrid').classList.toggle('hidden');
  $('teIcoGrid').onclick=ev=>{const b=ev.target.closest('[data-ico]');if(!b)return;t.icon=+b.dataset.ico;drawIco();prev();$('teIcoGrid').classList.add('hidden');};
  $('teAdd').onclick=()=>{fields.push({k:'',p:false,v:''});drawF();dlg.querySelector(`[data-fk="${fields.length-1}"]`).focus();};
  $('teF').oninput=ev=>{const x=ev.target;if(x.dataset.fk!==undefined)fields[+x.dataset.fk].k=x.value;else if(x.dataset.fv!==undefined)fields[+x.dataset.fv].v=x.value;else return;prev();};
  $('teF').onchange=ev=>{const x=ev.target;if(x.dataset.fp!==undefined){fields[+x.dataset.fp].p=x.checked;prev();}};
  $('teF').onclick=ev=>{const u=ev.target.closest('[data-fu]'),x=ev.target.closest('[data-fx]');
    if(u){const i=+u.dataset.fu;if(i>0){[fields[i-1],fields[i]]=[fields[i],fields[i-1]];drawF();}}else if(x){fields.splice(+x.dataset.fx,1);drawF();}};
  dlg.querySelector('.stdf').onchange=prev;$('teName').oninput=prev;
  $('teC').onclick=()=>back?back():dlg.close();
  if($('teDel'))$('teDel').onclick=async()=>{const c=await askChoice('Kategorie löschen?',`„${esc(t.name)}“ wird entfernt. Bestehende Einträge bleiben unverändert.`,[{l:'Abbrechen',v:'cancel'},{l:'Löschen',v:'ok',danger:true}]);
    if(c==='ok'){tplStore(tplList().filter(x=>x.id!==t.id),'Kategorie löschen');undoToast(`Kategorie „${t.name}“ gelöscht`);}back?back():null;};
  $('teForm').onsubmit=ev=>{ev.preventDefault();const name=$('teName').value.trim();if(!name)return;
    const names=fields.map(f=>f.k.trim()).filter(Boolean);
    if(names.some(n=>STD.includes(n)||OTP_KEYS.includes(n)||isPkKey(n))){toast('Ein Feldname ist für Standardfelder reserviert.');return;}
    if(new Set(names).size!==names.length){toast('Zwei Felder haben denselben Namen.');return;}
    const out={id:t.id,name,icon:t.icon,fields:fields.filter(f=>f.k.trim()).map(f=>[f.k.trim(),f.p?1:0,f.v]),hide:[...dlg.querySelectorAll('[data-std]')].filter(c=>!c.checked).map(c=>c.dataset.std),tags:$('teTags').value.trim(),sens:$('teSens').checked,url:$('teUrl').value.trim()};
    const l=tplList();const i=l.findIndex(x=>x.id===t.id);if(i>=0)l[i]=out;else l.push(out);
    tplStore(l,isNew?'Kategorie anlegen':'Kategorie bearbeiten');undoToast(isNew?`Kategorie „${name}“ angelegt`:'Kategorie gespeichert');back?back():dlg.close();};
  if(!dlg.open)dlg.showModal();$('teName').focus();}

document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;
  if(b.dataset.act==='tplManage'){const fromEditor=!!b.closest('#edForm');tplManager(fromEditor?()=>openEditor(null):null);}});
