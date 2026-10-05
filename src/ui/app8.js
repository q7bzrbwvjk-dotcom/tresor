// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 9: Zusammenführen mit Vorschau, Passwortrichtlinien je Gruppe, Aktivitätsverlauf =====================

// ---------- 1) Zusammenführen mit Vorschau ----------
function mergePreview(plan,name,quiet){return new Promise(res=>{const dlg=$('dlg');const dec={};
  for(const c of plan.conflicts)dec[c.u]='newer';
  const tt=e=>esc(str(e,'Title')||T('Ohne Titel'));
  const diffHtml=(a,b,la,lb)=>{const d=diffEntries(a,b);if(!d.length)return `<p class="note" style="margin:4px 0 0">${T('Nur Zeitstempel unterschiedlich.')}</p>`;
    const v=(x,p)=>!x?`<span class="muted">${T('leer')}</span>`:p?'<span class="muted">••••••</span>':esc(x.length>160?x.slice(0,160)+' …':x);
    return `<div class="diff mdiff"><div></div><div class="dvh"><span>${la}</span><span>${lb}</span></div>${d.map(x=>`<div class="dk">${esc(fieldLabel(x.k))}</div><div class="dv two"><del>${v(x.a,x.prot)}</del><ins>${v(x.b,x.prot)}</ins></div>`).join('')}</div>`;};
  const chk=(k,u,label,sub,checked=true)=>`<label class="mrow"><input type="checkbox" data-${k}="${esc(u)}"${checked?' checked':''}><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span></label>`;
  const sum=[[plan.added.length,T('neu')],[plan.updated.length,T('aktualisiert')],[plan.conflicts.length,plan.conflicts.length===1?T('Konflikt'):T('Konflikte')],[plan.deleted.length,T('gelöscht')],[plan.moved.length,T('verschoben')],[plan.groups.length,plan.groups.length===1?T('neue Gruppe'):T('neue Gruppen')],[plan.meta||0,T('Kundendaten, Richtlinien oder Kategorien')]].filter(x=>x[0]);
  dlg.innerHTML=`<form class="dlg wide" id="mpForm"><header>${T('Zusammenführen – Vorschau')}</header><div class="body">
    <p style="margin:2px 0 10px">${T('Änderungen aus <b>{f}</b>. Nichts wird übernommen, bevor du bestätigst. Ersetzte Fassungen bleiben im Verlauf erhalten.',{f:esc(name)})}</p>
    <div class="chips" style="margin-bottom:14px">${sum.map(([n,l])=>`<span class="chip">${n} ${l}</span>`).join('')}${plan.localNewer.length?`<span class="chip muted">${T('{n} hier aktueller',{n:plan.localNewer.length})}</span>`:''}</div>
    ${plan.conflicts.length?`<h3 class="msec">${T('Konflikte')} <small>${T('– auf beiden Geräten unabhängig geändert')}</small></h3>`+plan.conflicts.map(c=>`<div class="mcard"><div class="mch"><b>${tt(c.le)}</b><small>${esc(groupPath(c.le))}</small></div>
      <div class="mtimes"><span>${T('Hier geändert: {d}',{d:fmtDate(new Date(c.lm*1000))})}</span><span>${T('Dort geändert: {d}',{d:fmtDate(new Date(c.om*1000))})}</span></div>
      ${diffHtml(c.le,c.oe,T('Hier'),T('Dort'))}
      <div class="seg wide3" data-c="${esc(c.u)}"><button type="button" data-v="newer" class="on">${c.newer==='other'?T('Neuere (dort)'):T('Neuere (hier)')}</button><button type="button" data-v="local">${T('Hier behalten')}</button><button type="button" data-v="other">${T('Dort übernehmen')}</button></div></div>`).join(''):''}
    ${plan.updated.length?`<h3 class="msec">${T('Dort aktualisiert')}</h3>`+plan.updated.map(x=>`<details class="mdet">${'<summary>'+chk('a',x.u,tt(x.le),T('Neuere Fassung übernehmen'))+'</summary>'}${diffHtml(x.le,x.oe,T('Hier'),T('Dort'))}</details>`).join(''):''}
    ${plan.added.length?`<h3 class="msec">${T('Neu')}</h3>`+plan.added.map(x=>chk('a',x.u,tt(x.oe),esc([str(x.oe,'UserName'),X.text(X.kid(x.oe.parent,'Name'))].filter(Boolean).join(' – ')))).join(''):''}
    ${plan.deleted.length?`<h3 class="msec">${T('Dort gelöscht')}</h3>`+plan.deleted.map(x=>chk('d',x.u,tt(x.le),T('Auch hier löschen'))).join(''):''}
    ${plan.moved.length?`<h3 class="msec">${T('Dort verschoben')}</h3>`+plan.moved.map(x=>chk('m',x.u,tt(x.le),T('nach „{g}“',{g:esc(gName(x.to))}))).join(''):''}
    ${plan.groups.length?`<h3 class="msec">${T('Neue Gruppen')}</h3><p class="note" style="margin:0">${T('{x} – werden angelegt, wenn Einträge darin übernommen werden.',{x:plan.groups.map(g=>esc(X.text(X.kid(g,'Name')))).join(', ')})}</p>`:''}
    ${plan.meta?`<h3 class="msec">${T('Zusatzdaten')}</h3><p class="note" style="margin:0">${T('{n} geänderte Kundenakten, Richtlinien oder Kategorien werden abgeglichen – jeweils die neuere Fassung, Protokolleinträge beider Seiten bleiben erhalten.',{n:plan.meta})}</p>`:''}
    ${plan.localNewer.length?`<p class="note" style="margin-top:14px">${T(plan.localNewer.length===1?'{n} Eintrag ist hier aktueller – die ältere Fassung von dort landet im Verlauf.':'{n} Einträge sind hier aktueller – die ältere Fassung von dort landet im Verlauf.',{n:plan.localNewer.length})}</p>`:''}
  </div><footer><button type="button" class="btn" id="mpC">${T('Abbrechen')}</button><button class="btn primary">${T('Zusammenführen')}</button></footer></form>`;
  dlg.querySelectorAll('.seg[data-c]').forEach(sg=>sg.onclick=ev=>{const b=ev.target.closest('[data-v]');if(!b)return;sg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));dec[sg.dataset.c]=b.dataset.v;});
  dlg.querySelectorAll('.mdet summary label').forEach(l=>l.addEventListener('click',e=>e.stopPropagation()));
  $('mpC').onclick=()=>{dlg.close();res(null);};dlg.oncancel=()=>res(null);
  $('mpForm').onsubmit=ev=>{ev.preventDefault();const out={};
    for(const [u,v] of Object.entries(dec))if(v!=='newer')out[u]=v;
    dlg.querySelectorAll('[data-a]').forEach(c=>{if(!c.checked)out[c.dataset.a]='skip';});
    dlg.querySelectorAll('[data-d]').forEach(c=>{if(!c.checked)out[c.dataset.d]='keep';});
    dlg.querySelectorAll('[data-m]').forEach(c=>{if(!c.checked&&!out[c.dataset.m])out[c.dataset.m]='nomove';});
    dlg.close();res(out);};
  dlg.showModal();});}
