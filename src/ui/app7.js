// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 8: Kategorien (Vorlagen) verwalten =====================
const TPL_KEY='Tresor.Templates';
const DEFAULT_TPLS=()=>[
  {id:'login',name:T('Login'),icon:0,fields:[],hide:[],tags:'',sens:false,url:''},
  {id:'wlan',name:T('WLAN'),icon:12,fields:[[T('SSID'),0,''],[T('Verschlüsselung'),0,'WPA2/WPA3']],hide:['user','url','otp'],tags:T('wlan'),sens:false,url:''},
  {id:'server',name:T('Server / SSH'),icon:3,fields:[[T('Host'),0,''],[T('Port'),0,'22'],[T('SSH-Schlüssel'),1,'']],hide:[],tags:'',sens:false,url:'ssh://'},
  {id:'card',name:T('Kreditkarte'),icon:66,fields:[[T('Karteninhaber'),0,''],[T('Kartennummer'),1,''],[T('Gültig bis'),0,''],[T('Prüfnummer (CVC)'),1,''],[T('PIN'),1,'']],hide:['user','pw','url','otp'],tags:'',sens:true,url:''},
  {id:'license',name:T('Softwarelizenz'),icon:47,fields:[[T('Produkt'),0,''],[T('Lizenzschlüssel'),1,''],[T('Lizenziert für'),0,''],[T('Kaufdatum'),0,'']],hide:['pw','otp'],tags:'',sens:false,url:''},
  {id:'customer',name:T('Kundenzugang'),icon:5,fields:[[T('Kunde'),0,''],[T('Kundennummer'),0,''],[T('Ansprechpartner'),0,''],[T('Telefon'),0,'']],hide:[],tags:T('kunde'),sens:false,url:''},
  {id:'note',name:T('Sichere Notiz'),icon:7,fields:[],hide:['user','pw','url','otp'],tags:'',sens:false,url:''}];
function tplItem(){const cd=X.kid(meta(),'CustomData');return cd?X.kids(cd,'Item').find(i=>X.text(X.kid(i,'Key'))===TPL_KEY):null;}
function tplList(){if(!S.db)return DEFAULT_TPLS();const it=tplItem();if(it){try{const l=JSON.parse(X.text(X.kid(it,'Value')));if(Array.isArray(l))return l;}catch(e){}}return DEFAULT_TPLS();}
function tplGet(id){return tplList().find(t=>t.id===id)||tplList()[0];}
function tplStore(list,label){checkpoint(label);const cd=X.ensure(meta(),'CustomData');let it=tplItem();
  if(!it){it=X.el('Item');X.append(it,X.el('Key',TPL_KEY));X.append(it,X.el('Value'));X.append(cd,it);}
  X.setText(X.kid(it,'Value'),JSON.stringify(list));markDirty();}
const tplSummary=t=>{const std=[['user',T('Benutzer')],['pw',T('Passwort')],['url','URL'],['otp','2FA']].filter(([k])=>!t.hide.includes(k)).map(x=>x[1]);
  return [std.join(', ')||T('keine Standardfelder'),t.fields.length?T(t.fields.length===1?'{n} eigenes Feld':'{n} eigene Felder',{n:t.fields.length}):'',t.sens?T('sensibel'):''].filter(Boolean).join(' · ');};

