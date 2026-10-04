// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 5: Übersicht, Vorlagen, Kundenmappe, Verlauf mit Unterschieden, Sitzungsschutz, Passwort ersetzen =====================
// ---- Sitzungsschutz ----
const SENS_MIN=5;
const isSens=e=>!!e&&tagsOf(e).some(t=>/^(sensibel|sensitive)$/i.test(t));
const sensLocked=(e=S.entry)=>isSens(e)&&!(S.sensUntil>Date.now());
async function verifyMaster(pw){try{return eqBytes(await compositeKey(pw,S.keyFile),S.db.composite);}catch(e){return false;}}
function askMaster(title,text){return new Promise(res=>{const dlg=$('dlg');const prev=dlg.open;if(prev)dlg.close();
  dlg.innerHTML=`<form class="dlg narrow" id="mvForm"><header>${esc(title)}</header><div class="body"><p style="margin:2px 0 4px">${text}</p>
    <label class="f" for="mvPw">Master-Passwort</label><input class="input" type="password" id="mvPw" autocomplete="current-password"><div class="err" id="mvErr"></div></div>
    <footer><button type="button" class="btn" id="mvC">Abbrechen</button><button class="btn primary">Bestätigen</button></footer></form>`;
  $('mvC').onclick=()=>{dlg.close();res(false);};dlg.oncancel=()=>res(false);
  $('mvForm').onsubmit=async ev=>{ev.preventDefault();if(await verifyMaster($('mvPw').value)){$('mvPw').value='';dlg.close();res(true);}else{$('mvErr').textContent='Das Master-Passwort stimmt nicht.';$('mvPw').select();}};
  dlg.showModal();$('mvPw').focus();});}
async function unlockSensitive(){const ok=await askMaster('Sensiblen Eintrag entsperren',`Dieser Eintrag ist als <b>sensibel</b> markiert. Bestätige dein Master-Passwort, um Inhalte ${SENS_MIN} Minuten lang anzuzeigen und zu kopieren.`);
  if(ok){S.sensUntil=Date.now()+SENS_MIN*60000;renderDetail();toast(`Entsperrt für ${SENS_MIN} Minuten`);}return ok;}
const GUARDED=new Set(['reveal','copy','edit','print','att','restore','rotate','attDel']);
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db||!GUARDED.has(b.dataset.act))return;
  if(b.dataset.act==='copy'&&b.closest('#dlg'))return;const e=S.entry;if(!sensLocked(e))return;
  ev.preventDefault();ev.stopImmediatePropagation();const act=b.dataset.act,key=b.dataset.key,idx=b.dataset.i;
  if(await unlockSensitive()){const t=b.isConnected?b:document.querySelector(`#detail [data-act="${act}"]${key?`[data-key="${CSS.escape(key)}"]`:''}${idx?`[data-i="${idx}"]`:''}`);if(t)t.click();}},true);
document.addEventListener('keydown',ev=>{if(!S.db||$('dlg').open||!sensLocked())return;const mod=ev.metaKey||ev.ctrlKey;const k=ev.key.toLowerCase();
  const hit=(mod&&['c','b','e','p'].includes(k)&&!window.getSelection().toString())||(ev.key==='Enter'&&!/^(INPUT|TEXTAREA|BUTTON|A|SELECT)$/.test(document.activeElement.tagName));
  if(hit){ev.preventDefault();ev.stopImmediatePropagation();unlockSensitive();}},true);

// ---- Probleme eines Eintrags + Passwort ersetzen ----
function entryIssues(e){const pw=str(e,'Password');const out=[];if(inBin(e))return out;
  if(expired(e))out.push('Abgelaufen am '+getTime(e,'ExpiryTime').toLocaleDateString('de-DE'));else if(expiresSoon(e))out.push('Läuft am '+getTime(e,'ExpiryTime').toLocaleDateString('de-DE')+' ab');
  if(pw){const same=allEntries(rootGroup()).filter(x=>x!==e&&str(x,'Password')===pw);if(same.length)out.push('Auch verwendet bei: '+same.slice(0,3).map(x=>str(x,'Title')||'Ohne Titel').join(', ')+(same.length>3?` und ${same.length-3} weiteren`:''));
    if(entropy(pw)<50)out.push('Schwaches Passwort (etwa '+entropy(pw)+' Bit)');
    const d=pwSince(e);if(d&&Date.now()-d>365*DAY)out.push('Seit '+d.toLocaleDateString('de-DE')+' unverändert');}
  return out;}
