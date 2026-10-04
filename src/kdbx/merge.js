// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== Zusammenführen zweier Datenbanken (nach UUID und Änderungszeit, wie KeePassXC) =====
const TIME_KEYS=new Set(['CreationTime','LastModificationTime','LastAccessTime','ExpiryTime','LocationChanged','DeletionTime']);
async function binaryDataOf(db,ref){
  if(db.major===4){const b=(db.binaries||[])[+ref];return b?b.data:null;}
  const mb=X.kids(X.kid(X.kid(db.xml,'Meta'),'Binaries'),'Binary').find(x=>x.attrs.ID===String(ref));if(!mb)return null;
  let d=unb64(X.text(mb));if(mb.attrs.Compressed==='True')d=await gunzip(d);return d;}
async function binaryAdd(db,data){
  if(db.major===4){db.binaries=db.binaries||[];db.binaries.push({flags:0,data});return String(db.binaries.length-1);}
  const meta=X.kid(db.xml,'Meta');const pool=X.ensure(meta,'Binaries');const ids=X.kids(pool,'Binary').map(b=>+b.attrs.ID);const ref=String(ids.length?Math.max(...ids)+1:0);
  X.append(pool,X.el('Binary',b64(await gzip(data)),{ID:ref,Compressed:'True'}));return ref;}
