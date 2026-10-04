// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 4: Favoriten, Zuletzt verwendet, Markenfarben, Fokus, Notfallblatt, Ablauf, Duplikate, Drucken =====================
const PSEUDO=['all','report','fav','recent','home'];
// ---- Favoriten & Zuletzt verwendet ----
const isFav=e=>tagsOf(e).some(t=>/^(favorit|favorite|favourite)$/i.test(t));
function toggleFav(e){checkpoint(isFav(e)?T('Favorit entfernen'):T('Als Favorit markieren'));const t=tagsOf(e);
  X.setText(X.ensure(e,'Tags'),(isFav(e)?t.filter(x=>!/^(favorit|favorite|favourite)$/i.test(x)):[...t,T('Favorit')]).join(';'));touch(e);markDirty();render();
  undoToast(isFav(e)?T('Zu Favoriten hinzugefügt'):T('Aus Favoriten entfernt'));}
function markAccess(e){if(e)setTime(e,'LastAccessTime',new Date());}
function recentList(){const es=allEntries(rootGroup()).map(e=>({e,a:getTime(e,'LastAccessTime'),c:getTime(e,'CreationTime')})).filter(x=>x.a&&(!x.c||x.a-x.c>2000));
  return es.sort((a,b)=>b.a-a.a).slice(0,20).map(x=>x.e);}
// ---- Markenfarben je Domain ----
const BRAND={'github.com':'#24292f','gitlab.com':'#fc6d26','google.com':'#4285f4','gmail.com':'#ea4335','youtube.com':'#ff0000','microsoft.com':'#0078d4','live.com':'#0078d4','office.com':'#d83b01','outlook.com':'#0078d4','azure.com':'#0089d6','apple.com':'#555555','icloud.com':'#3693f3','amazon.de':'#ff9900','amazon.com':'#ff9900','aws.amazon.com':'#ff9900','paypal.com':'#003087','paypal.de':'#003087','netflix.com':'#e50914','spotify.com':'#1db954','dropbox.com':'#0061ff','facebook.com':'#1877f2','instagram.com':'#c13584','linkedin.com':'#0a66c2','xing.com':'#026466','x.com':'#111111','twitter.com':'#1d9bf0','ebay.de':'#e53238','ebay.com':'#e53238','telekom.de':'#e20074','vodafone.de':'#e60000','o2online.de':'#0019a5','ionos.de':'#003d8f','1und1.de':'#003d8f','strato.de':'#ff8800','hetzner.com':'#d50c2d','hetzner.de':'#d50c2d','cloudflare.com':'#f38020','adobe.com':'#fa0f00','steampowered.com':'#1b2838','discord.com':'#5865f2','slack.com':'#4a154b','zoom.us':'#2d8cff','atlassian.com':'#0052cc','atlassian.net':'#0052cc','digitalocean.com':'#0080ff','ui.com':'#006fff','synology.com':'#4d4d4d','nextcloud.com':'#0082c9','wordpress.com':'#21759b','gmx.net':'#1c449b','gmx.de':'#1c449b','web.de':'#ffd800','check24.de':'#063773','dkb.de':'#148dea','ing.de':'#ff6200','n26.com':'#36a18b','commerzbank.de':'#ffcc00','sparkasse.de':'#ff0000','postbank.de':'#ffcc00','dhl.de':'#ffcc00','deutschebahn.com':'#ec0016','bahn.de':'#ec0016','lidl.de':'#0050aa','ikea.com':'#0058a3','datev.de':'#008f3a','elster.de':'#1d4f91','proton.me':'#6d4aff','tailscale.com':'#242424','openai.com':'#10a37f','claude.ai':'#c96442','anthropic.com':'#c96442','notion.so':'#191919','figma.com':'#a259ff','canva.com':'#00c4cc','shopify.com':'#5e8e3e','stripe.com':'#635bff','docker.com':'#2496ed','npmjs.com':'#cb3837','teamviewer.com':'#0e8ee9','anydesk.com':'#ef443b','unraid.net':'#f15a2c','fritz.box':'#e2001a','avm.de':'#e2001a'};
function hostOf(u){if(!u)return '';try{return new URL(/^[a-z][a-z0-9+.-]*:/i.test(u)?u:'https://'+u).hostname.replace(/^www\./,'').toLowerCase();}catch(e){return '';}}
function baseDomain(h){if(!h||/^\d+\.\d+\.\d+\.\d+$/.test(h))return h;const p=h.split('.');if(p.length<=2)return h;const sl=p[p.length-2];return (['co','com','org','net','gov','ac'].includes(sl)&&p[p.length-1].length===2)?p.slice(-3).join('.'):p.slice(-2).join('.');}
function badgeStyle(e){const h=hostOf(str(e,'URL'));if(!h)return '';const b=BRAND[h]||BRAND[baseDomain(h)];
  if(b){const n=parseInt(b.slice(1),16),r=n>>16,g=(n>>8)&255,bl=n&255;const lum=(0.299*r+0.587*g+0.114*bl)/255;return `background:${b};color:${lum>0.62?'#1d1d1d':'#fff'};--ic:${lum>0.62?'#1d1d1d':'#fff'}`;}
  return `background:hsl(${hue(baseDomain(h))} 32% 42%)`;}