function rotateDialog(e){const dlg=$('dlg');const url=safeUrl(str(e,'URL'));
  dlg.innerHTML=`<form class="dlg" id="roForm"><header>Passwort ersetzen</header><div class="body">
    <p style="margin:2px 0 10px">Für <b>${esc(str(e,'Title')||'Ohne Titel')}</b>. Das bisherige Passwort bleibt im Verlauf erhalten.</p>
    <ol class="steps"><li><b>Login-Seite öffnen</b> und dort „Passwort ändern“ aufrufen.</li><li><b>Neues Passwort kopieren</b> und auf der Seite einfügen.</li><li>Erst wenn die Seite die Änderung bestätigt: <b>Übernehmen</b>.</li></ol>
    <label class="f" for="roPw">Neues Passwort</label><div class="inrow"><input class="input mono" id="roPw" autocomplete="off" spellcheck="false"><button type="button" class="icon-btn" id="roCopy" title="Kopieren">${ICON.copy}</button></div>
    <div class="meter" id="roMeter"></div><div class="gen" id="roGen"></div>
    ${X.text(X.kid(X.kid(e,'Times'),'Expires'))==='True'?'<label class="check"><input type="checkbox" id="roExp" checked> Neues Ablaufdatum setzen: in 12 Monaten</label>':''}
    <div class="inrow" style="margin-top:12px;flex-wrap:wrap">${url?`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${ICON.ext}Login-Seite öffnen</a>`:''}<button type="button" class="btn" id="roCopy2">${ICON.copy}Neues Passwort kopieren</button></div></div>
    <footer><button type="button" class="btn" id="roC">Abbrechen</button><button class="btn primary">Übernehmen</button></footer></form>`;
  const pw=$('roPw');const upd=()=>$('roMeter').innerHTML=meterHtml(pw.value);pw.value=genAny();upd();pw.oninput=upd;mountGen($('roGen'),pw,upd);
  const cp=()=>{copyText(pw.value);toast('Neues Passwort kopiert – wird in 30 s geleert');};$('roCopy').onclick=cp;$('roCopy2').onclick=cp;$('roC').onclick=()=>dlg.close();
  $('roForm').onsubmit=ev=>{ev.preventDefault();if(!pw.value)return;checkpoint('Passwort ersetzen');pushHistory(e);setStr(e,'Password',pw.value,true);if($('roExp')&&$('roExp').checked){const d=new Date();d.setFullYear(d.getFullYear()+1);setTime(e,'ExpiryTime',d);}touch(e);markDirty();dlg.close();render();undoToast('Neues Passwort übernommen');};
  dlg.showModal();}

// ---- Verlauf mit Unterschieden ----
const FIELD_LABEL={Title:'Titel',UserName:'Benutzername',Password:'Passwort',URL:'URL',Notes:'Notizen',otp:'2FA-Schlüssel'};
function fieldLabel(k){return FIELD_LABEL[k]||(isPkKey(k)?'Passkey':k.startsWith('TimeOtp')?'2FA-Schlüssel':k);}
function diffEntries(a,b){const keys=new Set([...X.kids(a,'String'),...X.kids(b,'String')].map(s=>X.text(X.kid(s,'Key'))));const out=[];
  for(const k of keys){const va=str(a,k),vb=str(b,k);if(va===vb)continue;const prot=k==='Password'||isProt(a,k)||isProt(b,k)||isPkKey(k)||OTP_KEYS.includes(k);out.push({k,a:va,b:vb,prot});}
  const ta=tagsOf(a).join(', '),tb=tagsOf(b).join(', ');if(ta!==tb)out.push({k:'Tags',a:ta,b:tb});
  const ba=X.kids(a,'Binary').map(x=>X.text(X.kid(x,'Key'))).join(', '),bb=X.kids(b,'Binary').map(x=>X.text(X.kid(x,'Key'))).join(', ');if(ba!==bb)out.push({k:'Anhänge',a:ba,b:bb});
  const ea=X.text(X.kid(X.kid(a,'Times'),'Expires'))==='True'?fmtDate(getTime(a,'ExpiryTime')):'',eb=X.text(X.kid(X.kid(b,'Times'),'Expires'))==='True'?fmtDate(getTime(b,'ExpiryTime')):'';if(ea!==eb)out.push({k:'Ablauf',a:ea,b:eb});
  return out;}