mergeBytes=async function(bytes,name,quiet){
  let other=null;
  try{const pr=progressDialog(T('Datei wird geöffnet'));other=await kdbxOpen(bytes,null,null,pr,S.db.composite);$('dlg').close();}
  catch(e){$('dlg').close();if(!WRONG_KEY_RE.test(e.message)){toast(e.message);return false;}
    for(;;){const cred=await askPassword(name);if(!cred)return false;
      try{const pr=progressDialog(T('Datei wird geöffnet'));other=await kdbxOpen(bytes,cred.pw,cred.kf,pr);$('dlg').close();break;}
      catch(err){$('dlg').close();toast(err.message);if(!WRONG_KEY_RE.test(err.message))return false;}}}
  const plan=planMerge(S.db,other);
  if(!plan.changes){if(!quiet)await askChoice(T('Nichts zu übernehmen'),T('Beide Dateien sind bereits auf demselben Stand.')+(plan.localNewer.length?' '+T(plan.localNewer.length===1?'{n} Eintrag ist hier aktueller.':'{n} Einträge sind hier aktueller.',{n:plan.localNewer.length}):''),[{l:'OK',v:'ok',primary:true}]);return true;}
  const dec=await mergePreview(plan,name,quiet);if(dec===null)return false;
  checkpoint(T('Zusammenführen'));const st=await mergeDb(S.db,other,{decisions:dec});
  markDirty();S.entry=S.entry&&S.entry.parent?S.entry:null;render();
  undoToast(T('Zusammengeführt: {a} neu, {u} aktualisiert, {d} gelöscht',{a:st.added,u:st.updated,d:st.deleted}));return true;};