// ---- Fokus-Modus ----
function toggleFocus(){prefs.focus=!prefs.focus;savePrefs();toast(prefs.focus?T('Fokus-Modus an – ⌘\\ beendet ihn'):T('Fokus-Modus aus'));}
// ---- Ablauf ----
const DAY=864e5;
function expiresSoon(e,days=30){const Tm=X.kid(e,'Times');if(X.text(X.kid(Tm,'Expires'))!=='True')return false;const d=getTime(e,'ExpiryTime');return d&&d>=new Date()&&d-new Date()<days*DAY;}
function notifyExpiry(){const es=allEntries(rootGroup());const n=es.filter(expired).length,s=es.filter(e=>expiresSoon(e)).length;if(!n&&!s)return;
  const parts=[];if(n)parts.push(T(n===1?'{n} Passwort ist abgelaufen':'{n} Passwörter sind abgelaufen',{n}));if(s)parts.push(T(s===1?'{n} läuft in den nächsten 30 Tagen ab':'{n} laufen in den nächsten 30 Tagen ab',{n:s}));
  setTimeout(()=>toast(parts.join(', '),{label:T('Anzeigen'),fn:()=>goGroup('report')}),400);}
// ---- Duplikate ----
function dupKey(e){const h=baseDomain(hostOf(str(e,'URL')));const u=str(e,'UserName').trim().toLowerCase();const t=str(e,'Title').trim().toLowerCase();
  if(!u&&!str(e,'Password'))return null;return (h||'t:'+t)+'|'+u;}
function findDuplicates(){const m=new Map();for(const e of allEntries(rootGroup())){const k=dupKey(e);if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(e);}
  return [...m.values()].filter(g=>g.length>1).map(g=>g.sort((a,b)=>(getTime(b,'LastModificationTime')||0)-(getTime(a,'LastModificationTime')||0)));}
function mergeDuplicateGroup(list){const keep=list[0];const H=X.ensure(keep,'History');
  for(const o of list.slice(1)){
    for(const h of X.kids(X.kid(o,'History'),'Entry'))X.append(H,X.clone(h,H));
    const c=X.clone(o,null);const ch=X.kid(c,'History');if(ch)X.remove(ch);X.append(H,c);
    for(const s of X.kids(o,'String')){const k=X.text(X.kid(s,'Key'));const v=X.text(X.kid(s,'Value'));
      if(k==='Notes'){const kn=str(keep,'Notes');if(v&&!kn.includes(v))setStr(keep,'Notes',kn?kn+'\n\n'+T('— aus „{t}“ —',{t:str(o,'Title')||T('Ohne Titel')})+'\n'+v:v,isProt(keep,'Notes'));}
      else if(!STD.includes(k)&&!strEl(keep,k))setStr(keep,k,v,X.kid(s,'Value').attrs.Protected==='True');
      else if(STD.includes(k)&&k!=='Password'&&!str(keep,k)&&v)setStr(keep,k,v,isProt(keep,k));}
    const names=X.kids(keep,'Binary').map(b=>X.text(X.kid(b,'Key')));
    for(const b of X.kids(o,'Binary'))if(!names.includes(X.text(X.kid(b,'Key')))){const nb=X.clone(b,keep);const at=keep.children.find(x=>typeof x!=='string'&&(x.name==='AutoType'||x.name==='History'));X.insertAt(keep,nb,at?keep.children.indexOf(at):keep.children.length);}
    const tg=new Set([...tagsOf(keep),...tagsOf(o)]);X.setText(X.ensure(keep,'Tags'),[...tg].join(';'));
    deleteEl(o);}
  const hs=X.kids(H,'Entry').sort((a,b)=>(getTime(a,'LastModificationTime')||0)-(getTime(b,'LastModificationTime')||0));H.children=[];
  const seen=new Set();for(const h of hs){const k=+(getTime(h,'LastModificationTime')||0);if(seen.has(k))continue;seen.add(k);X.append(H,h);}
  const max=parseInt(X.text(X.kid(meta(),'HistoryMaxItems'))||'10',10);if(max>=0)while(X.kids(H,'Entry').length>max)X.remove(X.kids(H,'Entry')[0]);
  touch(keep);return keep;}
