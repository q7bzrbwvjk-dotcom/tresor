// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===================== Runde 6: Schutzstufen der Schlüsselableitung, Tailscale-Erkennung =====================
const KDF_PRESETS={fast:{name:'Schnell',m:32,t:3,p:2,r:2e6,desc:'Für ältere Geräte oder sehr häufiges Öffnen.'},std:{name:'Standard',m:64,t:8,p:2,r:1e7,desc:'Empfohlen – guter Schutz bei kurzer Wartezeit.'},strong:{name:'Stark',m:256,t:6,p:2,r:3e7,desc:'Maximaler Schutz. Braucht 256 MB Arbeitsspeicher beim Öffnen.'}};
let BENCH_A=null,BENCH_R=null;
function benchArgon(){if(BENCH_A)return BENCH_A;const o={password:new Uint8Array(32),salt:new Uint8Array(16),t:1,m:4096,p:1};A2.argon2(o);const t0=performance.now();A2.argon2(o);BENCH_A=Math.max(0.5,(performance.now()-t0)/4);return BENCH_A;}
async function benchAes(){if(BENCH_R)return BENCH_R;const t0=performance.now();await aesKdf(new Uint8Array(32),new Uint8Array(32),200000);BENCH_R=(performance.now()-t0)/200000;return BENCH_R;}
const fmtSec=ms=>ms<1000?'unter 1 s':`≈ ${(ms/1000).toLocaleString('de-DE',{maximumFractionDigits:ms<10000?1:0})} s`;
function argonEstimate(pr){return pr.m*pr.t*benchArgon()+60;}
function kdfFromPreset(key,major){const pr=KDF_PRESETS[key];
  if(major===4)return {$UUID:{t:0x42,v:unhex(KDF_ARGON2D)},S:{t:0x42,v:rnd(32)},P:{t:0x04,v:pr.p},M:{t:0x05,v:pr.m*1048576},I:{t:0x05,v:pr.t},V:{t:0x04,v:0x13}};
  return {$UUID:{t:0x42,v:unhex(KDF_AES_KDBX3)},S:{t:0x42,v:rnd(32)},R:{t:0x05,v:pr.r}};}
function kdfDescribe(k){const u=hex(k.$UUID.v);
  if(u===KDF_ARGON2D||u===KDF_ARGON2ID)return {argon:true,text:`${u===KDF_ARGON2D?'Argon2d':'Argon2id'} · ${Math.round(k.M.v/1048576)} MB · ${k.I.v} ${k.I.v===1?'Durchlauf':'Durchläufe'} · ${k.P.v} ${k.P.v===1?'Thread':'Threads'}`,mib:k.M.v/1048576,t:k.I.v};
  return {argon:false,text:`AES-KDF · ${Number(k.R.v).toLocaleString('de-DE')} Runden`,r:k.R.v};}
function presetKeyOf(k){const d=kdfDescribe(k);for(const [key,pr] of Object.entries(KDF_PRESETS)){if(d.argon&&hex(k.$UUID.v)===KDF_ARGON2D&&d.mib===pr.m&&d.t===pr.t&&k.P.v===pr.p)return key;if(!d.argon&&d.r===pr.r)return key;}return null;}
const engineNote=()=>A2.engine()==='wasm'?'Berechnung mit WebAssembly.':'WebAssembly ist hier nicht verfügbar – die Berechnung läuft langsamer in JavaScript.';
function segHtml(id,sel,est){return `<div class="seg wide" id="${id}">${Object.entries(KDF_PRESETS).map(([k,p])=>`<button type="button" data-k="${k}" class="${k===sel?'on':''}"><b>${p.name}</b><span>${est(p)}</span></button>`).join('')}</div>`;}
// ---- Neue Datenbank ----
let NEWKDF='std';
function mountNewKdf(){const box=$('kdfNew');if(!box)return;
  const draw=()=>{box.innerHTML=segHtml('kdfSegNew',NEWKDF,p=>fmtSec(argonEstimate(p)))+`<p class="note" style="margin-top:8px">${KDF_PRESETS[NEWKDF].desc} Die Wartezeit fällt bei jedem Öffnen an – auf diesem Gerät gemessen. ${engineNote()}</p>`;};
  draw();box.onclick=ev=>{const b=ev.target.closest('[data-k]');if(b){NEWKDF=b.dataset.k;draw();}};}
document.querySelector('[data-tab=new]').addEventListener('click',()=>setTimeout(mountNewKdf,30));
// ---- Einstellungen ----
let SETKDF=null;
async function mountSetKdf(box){SETKDF=null;const db=S.db;const cur=kdfDescribe(db.kdf);const curKey=presetKeyOf(db.kdf);const v4=db.major===4;
  let est;if(v4)est=p=>fmtSec(argonEstimate(p));else{const ms=await benchAes();est=p=>fmtSec(p.r*ms);}
  const curEst=cur.argon?fmtSec(cur.mib*cur.t*benchArgon()+60):(BENCH_R?fmtSec(cur.r*BENCH_R):'');
  const draw=()=>{const sel=SETKDF||curKey;
    box.innerHTML=`<p style="margin:8px 0 10px;font-size:14px">Aktuell: <b>${esc(cur.text)}</b>${curEst?` – Öffnen ${curEst} auf diesem Gerät`:''}${curKey?` (Stufe „${KDF_PRESETS[curKey].name}“)`:''}</p>`+segHtml('kdfSegSet',sel,est)+
      `<p class="note" style="margin-top:8px">${SETKDF&&SETKDF!==curKey?`Wird beim Übernehmen neu berechnet und gilt ab dem nächsten Speichern. ${KDF_PRESETS[SETKDF].desc}`:'Höhere Stufen machen das Erraten des Master-Passworts teurer, verlängern aber auch das Öffnen.'}${v4?'':' Diese Datei nutzt das ältere Format KDBX 3 – dort ist nur AES-KDF möglich.'} ${v4?engineNote():''}</p>`;};
  draw();box.onclick=ev=>{const b=ev.target.closest('[data-k]');if(b){SETKDF=b.dataset.k===curKey?null:b.dataset.k;draw();}};}
function kdfChoice(){return SETKDF?kdfFromPreset(SETKDF,S.db.major):null;}
// ---- Tailscale erkennen ----
(function(){if(window.isSecureContext)return;const h=location.hostname;const m=h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  const ts=/\.ts\.net$/i.test(h)||(m&&+m[1]===100&&+m[2]>=64&&+m[2]<=127);if(!ts)return;
  const w=$('secWarn');w.classList.add('ok');w.innerHTML='<b>Verbunden über Tailscale</b><span>Die Übertragung ist durch WireGuard verschlüsselt – auch ohne HTTPS kann niemand im Netzwerk die Seite unterwegs verändern. Der Browser stuft die Seite trotzdem als „nicht sicher“ ein; Tresor nutzt deshalb seine eingebaute Kryptografie.</span>';
  const b=$('httpBadge');b.textContent='Tailscale';b.classList.add('ok');b.title='Über Tailscale verbunden – Übertragung verschlüsselt';})();
