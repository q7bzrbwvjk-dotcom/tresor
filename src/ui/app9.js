// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 10: Kundenakte =====================
const CUST_KEY='Tresor.Customers';
function metaItem(db,key){const cd=X.kid(X.kid(db.xml,'Meta'),'CustomData');return cd?X.kids(cd,'Item').find(i=>X.text(X.kid(i,'Key'))===key):null;}
function metaJson(db,key,def){const it=metaItem(db,key);if(it){try{const v=JSON.parse(X.text(X.kid(it,'Value')));if(v)return v;}catch(e){}}return def;}
function metaSet(db,key,val){const cd=X.ensure(X.kid(db.xml,'Meta'),'CustomData');let it=metaItem(db,key);if(!it){it=X.el('Item');X.append(it,X.el('Key',key));X.append(it,X.el('Value'));X.append(cd,it);}X.setText(X.kid(it,'Value'),JSON.stringify(val));}
const custAll=()=>metaJson(S.db,CUST_KEY,{});
const custGet=g=>g&&typeof g==='object'?custAll()[uuidOf(g)]||null:null;
function custOf(g){for(let p=g;p&&p.name==='Group';p=p.parent){if(custGet(p))return p;}return null;}
function custSave(g,rec,label){checkpoint(label);const m=custAll();if(rec){rec.u=new Date().toISOString();m[uuidOf(g)]=rec;}else delete m[uuidOf(g)];metaSet(S.db,CUST_KEY,m);writeCustNotes(g,rec);markDirty();}
// lesbare Zusammenfassung in der Gruppennotiz (sichtbar in KeePassXC & Co.)
// Markers in both languages are recognised, so switching the language does not duplicate the block.
const CUST_MARKS=[['— Kundendaten (Tresor) —','— Ende Kundendaten —'],['— Customer data (Tresor) —','— End of customer data —']];
const NB=LANG==='de'?CUST_MARKS[0][0]:CUST_MARKS[1][0],NE=LANG==='de'?CUST_MARKS[0][1]:CUST_MARKS[1][1];
function writeCustNotes(g,rec){const n=X.ensure(g,'Notes');let t=X.text(n);
  for(const [b,e] of CUST_MARKS){const i=t.indexOf(b),j=t.indexOf(e);if(i>=0&&j>i)t=(t.slice(0,i)+t.slice(j+e.length)).replace(/\n{3,}/g,'\n\n').trim();}
  if(rec){const L=[[T('Kundennummer'),rec.nr],[T('Ansprechpartner'),rec.contact],[T('Telefon'),rec.phone],[T('E-Mail'),rec.email],[T('Website'),rec.web],[T('Adresse'),(rec.address||'').replace(/\n/g,', ')]].filter(x=>x[1]).map(([k,v])=>`${k}: ${v}`);
    t=(t?t+'\n\n':'')+[NB,...L,NE].join('\n');}X.setText(n,t);}
