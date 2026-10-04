// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== BLAKE2b + Argon2 (d/id, v1.3) – reines JS, 64-Bit als Paare von 32-Bit-Wörtern =====
function argon2Factory(){
  const IV=new Uint32Array([0xf3bcc908,0x6a09e667,0x84caa73b,0xbb67ae85,0xfe94f82b,0x3c6ef372,0x5f1d36f1,0xa54ff53a,0xade682d1,0x510e527f,0x2b3e6c1f,0x9b05688c,0xfb41bd6b,0x1f83d9ab,0x137e2179,0x5be0cd19]);
  const SIG=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3,11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4,7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8,9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13,2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9,12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11,13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10,6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5,10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0];
  const v=new Uint32Array(32),m=new Uint32Array(32);
  function add64(a,b){const lo=v[a]+v[b];let hi=v[a+1]+v[b+1];if(lo>=4294967296)hi++;v[a]=lo;v[a+1]=hi;}
  function add64m(a,i){const lo=v[a]+m[i];let hi=v[a+1]+m[i+1];if(lo>=4294967296)hi++;v[a]=lo;v[a+1]=hi;}
  function B2G(a,b,c,d,x,y){add64(a,b);add64m(a,x);
    let xl=v[d]^v[a],xh=v[d+1]^v[a+1];v[d]=xh;v[d+1]=xl;
    add64(c,d);xl=v[b]^v[c];xh=v[b+1]^v[c+1];v[b]=(xl>>>24)|(xh<<8);v[b+1]=(xh>>>24)|(xl<<8);
    add64(a,b);add64m(a,y);xl=v[d]^v[a];xh=v[d+1]^v[a+1];v[d]=(xl>>>16)|(xh<<16);v[d+1]=(xh>>>16)|(xl<<16);
    add64(c,d);xl=v[b]^v[c];xh=v[b+1]^v[c+1];v[b]=(xh>>>31)|(xl<<1);v[b+1]=(xl>>>31)|(xh<<1);}
  function compress(h,blk,t,last){
    for(let i=0;i<16;i++){v[i]=h[i];v[i+16]=IV[i];}
    v[24]^=t;v[25]^=(t/4294967296)>>>0;if(last){v[28]=~v[28];v[29]=~v[29];}
    for(let i=0;i<32;i++)m[i]=blk[i*4]|(blk[i*4+1]<<8)|(blk[i*4+2]<<16)|(blk[i*4+3]<<24);
    for(let r=0;r<12;r++){const s=(r%10)*16;
      B2G(0,8,16,24,SIG[s]*2,SIG[s+1]*2);B2G(2,10,18,26,SIG[s+2]*2,SIG[s+3]*2);B2G(4,12,20,28,SIG[s+4]*2,SIG[s+5]*2);B2G(6,14,22,30,SIG[s+6]*2,SIG[s+7]*2);
      B2G(0,10,20,30,SIG[s+8]*2,SIG[s+9]*2);B2G(2,12,22,24,SIG[s+10]*2,SIG[s+11]*2);B2G(4,14,16,26,SIG[s+12]*2,SIG[s+13]*2);B2G(6,8,18,28,SIG[s+14]*2,SIG[s+15]*2);}
    for(let i=0;i<16;i++)h[i]^=v[i]^v[i+16];}
  function blake2b(input,outlen){
    const h=new Uint32Array(IV);h[0]^=0x01010000^outlen;
    const blk=new Uint8Array(128);let t=0,off=0;
    while(input.length-off>128){blk.set(input.subarray(off,off+128));t+=128;compress(h,blk,t,false);off+=128;}
    blk.fill(0);blk.set(input.subarray(off));t+=input.length-off;compress(h,blk,t,true);
    const o=new Uint8Array(64);for(let i=0;i<16;i++){o[i*4]=h[i];o[i*4+1]=h[i]>>>8;o[i*4+2]=h[i]>>>16;o[i*4+3]=h[i]>>>24;}
    return o.slice(0,outlen);}
  function le32(x){return new Uint8Array([x&255,(x>>>8)&255,(x>>>16)&255,(x>>>24)&255]);}
  function cat(...a){let n=0;for(const x of a)n+=x.length;const o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;}
  function Hprime(x,T){
    if(T<=64)return blake2b(cat(le32(T),x),T);
    const r=Math.ceil(T/32)-2;const out=new Uint8Array(T);let V=blake2b(cat(le32(T),x),64);out.set(V.subarray(0,32),0);
    for(let i=1;i<r;i++){V=blake2b(V,64);out.set(V.subarray(0,32),i*32);}
    V=blake2b(V,T-32*r);out.set(V,r*32);return out;}
  // --- Argon2-Kompression G: 256 u32 pro Block (128 u64) ---
  const R=new Uint32Array(256),Z=new Uint32Array(256);
  function mulAdd(a,b){ // Z[a]+=Z[b]+2*lo(a)*lo(b)  (64-Bit)
    const x=Z[a],y=Z[b];
    const xl=x&0xffff,xh=x>>>16,yl=y&0xffff,yh=y>>>16;
    const ll=xl*yl,lh=xl*yh,hl=xh*yl,hh=xh*yh;
    const mid=(ll>>>16)+(lh&0xffff)+(hl&0xffff);
    let plo=((mid&0xffff)<<16|(ll&0xffff))>>>0;
    let phi=hh+(lh>>>16)+(hl>>>16)+(mid>>>16);
    // *2
    phi=((phi<<1)|(plo>>>31))>>>0;plo=(plo<<1)>>>0;
    let lo=x+y,hi=Z[a+1]+Z[b+1];if(lo>=4294967296){lo-=4294967296;hi++;}
    lo+=plo;if(lo>=4294967296){lo-=4294967296;hi++;}
    Z[a]=lo;Z[a+1]=hi+phi;}
  function GB(a,b,c,d){
    mulAdd(a,b);let xl=Z[d]^Z[a],xh=Z[d+1]^Z[a+1];Z[d]=xh;Z[d+1]=xl;
    mulAdd(c,d);xl=Z[b]^Z[c];xh=Z[b+1]^Z[c+1];Z[b]=(xl>>>24)|(xh<<8);Z[b+1]=(xh>>>24)|(xl<<8);
    mulAdd(a,b);xl=Z[d]^Z[a];xh=Z[d+1]^Z[a+1];Z[d]=(xl>>>16)|(xh<<16);Z[d+1]=(xh>>>16)|(xl<<16);
    mulAdd(c,d);xl=Z[b]^Z[c];xh=Z[b+1]^Z[c+1];Z[b]=(xh>>>31)|(xl<<1);Z[b+1]=(xl>>>31)|(xh<<1);}
  function P(i0,i1,i2,i3,i4,i5,i6,i7,i8,i9,i10,i11,i12,i13,i14,i15){
    GB(i0,i4,i8,i12);GB(i1,i5,i9,i13);GB(i2,i6,i10,i14);GB(i3,i7,i11,i15);
    GB(i0,i5,i10,i15);GB(i1,i6,i11,i12);GB(i2,i7,i8,i13);GB(i3,i4,i9,i14);}
  // mem: Uint32Array; xo,yo,outo: Offsets in u32; withXor: Ergebnis zusätzlich mit altem Inhalt xoren
  function fillBlock(X,xo,Y,yo,O,oo,withXor){
    for(let i=0;i<256;i++){R[i]=X[xo+i]^Y[yo+i];Z[i]=R[i];}
    for(let i=0;i<8;i++){const b=i*32;P(b,b+2,b+4,b+6,b+8,b+10,b+12,b+14,b+16,b+18,b+20,b+22,b+24,b+26,b+28,b+30);}
    for(let i=0;i<8;i++){const b=i*4;P(b,b+2,b+32,b+34,b+64,b+66,b+96,b+98,b+128,b+130,b+160,b+162,b+192,b+194,b+224,b+226);}
    if(withXor)for(let i=0;i<256;i++)O[oo+i]^=Z[i]^R[i];else for(let i=0;i<256;i++)O[oo+i]=Z[i]^R[i];}
  function mulhi(a,b){const al=a&0xffff,ah=a>>>16,bl=b&0xffff,bh=b>>>16;const ll=al*bl,lh=al*bh,hl=ah*bl,hh=ah*bh;const mid=(ll>>>16)+(lh&0xffff)+(hl&0xffff);return (hh+(lh>>>16)+(hl>>>16)+(mid>>>16))>>>0;}
  function argon2({password,salt,secret=new Uint8Array(0),ad=new Uint8Array(0),t,m,p,len=32,type=0,version=0x13,onProgress}){
    const H0=blake2b(cat(le32(p),le32(len),le32(m),le32(t),le32(version),le32(type),le32(password.length),password,le32(salt.length),salt,le32(secret.length),secret,le32(ad.length),ad),64);
    const mBlocks=4*p*Math.floor(m/(4*p));const laneLen=mBlocks/p;const segLen=laneLen/4;
    const mem=new Uint32Array(mBlocks*256);
    const toWords=(b,off)=>{for(let i=0;i<256;i++)mem[off+i]=b[i*4]|(b[i*4+1]<<8)|(b[i*4+2]<<16)|(b[i*4+3]<<24);};
    for(let l=0;l<p;l++){toWords(Hprime(cat(H0,le32(0),le32(l)),1024),(l*laneLen)*256);toWords(Hprime(cat(H0,le32(1),le32(l)),1024),(l*laneLen+1)*256);}
    const zero=new Uint32Array(256),input=new Uint32Array(256),addr=new Uint32Array(256);
    const total=t*4*p;let done=0;
    for(let pass=0;pass<t;pass++)for(let sl=0;sl<4;sl++){for(let lane=0;lane<p;lane++){
      const indep=type===1||(type===2&&pass===0&&sl<2);
      if(indep){input.fill(0);input[0]=pass;input[2]=lane;input[4]=sl;input[6]=mBlocks;input[8]=t;input[10]=type;}
      const nextAddr=()=>{input[12]++;fillBlock(zero,0,input,0,addr,0,false);fillBlock(zero,0,addr,0,addr,0,false);};
      let start=0;if(pass===0&&sl===0){start=2;if(indep)nextAddr();}
      let cur=lane*laneLen+sl*segLen+start;let prev=(cur%laneLen===0)?cur+laneLen-1:cur-1;
      for(let i=start;i<segLen;i++,cur++,prev++){
        if(cur%laneLen===1)prev=cur-1;
        let J1,J2;
        if(indep){if(i%128===0)nextAddr();J1=addr[(i%128)*2];J2=addr[(i%128)*2+1];}
        else{J1=mem[prev*256];J2=mem[prev*256+1];}
        let refLane=J2%p;if(pass===0&&sl===0)refLane=lane;
        const same=refLane===lane;let area;
        if(pass===0){if(sl===0)area=i-1;else if(same)area=sl*segLen+i-1;else area=sl*segLen+(i===0?-1:0);}
        else{if(same)area=laneLen-segLen+i-1;else area=laneLen-segLen+(i===0?-1:0);}
        const x=mulhi(J1,J1);const rel=area-1-mulhi(area,x);
        const startPos=pass!==0?(sl===3?0:(sl+1)*segLen):0;
        const ref=refLane*laneLen+(startPos+rel)%laneLen;
        fillBlock(mem,prev*256,mem,ref*256,mem,cur*256,pass!==0);
      }
      done++;if(onProgress)onProgress(done/total);}}
    const C=new Uint32Array(256);for(let l=0;l<p;l++){const o=(l*laneLen+laneLen-1)*256;for(let i=0;i<256;i++)C[i]^=mem[o+i];}
    const cb=new Uint8Array(1024);for(let i=0;i<256;i++){cb[i*4]=C[i];cb[i*4+1]=C[i]>>>8;cb[i*4+2]=C[i]>>>16;cb[i*4+3]=C[i]>>>24;}
    return Hprime(cb,len);}
  // --- WebAssembly-Pfad: gleiche Logik, Blockfunktion G nativ in 64 Bit ---
  const WASM_B64='AGFzbQEAAAABGwJgBH9/f38AYBB/f39/f39/f39/f39/f39/AAIMAQNlbnYDbWVtAgABAwQDAAEABwgBBGZpbGwAAgrUCQPcAQEEfiAAKQMAIQQgASkDACEFIAIpAwAhBiADKQMAIQcgBCAFfCAEQv////8PgyAFQv////8Pg35CAYZ8IQQgByAEhUIgiiEHIAYgB3wgBkL/////D4MgB0L/////D4N+QgGGfCEGIAUgBoVCGIohBSAEIAV8IARC/////w+DIAVC/////w+DfkIBhnwhBCAHIASFQhCKIQcgBiAHfCAGQv////8PgyAHQv////8Pg35CAYZ8IQYgBSAGhUI/iiEFIAAgBDcDACABIAU3AwAgAiAGNwMAIAMgBzcDAAtSACAAIAQgCCAMEAAgASAFIAkgDRAAIAIgBiAKIA4QACADIAcgCyAPEAAgACAFIAogDxAAIAEgBiALIAwQACACIAcgCCANEAAgAyAEIAkgDhAAC6AHAgF/AX5BACEEA0AgACAEaikDACABIARqKQMAhSEFIAQgBTcDACAEQYAIaiAFNwMAIARBCGoiBEGACEkNAAtBgAhBiAhBkAhBmAhBoAhBqAhBsAhBuAhBwAhByAhB0AhB2AhB4AhB6AhB8AhB+AgQAUGACUGICUGQCUGYCUGgCUGoCUGwCUG4CUHACUHICUHQCUHYCUHgCUHoCUHwCUH4CRABQYAKQYgKQZAKQZgKQaAKQagKQbAKQbgKQcAKQcgKQdAKQdgKQeAKQegKQfAKQfgKEAFBgAtBiAtBkAtBmAtBoAtBqAtBsAtBuAtBwAtByAtB0AtB2AtB4AtB6AtB8AtB+AsQAUGADEGIDEGQDEGYDEGgDEGoDEGwDEG4DEHADEHIDEHQDEHYDEHgDEHoDEHwDEH4DBABQYANQYgNQZANQZgNQaANQagNQbANQbgNQcANQcgNQdANQdgNQeANQegNQfANQfgNEAFBgA5BiA5BkA5BmA5BoA5BqA5BsA5BuA5BwA5ByA5B0A5B2A5B4A5B6A5B8A5B+A4QAUGAD0GID0GQD0GYD0GgD0GoD0GwD0G4D0HAD0HID0HQD0HYD0HgD0HoD0HwD0H4DxABQYAIQYgIQYAJQYgJQYAKQYgKQYALQYgLQYAMQYgMQYANQYgNQYAOQYgOQYAPQYgPEAFBkAhBmAhBkAlBmAlBkApBmApBkAtBmAtBkAxBmAxBkA1BmA1BkA5BmA5BkA9BmA8QAUGgCEGoCEGgCUGoCUGgCkGoCkGgC0GoC0GgDEGoDEGgDUGoDUGgDkGoDkGgD0GoDxABQbAIQbgIQbAJQbgJQbAKQbgKQbALQbgLQbAMQbgMQbANQbgNQbAOQbgOQbAPQbgPEAFBwAhByAhBwAlByAlBwApByApBwAtByAtBwAxByAxBwA1ByA1BwA5ByA5BwA9ByA8QAUHQCEHYCEHQCUHYCUHQCkHYCkHQC0HYC0HQDEHYDEHQDUHYDUHQDkHYDkHQD0HYDxABQeAIQegIQeAJQegJQeAKQegKQeALQegLQeAMQegMQeANQegNQeAOQegOQeAPQegPEAFB8AhB+AhB8AlB+AlB8ApB+ApB8AtB+AtB8AxB+AxB8A1B+A1B8A5B+A5B8A9B+A8QAUEAIQQDQCAEQYAIaikDACAEKQMAhSEFIAMEQCAFIAIgBGopAwCFIQULIAIgBGogBTcDACAEQQhqIgRBgAhJDQALCw==';let wmod=null,engine='js';
  try{if(typeof WebAssembly==='object'){const bin=atob(WASM_B64);const u=new Uint8Array(bin.length);for(let i=0;i<u.length;i++)u[i]=bin.charCodeAt(i);wmod=new WebAssembly.Module(u);engine='wasm';}}catch(e){wmod=null;engine='js';}
  function argon2w({password,salt,secret=new Uint8Array(0),ad=new Uint8Array(0),t,m,p,len=32,type=0,version=0x13,onProgress}){
    const H0=blake2b(cat(le32(p),le32(len),le32(m),le32(t),le32(version),le32(type),le32(password.length),password,le32(salt.length),salt,le32(secret.length),secret,le32(ad.length),ad),64);
    const mBlocks=4*p*Math.floor(m/(4*p));const laneLen=mBlocks/p;const segLen=laneLen/4;
    const ZERO=2048,INP=3072,ADR=4096,BASE=5120;
    const memory=new WebAssembly.Memory({initial:Math.ceil((BASE+mBlocks*1024)/65536)});
    const fill=new WebAssembly.Instance(wmod,{env:{mem:memory}}).exports.fill;
    const m8=new Uint8Array(memory.buffer),m32=new Uint32Array(memory.buffer);
    for(let l=0;l<p;l++){m8.set(Hprime(cat(H0,le32(0),le32(l)),1024),BASE+(l*laneLen)*1024);m8.set(Hprime(cat(H0,le32(1),le32(l)),1024),BASE+(l*laneLen+1)*1024);}
    const inW=INP>>2,adW=ADR>>2;const total=t*4*p;let done=0;
    for(let pass=0;pass<t;pass++)for(let sl=0;sl<4;sl++){for(let lane=0;lane<p;lane++){
      const indep=type===1||(type===2&&pass===0&&sl<2);
      if(indep){m32.fill(0,inW,inW+256);m32[inW]=pass;m32[inW+2]=lane;m32[inW+4]=sl;m32[inW+6]=mBlocks;m32[inW+8]=t;m32[inW+10]=type;}
      const nextAddr=()=>{m32[inW+12]++;fill(ZERO,INP,ADR,0);fill(ZERO,ADR,ADR,0);};
      let start=0;if(pass===0&&sl===0){start=2;if(indep)nextAddr();}
      let cur=lane*laneLen+sl*segLen+start;let prev=(cur%laneLen===0)?cur+laneLen-1:cur-1;
      for(let i=start;i<segLen;i++,cur++,prev++){
        if(cur%laneLen===1)prev=cur-1;
        let J1,J2;
        if(indep){if(i%128===0)nextAddr();J1=m32[adW+(i%128)*2];J2=m32[adW+(i%128)*2+1];}
        else{const o=(BASE>>2)+prev*256;J1=m32[o];J2=m32[o+1];}
        let refLane=J2%p;if(pass===0&&sl===0)refLane=lane;
        const same=refLane===lane;let area;
        if(pass===0){if(sl===0)area=i-1;else if(same)area=sl*segLen+i-1;else area=sl*segLen+(i===0?-1:0);}
        else{if(same)area=laneLen-segLen+i-1;else area=laneLen-segLen+(i===0?-1:0);}
        const x=mulhi(J1,J1);const rel=area-1-mulhi(area,x);
        const startPos=pass!==0?(sl===3?0:(sl+1)*segLen):0;
        const ref=refLane*laneLen+(startPos+rel)%laneLen;
        fill(BASE+prev*1024,BASE+ref*1024,BASE+cur*1024,pass!==0?1:0);
      }
      done++;if(onProgress)onProgress(done/total);}}
    const C=new Uint8Array(1024);for(let l=0;l<p;l++){const o=BASE+(l*laneLen+laneLen-1)*1024;for(let i=0;i<1024;i++)C[i]^=m8[o+i];}
    return Hprime(C,len);}
  function argon2any(o){if(wmod){try{return argon2w(o);}catch(e){engine='js';}}return argon2(o);}
  return {argon2:argon2any,argon2js:argon2,blake2b,engine:()=>engine};
}
