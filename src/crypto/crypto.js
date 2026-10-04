// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== Basis-Hilfen =====
const enc = new TextEncoder(), dec = new TextDecoder();
function concat(...arrs){let n=0;for(const a of arrs)n+=a.length;const o=new Uint8Array(n);let p=0;for(const a of arrs){o.set(a,p);p+=a.length;}return o;}
function u32le(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v,true);return b;}
function u64le(v){const b=new Uint8Array(8);const dv=new DataView(b.buffer);dv.setUint32(0,v%4294967296,true);dv.setUint32(4,Math.floor(v/4294967296),true);return b;}
function rnd(n){const b=new Uint8Array(n);crypto.getRandomValues(b);return b;}
function b64(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);}
function unb64(s){const t=atob(s.replace(/\s+/g,''));const u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u;}
function hex(u){return Array.from(u,x=>x.toString(16).padStart(2,'0')).join('');}
function unhex(s){s=s.replace(/\s+/g,'');const u=new Uint8Array(s.length/2);for(let i=0;i<u.length;i++)u[i]=parseInt(s.substr(i*2,2),16);return u;}
function eqBytes(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;}
async function sha256(d){if(!HAS_SUBTLE)return JSC.sha256(d);return new Uint8Array(await crypto.subtle.digest('SHA-256',d));}
async function sha512(d){if(!HAS_SUBTLE)return JSC.sha512(d);return new Uint8Array(await crypto.subtle.digest('SHA-512',d));}
async function hmac256(key,data){if(!HAS_SUBTLE)return JSC.hmac(JSC.sha256,64,key,data);const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data));}
async function aesCbc(key,iv,data,encrypt){if(!HAS_SUBTLE)return JSC.cbc(key,iv,data,encrypt);const k=await crypto.subtle.importKey('raw',key,{name:'AES-CBC'},false,[encrypt?'encrypt':'decrypt']);return new Uint8Array(await crypto.subtle[encrypt?'encrypt':'decrypt']({name:'AES-CBC',iv},k,data));}
// AES-KDF: n-faches AES-ECB per CBC-Trick (Nullblöcke nach dem Startblock => letzte Chiffre = E^n(x))
async function aesKdf(seed,data,rounds,onProgress){
  if(!HAS_SUBTLE)return JSC.aesKdf(seed,data,rounds,onProgress);
  const k=await crypto.subtle.importKey('raw',seed,{name:'AES-CBC'},false,['encrypt']);
  const out=new Uint8Array(32);const CH=1<<20;
  for(let half=0;half<2;half++){
    let st=data.slice(half*16,half*16+16);let left=rounds;
    while(left>0){const n=Math.min(left,CH);const pt=new Uint8Array(n*16);pt.set(st,0);
      const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:new Uint8Array(16)},k,pt));
      st=ct.slice((n-1)*16,n*16);left-=n;
      if(onProgress)onProgress((half*rounds+(rounds-left))/(2*rounds));}
    out.set(st,half*16);}
  return sha256(out);
}
async function gzip(d){return new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());}
async function gunzip(d){return new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}

// ===== Stromchiffren =====
function rotl(v,c){return (v<<c)|(v>>>(32-c));}
function chachaBlock(st,out){const x=st.slice();
  const QR=(a,b,c,d)=>{x[a]+=x[b];x[d]=rotl(x[d]^x[a],16);x[c]+=x[d];x[b]=rotl(x[b]^x[c],12);x[a]+=x[b];x[d]=rotl(x[d]^x[a],8);x[c]+=x[d];x[b]=rotl(x[b]^x[c],7);};
  for(let i=0;i<10;i++){QR(0,4,8,12);QR(1,5,9,13);QR(2,6,10,14);QR(3,7,11,15);QR(0,5,10,15);QR(1,6,11,12);QR(2,7,8,13);QR(3,4,9,14);}
  for(let i=0;i<16;i++)out[i]=x[i]+st[i];}
function salsaBlock(st,out){const x=st.slice();
  const QR=(a,b,c,d)=>{x[b]^=rotl(x[a]+x[d],7);x[c]^=rotl(x[b]+x[a],9);x[d]^=rotl(x[c]+x[b],13);x[a]^=rotl(x[d]+x[c],18);};
  for(let i=0;i<10;i++){QR(0,4,8,12);QR(5,9,13,1);QR(10,14,2,6);QR(15,3,7,11);QR(0,1,2,3);QR(5,6,7,4);QR(10,11,8,9);QR(15,12,13,14);}
  for(let i=0;i<16;i++)out[i]=x[i]+st[i];}
// Gemeinsamer Keystream-Generator; xor(data) verbraucht fortlaufend
function makeStream(kind,key,nonce){
  const st=new Uint32Array(16);const kv=new DataView(key.buffer,key.byteOffset,32);const nv=new DataView(nonce.buffer,nonce.byteOffset,nonce.length);
  const C=[0x61707865,0x3320646e,0x79622d32,0x6b206574];let ctr;
  if(kind==='chacha'){st.set(C,0);for(let i=0;i<8;i++)st[4+i]=kv.getUint32(i*4,true);st[12]=0;for(let i=0;i<3;i++)st[13+i]=nv.getUint32(i*4,true);ctr=()=>{st[12]++;};}
  else{st[0]=C[0];st[5]=C[1];st[10]=C[2];st[15]=C[3];for(let i=0;i<4;i++){st[1+i]=kv.getUint32(i*4,true);st[11+i]=kv.getUint32(16+i*4,true);}st[6]=nv.getUint32(0,true);st[7]=nv.getUint32(4,true);st[8]=0;st[9]=0;ctr=()=>{st[8]++;if(st[8]===0)st[9]++;};}
  const blk=new Uint32Array(16);const bb=new Uint8Array(blk.buffer);let pos=64;const fn=kind==='chacha'?chachaBlock:salsaBlock;
  return {xor(d){const o=new Uint8Array(d.length);for(let i=0;i<d.length;i++){if(pos===64){fn(st,blk);ctr();pos=0;}o[i]=d[i]^bb[pos++];}return o;}};
}