// ---------- 2) Passwortrichtlinien je Gruppe ----------
const POL_KEY='Tresor.Policies';
const CLS=[['upper',T('Großbuchstaben'),'A–Z'],['lower',T('Kleinbuchstaben'),'a–z'],['digits',T('Ziffern'),'0–9'],['symbols',T('Sonderzeichen'),'!#$…']];
function polItem(){const cd=X.kid(meta(),'CustomData');return cd?X.kids(cd,'Item').find(i=>X.text(X.kid(i,'Key'))===POL_KEY):null;}
function polAll(){const it=polItem();if(it){try{return JSON.parse(X.text(X.kid(it,'Value')))||{};}catch(e){}}return {};}
function polStoreAll(m,label){checkpoint(label);const cd=X.ensure(meta(),'CustomData');let it=polItem();if(!it){it=X.el('Item');X.append(it,X.el('Key',POL_KEY));X.append(it,X.el('Value'));X.append(cd,it);}X.setText(X.kid(it,'Value'),JSON.stringify(m));markDirty();}
function policyFor(g){if(!S.db||!g)return null;const m=polAll();for(let p=g;p&&p.name==='Group';p=p.parent){const pol=m[uuidOf(p)];if(pol)return {...pol,from:p};}return null;}
const polSymbols=pol=>pol.symbolSet&&pol.symbolSet.trim()?[...new Set(pol.symbolSet.replace(/\s/g,''))].join(''):CHARSETS.symbols;
// Class names inside sentences: German nouns keep the capital, English uses lower case.
const clsWord=l=>LANG==='de'?l:l.toLowerCase();
function polText(pol){const parts=[T('{n} Zeichen',{n:`${pol.min}${pol.max?'–'+pol.max:'+'}`})];for(const [k,l] of CLS){if(pol[k]==='req')parts.push(T('{x} Pflicht',{x:clsWord(l)}));else if(pol[k]==='no')parts.push(T('keine {x}',{x:clsWord(l)}));}
  if(pol.symbols!=='no'&&pol.symbolSet)parts.push(T('nur {x}',{x:pol.symbolSet}));if(pol.maxAge)parts.push(T('Wechsel alle {n} Tage',{n:pol.maxAge}));return parts.join(' · ');}
function checkPolicy(pw,pol){const v=[];if(!pw||!pol)return v;const n=[...pw].length;
  if(n<pol.min)v.push(T('zu kurz ({n} statt mind. {m})',{n,m:pol.min}));if(pol.max&&n>pol.max)v.push(T('zu lang ({n} statt höchstens {m})',{n,m:pol.max}));
  const has={upper:/[A-Z]/.test(pw),lower:/[a-z]/.test(pw),digits:/[0-9]/.test(pw),symbols:/[^A-Za-z0-9]/.test(pw)};
  for(const [k,l] of CLS){if(pol[k]==='req'&&!has[k])v.push(T('{x} fehlen',{x:clsWord(l)}));if(pol[k]==='no'&&has[k])v.push(T('{x} nicht erlaubt',{x:clsWord(l)}));}
  if(pol.symbols!=='no'&&pol.symbolSet){const ok=new Set(polSymbols(pol));const bad=[...new Set([...pw].filter(c=>/[^A-Za-z0-9]/.test(c)&&!ok.has(c)))];if(bad.length)v.push(T('nicht erlaubte Zeichen: {x}',{x:bad.join(' ')}));}
  return v;}
