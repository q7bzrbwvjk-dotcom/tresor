// SPDX-License-Identifier: GPL-3.0-or-later
// Tresor – KeePass-compatible password manager
// Copyright (C) 2026 Techflow-IT
// ===== CSV lesen/schreiben + Formaterkennung =====
function csvParse(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const first=text.split(/\r?\n/,1)[0];const cnt=c=>first.split(c).length;
  const d=cnt('\t')>cnt(',')&&cnt('\t')>cnt(';')?'\t':cnt(';')>cnt(',')?';':',';
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===d){row.push(f);f='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);f='';if(row.some(x=>x!==''))rows.push(row);row=[];}
    else f+=c;}
  row.push(f);if(row.some(x=>x!==''))rows.push(row);return rows;}
const CSV_ALIASES={
  title:['title','name','titel','account','eintrag'],
  user:['username','login_username','user name','user','login','benutzername','email','e-mail'],
  pass:['password','login_password','passwort','kennwort'],
  url:['url','website','login_uri','uri','web site','adresse'],
  notes:['notes','note','extra','comments','notizen','bemerkung'],
  totp:['totp','otpauth','login_totp','otp','one-time password'],
  group:['group','folder','grouping','gruppe','ordner','vault'],
  tags:['tags','tag'],
  type:['type'],fields:['fields']};
function csvDetect(header){const h=header.map(x=>x.trim().toLowerCase());const has=(...k)=>k.every(x=>h.includes(x));
  if(has('login_uri','login_username'))return 'Bitwarden';if(has('grouping','extra'))return 'LastPass';if(has('httprealm'))return 'Firefox';
  if(has('otpauth','archived')||has('otpauth','favorite'))return '1Password';if(has('group','title','username','password','last modified'))return 'KeePassXC';
  if(has('title','url','username','password','otpauth'))return 'Apple Passwörter';if(has('name','url','username','password'))return 'Chrome/Brave/Edge';return 'CSV';}
function csvRecords(rows){const header=rows[0].map(x=>x.trim().toLowerCase());const col={};
  for(const k in CSV_ALIASES){const i=header.findIndex(h=>CSV_ALIASES[k].includes(h));if(i>=0)col[k]=i;}
  const out=[];for(const r of rows.slice(1)){const g=k=>col[k]!==undefined?(r[col[k]]||'').trim():'';
    if(g('type')&&!['login','1',''].includes(g('type').toLowerCase())&&!g('pass')&&!g('user')){out.push({title:g('title')||T('Notiz'),user:'',pass:'',url:'',notes:[g('notes'),g('fields')].filter(Boolean).join('\n'),totp:'',group:g('group'),tags:g('tags')});continue;}
    let title=g('title'),url=g('url');if(!title&&url){try{title=new URL(/^[a-z]+:/i.test(url)?url:'https://'+url).hostname.replace(/^www\./,'');}catch(e){title=url;}}
    const rec={title:title||T('Ohne Titel'),user:g('user'),pass:r[col.pass]??'',url,notes:[g('notes'),g('fields')].filter(Boolean).join('\n'),totp:g('totp'),group:g('group'),tags:g('tags')};
    if(rec.user||rec.pass||rec.url||rec.notes||g('title'))out.push(rec);}
  return {records:out,mapped:Object.keys(col)};}
function csvCell(v){v=String(v??'');return /[",\n\r]/.test(v)||/^[=+\-@]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