function historyHtml(e){const hist=X.kids(X.kid(e,'History'),'Entry');if(!hist.length)return '';const ver=[...hist,e];const show=reveal&&!sensLocked(e);
  const val=(v,p)=>!v?'<span class="muted">leer</span>':p&&!show?'<span class="muted">••••••</span>':esc(v.length>240?v.slice(0,240)+' …':v);
  let h=`<div class="field hist"><div class="k">Verlauf · ${hist.length} ${hist.length===1?'frühere Version':'frühere Versionen'}</div>`;
  for(let i=hist.length-1;i>=0;i--){const d=diffEntries(hist[i],ver[i+1]);const lab=d.length?d.slice(0,3).map(x=>fieldLabel(x.k)).join(', ')+(d.length>3?` und ${d.length-3} weitere`:''):'Keine inhaltliche Änderung';
    h+=`<details class="hv"><summary><span class="hvt"><b>${fmtDate(getTime(ver[i+1],'LastModificationTime'))}</b><span>${esc(lab)} geändert</span></span><span class="hvchev">${ICON.back}</span></summary>
      <div class="diff">${d.map(x=>`<div class="dk">${esc(fieldLabel(x.k))}</div><div class="dv"><del>${val(x.a,x.prot)}</del><ins>${val(x.b,x.prot)}</ins></div>`).join('')}
      <div class="hvact"><span class="muted">Stand vor dieser Änderung wiederherstellen</span><button class="btn small" data-act="restore" data-i="${i}">Wiederherstellen</button></div></div></details>`;}
  return h+(show?'':'<p class="note" style="margin:8px 0 0">Geschützte Werte erscheinen nach „Anzeigen“ beim Passwort.</p>')+'</div>';}

// ---- Vorlagen ----
const TEMPLATES={
  login:{name:'Login',icon:0,fields:[],hide:[]},
  wlan:{name:'WLAN',icon:12,fields:[['SSID',0,''],['Verschlüsselung',0,'WPA2/WPA3']],tags:'wlan',hide:['user','url','otp']},
  server:{name:'Server / SSH',icon:3,fields:[['Host',0,''],['Port',0,'22'],['SSH-Schlüssel',1,'']],hide:[],url:'ssh://'},
  card:{name:'Kreditkarte',icon:66,fields:[['Karteninhaber',0,''],['Kartennummer',1,''],['Gültig bis',0,''],['Prüfnummer (CVC)',1,''],['PIN',1,'']],hide:['user','pw','url','otp'],sens:true},
  license:{name:'Softwarelizenz',icon:47,fields:[['Produkt',0,''],['Lizenzschlüssel',1,''],['Lizenziert für',0,''],['Kaufdatum',0,'']],hide:['pw','otp']},
  customer:{name:'Kundenzugang',icon:5,fields:[['Kunde',0,''],['Kundennummer',0,''],['Ansprechpartner',0,''],['Telefon',0,'']],tags:'kunde',hide:[]},
  note:{name:'Sichere Notiz',icon:7,fields:[],hide:['user','pw','url','otp']}};
const TPL_ICON={login:'key',wlan:'wifi',server:'server',card:'money',license:'pkg',customer:'users',note:'note'};