function genWithPolicy(pol){const sets=[];for(const [k] of CLS){if(pol[k]==='no')continue;let s=k==='symbols'?polSymbols(pol):CHARSETS[k];if(pol.noAmbig)s=s.replace(AMBIG,'');if(s)sets.push({s,req:pol[k]==='req'});}
  if(!sets.length)return '';const len=Math.max(pol.min,Math.min(pol.max||128,Math.max(genOpt.len,pol.min)));const all=sets.map(x=>x.s).join('');let out;
  do{out=Array.from({length:len},()=>all[randInt(all.length)]);}while(!sets.filter(x=>x.req).every(x=>out.some(c=>x.s.includes(c))));return out.join('');}
let CURPOL=null;
const _genAny=genAny;
genAny=function(){if(CURPOL){const pw=genWithPolicy(CURPOL);const n=CLS.filter(([k])=>CURPOL[k]!=='no').map(([k])=>k==='symbols'?polSymbols(CURPOL):CHARSETS[k]).join('').length;LASTGEN.pw=pw;LASTGEN.bits=Math.round(pw.length*Math.log2(n||1));return pw;}return _genAny();};
const _mountGen=mountGen;
mountGen=function(box,input,onGen){if(!CURPOL)return _mountGen(box,input,onGen);const pol=CURPOL;
  const lo=pol.min,hi=pol.max||64;if(genOpt.len<lo||genOpt.len>hi)genOpt.len=Math.max(lo,Math.min(hi,genOpt.len));
  const draw=()=>{box.innerHTML=`<div class="polnote">${kpSvg(0,'lockdoc')}<span>${T('Richtlinie „{g}“: {x}',{g:esc(gName(pol.from)),x:esc(polText(pol))})}</span></div>
    <div class="inrow"><span class="glab">${T('Länge')} <b>${Math.max(lo,Math.min(hi,genOpt.len))}</b></span><input type="range" min="${lo}" max="${hi}" value="${Math.max(lo,Math.min(hi,genOpt.len))}" data-r="len"${lo===hi?' disabled':''}><button type="button" class="btn" data-new>${ICON.dice}${T('Neu')}</button></div>`;};
  const gen=()=>{input.value=genAny();input.type='text';onGen&&onGen();};
  box.onclick=ev=>{if(ev.target.closest('[data-new]'))gen();};
  box.oninput=ev=>{if(ev.target.dataset.r==='len'){genOpt.len=+ev.target.value;ev.target.previousElementSibling.querySelector('b').textContent=ev.target.value;gen();}};box.onchange=null;
  draw();};
$('dlg').addEventListener('close',()=>{setTimeout(()=>{if(!$('dlg').open)CURPOL=null;},0);});
// Editor: Richtlinie der Zielgruppe anwenden und prüfen
const _openEditor=openEditor;
openEditor=function(entry,tplKey){CURPOL=policyFor(entry?entry.parent:curGroupEl());_openEditor(entry,tplKey);
  const sel=$('edGroup'),pw=$('edPw');if(!sel||!pw)return;
  pw.closest('.inrow').insertAdjacentHTML('afterend','');$('edMeter').insertAdjacentHTML('afterend','<div class="polwarn hidden" id="edPol"></div>');
  const check=()=>{const v=checkPolicy(pw.value,CURPOL);const b=$('edPol');b.classList.toggle('hidden',!v.length);b.innerHTML=v.length?`${kpSvg(0,'warn')}<span><b>${T('Verstößt gegen die Richtlinie „{g}“:',{g:esc(gName(CURPOL.from))})}</b> ${esc(v.join(', '))}</span>`:'';};
  pw.addEventListener('input',check);
  sel.addEventListener('change',()=>{CURPOL=policyFor(findGroup(sel.value));if(!$('genBox').classList.contains('hidden')||CURPOL)mountGen($('genBox'),pw,()=>{$('edMeter').innerHTML=meterHtml(pw.value);check();});check();});
  mountGen($('genBox'),pw,()=>{$('edMeter').innerHTML=meterHtml(pw.value);check();});check();};