function dupDialog(){const groups=findDuplicates();const dlg=$('dlg');
  if(!groups.length){toast(T('Keine doppelten Einträge gefunden'));return;}
  dlg.innerHTML=`<form class="dlg" id="dupForm"><header>${T('Doppelte Einträge zusammenführen')}</header><div class="body">
    <p class="note" style="margin-top:2px">${T('Einträge mit gleicher Website und gleichem Benutzernamen. Der zuletzt geänderte bleibt erhalten. Die anderen wandern in den Papierkorb, ihre Passwörter in den Verlauf, eigene Felder, Anhänge, Notizen und Tags werden übernommen.')}</p>
    ${groups.map((g,i)=>`<label class="dupg"><input type="checkbox" data-d="${i}" checked><div><b>${esc(str(g[0],'Title')||T('Ohne Titel'))}</b> <span class="muted">${esc(str(g[0],'UserName'))}</span>
      <div class="dupl">${g.map((e,j)=>`<span class="${j?'':'keep'}">${j?'':'✓ '}${esc(str(e,'Title')||T('Ohne Titel'))} – ${esc(groupPath(e))} – ${fmtDate(getTime(e,'LastModificationTime'))}${str(e,'Password')!==str(g[0],'Password')?' – <i>'+T('anderes Passwort')+'</i>':''}</span>`).join('')}</div></div></label>`).join('')}
  </div><footer><button type="button" class="btn" id="dupC">${T('Abbrechen')}</button><button class="btn primary" id="dupGo">${T(groups.length===1?'{n} Gruppe zusammenführen':'{n} Gruppen zusammenführen',{n:groups.length})}</button></footer></form>`;
  const upd=()=>{const n=dlg.querySelectorAll('[data-d]:checked').length;$('dupGo').textContent=T(n===1?'{n} Gruppe zusammenführen':'{n} Gruppen zusammenführen',{n});$('dupGo').disabled=!n;};
  dlg.querySelectorAll('[data-d]').forEach(c=>c.onchange=upd);$('dupC').onclick=()=>dlg.close();
  $('dupForm').onsubmit=ev=>{ev.preventDefault();const sel=[...dlg.querySelectorAll('[data-d]:checked')].map(c=>groups[+c.dataset.d]);if(!sel.length)return;
    checkpoint(T('Duplikate zusammenführen'));let n=0;for(const g of sel){mergeDuplicateGroup(g);n+=g.length-1;}
    markDirty();dlg.close();render();undoToast(T(n===1?'{n} Duplikat zusammengeführt':'{n} Duplikate zusammengeführt',{n}));};
  dlg.showModal();}
// ---- Drucken ----
function printHtml(html){const p=$('printArea');p.innerHTML=html;document.body.classList.add('printing');
  const done=()=>{document.body.classList.remove('printing');p.innerHTML='';removeEventListener('afterprint',done);};addEventListener('afterprint',done);
  setTimeout(()=>{window.print();setTimeout(()=>{if(!matchMedia('print').matches)done();},1500);},60);}
