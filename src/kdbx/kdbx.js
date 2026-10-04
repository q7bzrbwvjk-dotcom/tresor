// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== Minimaler XML-Baum (bewahrt unbekannte Elemente) =====
function xmlParse(s){
  const root={name:'#doc',attrs:{},children:[]};const stack=[root];let i=0;
  const ent=t=>t.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,(m,e)=>e==='amp'?'&':e==='lt'?'<':e==='gt'?'>':e==='quot'?'"':e==='apos'?"'":e[1]==='x'?String.fromCodePoint(parseInt(e.slice(2),16)):String.fromCodePoint(parseInt(e.slice(1),10)));
  if(s.charCodeAt(0)===0xFEFF)s=s.slice(1);
  while(i<s.length){
    const lt=s.indexOf('<',i);const top=stack[stack.length-1];
    if(lt<0){top.children.push(ent(s.slice(i)));break;}
    if(lt>i)top.children.push(ent(s.slice(i,lt)));
    if(s.startsWith('<?',lt)){i=s.indexOf('?>',lt)+2;continue;}
    if(s.startsWith('<!--',lt)){i=s.indexOf('-->',lt)+3;continue;}
    if(s.startsWith('<![CDATA[',lt)){const e=s.indexOf(']]>',lt);top.children.push(s.slice(lt+9,e));i=e+3;continue;}
    if(s.startsWith('<!',lt)){i=s.indexOf('>',lt)+1;continue;}
    if(s[lt+1]==='/'){const e=s.indexOf('>',lt);stack.pop();i=e+1;continue;}
    let j=lt+1;while(j<s.length&&!/[\s/>]/.test(s[j]))j++;
    const el={name:s.slice(lt+1,j),attrs:{},children:[],parent:top};
    const re=/\s*([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')|\s*(\/?)>/y;re.lastIndex=j;
    for(;;){const m=re.exec(s);if(!m)throw new Error('XML-Fehler bei '+j);if(m[1]){el.attrs[m[1]]=ent(m[3]!==undefined?m[3]:m[4]);}else{top.children.push(el);i=re.lastIndex;if(!m[5])stack.push(el);break;}}
  }
  const clean=n=>{if(n.children.some(c=>typeof c!=='string'))n.children=n.children.filter(c=>typeof c!=='string'||c.trim());for(const c of n.children)if(typeof c!=='string')clean(c);};
  clean(root);return root.children.find(c=>typeof c!=='string');
}
function xmlSerialize(root){
  const et=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const ea=t=>et(t).replace(/"/g,'&quot;').replace(/\n/g,'&#10;').replace(/\r/g,'&#13;').replace(/\t/g,'&#9;');
  const out=['<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n'];
  const w=(n,d)=>{const ind='\t'.repeat(d);let a='';for(const k in n.attrs)a+=` ${k}="${ea(n.attrs[k])}"`;
    if(!n.children.length){out.push(`${ind}<${n.name}${a} />\n`);return;}
    const els=n.children.some(c=>typeof c!=='string');
    if(!els){out.push(`${ind}<${n.name}${a}>${et(n.children.join(''))}</${n.name}>\n`);return;}
    out.push(`${ind}<${n.name}${a}>\n`);for(const c of n.children)if(typeof c!=='string')w(c,d+1);out.push(`${ind}</${n.name}>\n`);};
  w(root,0);return out.join('');
}
const X={
  kids:(n,name)=>n?n.children.filter(c=>typeof c!=='string'&&(!name||c.name===name)):[],
  kid:(n,name)=>n?n.children.find(c=>typeof c!=='string'&&c.name===name):undefined,
  text:n=>n?n.children.filter(c=>typeof c==='string').join(''):'',
  el:(name,text,attrs)=>({name,attrs:attrs||{},children:text===undefined||text===null||text===''?[]:[String(text)]}),
  setText(n,t){n.children=t===''||t==null?[]:[String(t)];},
  ensure(n,name,after){let c=X.kid(n,name);if(!c){c=X.el(name);X.append(n,c);}return c;},
  append(p,c){c.parent=p;p.children.push(c);return c;},
  insertAt(p,c,idx){c.parent=p;p.children.splice(idx,0,c);return c;},
  remove(c){const p=c.parent;if(!p)return;const i=p.children.indexOf(c);if(i>=0)p.children.splice(i,1);c.parent=null;},
  clone(n,parent){const c={name:n.name,attrs:{...n.attrs},children:[],parent};for(const ch of n.children)c.children.push(typeof ch==='string'?ch:X.clone(ch,c));return c;},
  walk(n,fn){for(const c of n.children)if(typeof c!=='string'){fn(c);X.walk(c,fn);}}
};

// ===== KDBX-Konstanten =====
const SIG1=0x9AA2D903,SIG2=0xB54BFB67;
const CIPHER_AES='31c1f2e6bf714350be5805216afc5aff',CIPHER_CHACHA='d6038a2b8b6f4cb5a524339a31dbb59a',CIPHER_TWOFISH='ad68f29f576f4bb9a36ad47af965346c';
const KDF_AES_KDBX3='7c02bb8279a74ac0927d114a00648238',KDF_AES='c9d9f39a628a4460bf740d08c18a4fea',KDF_ARGON2D='ef636ddf8c29444b91f7a9a403e30a0c',KDF_ARGON2ID='9e298b1956db4773b23dfc3ec6f0a1e6';
const SALSA_IV=new Uint8Array([0xE8,0x30,0x09,0x4B,0x97,0x20,0x5D,0x2A]);

function readVarDict(b){const dv=new DataView(b.buffer,b.byteOffset,b.length);let p=2;const d={};
  for(;;){const t=b[p++];if(t===0||p>=b.length)break;const kl=dv.getInt32(p,true);p+=4;const k=dec.decode(b.subarray(p,p+kl));p+=kl;const vl=dv.getInt32(p,true);p+=4;const vb=b.slice(p,p+vl);p+=vl;
    const vdv=new DataView(vb.buffer);let val;
    if(t===0x04)val=vdv.getUint32(0,true);else if(t===0x05)val=vdv.getUint32(0,true)+vdv.getUint32(4,true)*4294967296;else if(t===0x08)val=vb[0]!==0;else if(t===0x0C)val=vdv.getInt32(0,true);else if(t===0x0D)val=vdv.getUint32(0,true)+vdv.getInt32(4,true)*4294967296;else if(t===0x18)val=dec.decode(vb);else val=vb;
    d[k]={t,v:val};}
  return d;}
function writeVarDict(d){const parts=[new Uint8Array([0,1])];
  for(const k in d){const {t,v}=d[k];let vb;
    if(t===0x04)vb=u32le(v);else if(t===0x05||t===0x0D)vb=u64le(v);else if(t===0x08)vb=new Uint8Array([v?1:0]);else if(t===0x0C)vb=u32le(v>>>0);else if(t===0x18)vb=enc.encode(v);else vb=v;
    const kb=enc.encode(k);parts.push(new Uint8Array([t]),u32le(kb.length),kb,u32le(vb.length),vb);}
  parts.push(new Uint8Array([0]));return concat(...parts);}

async function compositeKey(password,keyFile){
  const parts=[];
  if(password||!keyFile)parts.push(await sha256(enc.encode(password||'')));
  if(keyFile){let kd=null;
    try{const s=dec.decode(keyFile);if(/<KeyFile/.test(s)){const x=xmlParse(s);const ver=X.text(X.kid(X.kid(x,'Meta'),'Version')).trim();const data=X.kid(X.kid(x,'Key'),'Data');kd=ver.startsWith('2')?unhex(X.text(data)):unb64(X.text(data));}}catch(e){}
    if(!kd){if(keyFile.length===32)kd=keyFile;else if(keyFile.length===64&&/^[0-9a-fA-F]{64}$/.test(dec.decode(keyFile)))kd=unhex(dec.decode(keyFile));else kd=await sha256(keyFile);}
    parts.push(kd);}
  return sha256(concat(...parts));}

async function runKdf(kdf,composite,onProgress){
  const uuid=hex(kdf.$UUID.v);
  if(uuid===KDF_AES||uuid===KDF_AES_KDBX3)return aesKdf(kdf.S.v,composite,kdf.R.v,onProgress);
  if(uuid===KDF_ARGON2D||uuid===KDF_ARGON2ID){
    const params={password:composite,salt:kdf.S.v,t:kdf.I.v,m:Math.floor(kdf.M.v/1024),p:kdf.P.v,len:32,type:uuid===KDF_ARGON2D?0:2,version:kdf.V?kdf.V.v:0x13};
    return argon2Run(params,onProgress);}
  throw new Error('Unbekannte Schlüsselableitung');}

function blockHmacKey(hk,idx){return sha512(concat(u64le(idx),hk));}

// ===== Lesen =====
async function kdbxOpen(file,password,keyFile,onProgress,compositeIn){
  const dv=new DataView(file.buffer,file.byteOffset,file.length);
  if(file.length<12||dv.getUint32(0,true)!==SIG1||dv.getUint32(4,true)!==SIG2)throw new Error('Das ist keine KeePass-Datenbank (.kdbx).');
  const minor=dv.getUint16(8,true),major=dv.getUint16(10,true);
  if(major<3||major>4)throw new Error(`KDBX-Version ${major}.${minor} wird nicht unterstützt.`);
  let p=12;const h={};const v4=major===4;
  for(;;){const id=file[p];const sz=v4?dv.getUint32(p+1,true):dv.getUint16(p+1,true);p+=v4?5:3;const d=file.slice(p,p+sz);p+=sz;if(id===0)break;h[id]=d;}
  const headerBytes=file.slice(0,p);
  const cipher=hex(h[2]);if(cipher===CIPHER_TWOFISH)throw new Error('Twofish-verschlüsselte Datenbanken werden nicht unterstützt. Bitte in KeePass auf AES oder ChaCha20 umstellen.');
  if(cipher!==CIPHER_AES&&cipher!==CIPHER_CHACHA)throw new Error('Unbekannte Verschlüsselung.');
  const compressed=new DataView(h[3].buffer).getUint32(0,true)===1;
  let kdf;
  if(v4)kdf=readVarDict(h[11]);
  else{const r=new DataView(h[6].buffer);kdf={$UUID:{t:0x42,v:unhex(KDF_AES_KDBX3)},S:{t:0x42,v:h[5]},R:{t:0x05,v:r.getUint32(0,true)+r.getUint32(4,true)*4294967296}};}
  const composite=compositeIn||await compositeKey(password,keyFile);
  const transformed=await runKdf(kdf,composite,onProgress);
  const db={major,minor,cipher,compressed,kdf,kdfRaw:h[11],publicCustom:h[12],transformed,composite};
  const masterSeed=h[4];const encKey=await sha256(concat(masterSeed,transformed));
  let plain,innerId,innerKey;
  const wrong=()=>new Error('Falsches Master-Passwort oder falsche Schlüsseldatei.');
  if(v4){
    const hk=await sha512(concat(masterSeed,transformed,new Uint8Array([1])));
    const storedHash=file.slice(p,p+32),storedHmac=file.slice(p+32,p+64);p+=64;
    if(!eqBytes(await sha256(headerBytes),storedHash))throw new Error('Der Dateikopf ist beschädigt.');
    if(!eqBytes(await hmac256(await sha512(concat(new Uint8Array(8).fill(255),hk)),headerBytes),storedHmac))throw wrong();
    const blocks=[];let i=0;
    for(;;){const mac=file.slice(p,p+32);const sz=dv.getUint32(p+32,true);const data=file.slice(p+36,p+36+sz);
      const calc=await hmac256(await blockHmacKey(hk,i),concat(u64le(i),u32le(sz),data));if(!eqBytes(calc,mac))throw new Error('Datenblock beschädigt.');
      p+=36+sz;i++;if(sz===0)break;blocks.push(data);}
    let ct=concat(...blocks);
    plain=cipher===CIPHER_AES?await aesCbc(encKey,h[7],ct,false):makeStream('chacha',encKey,h[7]).xor(ct);
    if(compressed)plain=await gunzip(plain);
    const pv=new DataView(plain.buffer,plain.byteOffset,plain.length);let q=0;db.binaries=[];
    for(;;){const id=plain[q];const sz=pv.getUint32(q+1,true);const d=plain.slice(q+5,q+5+sz);q+=5+sz;if(id===0)break;
      if(id===1)innerId=new DataView(d.buffer).getUint32(0,true);else if(id===2)innerKey=d;else if(id===3)db.binaries.push({flags:d[0],data:d.slice(1)});}
    plain=plain.subarray(q);
  }else{
    let pt;
    if(cipher===CIPHER_CHACHA)pt=makeStream('chacha',encKey,h[7]).xor(file.slice(p));
    else{try{pt=await aesCbc(encKey,h[7],file.slice(p),false);}catch(e){throw wrong();}}
    if(!eqBytes(pt.slice(0,32),h[9]))throw wrong();
    const bv=new DataView(pt.buffer,pt.byteOffset,pt.length);let q=32;const blocks=[];
    for(;;){const sz=bv.getUint32(q+36,true);const hs=pt.slice(q+4,q+36);const d=pt.slice(q+40,q+40+sz);q+=40+sz;if(sz===0)break;
      if(!eqBytes(await sha256(d),hs))throw new Error('Datenblock beschädigt.');blocks.push(d);}
    plain=concat(...blocks);if(compressed)plain=await gunzip(plain);
    innerId=new DataView(h[10].buffer).getUint32(0,true);innerKey=h[8];
  }
  const stream=await innerStream(innerId,innerKey);
  db.xml=xmlParse(dec.decode(plain));
  // geschützte Werte in Dokumentreihenfolge entschlüsseln
  X.walk(db.xml,n=>{if(n.attrs.Protected==='True'){const raw=unb64(X.text(n));const pl=stream.xor(raw);
    X.setText(n,n.name==='Value'?dec.decode(pl):b64(pl));n.attrs.Protected='True';}});
  return db;}

async function innerStream(id,key){
  if(id===2)return makeStream('salsa',await sha256(key),SALSA_IV);
  if(id===3){const h=await sha512(key);return makeStream('chacha',h.slice(0,32),h.slice(32,44));}
  if(id===0)return {xor:d=>d};
  throw new Error('Unbekannter innerer Stromschlüssel');}

// ===== Schreiben =====
async function kdbxSave(db){
  const v4=db.major===4;const masterSeed=rnd(32);
  const iv=rnd(db.cipher===CIPHER_CHACHA?12:16);
  const encKey=await sha256(concat(masterSeed,db.transformed));
  const innerKey=rnd(v4?64:32);const innerId=v4?3:2;
  const fld=(id,d)=>v4?concat(new Uint8Array([id]),u32le(d.length),d):concat(new Uint8Array([id]),new Uint8Array([d.length&255,d.length>>8]),d);
  const ver=new Uint8Array(4);new DataView(ver.buffer).setUint16(0,db.minor,true);new DataView(ver.buffer).setUint16(2,db.major,true);
  const parts=[u32le(SIG1),u32le(SIG2),ver,fld(2,unhex(db.cipher)),fld(3,u32le(db.compressed?1:0)),fld(4,masterSeed)];
  let streamStart;
  if(v4){parts.push(fld(7,iv),fld(11,db.kdfRaw||writeVarDict(db.kdf)));if(db.publicCustom)parts.push(fld(12,db.publicCustom));}
  else{streamStart=rnd(32);parts.push(fld(5,db.kdf.S.v),fld(6,u64le(db.kdf.R.v)),fld(7,iv),fld(8,innerKey),fld(9,streamStart),fld(10,u32le(innerId)));}
  parts.push(fld(0,new Uint8Array([13,10,13,10])));
  const header=concat(...parts);
  // XML mit verschlüsselten geschützten Werten erzeugen (Arbeitskopie)
  const xml=X.clone(db.xml,null);
  if(!v4){const meta=X.kid(xml,'Meta');const hh=X.kid(meta,'HeaderHash');if(hh)X.setText(hh,b64(await sha256(header)));}
  // Anhang-Speicher bereinigen: nur noch referenzierte Daten schreiben
  let binaries=db.binaries||[];
  {const refs=[];X.walk(xml,n=>{if(n.name==='Value'&&n.parent&&n.parent.name==='Binary'&&n.attrs.Ref!==undefined)refs.push(n);});
    const map=new Map();
    if(v4){const nb=[];for(const n of refs){const o=n.attrs.Ref;if(!map.has(o)&&binaries[+o]){map.set(o,String(nb.length));nb.push(binaries[+o]);}if(map.has(o))n.attrs.Ref=map.get(o);}binaries=nb;}
    else{const pool=X.kid(X.kid(xml,'Meta'),'Binaries');if(pool){let k=0;for(const n of refs){const o=n.attrs.Ref;if(!map.has(o))map.set(o,String(k++));n.attrs.Ref=map.get(o);}
      for(const b of X.kids(pool,'Binary')){if(map.has(b.attrs.ID))b.attrs.ID=map.get(b.attrs.ID);else X.remove(b);}
      pool.children.sort((a,b)=>(+a.attrs.ID)-(+b.attrs.ID));}}}
  const stream=await innerStream(innerId,innerKey);
  X.walk(xml,n=>{if(n.attrs.Protected==='True'){const t=X.text(n);const pl=n.name==='Value'?enc.encode(t):unb64(t);X.setText(n,b64(stream.xor(pl)));}});
  let payload=enc.encode(xmlSerialize(xml));
  if(v4){
    const ih=[new Uint8Array([1]),u32le(4),u32le(innerId),new Uint8Array([2]),u32le(innerKey.length),innerKey];
    for(const b of binaries)ih.push(new Uint8Array([3]),u32le(b.data.length+1),new Uint8Array([b.flags]),b.data);
    ih.push(new Uint8Array([0]),u32le(0));payload=concat(...ih,payload);
    if(db.compressed)payload=await gzip(payload);
    const ct=db.cipher===CIPHER_AES?await aesCbc(encKey,iv,payload,true):makeStream('chacha',encKey,iv).xor(payload);
    const hk=await sha512(concat(masterSeed,db.transformed,new Uint8Array([1])));
    const out=[header,await sha256(header),await hmac256(await sha512(concat(new Uint8Array(8).fill(255),hk)),header)];
    const BS=1<<20;let i=0;
    for(let off=0;;off+=BS,i++){const d=ct.subarray(off,Math.min(off+BS,ct.length));
      out.push(await hmac256(await blockHmacKey(hk,i),concat(u64le(i),u32le(d.length),d)),u32le(d.length),d);if(d.length===0)break;}
    return concat(...out);
  }else{
    if(db.compressed)payload=await gzip(payload);
    const blocks=[streamStart];const BS=1<<20;let i=0;
    for(let off=0;off<payload.length;off+=BS,i++){const d=payload.subarray(off,Math.min(off+BS,payload.length));blocks.push(u32le(i),await sha256(d),u32le(d.length),d);}
    blocks.push(u32le(i),new Uint8Array(32),u32le(0));
    const pt=concat(...blocks);
    const ct=db.cipher===CIPHER_AES?await aesCbc(encKey,iv,pt,true):makeStream('chacha',encKey,iv).xor(pt);
    return concat(header,ct);
  }}

// ===== Neue Datenbank =====
function newUuid(){return b64(rnd(16));}
function timeStr(db,date){date=date||new Date();
  if(db.major===4){const secs=Math.floor(date.getTime()/1000)+62135596800;return b64(u64le(secs));}
  return date.toISOString().replace(/\.\d{3}Z$/,'Z');}
function parseTime(db,s){if(!s)return null;if(/^\d{4}-/.test(s))return new Date(s);
  try{const b=unb64(s);if(b.length!==8)return null;const dv=new DataView(b.buffer);const secs=dv.getUint32(0,true)+dv.getUint32(4,true)*4294967296;return new Date((secs-62135596800)*1000);}catch(e){return null;}}
function timesEl(db){const t=timeStr(db);const T=X.el('Times');for(const [k,v] of [['CreationTime',t],['LastModificationTime',t],['LastAccessTime',t],['ExpiryTime',t],['Expires','False'],['UsageCount','0'],['LocationChanged',t]])X.append(T,X.el(k,v));return T;}
async function kdbxCreate(name,password,keyFile,onProgress,kdfIn){
  const db={major:4,minor:0,cipher:CIPHER_AES,compressed:true,binaries:[],
    kdf:kdfIn||{$UUID:{t:0x42,v:unhex(KDF_ARGON2D)},S:{t:0x42,v:rnd(32)},P:{t:0x04,v:2},M:{t:0x05,v:64*1024*1024},I:{t:0x05,v:8},V:{t:0x04,v:0x13}}};
  db.kdfRaw=writeVarDict(db.kdf);
  db.composite=await compositeKey(password,keyFile);db.transformed=await runKdf(db.kdf,db.composite,onProgress);
  const t=timeStr(db);const root=X.el('KeePassFile');
  const meta=X.append(root,X.el('Meta'));
  for(const [k,v] of [['Generator','Tresor'],['DatabaseName',name],['DatabaseNameChanged',t],['DatabaseDescription',''],['DefaultUserName',''],['MaintenanceHistoryDays','365'],['MasterKeyChanged',t]])X.append(meta,X.el(k,v));
  const mp=X.append(meta,X.el('MemoryProtection'));for(const [k,v] of [['ProtectTitle','False'],['ProtectUserName','False'],['ProtectPassword','True'],['ProtectURL','False'],['ProtectNotes','False']])X.append(mp,X.el(k,v));
  for(const [k,v] of [['RecycleBinEnabled','True'],['RecycleBinUUID','AAAAAAAAAAAAAAAAAAAAAA=='],['RecycleBinChanged',t],['EntryTemplatesGroup','AAAAAAAAAAAAAAAAAAAAAA=='],['EntryTemplatesGroupChanged',t],['HistoryMaxItems','10'],['HistoryMaxSize','6291456']])X.append(meta,X.el(k,v));
  const r=X.append(root,X.el('Root'));const g=X.append(r,X.el('Group'));
  for(const [k,v] of [['UUID',newUuid()],['Name',name],['Notes',''],['IconID','49']])X.append(g,X.el(k,v));
  X.append(g,timesEl(db));X.append(g,X.el('IsExpanded','True'));X.append(r,X.el('DeletedObjects'));
  db.xml=root;return db;}