const _rotateDialog=rotateDialog;
rotateDialog=function(e){CURPOL=policyFor(e.parent);_rotateDialog(e);};
// Richtlinie bearbeiten
function policyDialog(g){const dlg=$('dlg');const m=polAll();const own=m[uuidOf(g)];const inh=own?null:policyFor(g);
  const p=own||{min:12,max:0,upper:'yes',lower:'yes',digits:'yes',symbols:'yes',symbolSet:'',noAmbig:false,maxAge:0};
  const tri=(k,l,h)=>`<div class="polcls"><span>${l} <small class="muted">${h}</small></span><div class="seg tri" data-k="${k}">${[['req',T('Pflicht')],['yes',T('Erlaubt')],['no',T('Verboten')]].map(([v,t])=>`<button type="button" data-v="${v}" class="${p[k]===v?'on':''}">${t}</button>`).join('')}</div></div>`;
  dlg.innerHTML=`<form class="dlg" id="poForm"><header>${T('Passwortrichtlinie')}</header><div class="body">
    <p style="margin:2px 0 6px">${T('Für <b>{g}</b> und alle Untergruppen. Der Generator hält sich automatisch daran, der Editor warnt bei Verstößen und der Sicherheitsbericht prüft alle Einträge.',{g:esc(gName(g))})}</p>
    ${inh?`<p class="note warnbox">${T('Derzeit gilt die Richtlinie von „{g}“: {x}. Eine eigene Richtlinie hier hat Vorrang.',{g:esc(gName(inh.from)),x:esc(polText(inh))})}</p>`:''}
    <div class="two"><div><label class="f" for="poMin">${T('Mindestlänge')}</label><input class="input" type="number" id="poMin" min="4" max="128" value="${p.min}"></div>
      <div><label class="f" for="poMax">${T('Höchstlänge')} <span class="muted">${T('(leer = keine)')}</span></label><input class="input" type="number" id="poMax" min="4" max="128" value="${p.max||''}" placeholder="${T('z. B. 20')}"></div></div>
    <label class="f">${T('Zeichenarten')}</label>${CLS.map(([k,l,h])=>tri(k,l,h)).join('')}
    <label class="f" for="poSym">${T('Erlaubte Sonderzeichen')} <span class="muted">${T('(leer = alle üblichen)')}</span></label><input class="input mono" id="poSym" value="${esc(p.symbolSet||'')}" placeholder="${T('z. B. -_.!')}">
    <label class="check"><input type="checkbox" id="poAmb"${p.noAmbig?' checked':''}> ${T('Verwechselbare Zeichen vermeiden (l, 1, I, O, 0 …)')}</label>
    <label class="f" for="poAge">${T('Passwort wechseln alle … Tage')} <span class="muted">${T('(leer = nie)')}</span></label><input class="input" type="number" id="poAge" min="1" max="3650" value="${p.maxAge||''}" placeholder="${T('z. B. 365')}">
    <div class="tplprev"><span class="muted">${T('Beispiel')}</span><div class="mono" id="poEx" style="font-size:15px;word-break:break-all"></div><div id="poSum" class="muted"></div></div>
  </div><footer>${own?`<button type="button" class="btn danger left" id="poDel">${T('Richtlinie entfernen')}</button>`:''}<button type="button" class="btn" id="poC">${T('Abbrechen')}</button><button class="btn primary">${T('Speichern')}</button></footer></form>`;
  const read=()=>{const o={min:Math.max(4,Math.min(128,+$('poMin').value||12)),max:+$('poMax').value||0,symbolSet:$('poSym').value.trim(),noAmbig:$('poAmb').checked,maxAge:+$('poAge').value||0};
    if(o.max&&o.max<o.min)o.max=o.min;dlg.querySelectorAll('.seg.tri').forEach(s=>{o[s.dataset.k]=s.querySelector('.on').dataset.v;});return o;};
  const prev=()=>{const o=read();const ok=CLS.some(([k])=>o[k]!=='no');$('poEx').textContent=ok?genWithPolicy(o):T('– keine Zeichenart erlaubt –');$('poSum').textContent=polText(o);};
  dlg.querySelectorAll('.seg.tri').forEach(s=>s.onclick=ev=>{const b=ev.target.closest('[data-v]');if(!b)return;s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));prev();});
  dlg.querySelector('.body').addEventListener('input',prev);prev();
  $('poC').onclick=()=>dlg.close();
  if($('poDel'))$('poDel').onclick=()=>{const m2=polAll();delete m2[uuidOf(g)];polStoreAll(m2,T('Richtlinie entfernen'));dlg.close();render();undoToast(T('Richtlinie entfernt'));};
  $('poForm').onsubmit=ev=>{ev.preventDefault();const o=read();o.u=new Date().toISOString();if(!CLS.some(([k])=>o[k]!=='no')){toast(T('Mindestens eine Zeichenart muss erlaubt sein.'));return;}
    const m2=polAll();m2[uuidOf(g)]=o;polStoreAll(m2,T('Richtlinie speichern'));dlg.close();render();
    const bad=allEntries(g).filter(e=>str(e,'Password')&&checkPolicy(str(e,'Password'),policyFor(e.parent)).length).length;
    undoToast(bad?T(bad===1?'Richtlinie gespeichert – {n} Eintrag verstößt dagegen':'Richtlinie gespeichert – {n} Einträge verstoßen dagegen',{n:bad}):T('Richtlinie gespeichert'));};
  dlg.showModal();}