// ---- Kundenmappe (Gruppe als eigene .kdbx) ----
async function buildBundle(g,name,pw,withHist,onProgress){
  const dst=await kdbxCreate(name,pw,null,onProgress);const droot=X.kid(X.kid(dst.xml,'Root'),'Group');
  const bin=recycleBin(false);const c=X.clone(g,null);
  const strip=n=>{for(const ch of X.kids(n,'Group'))if(bin&&uuidOf(ch)===uuidOf(bin))X.remove(ch);else strip(ch);if(!withHist)for(const en of X.kids(n,'Entry')){const h=X.kid(en,'History');if(h)h.children=[];}};strip(c);
  if(S.db.major!==4)X.walk(c,n=>{if(TIME_KEYS.has(n.name)){const d=parseTime(S.db,X.text(n));if(d)X.setText(n,timeStr(dst,d));}});
  const map=new Map();const vals=[];X.walk(c,n=>{if(n.name==='Value'&&n.parent&&n.parent.name==='Binary'&&n.attrs.Ref!==undefined)vals.push(n);});
  for(const v of vals){const o=v.attrs.Ref;if(!map.has(o)){const d=await binaryDataOf(S.db,o);map.set(o,d?await binaryAdd(dst,d):null);}if(map.get(o)!==null)v.attrs.Ref=map.get(o);else X.remove(v.parent);}
  const icons=new Set();X.walk(c,n=>{if(n.name==='CustomIconUUID')icons.add(X.text(n));});
  for(const iu of icons){const oi=X.kids(X.kid(meta(),'CustomIcons'),'Icon').find(i=>X.text(X.kid(i,'UUID'))===iu);if(oi)X.append(X.ensure(X.kid(dst.xml,'Meta'),'CustomIcons'),X.clone(oi,null));}
  for(const ch of X.kids(c))if(ch.name==='Entry'||ch.name==='Group')X.append(droot,ch);
  let n=0;X.walk(droot,x=>{if(x.name==='Entry'&&x.parent.name==='Group')n++;});
  return {bytes:await kdbxSave(dst),count:n};}