async function mergeDb(local,other){
  const st={added:0,updated:0,deleted:0,groups:0,moved:0};
  const U=el=>X.text(X.kid(el,'UUID'));
  const lroot=X.kid(X.kid(local.xml,'Root'),'Group'),oroot=X.kid(X.kid(other.xml,'Root'),'Group');
  const tm=(db,el,k)=>{const d=parseTime(db,X.text(X.kid(X.kid(el,'Times'),k)));return d?d.getTime():0;};
  const lE=new Map(),lG=new Map();
  (function idx(g){lG.set(U(g),g);for(const e of X.kids(g,'Entry'))lE.set(U(e),e);for(const c of X.kids(g,'Group'))idx(c);})(lroot);
  lG.set(U(oroot),lroot);
  const delMap=db=>{const m=new Map();for(const d of X.kids(X.kid(X.kid(db.xml,'Root'),'DeletedObjects'),'DeletedObject')){const t=parseTime(db,X.text(X.kid(d,'DeletionTime')));m.set(X.text(X.kid(d,'UUID')),t?t.getTime():0);}return m;};
  const lDel=delMap(local),oDel=delMap(other);
  const binMap=new Map();const lMeta=X.kid(local.xml,'Meta'),oMeta=X.kid(other.xml,'Meta');
  async function importEl(el){
    const c=X.clone(el,null);
    const conv=n=>{if(TIME_KEYS.has(n.name)&&local.major!==other.major){const d=parseTime(other,X.text(n));if(d)X.setText(n,timeStr(local,d));}for(const ch of X.kids(n))conv(ch);};conv(c);
    const vals=[];X.walk(c,n=>{if(n.name==='Value'&&n.parent&&n.parent.name==='Binary'&&n.attrs.Ref!==undefined)vals.push(n);});
    for(const v of vals){const o=v.attrs.Ref;if(!binMap.has(o)){const d=await binaryDataOf(other,o);binMap.set(o,d?await binaryAdd(local,d):null);}
      if(binMap.get(o)!==null)v.attrs.Ref=binMap.get(o);else X.remove(v.parent);}
    const icons=[];X.walk(c,n=>{if(n.name==='CustomIconUUID')icons.push(X.text(n));});if(c.name==='Group'||c.name==='Entry'){const ci=X.kid(c,'CustomIconUUID');if(ci)icons.push(X.text(ci));}
    for(const iu of icons){if(!iu||/^A+=*$/.test(iu))continue;const lci=X.ensure(lMeta,'CustomIcons');
      if(!X.kids(lci,'Icon').some(i=>X.text(X.kid(i,'UUID'))===iu)){const oi=X.kids(X.kid(oMeta,'CustomIcons'),'Icon').find(i=>X.text(X.kid(i,'UUID'))===iu);if(oi)X.append(lci,X.clone(oi,null));}}
    return c;}
  const isUnder=(g,anc)=>{for(let p=g;p;p=p.parent)if(p===anc)return true;return false;};
  async function ensureGroup(og){
    const u=U(og);if(lG.has(u))return lG.get(u);
    const lp=await ensureGroup(og.parent);
    const shallow={...og,children:og.children.filter(c=>typeof c==='string'||(c.name!=='Entry'&&c.name!=='Group'))};
    const ng=await importEl(shallow);X.append(lp,ng);lG.set(u,ng);st.groups++;return ng;}
  const insertE=(g,e)=>{const fg=g.children.find(c=>typeof c!=='string'&&c.name==='Group');if(fg)X.insertAt(g,e,g.children.indexOf(fg));else X.append(g,e);};
  const maxHist=parseInt(X.text(X.kid(lMeta,'HistoryMaxItems'))||'10',10);
  // Gruppen
  const oGroups=[];(function w(g){for(const c of X.kids(g,'Group')){oGroups.push(c);w(c);}})(oroot);
  const skipped=new Set();
  for(const og of oGroups){const u=U(og);
    if(skipped.has(og.parent)){skipped.add(og);continue;}
    if(!lG.has(u)){if(lDel.has(u)&&lDel.get(u)>=tm(other,og,'LastModificationTime')){skipped.add(og);continue;}await ensureGroup(og);continue;}
    const lg=lG.get(u);
    if(tm(other,og,'LastModificationTime')>tm(local,lg,'LastModificationTime')){for(const k of ['Name','Notes','IconID','CustomIconUUID','Times']){const oc=X.kid(og,k);if(!oc)continue;const nc=await importEl(oc);const lc=X.kid(lg,k);if(lc){const i=lg.children.indexOf(lc);lg.children[i]=nc;nc.parent=lg;}else X.append(lg,nc);}}
    const lpar=lG.get(U(og.parent))||lroot;
    if(lg!==lroot&&lg.parent!==lpar&&tm(other,og,'LocationChanged')>tm(local,lg,'LocationChanged')&&!isUnder(lpar,lg)){X.remove(lg);X.append(lpar,lg);st.moved++;}}
  // Einträge
  const oEntries=[];(function w(g){if(skipped.has(g))return;for(const e of X.kids(g,'Entry'))oEntries.push(e);for(const c of X.kids(g,'Group'))w(c);})(oroot);
  const histUnion=(list)=>{const m=new Map();for(const h of list){const k=tm(local,h,'LastModificationTime');if(!m.has(k))m.set(k,h);}return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);};
  for(const oe of oEntries){const u=U(oe);const le=lE.get(u);
    if(!le){if(lDel.has(u)&&lDel.get(u)>=tm(other,oe,'LastModificationTime'))continue;
      const g=await ensureGroup(oe.parent);const ne=await importEl(oe);insertE(g,ne);lE.set(u,ne);st.added++;continue;}
    const lm=tm(local,le,'LastModificationTime'),om=tm(other,oe,'LastModificationTime');
    const oHist=[];for(const h of X.kids(X.kid(oe,'History'),'Entry'))oHist.push(await importEl(h));
    const lHist=X.kids(X.kid(le,'History'),'Entry');
    let target=le,extra=[];
    if(om>lm){const ne=await importEl(oe);const cur=X.clone(le,null);const ch=X.kid(cur,'History');if(ch)X.remove(ch);extra.push(cur);
      const p=le.parent;const i=p.children.indexOf(le);p.children[i]=ne;ne.parent=p;le.parent=null;target=ne;lE.set(u,ne);st.updated++;}
    else if(om<lm){const oc=await importEl(oe);const ch=X.kid(oc,'History');if(ch)X.remove(ch);extra.push(oc);}
    const all=histUnion([...lHist,...oHist,...extra]).filter(h=>tm(local,h,'LastModificationTime')!==tm(local,target,'LastModificationTime'));
    const H=X.ensure(target,'History');H.children=[];for(const h of (maxHist>=0?all.slice(-maxHist):all))X.append(H,h);
    const lpar=lG.get(U(oe.parent));
    if(lpar&&target.parent!==lpar&&tm(other,oe,'LocationChanged')>tm(local,target,'LocationChanged')){X.remove(target);insertE(lpar,target);st.moved++;}}
  // Löschungen aus der anderen Datei übernehmen
  const lDelRoot=X.ensure(X.kid(local.xml,'Root'),'DeletedObjects');
  for(const [u,t] of oDel){const le=lE.get(u);
    if(le&&le.parent&&tm(local,le,'LastModificationTime')<=t){X.remove(le);st.deleted++;}
    const lg=lG.get(u);if(lg&&lg!==lroot&&lg.parent&&tm(local,lg,'LastModificationTime')<=t&&!X.kids(lg,'Entry').length&&!X.kids(lg,'Group').length){X.remove(lg);}
    if(!lDel.has(u)){const d=X.el('DeletedObject');X.append(d,X.el('UUID',u));X.append(d,X.el('DeletionTime',timeStr(local,new Date(t))));X.append(lDelRoot,d);}}
  return st;}