function policyIssues(e){const pol=policyFor(e.parent);if(!pol||inBin(e))return [];const pw=str(e,'Password');const v=pw?checkPolicy(pw,pol):[];
  if(pw&&pol.maxAge){const d=pwSince(e);if(d&&Date.now()-d>pol.maxAge*DAY)v.push(T('Wechsel fällig (Richtlinie: alle {n} Tage)',{n:pol.maxAge}));}return v;}
// in Analyse, Bericht, Hinweise und Gruppenmenü einhängen
const _analyze=analyze;
analyze=function(){const r=_analyze();r.policy=allEntries(rootGroup()).filter(e=>policyIssues(e).length);if(r.policy.length){const s=new Set([...r.policy]);for(const x of [...r.reused,...r.weak,...r.exp,...r.old,...r.soon,...r.dups.flat()])s.add(x);r.count=s.size;}return r;};
const _entryIssues=entryIssues;
entryIssues=function(e){const v=_entryIssues(e);const p=policyIssues(e);if(p.length)v.unshift(T('Richtlinie „{g}“: {x}',{g:gName(policyFor(e.parent).from),x:p.join(', ')}));return v;};
const _securityScore=securityScore;
securityScore=function(r){const base=_securityScore(r);if(!r.total||!r.policy||!r.policy.length)return base;return Math.max(0,base-Math.round(30*r.policy.length/r.total));};
const _renderReport=renderReport;
renderReport=function(){_renderReport();const r=analyze();if(!r.policy.length)return;const L=$('list');const sum=L.querySelector('.rsum');
  const h=`<div class="lsec"><span>${T('Verstößt gegen Richtlinie')}</span><span>${r.policy.length}</span></div><div class="lhint">${T('Passwörter, die nicht zu den Vorgaben ihrer Gruppe passen.')}</div>`+r.policy.map(e=>eRow(e,policyIssues(e).join(', '))).join('');
  if(sum)sum.insertAdjacentHTML('afterend',h);else L.insertAdjacentHTML('beforeend',h);};