function bundleDialog(g0){const dlg=$('dlg');const g=g0||(typeof S.group==='object'&&S.group)||null;
  dlg.innerHTML=`<form class="dlg" id="buForm"><header>Kundenmappe erstellen</header><div class="body">
    <p style="margin:2px 0 4px">Exportiert eine Gruppe als <b>eigene, verschlüsselte KeePass-Datei</b> mit eigenem Master-Passwort – zum Übergeben an einen Kunden. Deine übrige Datenbank bleibt unberührt.</p>
    <label class="f" for="buG">Gruppe</label><select class="input" id="buG">${groupOptions(g||rootGroup())}</select>
    <label class="f" for="buN">Name der Mappe</label><input class="input" id="buN">
    <label class="f" for="buP">Master-Passwort für die Mappe</label><div class="inrow"><input class="input mono" id="buP" autocomplete="new-password" spellcheck="false"><button type="button" class="btn" id="buPP">${ICON.dice}Vorschlagen</button></div>
    <div class="meter" id="buM"></div>
    <label class="check"><input type="checkbox" id="buH"> Frühere Versionen (Verlauf) mitgeben</label>
    <div class="progress hidden" id="buProg"><i></i></div><div class="err" id="buErr"></div>
    <p class="note">Gib das Passwort getrennt von der Datei weiter, z. B. telefonisch oder auf dem gedruckten Übergabeblatt.</p></div>
    <footer><button type="button" class="btn" id="buC">Abbrechen</button><button class="btn primary" id="buGo">Mappe erstellen</button></footer></form>`;
  const setName=()=>{const gg=findGroup($('buG').value);$('buN').value=gName(gg);};setName();$('buG').onchange=setName;
  $('buP').oninput=()=>$('buM').innerHTML=meterHtml($('buP').value);
  $('buPP').onclick=()=>{const p=passphrase({...PP,words:Math.max(PP.words,5)});LASTGEN.pw=p;LASTGEN.bits=ppBits({...PP,words:Math.max(PP.words,5)});$('buP').value=p;$('buM').innerHTML=meterHtml(p);};
  $('buC').onclick=()=>dlg.close();
  $('buForm').onsubmit=async ev=>{ev.preventDefault();const gg=findGroup($('buG').value);const name=$('buN').value.trim()||gName(gg);const pw=$('buP').value;
    if(pw.length<8){$('buErr').textContent='Wähle ein Master-Passwort mit mindestens 8 Zeichen.';return;}
    $('buGo').disabled=true;$('buProg').classList.remove('hidden');
    try{const {bytes,count}=await buildBundle(gg,name,pw,$('buH').checked,x=>$('buProg').firstChild.style.width=(x*100)+'%');
      const file=name.replace(/[\\/:*?"<>|]/g,'_')+'.kdbx';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes]));a.download=file;document.body.appendChild(a);a.click();a.remove();
      const c=await askChoice('Kundenmappe erstellt',`<b>${esc(file)}</b> mit ${count} ${count===1?'Eintrag':'Einträgen'} wurde heruntergeladen. Der Kunde öffnet sie mit KeePassXC, Strongbox, KeePassDX oder Tresor.`,[{l:'Fertig',v:'ok'},{l:'Übergabeblatt drucken',v:'print',primary:true}]);
      if(c==='print')printHtml(handoverHtml(name,file,count));}
    catch(err){$('buErr').textContent=err.message;$('buGo').disabled=false;}};
  dlg.showModal();}
function handoverHtml(name,file,count){const lines=n=>'<div class="pline"></div>'.repeat(n);
  return `<div class="psheet"><div class="phead"><div><div class="pkick">Übergabe von Zugangsdaten</div><h1>${esc(name)}</h1></div><div class="pdate">${new Date().toLocaleDateString('de-DE')}</div></div>
    <p>Sie erhalten Ihre Zugangsdaten als verschlüsselte KeePass-Datei. Ohne das Master-Passwort unten kann niemand die Datei lesen.</p>
    <h2>1 · Datei</h2><table class="ptbl"><tr><th>Dateiname</th><td>${esc(file)}</td></tr><tr><th>Inhalt</th><td>${count} ${count===1?'Zugang':'Zugänge'}</td></tr><tr><th>Übermittelt per</th><td>${lines(1)}</td></tr></table>
    <h2>2 · Master-Passwort</h2><div class="pbox">${lines(2)}</div><p class="psmall">Groß- und Kleinschreibung, Leer- und Sonderzeichen beachten.</p>
    <h2>3 · Öffnen</h2><ol><li>Programm installieren: <b>KeePassXC</b> (Windows, Mac, Linux – keepassxc.org), <b>Strongbox</b> (iPhone, iPad, Mac) oder <b>KeePassDX</b> (Android).</li><li>Die Datei öffnen und das Master-Passwort eingeben.</li><li>Datei und Passwort sicher aufbewahren – am besten getrennt voneinander.</li></ol>
    <h2>Ansprechpartner</h2>${lines(2)}<div class="pfoot">Vertraulich – sicher aufbewahren</div></div>`;}

// ---- Übersicht ----
function securityScore(r){if(!r.total)return 100;const w=new Map();const add=(list,x)=>{for(const e of list)w.set(e,Math.min(1,(w.get(e)||0)+x));};
  add(r.weak,1);add(r.reused,1);add(r.exp,1);add(r.old,.4);add(r.soon,.3);add(r.dups.flat(),.3);let s=0;for(const v of w.values())s+=v;return Math.max(0,Math.round(100*(1-s/r.total)));}
function scoreRing(score){const R=52,C=2*Math.PI*R;const col=score>=85?'var(--ok)':score>=60?'var(--brass)':'var(--danger)';let ticks='';
  for(let i=0;i<60;i++){const a=i*6*Math.PI/180;const r1=i%5===0?62:64;ticks+=`<line x1="${(70+Math.sin(a)*r1).toFixed(1)}" y1="${(70-Math.cos(a)*r1).toFixed(1)}" x2="${(70+Math.sin(a)*67).toFixed(1)}" y2="${(70-Math.cos(a)*67).toFixed(1)}"/>`;}
  return `<svg class="ring" viewBox="0 0 140 140" aria-hidden="true"><g class="ticks">${ticks}</g><circle cx="70" cy="70" r="${R}" class="trk"/><circle cx="70" cy="70" r="${R}" class="val" style="stroke:${col};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C*(1-score/100)).toFixed(1)}"/></svg>`;}
function renderDashboard(){const root=rootGroup();const es=allEntries(root);const r=analyze();const score=securityScore(r);
  const groups=(()=>{let n=1;const b=recycleBin(false);(function w(g){for(const c of X.kids(g,'Group'))if(c!==b){n++;w(c);}})(root);return n;})();
  const otp=es.filter(e=>{const c=otpConfig(e);return c&&!c.error;}).length,pk=es.filter(passkeyOf).length,sens=es.filter(isSens).length;
  const favs=es.filter(isFav).sort((a,b)=>str(a,'Title').localeCompare(str(b,'Title'),'de'));const rec=recentList().slice(0,6);
  const label=score>=85?'Gut aufgestellt':score>=60?'Verbesserungswürdig':'Handlungsbedarf';
  const iss=[['Mehrfach verwendet',r.reused.length],['Schwach',r.weak.length],['Abgelaufen',r.exp.length],['Läuft bald ab',r.soon.length],['Älter als ein Jahr',r.old.length],['Doppelte Einträge',r.dups.length]];
  const card=e=>`<div class="fav"><button class="favmain" data-act="openE" data-uuid="${esc(uuidOf(e))}">${entryBadge(e)}<span class="tx"><b>${esc(str(e,'Title')||'Ohne Titel')}</b><span>${esc(str(e,'UserName')||hostOf(str(e,'URL'))||groupPath(e))}</span></span></button>${str(e,'Password')?`<button class="icon-btn" data-act="quickCopy" data-uuid="${esc(uuidOf(e))}" title="Passwort kopieren">${ICON.copy}</button>`:''}</div>`;
  const saved=S.lastSaved?`zuletzt gespeichert ${new Date(S.lastSaved).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`:S.dirty?'ungespeicherte Änderungen':'geöffnet aus '+esc(S.fileName);
  $('detail').innerHTML=`<div class="dash">
    <div class="dhead"><div><h1>${esc(X.text(X.kid(meta(),'DatabaseName'))||S.fileName)}</h1><p>${es.length} ${es.length===1?'Eintrag':'Einträge'} in ${groups} ${groups===1?'Gruppe':'Gruppen'} – ${saved}</p></div>
      <div class="inrow"><button class="btn" data-act="palette">${ICON.search||''}Suchen <kbd class="hide-narrow">⌘K</kbd></button><button class="btn primary" data-act="newEntry">${ICON.plus}Neuer Eintrag</button></div></div>
    <div class="dgrid">
      <section class="dcard score"><div class="ringwrap">${scoreRing(score)}<div class="ringv"><b>${score}</b><span>von 100</span></div></div>
        <div><h2>Sicherheitswert</h2><p class="lab">${label}</p><p class="muted">${r.count?`${r.count} von ${r.total} Einträgen sollten überarbeitet werden.`:'Keine schwachen, doppelten oder ablaufenden Passwörter.'}</p><button class="btn" data-act="report">Sicherheitsbericht öffnen</button></div></section>
      <section class="dcard"><h2>Handlungsbedarf</h2><div class="isslist">${iss.map(([l,n])=>`<button class="iss${n?' on':''}" data-act="report"><span>${l}</span><b>${n}</b></button>`).join('')}</div></section>
      <section class="dcard stats"><h2>Inhalt</h2><div class="stgrid">${[[es.length,'Einträge'],[otp,'mit 2FA'],[pk,'Passkeys'],[sens,'sensibel']].map(([n,l])=>`<div><b>${n}</b><span>${l}</span></div>`).join('')}</div></section>
    </div>
    <section class="dcard"><div class="dch"><h2>Favoriten</h2>${favs.length?`<button class="linkbtn" data-act="pseudo" data-g="fav">Alle anzeigen</button>`:''}</div>
      ${favs.length?`<div class="favgrid">${favs.slice(0,8).map(card).join('')}</div>`:'<p class="muted" style="margin:6px 0 0">Markiere häufig genutzte Einträge mit dem Stern (⌘D) – sie erscheinen dann hier.</p>'}</section>
    <div class="dgrid two">
      <section class="dcard"><div class="dch"><h2>Zuletzt verwendet</h2></div>${rec.length?`<div class="favgrid one">${rec.map(card).join('')}</div>`:'<p class="muted" style="margin:6px 0 0">Noch nichts geöffnet.</p>'}</section>
      <section class="dcard"><div class="dch"><h2>Neu anlegen</h2><button class="linkbtn" data-act="tplManage">Kategorien verwalten</button></div><div class="tplgrid">${tplList().map(t=>`<button class="tplb" data-act="newTpl" data-tpl="${esc(t.id)}">${kpSvg(t.icon)}<span>${esc(t.name)}</span></button>`).join('')}</div>
        <div class="dlinks"><button class="linkbtn" data-act="bundle">Kundenmappe erstellen</button><button class="linkbtn" data-act="imp">CSV importieren</button><button class="linkbtn" data-act="sheet">Notfallblatt drucken</button></div></section>
    </div></div>`;}

// ---- Detail-Darstellung in Karten gliedern ----
function decorateDetail(){const w=document.querySelector('#detail .dwrap');if(!w||w.dataset.dec)return;w.dataset.dec='1';const e=S.entry;
  const fields=[...w.children].filter(c=>c.classList.contains('field'));if(!fields.length)return;
  const main=document.createElement('div');main.className='fcard';const sub=document.createElement('div');sub.className='fcard sub';
  fields[0].before(main);for(const f of fields)(f.querySelector('.meta-grid')||f.classList.contains('hist')?sub:main).appendChild(f);
  if(sub.children.length)main.after(sub);if(!main.children.length)main.remove();
  if(e&&!bulkActive()){const iss=entryIssues(e);const top=w.querySelector('.dtop');
    const sens=isSens(e)?`<div class="sensbar">${kpSvg(0,'lockdoc')}<span>${sensLocked(e)?'Sensibel – Anzeigen und Kopieren erfordern dein Master-Passwort.':`Sensibel – entsperrt bis ${new Date(S.sensUntil).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}.`}</span>${sensLocked(e)?'<button class="btn small" data-act="unlockSens">Entsperren</button>':''}</div>`:'';
    const ib=iss.length?`<div class="issue">${kpSvg(0,'warn')}<div><b>${iss.length===1?'Hinweis':'Hinweise'}</b>${iss.map(x=>`<span>${esc(x)}</span>`).join('')}</div>${str(e,'Password')||!passkeyOf(e)?'<button class="btn small" data-act="rotate">Passwort ersetzen</button>':''}</div>`:'';
    if(sens||ib)top.insertAdjacentHTML('afterend',sens+ib);}}

// ---- Funktionen umhüllen ----
const _render=render,_renderDetail=renderDetail,_showView=showView;
render=function(){if(S.db&&S.group==='home'&&S.entry)S.group='all';_render();updateChrome();};
renderDetail=function(){if(S.db&&S.group==='home'&&S.entry){S.group='all';renderGroups();renderList();}if(S.db&&S.group==='home'&&!S.entry&&!S.query.trim()&&!bulkActive()){startOtp(null);renderDashboard();updateChrome();return;}_renderDetail();decorateDetail();updateChrome();};
showView=function(v){_showView(v);updateChrome();};
function updateChrome(){const home=!!S.db&&S.group==='home'&&!S.entry&&!S.query.trim()&&!bulkActive();document.body.classList.toggle('home',home);
  const tb=document.querySelector('.tabbar');if(!tb)return;const v=document.body.classList.contains('v-groups')?'groups':document.body.classList.contains('v-detail')?(home?'home':'list'):(home?'home':'list');
  tb.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===v));}