// ---- Daten bearbeiten ----
function custDialog(g){const dlg=$('dlg');const r=custGet(g)||{nr:'',contact:'',phone:'',email:'',web:'',address:'',log:[]};const isNew=!custGet(g);
  const f=(id,l,v,ph,type='text')=>`<div><label class="f" for="${id}">${l}</label><input class="input" id="${id}" type="${type}" value="${esc(v||'')}" placeholder="${ph}"></div>`;
  dlg.innerHTML=`<form class="dlg" id="cuForm"><header>${isNew?T('Als Kunde führen'):T('Kundendaten bearbeiten')}</header><div class="body">
    <p style="margin:2px 0 4px">${isNew?T('„{g}“ erhält eine Kundenakte mit Kontaktdaten, Geräten, Terminen und Wartungsprotokoll.',{g:esc(gName(g))}):T('Für <b>{g}</b>.',{g:esc(gName(g))})} ${T('Die Daten werden verschlüsselt in der Datenbank gespeichert.')}</p>
    <div class="two">${f('cuNr',T('Kundennummer'),r.nr,T('z. B. K-1042'))}${f('cuContact',T('Ansprechpartner'),r.contact,T('z. B. Frau Beispiel'))}</div>
    <div class="two">${f('cuPhone',T('Telefon'),r.phone,T('+49 …'),'tel')}${f('cuMail',T('E-Mail'),r.email,T('name@firma.de'),'email')}</div>
    ${f('cuWeb',T('Website'),r.web,'https://')}
    <label class="f" for="cuAddr">${T('Adresse')}</label><textarea class="input" id="cuAddr" style="min-height:64px" placeholder="${T('Straße, PLZ Ort')}">${esc(r.address||'')}</textarea>
  </div><footer>${isNew?'':`<button type="button" class="btn danger left" id="cuDel">${T('Nicht mehr als Kunde führen')}</button>`}<button type="button" class="btn" id="cuC">${T('Abbrechen')}</button><button class="btn primary">${isNew?T('Kundenakte anlegen'):T('Speichern')}</button></footer></form>`;
  $('cuC').onclick=()=>dlg.close();
  if($('cuDel'))$('cuDel').onclick=async()=>{const c=await askChoice(T('Kundenakte entfernen?'),T('Kontaktdaten und Wartungsprotokoll von „{g}“ werden entfernt. Die Gruppe und alle Einträge bleiben erhalten.',{g:esc(gName(g))}),[{l:T('Abbrechen'),v:'cancel'},{l:T('Entfernen'),v:'ok',danger:true}]);
    if(c==='ok'){custSave(g,null,T('Kundenakte entfernen'));render();undoToast(T('Kundenakte entfernt'));}};
  $('cuForm').onsubmit=ev=>{ev.preventDefault();const rec={...r,nr:$('cuNr').value.trim(),contact:$('cuContact').value.trim(),phone:$('cuPhone').value.trim(),email:$('cuMail').value.trim(),web:$('cuWeb').value.trim(),address:$('cuAddr').value.trim(),log:r.log||[]};
    custSave(g,rec,isNew?T('Kundenakte anlegen'):T('Kundendaten bearbeiten'));dlg.close();openCustomer(g);undoToast(isNew?T('Kundenakte angelegt'):T('Kundendaten gespeichert'));};
  dlg.showModal();$('cuNr').focus();}
function openCustomer(g){S.group=g;S.entry=null;S.query='';$('q').value='';S.sel.clear();render();showView('detail');$('detail').scrollTop=0;}
// ---- Auswertungen ----
const IPV4=/^\d{1,3}(\.\d{1,3}){3}$/;
function deviceOf(e){const keys=X.kids(e,'String').map(s=>X.text(X.kid(s,'Key')));
  const k=keys.find(x=>/^(ip|ip-adresse|ip address|ipv4|host|hostname|server|adresse|address)$/i.test(x));let addr=k?str(e,k):'';
  const url=str(e,'URL');const h=hostOf(url);const scheme=(url.match(/^([a-z]+):/i)||[])[1]||'';
  if(!addr&&(IPV4.test(h)||/\.(local|lan|fritz\.box|home|intern|internal)$/i.test(h)||/^(ssh|rdp|vnc|smb|telnet|ftp)$/i.test(scheme)))addr=h||url;
  if(!addr)return null;return {e,addr,link:/^https?:/i.test(url)?safeUrl(url):(IPV4.test(addr)?`http://${addr}`:null),user:str(e,'UserName')};}
function parseLooseDate(s){s=(s||'').trim();let m;
  if((m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)))return new Date(+(m[3].length===2?'20'+m[3]:m[3]),+m[2]-1,+m[1]);
  if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return new Date(+m[1],+m[2]-1,+m[3]);
  if((m=s.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/)))return new Date(+(m[2].length===2?'20'+m[2]:m[2]),+m[1],0);
  return null;}