const _groupMenu=groupMenu;
groupMenu=function(g,a){_groupMenu(g,a);const dlg=$('dlg');if(g===recycleBin(false))return;const own=polAll()[uuidOf(g)];const pol=policyFor(g);
  const btn=document.createElement('button');btn.type='button';btn.className='mitem';btn.innerHTML=`${kpSvg(0,'lockdoc')}<span><b>${T('Passwortrichtlinie …')}</b><small>${pol?esc((own?'':T('Geerbt:')+' ')+polText(pol)):T('Keine – z. B. Länge und erlaubte Zeichen festlegen')}</small></span>`;
  btn.onclick=()=>{dlg.close();policyDialog(g);};const list=dlg.querySelector('.mlist');const ref=list.querySelector('[data-m=move]')||list.querySelector('[data-m=bundle]')||list.querySelector('[data-m=del]');list.insertBefore(btn,ref);};
// Hinweis im Listenkopf einer Gruppe
const _renderList=renderList;
renderList=function(){_renderList();if(typeof S.group!=='object'||!S.group||S.query.trim())return;const pol=policyFor(S.group);if(!pol)return;
  const head=$('list').querySelector('.lhead');if(head)head.insertAdjacentHTML('afterend',`<button class="polbar" data-act="polEdit">${kpSvg(0,'lockdoc')}<span>${esc(polText(pol))}${pol.from!==S.group?` <small>${T('(von „{g}“)',{g:esc(gName(pol.from))})}</small>`:''}</span></button>`);};

// ---------- 3) Aktivitätsverlauf ----------
function activityEvents(){const ev=[];const root=rootGroup();const bin=recycleBin(false);const gt=(el,k)=>getTime(el,k);
  const walk=g=>{for(const e of X.kids(g,'Entry')){const hist=X.kids(X.kid(e,'History'),'Entry');const ver=[...hist,e];const c=gt(e,'CreationTime');
      if(c)ev.push({t:c,kind:'new',e,text:T('angelegt')});
      for(let i=0;i<hist.length;i++){const d=diffEntries(ver[i],ver[i+1]);const t=gt(ver[i+1],'LastModificationTime');if(t&&d.length)ev.push({t,kind:d.some(x=>x.k==='Password')?'pw':'edit',e,text:T('{x} geändert',{x:d.map(x=>fieldLabel(x.k)).slice(0,4).join(', ')})});}
      if(!hist.length){const m=gt(e,'LastModificationTime');if(m&&c&&m-c>2000)ev.push({t:m,kind:'edit',e,text:T('bearbeitet')});}
      const lc=gt(e,'LocationChanged');if(lc&&c&&lc-c>2000)ev.push({t:lc,kind:inBin(e)?'del':'move',e,text:inBin(e)?T('in den Papierkorb verschoben'):T('nach „{g}“ verschoben',{g:gName(e.parent)})});}
    for(const s of X.kids(g,'Group')){const c=gt(s,'CreationTime');if(c&&s!==bin)ev.push({t:c,kind:'group',g:s,text:T('Gruppe angelegt')});walk(s);}};
  walk(root);
  const alive=new Set();(function w(g){alive.add(uuidOf(g));for(const e of X.kids(g,'Entry'))alive.add(uuidOf(e));for(const c of X.kids(g,'Group'))w(c);})(root);
  for(const d of X.kids(X.kid(X.kid(S.db.xml,'Root'),'DeletedObjects'),'DeletedObject')){if(alive.has(X.text(X.kid(d,'UUID'))))continue;const t=parseTime(S.db,X.text(X.kid(d,'DeletionTime')));if(t)ev.push({t,kind:'del',text:T('Eintrag oder Gruppe endgültig gelöscht')});}
  const mk=parseTime(S.db,X.text(X.kid(meta(),'MasterKeyChanged')));const cr=getTime(root,'CreationTime');
  if(mk&&cr&&mk-cr>2000)ev.push({t:mk,kind:'key',text:T('Master-Passwort oder Schutzstufe geändert')});
  return ev.filter(x=>x.t&&!isNaN(x.t)).sort((a,b)=>b.t-a.t);}