function sheetDialog(){const dlg=$('dlg');
  dlg.innerHTML=`<form class="dlg" id="shForm"><header>${T('Notfallblatt drucken')}</header><div class="body">
    <p style="margin-top:4px">${T('Ein Blatt Papier mit allem, was eine Vertrauensperson im Ernstfall braucht, um an deine Passwörter zu kommen. Das Master-Passwort trägst du <b>von Hand</b> ein – es wird nie gedruckt.')}</p>
    <label class="f" for="shWho">${T('Erstellt für')} <span class="muted">${T('(optional)')}</span></label><input class="input" id="shWho" placeholder="${T('z. B. Ehepartner, Geschäftspartner, Notar')}">
    <label class="f" for="shWhere">${T('Wo liegt die Datei?')} <span class="muted">${T('(optional, sonst Freifeld)')}</span></label><input class="input" id="shWhere" placeholder="${T('z. B. iCloud Drive › Tresor, USB-Stick im Safe')}">
    <p class="note warnbox">${T('Bewahre das ausgefüllte Blatt getrennt von deinen Geräten auf, z. B. im Safe oder Bankschließfach.')}</p></div>
    <footer><button type="button" class="btn" id="shC">${T('Abbrechen')}</button><button class="btn primary">${T('Drucken')}</button></footer></form>`;
  $('shC').onclick=()=>dlg.close();
  $('shForm').onsubmit=ev=>{ev.preventDefault();const who=$('shWho').value.trim(),where=$('shWhere').value.trim();dlg.close();
    const kdf=hex(S.db.kdf.$UUID.v);const lines=n=>'<div class="pline"></div>'.repeat(n);
    printHtml(`<div class="psheet"><div class="phead"><div><div class="pkick">${T('Notfallblatt')}</div><h1>${esc(X.text(X.kid(meta(),'DatabaseName'))||S.fileName)}</h1></div><div class="pdate">${T('Erstellt am {d}',{d:new Date().toLocaleDateString(LOC)})}${who?'<br>'+T('für {w}',{w:esc(who)}):''}</div></div>
      <p>${T('Dieses Blatt beschreibt, wie du an die Passwortdatenbank kommst, falls ich dazu selbst nicht in der Lage bin. Die Datenbank ist verschlüsselt – ohne das Master-Passwort unten ist sie nicht lesbar.')}</p>
      <h2>${T('1 · Die Datei')}</h2><table class="ptbl"><tr><th>${T('Dateiname')}</th><td>${esc(S.fileName)}</td></tr><tr><th>${T('Speicherort')}</th><td>${where?esc(where):lines(2)}</td></tr><tr><th>${T('Format')}</th><td>KeePass KDBX ${S.db.major}.${S.db.minor}</td></tr></table>
      <h2>${T('2 · Master-Passwort')}</h2><div class="pbox">${lines(3)}</div><p class="psmall">${T('Genau so abschreiben, wie es eingegeben wird – Groß- und Kleinschreibung, Leer- und Sonderzeichen zählen.')}</p>
      <h2>${T('3 · Schlüsseldatei')}</h2>${S.keyFile?`<p>${T('Zum Öffnen wird zusätzlich die Schlüsseldatei <b>{f}</b> benötigt. Sie liegt hier:',{f:esc(S.keyFileName||T('(Name unbekannt)'))})}</p>${lines(2)}`:`<p>${T('Wird nicht benötigt.')}</p>`}
      <h2>${T('4 · So öffnest du die Datenbank')}</h2><ol><li>${T('Die Datei vom Speicherort auf einen Computer, ein Tablet oder Smartphone holen.')}</li><li>${T('Mit einem KeePass-kompatiblen Programm öffnen: <b>KeePassXC</b> (Windows, Mac, Linux – keepassxc.org), <b>Strongbox</b> (iPhone, iPad, Mac), <b>KeePassDX</b> (Android) oder <b>Tresor</b>.')}</li><li>${S.keyFile?T('Das Master-Passwort von oben eingeben und die Schlüsseldatei auswählen.'):T('Das Master-Passwort von oben eingeben.')}</li></ol>
      <h2>${T('Notizen')}</h2>${lines(4)}<div class="pfoot">${T('Vertraulich – sicher aufbewahren')} · ${T('Verschlüsselung')}: ${S.db.cipher===CIPHER_CHACHA?'ChaCha20':'AES-256'}, ${kdf===KDF_ARGON2D?'Argon2d':kdf===KDF_ARGON2ID?'Argon2id':'AES-KDF'}</div></div>`);};
  dlg.showModal();}
const isWifi=e=>/\b(wlan|wifi|wi-fi|wpa)\b/i.test([str(e,'Title'),tagsOf(e).join(' '),str(e,'URL')].join(' '))||!!strEl(e,'SSID');
function entryPrintHtml(e,o){const pw=str(e,'Password');const rows=[];
  if(o.qr)rows.push([T('Netzwerk'),`<span class="pmono">${esc(o.ssid)}</span>`]);
  if(str(e,'UserName'))rows.push([T('Benutzername'),`<span class="pmono">${esc(str(e,'UserName'))}</span>`]);
  if(o.pw&&pw)rows.push([T('Passwort'),`<div class="ptiles">${[...pw].map((c,i)=>`<span><b>${c===' '?'␣':esc(c)}</b><small>${i+1}</small></span>`).join('')}</div>`]);
  if(str(e,'URL'))rows.push([T('Adresse'),esc(str(e,'URL'))]);
  if(o.notes&&str(e,'Notes'))rows.push([T('Notizen'),`<div style="white-space:pre-wrap">${esc(str(e,'Notes'))}</div>`]);
  let qr='';if(o.qr){try{qr=`<div class="pqr">${qrSvg(wifiString(o.ssid,pw,o.sec,o.hidden),190)}<div>${T('Mit der Handykamera scannen, um sich mit „{s}“ zu verbinden.',{s:esc(o.ssid)})}</div></div>`;}catch(err){qr=`<div class="pqr">${esc(err.message)}</div>`;}}
  return `<div class="pcard"><div class="pchead"><h1>${esc(o.title||str(e,'Title')||T('Zugangsdaten'))}</h1>${o.qr?`<div class="pnet">${T('WLAN')}: <b>${esc(o.ssid)}</b></div>`:''}</div><div class="pcbody"><table class="ptbl">${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table>${qr}</div>
    <div class="pfoot">${T('Stand {d}',{d:new Date().toLocaleDateString(LOC)})} · ${T('Vertraulich – nicht offen liegen lassen')}</div></div>`;}