// ---- Übersicht aller Kategorien ----
function tplManager(after){const dlg=$('dlg');const draw=()=>{const l=tplList();
  dlg.innerHTML=`<div class="dlg"><header>${T('Kategorien')}</header><div class="body">
    <p class="note" style="margin:0 0 10px">${T('Kategorien sind Vorlagen für neue Einträge: welche Felder es gibt, welches Symbol und welche Tags. Sie werden in dieser Datenbank gespeichert. Änderungen gelten für neue Einträge – bestehende bleiben unverändert.')}</p>
    <div class="tpllist">${l.map((t,i)=>`<div class="tplli"><span class="mono-badge gbadge">${kpSvg(t.icon)}</span><button type="button" class="tplmain" data-e="${esc(t.id)}"><b>${esc(t.name)}</b><small>${esc(tplSummary(t))}</small></button>
      <span class="tplord"><button type="button" class="icon-btn" data-u="${i}" title="${T('Nach oben')}"${i?'':' disabled'}><svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="icon-btn" data-d="${i}" title="${T('Nach unten')}"${i<l.length-1?'':' disabled'}><svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></span></div>`).join('')}</div>
    <button type="button" class="btn" id="tplNew" style="margin-top:12px">${ICON.plus}${T('Neue Kategorie')}</button></div>
    <footer><button type="button" class="btn left" id="tplReset">${T('Standard wiederherstellen')}</button><button type="button" class="btn primary" id="tplClose">${T('Fertig')}</button></footer></div>`;
  const move=(i,d)=>{const l=tplList();const j=i+d;if(j<0||j>=l.length)return;[l[i],l[j]]=[l[j],l[i]];tplStore(l,T('Kategorien sortieren'));draw();};
  dlg.querySelector('.tpllist').onclick=ev=>{const e=ev.target.closest('[data-e]'),u=ev.target.closest('[data-u]'),d=ev.target.closest('[data-d]');
    if(e)tplEditor(e.dataset.e,()=>tplManager(after));else if(u)move(+u.dataset.u,-1);else if(d)move(+d.dataset.d,1);};
  $('tplNew').onclick=()=>tplEditor(null,()=>tplManager(after));
  $('tplReset').onclick=async()=>{const c=await askChoice(T('Standard-Kategorien wiederherstellen?'),T('Deine eigenen und geänderten Kategorien werden durch die sieben Standard-Kategorien ersetzt. Bestehende Einträge bleiben unverändert.'),[{l:T('Abbrechen'),v:'cancel'},{l:T('Wiederherstellen'),v:'ok',danger:true}]);
    if(c==='ok'){tplStore(DEFAULT_TPLS(),T('Kategorien zurücksetzen'));undoToast(T('Standard-Kategorien wiederhergestellt'));}tplManager(after);};
  $('tplClose').onclick=()=>{dlg.close();render();if(after)after();};dlg.oncancel=()=>{render();};};
  draw();if(!dlg.open)dlg.showModal();}

