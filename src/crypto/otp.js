// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== TOTP (2FA) – kompatibel mit KeePassXC (otp), KeePass 2.47+ (TimeOtp-*) und KeeOtp (TOTP Seed) =====
const OTP_KEYS=['otp','TimeOtp-Secret','TimeOtp-Secret-Base32','TimeOtp-Secret-Hex','TimeOtp-Secret-Base64','TimeOtp-Length','TimeOtp-Period','TimeOtp-Algorithm','TOTP Seed','TOTP Settings'];
function base32dec(s){s=s.toUpperCase().replace(/[\s=-]/g,'');const AL='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,val=0;const out=[];
  for(const c of s){const i=AL.indexOf(c);if(i<0)throw new Error(T('Der Schlüssel enthält ungültige Zeichen.'));val=((val<<5)|i)&0xffff;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&255);bits-=8;}}
  if(!out.length)throw new Error(T('Der Schlüssel ist leer.'));return new Uint8Array(out);}
function parseOtpString(o){
  o=o.trim();
  if(/^otpauth:\/\//i.test(o)){const q=o.split('?')[1]||'';const p=new URLSearchParams(q);
    if(/^otpauth:\/\/hotp/i.test(o))throw new Error(T('Nur zeitbasierte Codes (TOTP) werden unterstützt.'));
    return {secret:base32dec(p.get('secret')||''),digits:+(p.get('digits')||6),period:+(p.get('period')||30),algo:(p.get('algorithm')||'SHA1').toUpperCase().replace('-',''),steam:(p.get('encoder')||'').toLowerCase()==='steam'};}
  if(/key=/.test(o)){const p=new URLSearchParams(o);return {secret:base32dec(p.get('key')||''),digits:+(p.get('size')||6),period:+(p.get('step')||30),algo:(p.get('otpHashMode')||'SHA1').toUpperCase().replace('-',''),steam:false};}
  return {secret:base32dec(o),digits:6,period:30,algo:'SHA1',steam:false};}
function otpConfig(e){
  try{
    const o=str(e,'otp');if(o)return parseOtpString(o);
    let secret=null;
    if(str(e,'TimeOtp-Secret-Base32'))secret=base32dec(str(e,'TimeOtp-Secret-Base32'));
    else if(str(e,'TimeOtp-Secret-Hex'))secret=unhex(str(e,'TimeOtp-Secret-Hex'));
    else if(str(e,'TimeOtp-Secret-Base64'))secret=unb64(str(e,'TimeOtp-Secret-Base64'));
    else if(str(e,'TimeOtp-Secret'))secret=enc.encode(str(e,'TimeOtp-Secret'));
    if(secret){const alg=str(e,'TimeOtp-Algorithm').toUpperCase();
      return {secret,digits:+(str(e,'TimeOtp-Length')||6),period:+(str(e,'TimeOtp-Period')||30),algo:alg.includes('512')?'SHA512':alg.includes('256')?'SHA256':'SHA1',steam:false};}
    if(str(e,'TOTP Seed')){const st=(str(e,'TOTP Settings')||'30;6').split(';');
      return {secret:base32dec(str(e,'TOTP Seed')),period:+st[0]||30,digits:st[1]==='S'?5:+st[1]||6,algo:'SHA1',steam:st[1]==='S'};}
  }catch(err){return {error:err.message};}
  return null;}
function otpEditValue(e){const o=str(e,'otp');if(o)return o;const c=otpConfig(e);if(!c||c.error)return '';
  const AL='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,val=0,s='';for(const b of c.secret){val=(val<<8)|b;bits+=8;while(bits>=5){s+=AL[(val>>>(bits-5))&31];bits-=5;}val&=0xff;}if(bits)s+=AL[(val<<(5-bits))&31];
  if(c.digits===6&&c.period===30&&c.algo==='SHA1'&&!c.steam)return s;
  return `otpauth://totp/x?secret=${s}&period=${c.period}&digits=${c.digits}&algorithm=${c.algo}${c.steam?'&encoder=steam':''}`;}
async function totpCode(c,now=Date.now()){
  const ctr=Math.floor(now/1000/c.period);const msg=new Uint8Array(8);const dv=new DataView(msg.buffer);dv.setUint32(0,Math.floor(ctr/4294967296));dv.setUint32(4,ctr>>>0);
  const hash={SHA1:'SHA-1',SHA256:'SHA-256',SHA512:'SHA-512'}[c.algo]||'SHA-1';
  let h;if(HAS_SUBTLE){const k=await crypto.subtle.importKey('raw',c.secret,{name:'HMAC',hash},false,['sign']);h=new Uint8Array(await crypto.subtle.sign('HMAC',k,msg));}
  else h=hash==='SHA-1'?JSC.hmac(JSC.sha1,64,c.secret,msg):hash==='SHA-512'?JSC.hmac(JSC.sha512,128,c.secret,msg):JSC.hmac(JSC.sha256,64,c.secret,msg);
  const o=h[h.length-1]&15;let bin=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];
  if(c.steam){const AL='23456789BCDFGHJKMNPQRTVWXY';let s='';for(let i=0;i<5;i++){s+=AL[bin%AL.length];bin=Math.floor(bin/AL.length);}return s;}
  return String(bin%10**c.digits).padStart(c.digits,'0');}