function printEntryDialog(e){if(!e)return;const dlg=$('dlg');const wifi=isWifi(e);const ssid0=str(e,'SSID')||str(e,'Title');
  dlg.innerHTML=`<form class="dlg" id="prForm"><header>${T('Eintrag drucken')}</header><div class="body">
    <label class="f" for="prT">${T('Überschrift')}</label><input class="input" id="prT" value="${esc(str(e,'Title'))}">
    <label class="check"><input type="checkbox" id="prPw" checked> ${T('Passwort drucken')}</label>
    ${str(e,'Notes')?`<label class="check"><input type="checkbox" id="prN"> ${T('Notizen drucken')}</label>`:''}
    <label class="check"><input type="checkbox" id="prQ"${wifi?' checked':''}> ${T('WLAN-QR-Code zum Verbinden')}</label>
    <div id="prQo" class="${wifi?'':'hidden'}"><div class="two"><div><label class="f" for="prS">${T('Netzwerkname (SSID)')}</label><input class="input" id="prS" value="${esc(ssid0)}"></div>
      <div><label class="f" for="prE">${T('Verschlüsselung')}</label><select class="input" id="prE"><option value="WPA">WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">${T('Offen')}</option></select></div></div>
      <label class="check"><input type="checkbox" id="prH"> ${T('Verstecktes Netzwerk')}</label></div>
    <div class="pprev"><div id="prPrev"></div></div></div>
    <footer><button type="button" class="btn" id="prC">${T('Abbrechen')}</button><button class="btn primary">${T('Drucken')}</button></footer></form>`;
  const opts=()=>({title:$('prT').value,pw:$('prPw').checked,notes:$('prN')?$('prN').checked:false,qr:$('prQ').checked,ssid:$('prS').value||str(e,'Title'),sec:$('prE').value,hidden:$('prH').checked});
  const prev=()=>{$('prQo').classList.toggle('hidden',!$('prQ').checked);$('prPrev').innerHTML=entryPrintHtml(e,opts());};
  dlg.querySelector('.body').addEventListener('input',prev);dlg.querySelector('.body').addEventListener('change',prev);prev();
  $('prC').onclick=()=>dlg.close();$('prForm').onsubmit=ev=>{ev.preventDefault();const h=entryPrintHtml(e,opts());dlg.close();printHtml(h);};dlg.showModal();}

// ---- Ereignisse ----
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='pseudo')goGroup(b.dataset.g);
  else if(a==='fav'&&S.entry)toggleFav(S.entry);
  else if(a==='print'&&S.entry)printEntryDialog(S.entry);
  else if(a==='sheet'){$('dlg').close();sheetDialog();}
  else if(a==='dups'){$('dlg').open&&$('dlg').close();dupDialog();}
  else if(a==='focus')toggleFocus();
  else if(a==='expPreset'){const d=new Date();d.setMonth(d.getMonth()+(+b.dataset.m));$('edExp').checked=true;$('edExpD').classList.remove('hidden');$('edExpD').value=d.toISOString().slice(0,10);}
});
document.addEventListener('keydown',e=>{if(!S.db||$('dlg').open||e.defaultPrevented)return;const mod=e.metaKey||e.ctrlKey;if(!mod)return;const k=e.key.toLowerCase();
  if(k==='d'&&S.entry&&!bulkActive()){e.preventDefault();toggleFav(S.entry);}
  else if(k==='\\'){e.preventDefault();toggleFocus();}
  else if(k==='p'&&S.entry&&!bulkActive()){e.preventDefault();printEntryDialog(S.entry);}});