let ACT_FILTER='all',ACT_LIMIT=150;
const ACT_KINDS={all:T('Alle'),pw:T('Passwörter'),edit:T('Änderungen'),new:T('Neu'),move:T('Verschoben'),del:T('Gelöscht')};
function renderActivity(){const all=activityEvents();const list=all.filter(x=>ACT_FILTER==='all'||x.kind===ACT_FILTER||(ACT_FILTER==='new'&&x.kind==='group'));
  const day=d=>{const t=new Date();t.setHours(0,0,0,0);const x=new Date(d);x.setHours(0,0,0,0);const diff=Math.round((t-x)/DAY);return diff===0?T('Heute'):diff===1?T('Gestern'):x.toLocaleDateString(LOC,{weekday:'long',day:'numeric',month:'long',year:x.getFullYear()===t.getFullYear()?undefined:'numeric'});};
  const ic={new:'pkg',pw:'key',edit:'pen',move:'folderOpen',del:'trash',group:'folder',key:'lockdoc'};
  let h=`<div class="lhead"><h2>${T('Aktivität')}</h2></div><div class="actf">${Object.entries(ACT_KINDS).map(([k,l])=>`<button class="tplchip${ACT_FILTER===k?' on':''}" data-act="actF" data-k="${k}">${l}</button>`).join('')}</div>`;
  if(!list.length)h+=`<div class="empty"><b>${T('Keine Aktivität')}</b>${T('Für diesen Filter gibt es keine Einträge.')}</div>`;
  let last='';for(const x of list.slice(0,ACT_LIMIT)){const d=day(x.t);if(d!==last){h+=`<div class="actday">${d}</div>`;last=d;}
    const title=x.e?esc(str(x.e,'Title')||T('Ohne Titel')):x.g?esc(gName(x.g)):T('Datenbank');const time=x.t.toLocaleTimeString(LOC,{hour:'2-digit',minute:'2-digit'});
    h+=x.e&&x.e.parent?`<button class="eitem act" data-act="entry" data-uuid="${esc(uuidOf(x.e))}"><span class="acti k-${x.kind}">${kpSvg(0,ic[x.kind])}</span><span class="tx"><div class="t">${title}</div><div class="s">${esc(x.text)}</div></span><span class="actt">${time}</span></button>`
      :`<div class="eitem act static"><span class="acti k-${x.kind}">${kpSvg(0,ic[x.kind])}</span><span class="tx"><div class="t">${title}</div><div class="s">${esc(x.text)}</div></span><span class="actt">${time}</span></div>`;}
  if(list.length>ACT_LIMIT)h+=`<div style="padding:14px;text-align:center"><button class="btn" data-act="actMore">${T('Ältere anzeigen ({n})',{n:list.length-ACT_LIMIT})}</button></div>`;
  h+=`<p class="note" style="padding:6px 16px 20px">${T('Erzeugt aus Erstell-, Änderungs- und Verlaufsdaten der Datenbank. KeePass speichert nicht, auf welchem Gerät eine Änderung entstand.')}</p>`;
  $('list').innerHTML=h;}
const _renderList2=renderList;
renderList=function(){if(S.db&&S.group==='activity'&&!S.query.trim())return renderActivity();_renderList2();};
PSEUDO.push('activity');
const _renderGroups=renderGroups;
renderGroups=function(){_renderGroups();const rep=$('groups').querySelector('[data-act=report]');if(rep)rep.insertAdjacentHTML('beforebegin',`<button class="gitem${S.group==='activity'?' sel':''}" data-act="pseudo" data-g="activity">${kpSvg(0,'list')}<span class="nm">${T('Aktivität')}</span></button>`);};

document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b||!S.db)return;const a=b.dataset.act;
  if(a==='actF'){ACT_FILTER=b.dataset.k;ACT_LIMIT=150;renderActivity();}
  else if(a==='actMore'){ACT_LIMIT+=150;renderActivity();}
  else if(a==='polEdit'&&typeof S.group==='object')policyDialog(policyFor(S.group).from);});
