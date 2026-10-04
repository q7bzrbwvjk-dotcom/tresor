// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== Reine JS-Kryptografie als Ersatz, wenn crypto.subtle fehlt (z. B. bei http:// ohne TLS) =====
const JSC=(()=>{
  // --- SHA-256 ---
  const K256=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  function pad(d,blk,lenBytes){const l=d.length;const n=Math.ceil((l+1+lenBytes)/blk)*blk;const o=new Uint8Array(n);o.set(d);o[l]=0x80;const dv=new DataView(o.buffer);const bits=l*8;dv.setUint32(n-4,bits>>>0);dv.setUint32(n-8,Math.floor(bits/4294967296));return o;}
  function sha256(d){const m=pad(d,64,8);const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);const W=new Uint32Array(64);const dv=new DataView(m.buffer);
    for(let off=0;off<m.length;off+=64){for(let i=0;i<16;i++)W[i]=dv.getUint32(off+i*4);
      for(let i=16;i<64;i++){const a=W[i-15],b=W[i-2];W[i]=(((a>>>7|a<<25)^(a>>>18|a<<14)^(a>>>3))+W[i-7]+((b>>>17|b<<15)^(b>>>19|b<<13)^(b>>>10))+W[i-16])|0;}
      let a=H[0],b=H[1],c=H[2],d2=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for(let i=0;i<64;i++){const t1=(h+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&f)^(~e&g))+K256[i]+W[i])|0;const t2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+((a&b)^(a&c)^(b&c)))|0;h=g;g=f;f=e;e=(d2+t1)|0;d2=c;c=b;b=a;a=(t1+t2)|0;}
      H[0]+=a;H[1]+=b;H[2]+=c;H[3]+=d2;H[4]+=e;H[5]+=f;H[6]+=g;H[7]+=h;}
    const o=new Uint8Array(32);const ov=new DataView(o.buffer);for(let i=0;i<8;i++)ov.setUint32(i*4,H[i]);return o;}
  // --- SHA-1 (für TOTP) ---
  function sha1(d){const m=pad(d,64,8);const H=new Uint32Array([0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0]);const W=new Uint32Array(80);const dv=new DataView(m.buffer);
    for(let off=0;off<m.length;off+=64){for(let i=0;i<16;i++)W[i]=dv.getUint32(off+i*4);for(let i=16;i<80;i++){const x=W[i-3]^W[i-8]^W[i-14]^W[i-16];W[i]=x<<1|x>>>31;}
      let a=H[0],b=H[1],c=H[2],e2=H[3],e=H[4];
      for(let i=0;i<80;i++){const f=i<20?(b&c)|(~b&e2):i<40?b^c^e2:i<60?(b&c)|(b&e2)|(c&e2):b^c^e2;const k=i<20?0x5a827999:i<40?0x6ed9eba1:i<60?0x8f1bbcdc:0xca62c1d6;
        const t=((a<<5|a>>>27)+f+e+k+W[i])|0;e=e2;e2=c;c=b<<30|b>>>2;b=a;a=t;}
      H[0]+=a;H[1]+=b;H[2]+=c;H[3]+=e2;H[4]+=e;}
    const o=new Uint8Array(20);const ov=new DataView(o.buffer);for(let i=0;i<5;i++)ov.setUint32(i*4,H[i]);return o;}
  // --- SHA-512 (32-Bit-Paare) ---
  const K512=[0x428a2f98,0xd728ae22,0x71374491,0x23ef65cd,0xb5c0fbcf,0xec4d3b2f,0xe9b5dba5,0x8189dbbc,0x3956c25b,0xf348b538,0x59f111f1,0xb605d019,0x923f82a4,0xaf194f9b,0xab1c5ed5,0xda6d8118,0xd807aa98,0xa3030242,0x12835b01,0x45706fbe,0x243185be,0x4ee4b28c,0x550c7dc3,0xd5ffb4e2,0x72be5d74,0xf27b896f,0x80deb1fe,0x3b1696b1,0x9bdc06a7,0x25c71235,0xc19bf174,0xcf692694,0xe49b69c1,0x9ef14ad2,0xefbe4786,0x384f25e3,0x0fc19dc6,0x8b8cd5b5,0x240ca1cc,0x77ac9c65,0x2de92c6f,0x592b0275,0x4a7484aa,0x6ea6e483,0x5cb0a9dc,0xbd41fbd4,0x76f988da,0x831153b5,0x983e5152,0xee66dfab,0xa831c66d,0x2db43210,0xb00327c8,0x98fb213f,0xbf597fc7,0xbeef0ee4,0xc6e00bf3,0x3da88fc2,0xd5a79147,0x930aa725,0x06ca6351,0xe003826f,0x14292967,0x0a0e6e70,0x27b70a85,0x46d22ffc,0x2e1b2138,0x5c26c926,0x4d2c6dfc,0x5ac42aed,0x53380d13,0x9d95b3df,0x650a7354,0x8baf63de,0x766a0abb,0x3c77b2a8,0x81c2c92e,0x47edaee6,0x92722c85,0x1482353b,0xa2bfe8a1,0x4cf10364,0xa81a664b,0xbc423001,0xc24b8b70,0xd0f89791,0xc76c51a3,0x0654be30,0xd192e819,0xd6ef5218,0xd6990624,0x5565a910,0xf40e3585,0x5771202a,0x106aa070,0x32bbd1b8,0x19a4c116,0xb8d2d0c8,0x1e376c08,0x5141ab53,0x2748774c,0xdf8eeb99,0x34b0bcb5,0xe19b48a8,0x391c0cb3,0xc5c95a63,0x4ed8aa4a,0xe3418acb,0x5b9cca4f,0x7763e373,0x682e6ff3,0xd6b2b8a3,0x748f82ee,0x5defb2fc,0x78a5636f,0x43172f60,0x84c87814,0xa1f0ab72,0x8cc70208,0x1a6439ec,0x90befffa,0x23631e28,0xa4506ceb,0xde82bde9,0xbef9a3f7,0xb2c67915,0xc67178f2,0xe372532b,0xca273ece,0xea26619c,0xd186b8c7,0x21c0c207,0xeada7dd6,0xcde0eb1e,0xf57d4f7f,0xee6ed178,0x06f067aa,0x72176fba,0x0a637dc5,0xa2c898a6,0x113f9804,0xbef90dae,0x1b710b35,0x131c471b,0x28db77f5,0x23047d84,0x32caab7b,0x40c72493,0x3c9ebe0a,0x15c9bebc,0x431d67c4,0x9c100d4c,0x4cc5d4be,0xcb3e42b6,0x597f299c,0xfc657e2a,0x5fcb6fab,0x3ad6faec,0x6c44198c,0x4a475817];
  function sha512(d){const m=pad(d,128,16);const H=[0x6a09e667,0xf3bcc908,0xbb67ae85,0x84caa73b,0x3c6ef372,0xfe94f82b,0xa54ff53a,0x5f1d36f1,0x510e527f,0xade682d1,0x9b05688c,0x2b3e6c1f,0x1f83d9ab,0xfb41bd6b,0x5be0cd19,0x137e2179];
    const W=new Int32Array(160);const dv=new DataView(m.buffer);
    const add=(...p)=>{let lo=0,hi=0;for(let i=0;i<p.length;i+=2){lo+=p[i+1]>>>0;hi+=p[i]>>>0;}hi+=Math.floor(lo/4294967296);return [hi|0,lo|0];};
    const rotr=(h,l,n)=>n<32?[(h>>>n)|(l<<(32-n)),(l>>>n)|(h<<(32-n))]:[(l>>>(n-32))|(h<<(64-n)),(h>>>(n-32))|(l<<(64-n))];
    const shr=(h,l,n)=>[h>>>n,(l>>>n)|(h<<(32-n))];
    for(let off=0;off<m.length;off+=128){
      for(let i=0;i<32;i++)W[i]=dv.getUint32(off+i*4);
      for(let i=16;i<80;i++){const xh=W[(i-15)*2],xl=W[(i-15)*2+1],yh=W[(i-2)*2],yl=W[(i-2)*2+1];
        const a=rotr(xh,xl,1),b=rotr(xh,xl,8),c=shr(xh,xl,7);const s0h=a[0]^b[0]^c[0],s0l=a[1]^b[1]^c[1];
        const d1=rotr(yh,yl,19),e1=rotr(yh,yl,61),f1=shr(yh,yl,6);const s1h=d1[0]^e1[0]^f1[0],s1l=d1[1]^e1[1]^f1[1];
        const r=add(s1h,s1l,W[(i-7)*2],W[(i-7)*2+1],s0h,s0l,W[(i-16)*2],W[(i-16)*2+1]);W[i*2]=r[0];W[i*2+1]=r[1];}
      let [ah,al,bh,bl,ch,cl,dh,dl,eh,el,fh,fl,gh,gl,hh,hl]=H;
      for(let i=0;i<80;i++){const a1=rotr(eh,el,14),b1=rotr(eh,el,18),c1=rotr(eh,el,41);const S1h=a1[0]^b1[0]^c1[0],S1l=a1[1]^b1[1]^c1[1];
        const chh=(eh&fh)^(~eh&gh),chl=(el&fl)^(~el&gl);
        const t1=add(hh,hl,S1h,S1l,chh,chl,K512[i*2],K512[i*2+1],W[i*2],W[i*2+1]);
        const a2=rotr(ah,al,28),b2=rotr(ah,al,34),c2=rotr(ah,al,39);const S0h=a2[0]^b2[0]^c2[0],S0l=a2[1]^b2[1]^c2[1];
        const mjh=(ah&bh)^(ah&ch)^(bh&ch),mjl=(al&bl)^(al&cl)^(bl&cl);const t2=add(S0h,S0l,mjh,mjl);
        hh=gh;hl=gl;gh=fh;gl=fl;fh=eh;fl=el;[eh,el]=add(dh,dl,t1[0],t1[1]);dh=ch;dl=cl;ch=bh;cl=bl;bh=ah;bl=al;[ah,al]=add(t1[0],t1[1],t2[0],t2[1]);}
      const v=[ah,al,bh,bl,ch,cl,dh,dl,eh,el,fh,fl,gh,gl,hh,hl];for(let i=0;i<16;i+=2){const r=add(H[i],H[i+1],v[i],v[i+1]);H[i]=r[0];H[i+1]=r[1];}}
    const o=new Uint8Array(64);const ov=new DataView(o.buffer);for(let i=0;i<16;i++)ov.setUint32(i*4,H[i]>>>0);return o;}
  function hmac(hash,blk,key,data){if(key.length>blk)key=hash(key);const k=new Uint8Array(blk);k.set(key);const ip=new Uint8Array(blk+data.length),op=new Uint8Array(blk+(blk===128?64:hash===sha1?20:32));
    for(let i=0;i<blk;i++){ip[i]=k[i]^0x36;op[i]=k[i]^0x5c;}ip.set(data,blk);op.set(hash(ip),blk);return hash(op);}
  // --- AES (T-Tabellen) ---
  const SB=new Uint8Array(256),ISB=new Uint8Array(256);{let p=1,q=1;const r8=(x,s)=>((x<<s)|(x>>>(8-s)))&255;do{p=(p^(p<<1)^(p&0x80?0x1b:0))&255;q^=q<<1;q^=q<<2;q^=q<<4;q&=255;if(q&0x80)q^=0x09;const x=q^r8(q,1)^r8(q,2)^r8(q,3)^r8(q,4);SB[p]=x^0x63;}while(p!==1);SB[0]=0x63;for(let i=0;i<256;i++)ISB[SB[i]]=i;}
  const xt=x=>((x<<1)^(x&0x80?0x1b:0))&255;const mul=(a,b)=>{let r=0;while(b){if(b&1)r^=a;a=xt(a);b>>>=1;}return r;};
  const Te=[0,1,2,3].map(()=>new Uint32Array(256)),Td=[0,1,2,3].map(()=>new Uint32Array(256));
  for(let i=0;i<256;i++){const s=SB[i];const t=(mul(s,2)<<24|s<<16|s<<8|mul(s,3))>>>0;const is=ISB[i];const u=(mul(is,14)<<24|mul(is,9)<<16|mul(is,13)<<8|mul(is,11))>>>0;
    for(let j=0;j<4;j++){Te[j][i]=(t>>>(8*j)|t<<(32-8*j))>>>0;Td[j][i]=(u>>>(8*j)|u<<(32-8*j))>>>0;}}
  function expand(key){const nk=key.length/4,nr=nk+6;const w=new Uint32Array(4*(nr+1));const dv=new DataView(key.buffer,key.byteOffset,key.length);for(let i=0;i<nk;i++)w[i]=dv.getUint32(i*4);let rc=1;
    for(let i=nk;i<w.length;i++){let t=w[i-1];if(i%nk===0){t=(SB[t>>>16&255]<<24|SB[t>>>8&255]<<16|SB[t&255]<<8|SB[t>>>24])^(rc<<24);rc=xt(rc);}else if(nk>6&&i%nk===4)t=SB[t>>>24]<<24|SB[t>>>16&255]<<16|SB[t>>>8&255]<<8|SB[t&255];w[i]=w[i-nk]^t;}
    const d=new Uint32Array(w.length);for(let r=0;r<=nr;r++)for(let j=0;j<4;j++){const x=w[(nr-r)*4+j];d[r*4+j]=(r===0||r===nr)?x:(Td[0][SB[x>>>24]]^Td[1][SB[x>>>16&255]]^Td[2][SB[x>>>8&255]]^Td[3][SB[x&255]]);}
    return {w,d,nr};}
  function encBlock(k,s){const w=k.w,nr=k.nr;let a=s[0]^w[0],b=s[1]^w[1],c=s[2]^w[2],d=s[3]^w[3];const[T0,T1,T2,T3]=Te;let o=4;
    for(let r=1;r<nr;r++,o+=4){const a1=T0[a>>>24]^T1[b>>>16&255]^T2[c>>>8&255]^T3[d&255]^w[o],b1=T0[b>>>24]^T1[c>>>16&255]^T2[d>>>8&255]^T3[a&255]^w[o+1],c1=T0[c>>>24]^T1[d>>>16&255]^T2[a>>>8&255]^T3[b&255]^w[o+2],d1=T0[d>>>24]^T1[a>>>16&255]^T2[b>>>8&255]^T3[c&255]^w[o+3];a=a1;b=b1;c=c1;d=d1;}
    s[0]=(SB[a>>>24]<<24|SB[b>>>16&255]<<16|SB[c>>>8&255]<<8|SB[d&255])^w[o];s[1]=(SB[b>>>24]<<24|SB[c>>>16&255]<<16|SB[d>>>8&255]<<8|SB[a&255])^w[o+1];
    s[2]=(SB[c>>>24]<<24|SB[d>>>16&255]<<16|SB[a>>>8&255]<<8|SB[b&255])^w[o+2];s[3]=(SB[d>>>24]<<24|SB[a>>>16&255]<<16|SB[b>>>8&255]<<8|SB[c&255])^w[o+3];}
  function decBlock(k,s){const w=k.d,nr=k.nr;let a=s[0]^w[0],b=s[1]^w[1],c=s[2]^w[2],d=s[3]^w[3];const[T0,T1,T2,T3]=Td;let o=4;
    for(let r=1;r<nr;r++,o+=4){const a1=T0[a>>>24]^T1[d>>>16&255]^T2[c>>>8&255]^T3[b&255]^w[o],b1=T0[b>>>24]^T1[a>>>16&255]^T2[d>>>8&255]^T3[c&255]^w[o+1],c1=T0[c>>>24]^T1[b>>>16&255]^T2[a>>>8&255]^T3[d&255]^w[o+2],d1=T0[d>>>24]^T1[c>>>16&255]^T2[b>>>8&255]^T3[a&255]^w[o+3];a=a1;b=b1;c=c1;d=d1;}
    s[0]=(ISB[a>>>24]<<24|ISB[d>>>16&255]<<16|ISB[c>>>8&255]<<8|ISB[b&255])^w[o];s[1]=(ISB[b>>>24]<<24|ISB[a>>>16&255]<<16|ISB[d>>>8&255]<<8|ISB[c&255])^w[o+1];
    s[2]=(ISB[c>>>24]<<24|ISB[b>>>16&255]<<16|ISB[a>>>8&255]<<8|ISB[d&255])^w[o+2];s[3]=(ISB[d>>>24]<<24|ISB[c>>>16&255]<<16|ISB[b>>>8&255]<<8|ISB[a&255])^w[o+3];}
  function cbc(key,iv,data,encrypt){const k=expand(key);const s=new Uint32Array(4),prev=new Uint32Array(4),tmp=new Uint32Array(4);const ivv=new DataView(iv.buffer,iv.byteOffset,16);for(let i=0;i<4;i++)prev[i]=ivv.getUint32(i*4);
    if(encrypt){const p=16-data.length%16;const m=new Uint8Array(data.length+p);m.set(data);m.fill(p,data.length);const dv=new DataView(m.buffer);
      for(let off=0;off<m.length;off+=16){for(let i=0;i<4;i++)s[i]=dv.getUint32(off+i*4)^prev[i];encBlock(k,s);for(let i=0;i<4;i++){dv.setUint32(off+i*4,s[i]);prev[i]=s[i];}}return m;}
    if(data.length%16||!data.length)throw new Error('Ungültige Datenlänge');const m=new Uint8Array(data);const dv=new DataView(m.buffer);
    for(let off=0;off<m.length;off+=16){for(let i=0;i<4;i++){s[i]=dv.getUint32(off+i*4);tmp[i]=s[i];}decBlock(k,s);for(let i=0;i<4;i++){dv.setUint32(off+i*4,s[i]^prev[i]);prev[i]=tmp[i];}}
    const p=m[m.length-1];if(p<1||p>16)throw new Error('Entschlüsselung fehlgeschlagen');for(let i=m.length-p;i<m.length;i++)if(m[i]!==p)throw new Error('Entschlüsselung fehlgeschlagen');return m.slice(0,m.length-p);}
  async function aesKdf(seed,data,rounds,onProgress){const k=expand(seed);const out=new Uint8Array(32);const ov=new DataView(out.buffer);const dv=new DataView(data.buffer,data.byteOffset,32);
    for(let half=0;half<2;half++){const s=new Uint32Array(4);for(let i=0;i<4;i++)s[i]=dv.getUint32(half*16+i*4);let done=0;
      while(done<rounds){const n=Math.min(200000,rounds-done);for(let i=0;i<n;i++)encBlock(k,s);done+=n;if(onProgress)onProgress((half*rounds+done)/(2*rounds));await new Promise(r=>setTimeout(r,0));}
      for(let i=0;i<4;i++)ov.setUint32(half*16+i*4,s[i]);}
    return sha256(out);}
  return {sha256,sha512,sha1,hmac,cbc,aesKdf};
})();
const HAS_SUBTLE=!!(globalThis.crypto&&globalThis.crypto.subtle);
