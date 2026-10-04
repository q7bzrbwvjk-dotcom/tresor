// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Techflow-IT
// Runs all cryptographic and format tests against the sources in src/.
// Usage: node tests/run-all.js   (writes test databases to tests/out/ for tests/verify.py)
'use strict';
const fs = require('fs'), path = require('path'), nc = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const load = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
// Load the non-UI modules into this scope (they are plain browser scripts without exports).
(0, eval)([ 'ui/i18n.js', 'ui/words.js', 'crypto/cryptofb.js', 'crypto/crypto.js', 'crypto/argon2.js', 'kdbx/kdbx.js', 'kdbx/merge.js', 'kdbx/csv.js', 'crypto/qr.js', 'crypto/otp.js' ].map(load).join('\n')
  + ';globalThis.A=argon2Factory();globalThis.argon2Run=async(p,cb)=>A.argon2({...p,onProgress:cb});'
  + 'Object.assign(globalThis,{EN,WORDS_EN,JSC,kdbxCreate,kdbxSave,kdbxOpen,mergeDb,X,xmlSerialize,timeStr,parseTime,newUuid,timesEl,writeVarDict,runKdf,compositeKey,unhex,hex,makeStream,csvParse,csvRecords,csvDetect,qrEncode,aesKdf,totpCode,parseOtpString});');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log('  FAIL', name); } };
const eq = (a, b) => Buffer.from(a).equals(Buffer.from(b));
const H = u => Buffer.from(u).toString('hex');
const fill = (n, b) => new Uint8Array(n).fill(b);
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });

(async () => {
  console.log('BLAKE2b / Argon2');
  for (const len of [0, 3, 127, 128, 129, 1000]) { const d = nc.randomBytes(len); ok('blake2b ' + len, H(A.blake2b(new Uint8Array(d), 64)) === nc.createHash('blake2b512').update(d).digest('hex')); }
  const RFC = { 0: '512b391b6f1162975371d30919734294f868e3be3984f3c1a13a4db9fabe4acb', 1: 'c814d9d1dc7f37aa13f0d77f2494bda1c8de6b016dd388d29952a4c4672b6ce8', 2: '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659' };
  for (const type of [0, 1, 2]) {
    const o = { password: fill(32, 1), salt: fill(16, 2), secret: fill(8, 3), ad: fill(12, 4), t: 3, m: 32, p: 4, type };
    ok('RFC 9106 type ' + type + ' (wasm)', H(A.argon2(o)) === RFC[type]); ok('RFC 9106 type ' + type + ' (js)', H(A.argon2js(o)) === RFC[type]);
  }
  for (const [m, t, p, type] of [[1024, 3, 3, 2], [4096, 2, 1, 0], [777, 2, 2, 0], [512, 4, 1, 1]]) {
    const o = { password: fill(32, 9), salt: fill(32, 5), t, m, p, type };
    ok(`wasm == js m=${m} t=${t} p=${p}`, H(A.argon2(o)) === H(A.argon2js(o)));
  }
  ok('engine is wasm', A.engine() === 'wasm');

  console.log('Fallback crypto (SHA, HMAC, AES)');
  for (const len of [0, 1, 55, 56, 64, 111, 112, 128, 1000, 100000]) {
    const d = nc.randomBytes(len);
    ok('sha256 ' + len, eq(JSC.sha256(d), nc.createHash('sha256').update(d).digest()));
    ok('sha512 ' + len, eq(JSC.sha512(d), nc.createHash('sha512').update(d).digest()));
    ok('sha1 ' + len, eq(JSC.sha1(d), nc.createHash('sha1').update(d).digest()));
    const k = nc.randomBytes(100);
    ok('hmac256 ' + len, eq(JSC.hmac(JSC.sha256, 64, k, d), nc.createHmac('sha256', k).update(d).digest()));
    ok('hmac512 ' + len, eq(JSC.hmac(JSC.sha512, 128, k, d), nc.createHmac('sha512', k).update(d).digest()));
    const key = nc.randomBytes(32), iv = nc.randomBytes(16); const c = nc.createCipheriv('aes-256-cbc', key, iv); const ref = Buffer.concat([c.update(d), c.final()]);
    ok('aes-cbc enc ' + len, eq(JSC.cbc(new Uint8Array(key), new Uint8Array(iv), new Uint8Array(d), true), ref));
    ok('aes-cbc dec ' + len, eq(JSC.cbc(new Uint8Array(key), new Uint8Array(iv), new Uint8Array(ref), false), d));
  }
  { const seed = nc.randomBytes(32), d = nc.randomBytes(32); const e = nc.createCipheriv('aes-256-ecb', seed, null); e.setAutoPadding(false); let x = Buffer.from(d); for (let i = 0; i < 50000; i++) x = e.update(x);
    const ref = nc.createHash('sha256').update(x).digest(); ok('aes-kdf (js)', eq(await JSC.aesKdf(new Uint8Array(seed), new Uint8Array(d), 50000), ref)); ok('aes-kdf (subtle)', eq(await aesKdf(new Uint8Array(seed), new Uint8Array(d), 50000), ref)); }

  console.log('Stream ciphers / TOTP / QR');
  { const key = nc.randomBytes(32), nonce = nc.randomBytes(12), d = nc.randomBytes(300); const c = nc.createCipheriv('chacha20', key, Buffer.concat([Buffer.alloc(4), nonce]));
    ok('chacha20', eq(makeStream('chacha', new Uint8Array(key), new Uint8Array(nonce)).xor(new Uint8Array(d)), c.update(d))); }
  { const k = new Uint8Array(32); k[0] = 0x80; ok('salsa20 eSTREAM set 1 vector 0', H(makeStream('salsa', k, new Uint8Array(8)).xor(new Uint8Array(8))) === 'e3be8fdd8beca2e3'); }
  const s = x => new TextEncoder().encode(x);
  for (const [t, a, b, c] of [[59, '94287082', '46119246', '90693936'], [1111111109, '07081804', '68084774', '25091201'], [20000000000, '65353130', '77737706', '47863826']]) {
    ok('totp sha1 ' + t, await totpCode({ secret: s('12345678901234567890'), digits: 8, period: 30, algo: 'SHA1' }, t * 1000) === a);
    ok('totp sha256 ' + t, await totpCode({ secret: s('12345678901234567890123456789012'), digits: 8, period: 30, algo: 'SHA256' }, t * 1000) === b);
    ok('totp sha512 ' + t, await totpCode({ secret: s('1234567890123456789012345678901234567890123456789012345678901234'), digits: 8, period: 30, algo: 'SHA512' }, t * 1000) === c);
  }
  ok('otpauth uri', await totpCode(parseOtpString('otpauth://totp/Demo:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), 59000) === '287082');
  for (const [txt, size] of [['A', 21], ['WIFI:T:WPA;S:Demo;P:secret;;', 29], ['y'.repeat(200), 57]]) ok('qr size ' + size, qrEncode(txt).length === size);

  console.log('KDBX read/write');
  const S2 = (e, k, v, p) => { const x = X.el('String'); X.append(x, X.el('Key', k)); X.append(x, X.el('Value', v, p ? { Protected: 'True' } : {})); X.append(e, x); };
  const addEntry = (db, title, pw) => { const g = X.kid(X.kid(db.xml, 'Root'), 'Group'); const e = X.el('Entry'); X.append(e, X.el('UUID', newUuid())); X.append(e, timesEl(db)); S2(e, 'Title', title); S2(e, 'UserName', 'alice@example.com'); S2(e, 'Password', pw, true); X.append(e, X.el('History')); X.insertAt(g, e, 4); return e; };
  const PW = 'pässwört "x" \u{1F511}';
  const fast = { $UUID: { t: 0x42, v: unhex('9e298b1956db4773b23dfc3ec6f0a1e6') }, S: { t: 0x42, v: fill(32, 1) }, P: { t: 4, v: 2 }, M: { t: 5, v: 1 << 22 }, I: { t: 5, v: 2 }, V: { t: 4, v: 0x13 } };
  const db = await kdbxCreate('Demo', 'secret', null, null, fast); addEntry(db, 'Bank & <Account>', PW);
  let bytes = await kdbxSave(db); fs.writeFileSync(path.join(OUT, 'v4-argon2id.kdbx'), bytes);
  ok('v4 roundtrip', xmlSerialize((await kdbxOpen(bytes, 'secret', null)).xml) === xmlSerialize(db.xml));
  let wrong = false; try { await kdbxOpen(bytes, 'wrong', null); } catch (e) { wrong = /Passwort|password/i.test(e.message); } ok('v4 wrong password rejected', wrong);
  db.cipher = 'd6038a2b8b6f4cb5a524339a31dbb59a'; db.kdf = { $UUID: { t: 0x42, v: unhex('c9d9f39a628a4460bf740d08c18a4fea') }, S: { t: 0x42, v: fill(32, 3) }, R: { t: 0x05, v: 10000 } }; db.kdfRaw = writeVarDict(db.kdf);
  db.transformed = await runKdf(db.kdf, await compositeKey('secret', null)); bytes = await kdbxSave(db); fs.writeFileSync(path.join(OUT, 'v4-chacha-aeskdf.kdbx'), bytes);
  ok('v4 chacha20 + aes-kdf roundtrip', xmlSerialize((await kdbxOpen(bytes, 'secret', null)).xml) === xmlSerialize(db.xml));
  const keyFile = fill(100, 9); fs.writeFileSync(path.join(OUT, 'keyfile.bin'), keyFile);
  db.major = 3; db.minor = 1; db.cipher = '31c1f2e6bf714350be5805216afc5aff'; db.kdf = { $UUID: { t: 0x42, v: unhex('7c02bb8279a74ac0927d114a00648238') }, S: { t: 0x42, v: fill(32, 4) }, R: { t: 0x05, v: 6000 } };
  X.append(X.kid(db.xml, 'Meta'), X.el('HeaderHash', '')); db.transformed = await runKdf(db.kdf, await compositeKey('secret', keyFile));
  bytes = await kdbxSave(db); fs.writeFileSync(path.join(OUT, 'v3-keyfile.kdbx'), bytes);
  const r3 = await kdbxOpen(bytes, 'secret', keyFile); ok('v3 + key file roundtrip', xmlSerialize(r3.xml).includes(PW.replace('"', '&quot;')) || xmlSerialize(r3.xml).includes(PW));

  console.log('Merge / CSV');
  const a = await kdbxCreate('A', 'x', null, null, fast); const b = await kdbxCreate('B', 'x', null, null, fast);
  b.xml = X.clone(a.xml, null); addEntry(b, 'Only in B', 'b'); const ea = addEntry(a, 'Only in A', 'a');
  const st = await mergeDb(a, b); ok('merge adds new entry', st.added === 1); ok('merge keeps local entry', ea.parent !== null);
  const st2 = await mergeDb(a, b); ok('merge is idempotent', st2.added + st2.updated + st2.deleted === 0);
  const cases = [['folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\nWork,,login,Example,,,0,https://example.com,alice,"p,w",', 'Bitwarden'],
    ['url,username,password,totp,extra,name,grouping,fav\nhttps://example.com,a,b,,,X,Shop,0', 'LastPass'], ['name,url,username,password,note\n,https://www.example.com/login,alice,p1,', 'Chrome/Brave/Edge']];
  for (const [csv, fmt] of cases) { const rows = csvParse(csv); ok('csv ' + fmt, csvDetect(rows[0]) === fmt && csvRecords(rows).records.length === 1); }

  console.log('Translations');
  // Every German text passed to T() in the sources (and every static text in body.html) needs an English entry in EN.
  const literals = arg => [...arg.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\(.)/g, '$1')).filter(Boolean);
  const firstArg = (s, i) => { let d = 0, q = null; for (let j = i; j < s.length; j++) { const c = s[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; } else if ('\'"`'.includes(c)) q = c; else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) { if (!d) return s.slice(i, j); d--; } else if (c === ',' && !d) return s.slice(i, j); } return ''; };
  const keys = new Set();
  for (const f of ['ui', 'kdbx', 'crypto'].flatMap(d => fs.readdirSync(path.join(ROOT, 'src', d)).filter(x => x.endsWith('.js')).map(x => d + '/' + x))) {
    const s = load(f).replace(/^\s*\/\/.*$/gm, '');
    for (const m of s.matchAll(/(?<![\w$.])T\(/g)) for (const k of literals(firstArg(s, m.index + 2))) keys.add(k); }
  const html = load('ui/body.html').replace(/<span data-t="[^"]*">[^<]*(<b>[^<]*<\/b>[^<]*)*<\/span>/g, '');
  for (const m of html.matchAll(/>([^<>]*[A-Za-zÄÖÜäöüß][^<>]*)</g)) { const t = m[1].trim(); if (t && !/^(Tresor|HTTPS?)$/.test(t)) keys.add(t); }
  for (const m of html.matchAll(/(?:title|placeholder|aria-label)="([^"]+)"/g)) keys.add(m[1]);
  const missing = [...keys].filter(k => !Object.prototype.hasOwnProperty.call(EN, k));
  ok('every text has an English translation' + (missing.length ? ': ' + missing.join(' | ') : ''), !missing.length);
  ok(`${keys.size} texts found`, keys.size > 500);
  ok('T is not shadowed by local variables', !['ui', 'kdbx', 'crypto'].flatMap(d => fs.readdirSync(path.join(ROOT, 'src', d)).filter(x => x.endsWith('.js')).map(x => load(d + '/' + x))).some(s => /\b(const|let|var)\s+T\s*=|function\s*\w*\([^)]*\bT\b[^)]*\)\s*\{[^}]*\bT\(/.test(s)));
  ok('placeholders match', Object.entries(EN).every(([de, en]) => [...de.matchAll(/\{\w+\}/g)].map(String).sort().join() === [...en.matchAll(/\{\w+\}/g)].map(String).sort().join()));
  ok('English passphrase list', WORDS_EN.length >= 1232 && new Set(WORDS_EN).size === WORDS_EN.length && WORDS_EN.every(w => /^[a-z]{3,10}$/.test(w)));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
