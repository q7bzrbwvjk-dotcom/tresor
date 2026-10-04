// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== QR-Code-Encoder (Byte-Modus, Fehlerkorrektur M, Version 1–10) =====
function qrEncode(text){
  const data=enc.encode(text);
  // [Datenwörter gesamt, EC je Block, Blöcke [anzahl, datenwörter]...]
  const T=[null,[16,10,[[1,16]]],[28,16,[[1,28]]],[44,26,[[1,44]]],[64,18,[[2,32]]],[86,24,[[2,43]]],[108,16,[[4,27]]],[124,18,[[4,31]]],[154,22,[[2,38],[2,39]]],[182,22,[[3,36],[2,37]]],[216,26,[[4,43],[1,44]]]];
  const ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  let ver=0;for(let v=1;v<=10;v++){const cap=T[v][0]-(v<10?2:3);if(data.length<=cap){ver=v;break;}}
  if(!ver)throw new Error('Text zu lang für einen QR-Code');
  const [dcTotal,ecLen,blocks]=T[ver];
  const bits=[];const put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
  put(4,4);put(data.length,ver<10?8:16);for(const b of data)put(b,8);
  put(0,Math.min(4,dcTotal*8-bits.length));while(bits.length%8)bits.push(0);
  const dc=[];for(let i=0;i<bits.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|bits[i+j];dc.push(v);}
  for(let p=0;dc.length<dcTotal;p^=1)dc.push(p?0x11:0xEC);
  // Reed-Solomon
  const mul=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x;}return z&255;};
  const div=[];for(let i=0;i<ecLen-1;i++)div.push(0);div.push(1);
  let root=1;for(let i=0;i<ecLen;i++){for(let j=0;j<div.length;j++){div[j]=mul(div[j],root);if(j+1<div.length)div[j]^=div[j+1];}root=mul(root,2);}
  const rem=d=>{const r=div.map(()=>0);for(const b of d){const f=b^r.shift();r.push(0);div.forEach((c,i)=>r[i]^=mul(c,f));}return r;};
  const dBlocks=[],eBlocks=[];let off=0;
  for(const [n,len] of blocks)for(let i=0;i<n;i++){const d=dc.slice(off,off+len);off+=len;dBlocks.push(d);eBlocks.push(rem(d));}
  const cw=[];const maxD=Math.max(...dBlocks.map(b=>b.length));
  for(let i=0;i<maxD;i++)for(const b of dBlocks)if(i<b.length)cw.push(b[i]);
  for(let i=0;i<ecLen;i++)for(const b of eBlocks)cw.push(b[i]);
  // Matrix
  const N=17+4*ver;const M=[...Array(N)].map(()=>Array(N).fill(false));const F=[...Array(N)].map(()=>Array(N).fill(false));
  const set=(x,y,d)=>{M[y][x]=d;F[y][x]=true;};
  for(let i=0;i<N;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=N||y>=N)continue;const d=Math.max(Math.abs(dx),Math.abs(dy));set(x,y,d!==2&&d!==4);}};
  finder(3,3);finder(N-4,3);finder(3,N-4);
  const al=ALIGN[ver];for(const ay of al)for(const ax of al){if((ax===6&&ay===6)||(ax===6&&ay===al[al.length-1])||(ax===al[al.length-1]&&ay===6))continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}
  const format=mask=>{const d=(0<<3)|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((d<<10)|r)^0x5412;const g=i=>((b>>>i)&1)===1;
    for(let i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(let i=9;i<15;i++)set(14-i,8,g(i));
    for(let i=0;i<8;i++)set(N-1-i,8,g(i));for(let i=8;i<15;i++)set(8,N-15+i,g(i));set(8,N-8,true);};
  format(0);
  if(ver>=7){let r=ver;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=(ver<<12)|r;for(let i=0;i<18;i++){const bit=((b>>>i)&1)===1;const a=N-11+i%3,c=Math.floor(i/3);set(a,c,bit);set(c,a,bit);}}
  let i=0;for(let right=N-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<N;vert++)for(let j=0;j<2;j++){const x=right-j;const up=((right+1)&2)===0;const y=up?N-1-vert:vert;
    if(!F[y][x]&&i<cw.length*8){M[y][x]=((cw[i>>>3]>>>(7-(i&7)))&1)===1;i++;}}}
  const MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  const applyMask=m=>{for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!F[y][x]&&MASKS[m](x,y))M[y][x]=!M[y][x];};
  const penalty=()=>{let p=0,dark=0;
    for(let y=0;y<N;y++){let run=1;for(let x=1;x<N;x++){if(M[y][x]===M[y][x-1]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}
    for(let x=0;x<N;x++){let run=1;for(let y=1;y<N;y++){if(M[y][x]===M[y-1][x]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}
    for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){const c=M[y][x];if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1])p+=3;}
    for(const row of M)for(const c of row)if(c)dark++;p+=Math.floor(Math.abs(dark*20-N*N*10)/(N*N))*10;return p;};
  let best=0,bestP=Infinity;for(let m=0;m<8;m++){applyMask(m);format(m);const p=penalty();if(p<bestP){bestP=p;best=m;}applyMask(m);}
  applyMask(best);format(best);return M;}
function qrSvg(text,px){const M=qrEncode(text);const N=M.length,q=4;let d='';for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(M[y][x])d+=`M${x+q} ${y+q}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${N+2*q} ${N+2*q}" width="${px||N*6}" height="${px||N*6}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;}
function wifiString(ssid,pw,type,hidden){const e=s=>s.replace(/([\\;,:"])/g,'\\$1');return `WIFI:T:${type};S:${e(ssid)};${type==='nopass'?'':`P:${e(pw)};`}${hidden?'H:true;':''};`;}