function custDeadlines(g){const out=[];const horizon=Date.now()+90*DAY;
  for(const e of allEntries(g)){const Tm=X.kid(e,'Times');
    if(X.text(X.kid(Tm,'Expires'))==='True'){const d=getTime(e,'ExpiryTime');if(d&&d<horizon)out.push({d,e,text:d<new Date()?T('Passwort abgelaufen'):T('Passwort läuft ab')});}
    const pi=typeof policyIssues==='function'?policyIssues(e).find(x=>x.startsWith(T('Wechsel fällig'))):null;if(pi)out.push({d:new Date(),e,text:T('Passwortwechsel fällig (Richtlinie)')});
    for(const s of X.kids(e,'String')){const k=X.text(X.kid(s,'Key'));if(!/(gültig bis|ablauf|läuft ab|lizenz bis|ablaufdatum|vertragsende|wartung bis|support bis|valid until|expir|licen[cs]ed? until|contract end|maintenance until|support until)/i.test(k))continue;
      const d=parseLooseDate(X.text(X.kid(s,'Value')));if(d&&d<horizon)out.push({d,e,text:`${k}`});}}
  return out.sort((a,b)=>a.d-b.d);}
// ---- Akte anzeigen ----
function renderCustomer(g){const r=custGet(g);const es=allEntries(g);const devs=es.map(deviceOf).filter(Boolean);const dl=custDeadlines(g);const pol=typeof policyFor==='function'?policyFor(g):null;
  const subs=new Map();for(const e of es){const k=e.parent===g?'':groupPath(e).split(' / ').slice(groupPath(g).split(' / ').length+1).join(' / ')||gName(e.parent);if(!subs.has(k))subs.set(k,[]);subs.get(k).push(e);}
  const row=e=>`<div class="fav"><button class="favmain" data-act="openE2" data-uuid="${esc(uuidOf(e))}">${entryBadge(e)}<span class="tx"><b>${esc(str(e,'Title')||T('Ohne Titel'))}</b><span>${esc(str(e,'UserName')||hostOf(str(e,'URL'))||'')}</span></span></button>${str(e,'Password')?`<button class="icon-btn" data-act="quickCopy" data-uuid="${esc(uuidOf(e))}" title="${T('Passwort kopieren')}">${ICON.copy}</button>`:''}</div>`;
  const cp=(v)=>`<button class="icon-btn" data-act="custCopy" data-v="${esc(v)}" title="${T('Kopieren')}">${ICON.copy}</button>`;
  const contact=[[T('Ansprechpartner'),r.contact,''],[T('Telefon'),r.phone,r.phone?`<a class="icon-btn" href="tel:${esc(r.phone.replace(/[^\d+]/g,''))}" title="${T('Anrufen')}">${kpSvg(0,'phone')}</a>`:''],[T('E-Mail'),r.email,r.email?`<a class="icon-btn" href="mailto:${esc(r.email)}" title="${T('E-Mail schreiben')}">${kpSvg(0,'mail')}</a>`:''],[T('Website'),r.web,safeUrl(r.web)?`<a class="icon-btn" href="${esc(safeUrl(r.web))}" target="_blank" rel="noopener noreferrer" title="${T('Öffnen')}">${ICON.ext}</a>`:''],[T('Adresse'),r.address,'']].filter(x=>x[1]);
  const log=(r.log||[]).slice().sort((a,b)=>b.t.localeCompare(a.t));
  $('detail').innerHTML=`<div class="dash cust">
    <div class="dhead"><div class="chead"><span class="mono-badge big gbadge">${groupIcon(g)}</span><div><h1>${esc(gName(g))}</h1><p>${r.nr?`<span class="chip">${esc(r.nr)}</span> `:''}${T(es.length===1?'{n} Zugang':'{n} Zugänge',{n:es.length})}${devs.length?' · '+T(devs.length===1?'{n} Gerät':'{n} Geräte',{n:devs.length}):''}${pol?' · '+T('Richtlinie aktiv'):''}</p></div></div>
      <div class="inrow" style="flex-wrap:wrap"><button class="btn" data-act="custEdit">${ICON.edit}${T('Kundendaten')}</button><button class="btn primary" data-act="entryHere">${ICON.plus}${T('Neuer Zugang')}</button><button class="icon-btn" data-act="gmenu" data-uuid="${esc(uuidOf(g))}" title="${T('Weitere Aktionen')}">${ICON.dots}</button></div></div>
    <div class="dgrid two">
      <section class="dcard"><div class="dch"><h2>${T('Kontakt')}</h2><button class="linkbtn" data-act="custEdit">${T('Bearbeiten')}</button></div>${contact.length?`<div class="ctab">${contact.map(([l,v,a])=>`<div class="ctk">${l}</div><div class="ctv">${esc(v).replace(/\n/g,'<br>')}</div><div class="cta">${a}${cp(v)}</div>`).join('')}</div>`:`<p class="muted" style="margin:4px 0 0">${T('Noch keine Kontaktdaten – über „Bearbeiten“ ergänzen.')}</p>`}</section>
      <section class="dcard"><div class="dch"><h2>${T('Termine')} <small class="muted">${T('nächste 90 Tage')}</small></h2></div>${dl.length?`<div class="isslist">${dl.slice(0,8).map(x=>`<button class="iss on dl${x.d<new Date()?' over':''}" data-act="openE2" data-uuid="${esc(uuidOf(x.e))}"><span><strong>${esc(str(x.e,'Title')||T('Ohne Titel'))}</strong> – ${esc(x.text)}</span><b>${x.d.toLocaleDateString(LOC)}</b></button>`).join('')}</div>`:`<p class="muted" style="margin:4px 0 0">${T('Keine fälligen Passwörter, Lizenzen oder Verträge.')}</p>`}</section>
    </div>
    ${devs.length?`<section class="dcard"><h2>${T('Geräte')}</h2><div class="tblwrap"><table class="tbl devs"><thead><tr><th>${T('Gerät')}</th><th>${T('Adresse')}</th><th>${T('Benutzer')}</th><th></th></tr></thead><tbody>${devs.map(d=>`<tr><td><button class="linkbtn plain" data-act="openE2" data-uuid="${esc(uuidOf(d.e))}">${esc(str(d.e,'Title')||T('Ohne Titel'))}</button></td><td class="mono">${esc(d.addr)}</td><td>${esc(d.user)}</td><td class="r">${d.link?`<a class="icon-btn" href="${esc(d.link)}" target="_blank" rel="noopener noreferrer" title="${T('Weboberfläche öffnen')}">${ICON.ext}</a>`:''}${cp(d.addr)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
    <section class="dcard"><div class="dch"><h2>${T('Zugänge')}</h2></div>${es.length?[...subs.entries()].map(([k,l])=>`${k?`<div class="csub">${esc(k)}</div>`:''}<div class="favgrid">${l.sort((a,b)=>str(a,'Title').localeCompare(str(b,'Title'),LOC)).map(row).join('')}</div>`).join(''):`<p class="muted" style="margin:4px 0 0">${T('Noch keine Zugänge – mit „Neuer Zugang“ anlegen.')}</p>`}</section>
    <section class="dcard"><div class="dch"><h2>${T('Protokoll')}</h2></div>
      <form class="logadd" id="logForm"><input class="input" type="date" id="logD" value="${new Date().toISOString().slice(0,10)}"><input class="input" id="logT" placeholder="${T('z. B. Router-Firmware aktualisiert, Passwort für Gast-WLAN geändert')}" autocomplete="off"><button class="btn primary">${T('Eintragen')}</button></form>
      ${log.length?`<div class="loglist">${log.map(x=>`<div class="logi"><span class="logd">${new Date(x.t+'T12:00:00').toLocaleDateString(LOC)}</span><span class="logt">${esc(x.text)}</span><button class="icon-btn" data-act="logDel" data-id="${esc(x.id)}" title="${T('Entfernen')}">×</button></div>`).join('')}</div>`:`<p class="muted" style="margin:10px 0 0">${T('Noch keine Einträge. Halte hier Wartungen, Änderungen und Absprachen fest.')}</p>`}</section>
    <div class="dlinks"><button class="linkbtn" data-act="custPrint">${T('Kundendatenblatt drucken')}</button><button class="linkbtn" data-act="bundle" data-uuid="${esc(uuidOf(g))}">${T('Kundenmappe exportieren')}</button><button class="linkbtn" data-act="polEdit2">${pol?T('Passwortrichtlinie bearbeiten'):T('Passwortrichtlinie festlegen')}</button></div>
  </div>`;
  $('logForm').onsubmit=ev=>{ev.preventDefault();const t=$('logT').value.trim();if(!t)return;const rec=custGet(g);rec.log=[...(rec.log||[]),{id:hex(rnd(6)),t:$('logD').value||new Date().toISOString().slice(0,10),text:t}];custSave(g,rec,T('Protokolleintrag'));renderCustomer(g);undoToast(T('Ins Protokoll eingetragen'));};}
// ---- Kundendatenblatt drucken ----
function custPrintDialog(g){const dlg=$('dlg');
  dlg.innerHTML=`<form class="dlg narrow" id="cpForm"><header>${T('Kundendatenblatt drucken')}</header><div class="body">
    <label class="check"><input type="checkbox" id="cpDev" checked> ${T('Geräte')}</label><label class="check"><input type="checkbox" id="cpAcc" checked> ${T('Zugänge (Titel, Benutzer, Adresse)')}</label>
    <label class="check"><input type="checkbox" id="cpPw"> ${T('Passwörter mitdrucken')}</label><label class="check"><input type="checkbox" id="cpLog" checked> ${T('Protokoll')}</label>
    <p class="note warnbox" id="cpWarn" style="display:none">${T('Mit Passwörtern ist das Blatt so vertraulich wie die Datenbank selbst.')}</p></div>
    <footer><button type="button" class="btn" id="cpC">${T('Abbrechen')}</button><button class="btn primary">${T('Drucken')}</button></footer></form>`;
  $('cpPw').onchange=()=>$('cpWarn').style.display=$('cpPw').checked?'block':'none';$('cpC').onclick=()=>dlg.close();
  $('cpForm').onsubmit=async ev=>{ev.preventDefault();const o={dev:$('cpDev').checked,acc:$('cpAcc').checked,pw:$('cpPw').checked,log:$('cpLog').checked};dlg.close();
    if(o.pw&&allEntries(g).some(isSens)&&!(S.sensUntil>Date.now())&&!(await unlockSensitive()))return;
    const r=custGet(g);const es=allEntries(g);const devs=es.map(deviceOf).filter(Boolean);const tbl=(h,rows)=>`<table class="ptbl grid"><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
    printHtml(`<div class="psheet"><div class="phead"><div><div class="pkick">${T('Kundendatenblatt')}</div><h1>${esc(gName(g))}</h1></div><div class="pdate">${r.nr?T('Kundennr. {x}',{x:esc(r.nr)})+'<br>':''}${T('Stand {d}',{d:new Date().toLocaleDateString(LOC)})}</div></div>
      <h2>${T('Kontakt')}</h2><table class="ptbl">${[[T('Ansprechpartner'),r.contact],[T('Telefon'),r.phone],[T('E-Mail'),r.email],[T('Website'),r.web],[T('Adresse'),r.address]].filter(x=>x[1]).map(([k,v])=>`<tr><th>${k}</th><td>${esc(v).replace(/\n/g,'<br>')}</td></tr>`).join('')||'<tr><td>–</td></tr>'}</table>
      ${o.dev&&devs.length?`<h2>${T('Geräte')}</h2>${tbl([T('Gerät'),T('Adresse'),T('Benutzer')],devs.map(d=>[esc(str(d.e,'Title')),`<span class="pmono">${esc(d.addr)}</span>`,esc(d.user)]))}`:''}
      ${o.acc&&es.length?`<h2>${T('Zugänge')}</h2>${tbl([T('Titel'),T('Benutzer'),T('Adresse'),...(o.pw?[T('Passwort')]:[])],es.map(e=>[esc(str(e,'Title')),esc(str(e,'UserName')),esc(str(e,'URL')),...(o.pw?[`<span class="pmono">${esc(str(e,'Password'))}</span>`]:[])]))}`:''}
      ${o.log&&(r.log||[]).length?`<h2>${T('Protokoll')}</h2>${tbl([T('Datum'),T('Eintrag')],r.log.slice().sort((a,b)=>b.t.localeCompare(a.t)).map(x=>[new Date(x.t+'T12:00:00').toLocaleDateString(LOC),esc(x.text)]))}`:''}
      <div class="pfoot">${o.pw?T('Vertraulich – enthält Passwörter, sicher verwahren'):T('Vertraulich')}</div></div>`);};
  dlg.showModal();}
// ---- Einhängen ----
const _rd9=renderDetail;
renderDetail=function(){const g=S.group;if(S.db&&!S.entry&&!bulkActive()&&!S.query.trim()&&typeof g==='object'&&g&&custGet(g)){startOtp(null);renderCustomer(g);updateChrome();return;}_rd9();
  if(S.db&&S.entry&&!bulkActive()){const c=custOf(S.entry.parent);const w=document.querySelector('#detail .dwrap');if(c&&w&&!w.querySelector('.custback'))w.insertAdjacentHTML('afterbegin',`<button class="custback" data-act="custOpen" data-uuid="${esc(uuidOf(c))}">${ICON.back}${T('Kundenakte „{g}“',{g:esc(gName(c))})}</button>`);}};
const _rl9=renderList;
renderList=function(){_rl9();if(!S.db||S.query.trim()||typeof S.group!=='object'||!S.group)return;const c=custOf(S.group);if(!c)return;const r=custGet(c);
  const head=$('list').querySelector('.lhead');if(!head)return;const after=$('list').querySelector('.polbar')||head;
  after.insertAdjacentHTML('afterend',`<button class="custbar" data-act="custOpen" data-uuid="${esc(uuidOf(c))}">${kpSvg(0,'users')}<span><b>${c===S.group?T('Kundenakte'):T('Kunde „{g}“',{g:esc(gName(c))})}</b>${r.nr||r.contact?`<small>${esc([r.nr,r.contact].filter(Boolean).join(' · '))}</small>`:''}</span>${ICON.back}</button>`);};
const _gm9=groupMenu;
groupMenu=function(g,a){_gm9(g,a);const dlg=$('dlg');if(g===recycleBin(false)||g===rootGroup())return;const is=!!custGet(g);
  const b=document.createElement('button');b.type='button';b.className='mitem';b.innerHTML=`${kpSvg(0,'users')}<span><b>${is?T('Kundenakte öffnen'):T('Als Kunde führen …')}</b><small>${is?T('Kontakt, Geräte, Termine, Protokoll'):T('Kontaktdaten, Geräte, Termine und Wartungsprotokoll')}</small></span>`;
  b.onclick=()=>{dlg.close();is?openCustomer(g):custDialog(g);};const list=dlg.querySelector('.mlist');list.insertBefore(b,list.firstChild);};
const _rg9=renderGroups;
renderGroups=function(){_rg9();const m=custAll();for(const u of Object.keys(m)){const row=$('groups').querySelector(`.grow[data-uuid="${CSS.escape(u)}"] .gitem`);if(row&&!row.querySelector('.custdot'))row.querySelector('.nm').insertAdjacentHTML('afterend',`<span class="custdot" title="${T('Kunde')}"></span>`);}};
// Übersicht: Kunden-Karte
const _rdash=renderDashboard;
renderDashboard=function(){_rdash();const m=custAll();const cs=Object.keys(m).map(u=>findGroup(u)).filter(g=>g&&!inBin(g));if(!cs.length)return;
  const html=`<section class="dcard"><div class="dch"><h2>${T('Kunden')}</h2></div><div class="favgrid">${cs.sort((a,b)=>gName(a).localeCompare(gName(b),LOC)).map(g=>{const r=m[uuidOf(g)];const dl=custDeadlines(g)[0];
    return `<div class="fav"><button class="favmain" data-act="custOpen" data-uuid="${esc(uuidOf(g))}"><span class="mono-badge gbadge">${groupIcon(g)}</span><span class="tx"><b>${esc(gName(g))}</b><span>${dl?`${esc(dl.text)} · ${dl.d.toLocaleDateString(LOC)}`:esc([r.nr,T('{n} Zugänge',{n:allEntries(g).length})].filter(Boolean).join(' · '))}</span></span></button></div>`;}).join('')}</div></section>`;
  const fav=[...document.querySelectorAll('#detail .dash > .dcard')].find(s=>{const h=s.querySelector('h2');return h&&h.textContent===T('Favoriten');});(fav||document.querySelector('#detail .dash .dgrid')).insertAdjacentHTML(fav?'beforebegin':'afterend',html);};
// Zusammenführen: Zusatzdaten (Kunden, Richtlinien, Kategorien) mit abgleichen
function mergeTresorMeta(l,o){
  for(const key of [CUST_KEY,'Tresor.Policies']){const a=metaJson(l,key,null),b=metaJson(o,key,null);if(!b)continue;const out=a?{...a}:{};
    for(const [k,v] of Object.entries(b)){const x=out[k];if(!x||(v.u||'')>(x.u||'')){out[k]=v;}
      if(key===CUST_KEY&&x){const ids=new Set();out[k]={...out[k],log:[...(x.log||[]),...(v.log||[])].filter(e=>!ids.has(e.id)&&ids.add(e.id))};}}
    metaSet(l,key,out);}
  if(!metaItem(l,'Tresor.Templates')&&metaItem(o,'Tresor.Templates'))metaSet(l,'Tresor.Templates',metaJson(o,'Tresor.Templates',[]));}
function tresorMetaChanges(l,o){let n=0;
  for(const key of [CUST_KEY,'Tresor.Policies']){const a=metaJson(l,key,{})||{},b=metaJson(o,key,null);if(!b)continue;
    for(const [k,v] of Object.entries(b)){const x=a[k];if(!x||(v.u||'')>(x.u||''))n++;else if(key===CUST_KEY){const ids=new Set((x.log||[]).map(e=>e.id));if((v.log||[]).some(e=>!ids.has(e.id)))n++;}}}
  if(!metaItem(l,'Tresor.Templates')&&metaItem(o,'Tresor.Templates'))n++;return n;}
const _pm=planMerge;
planMerge=function(l,o){const p=_pm(l,o);p.meta=tresorMetaChanges(l,o);p.changes+=p.meta;return p;};
const _mdb=mergeDb;
mergeDb=async function(l,o,opts){const st=await _mdb(l,o,opts);mergeTresorMeta(l,o);return st;};
// Klicks
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='custOpen'){const g=findGroup(b.dataset.uuid);if(g)openCustomer(g);}
  else if(a==='custEdit'&&typeof S.group==='object')custDialog(S.group);
  else if(a==='custPrint'&&typeof S.group==='object')custPrintDialog(S.group);
  else if(a==='polEdit2'&&typeof S.group==='object')policyDialog(S.group);
  else if(a==='custCopy'){copyText(b.dataset.v);toast(T('Kopiert'));}
  else if(a==='openE2'){const e=findEntry(b.dataset.uuid);if(!e)return;S.entry=e;reveal=false;markAccess(e);render();showView('detail');$('detail').scrollTop=0;}
  else if(a==='logDel'&&typeof S.group==='object'){const g=S.group;const rec=custGet(g);rec.log=(rec.log||[]).filter(x=>x.id!==b.dataset.id);custSave(g,rec,T('Protokolleintrag entfernen'));renderCustomer(g);undoToast(T('Protokolleintrag entfernt'));}
  else if(a==='group'){const g=findGroup(b.dataset.uuid);if(g&&custGet(g)){S.entry=null;renderDetail();}}});