// ---- Kategorie bearbeiten / anlegen ----
function tplEditor(id,back){const dlg=$('dlg');const isNew=!id;const src=isNew?{id:'t'+hex(rnd(5)),name:'',icon:0,fields:[],hide:[],tags:'',sens:false,url:''}:JSON.parse(JSON.stringify(tplGet(id)));
  const t=src;const fields=t.fields.map(f=>({k:f[0],p:!!f[1],v:f[2]||''}));const isLogin=t.id==='login';
  dlg.innerHTML=`<form class="dlg" id="teForm"><header>${isNew?T('Neue Kategorie'):T('Kategorie bearbeiten')}</header><div class="body">
    <label class="f" for="teName">${T('Name')}</label><div class="inrow"><button type="button" class="iconpick" id="teIco" title="${T('Symbol wählen')}"></button><input class="input" id="teName" value="${esc(t.name)}" placeholder="${T('z. B. Router, Mailkonto, Bankkonto')}" required></div>
    <div class="icogrid hidden" id="teIcoGrid">${KP_MAP.map((n,i)=>`<button type="button" data-ico="${i}" title="${esc(KP_NAMES[i])}">${kpSvg(i)}</button>`).join('')}</div>
    <label class="f">${T('Standardfelder')}</label><div class="stdf">${[['user',T('Benutzername')],['pw',T('Passwort')],['url','URL'],['otp',T('2FA-Schlüssel')]].map(([k,l])=>`<label class="chk"><input type="checkbox" data-std="${k}"${t.hide.includes(k)?'':' checked'}><span>${l}</span></label>`).join('')}</div>
    <label class="f">${T('Eigene Felder')}</label><div id="teF"></div>
    <button type="button" class="btn ghost" id="teAdd" style="margin-top:6px">${ICON.plus}${T('Feld hinzufügen')}</button>
    <div class="two"><div><label class="f" for="teTags">${T('Tags für neue Einträge')}</label><input class="input" id="teTags" value="${esc(t.tags||'')}" placeholder="${T('z. B. kunde, netzwerk')}"></div>
      <div><label class="f" for="teUrl">${T('URL-Vorgabe')}</label><input class="input" id="teUrl" value="${esc(t.url||'')}" placeholder="${T('z. B. https:// oder ssh://')}"></div></div>
    <label class="check"><input type="checkbox" id="teSens"${t.sens?' checked':''}> ${T('Neue Einträge als sensibel markieren (Anzeigen nur nach Master-Passwort)')}</label>
    <div class="tplprev"><span class="muted">${T('Vorschau')}</span><div id="tePrev"></div></div></div>
    <footer>${!isNew&&!isLogin?`<button type="button" class="btn danger left" id="teDel">${ICON.trash}${T('Löschen')}</button>`:''}<button type="button" class="btn" id="teC">${T('Zurück')}</button><button class="btn primary">${isNew?T('Kategorie anlegen'):T('Speichern')}</button></footer></form>`;
  const drawIco=()=>{$('teIco').innerHTML=`<span class="mono-badge gbadge">${kpSvg(t.icon)}</span>`;dlg.querySelectorAll('[data-ico]').forEach(b=>b.classList.toggle('on',+b.dataset.ico===t.icon));};
  const prev=()=>{const hide=[...dlg.querySelectorAll('[data-std]')].filter(c=>!c.checked).map(c=>c.dataset.std);const std=[['user',T('Benutzername')],['pw',T('Passwort')],['url','URL'],['otp','2FA']].filter(([k])=>!hide.includes(k)).map(x=>x[1]);
    $('tePrev').innerHTML=`<div class="tplchip on">${kpSvg(t.icon)}${esc($('teName').value||T('Neue Kategorie'))}</div><span class="prevf">${[T('Titel'),...std,...fields.filter(f=>f.k.trim()).map(f=>f.k+(f.p?' 🔒':''))].map(x=>`<span>${esc(x)}</span>`).join('')}</span>`;};
  const drawF=()=>{$('teF').innerHTML=fields.length?fields.map((f,i)=>`<div class="tef"><input class="input" data-fk="${i}" value="${esc(f.k)}" placeholder="${T('Feldname')}"><input class="input" data-fv="${i}" value="${esc(f.v)}" placeholder="${T('Vorgabewert (optional)')}">
      <label class="chk sm" title="${T('Geschützt – wird verdeckt angezeigt')}"><input type="checkbox" data-fp="${i}"${f.p?' checked':''}><span>🔒</span></label>
      <button type="button" class="icon-btn" data-fu="${i}" title="${T('Nach oben')}"${i?'':' disabled'}><svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="icon-btn" data-fx="${i}" title="${T('Entfernen')}">×</button></div>`).join(''):`<p class="note" style="margin:0">${T('Keine eigenen Felder – z. B. „Kundennummer“, „PIN“ oder „Seriennummer“ hinzufügen.')}</p>`;prev();};
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
  if($('teDel'))$('teDel').onclick=async()=>{const c=await askChoice(T('Kategorie löschen?'),T('„{t}“ wird entfernt. Bestehende Einträge bleiben unverändert.',{t:esc(t.name)}),[{l:T('Abbrechen'),v:'cancel'},{l:T('Löschen'),v:'ok',danger:true}]);
    if(c==='ok'){tplStore(tplList().filter(x=>x.id!==t.id),T('Kategorie löschen'));undoToast(T('Kategorie „{t}“ gelöscht',{t:t.name}));}back?back():null;};
  $('teForm').onsubmit=ev=>{ev.preventDefault();const name=$('teName').value.trim();if(!name)return;
    const names=fields.map(f=>f.k.trim()).filter(Boolean);
    if(names.some(n=>STD.includes(n)||OTP_KEYS.includes(n)||isPkKey(n))){toast(T('Ein Feldname ist für Standardfelder reserviert.'));return;}
    if(new Set(names).size!==names.length){toast(T('Zwei Felder haben denselben Namen.'));return;}
    const out={id:t.id,name,icon:t.icon,fields:fields.filter(f=>f.k.trim()).map(f=>[f.k.trim(),f.p?1:0,f.v]),hide:[...dlg.querySelectorAll('[data-std]')].filter(c=>!c.checked).map(c=>c.dataset.std),tags:$('teTags').value.trim(),sens:$('teSens').checked,url:$('teUrl').value.trim()};
    const l=tplList();const i=l.findIndex(x=>x.id===t.id);if(i>=0)l[i]=out;else l.push(out);
    tplStore(l,isNew?T('Kategorie anlegen'):T('Kategorie bearbeiten'));undoToast(isNew?T('Kategorie „{t}“ angelegt',{t:name}):T('Kategorie gespeichert'));back?back():dlg.close();};
  if(!dlg.open)dlg.showModal();$('teName').focus();}

document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;
  if(b.dataset.act==='tplManage'){const fromEditor=!!b.closest('#edForm');tplManager(fromEditor?()=>openEditor(null):null);}});