// ---- Ereignisse ----
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='openE'){const e=findEntry(b.dataset.uuid);if(!e)return;S.group='all';S.query='';$('q').value='';S.sel.clear();S.entry=e;reveal=false;markAccess(e);render();showView('detail');$('detail').scrollTop=0;}
  else if(a==='quickCopy'){const e=findEntry(b.dataset.uuid);if(!e)return;if(isSens(e)&&!(S.sensUntil>Date.now())){S.group='all';S.entry=e;render();showView('detail');unlockSensitive();return;}
    copyText(str(e,'Password'));markAccess(e);toast(`Passwort von „${str(e,'Title')}“ kopiert – wird in 30 s geleert`);}
  else if(a==='rotate'&&S.entry)rotateDialog(S.entry);
  else if(a==='unlockSens')unlockSensitive();
  else if(a==='newTpl')openEditor(null,b.dataset.tpl);
  else if(a==='bundle'){$('dlg').open&&$('dlg').close();bundleDialog(b.dataset.uuid?findGroup(b.dataset.uuid):null);}
  else if(a==='tab'){const t=b.dataset.t;if(t==='home')goGroup('home');else if(t==='list'){if(S.group==='home')S.group='all';S.entry=null;render();showView('list');}else if(t==='groups')showView('groups');else if(t==='new')openEditor(null);}
});
if(!window.isSecureContext){$('secWarn').classList.remove('hidden');$('httpBadge').classList.remove('hidden');}
