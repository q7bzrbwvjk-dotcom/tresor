#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Techflow-IT
"""Independent KDBX reader written directly from the format specification.

It decrypts the databases written by tests/run-all.js using Python's `cryptography`
package and checks header hashes, HMACs, hashed blocks and protected values. Because it
shares no code with Tresor, it catches errors a round-trip test alone would miss.
Usage: pip install cryptography && python3 tests/verify.py
"""
import struct,hashlib,hmac,gzip,base64,re,sys
from cryptography.hazmat.primitives.ciphers import Cipher,algorithms,modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
def salsa20(key,nonce,n):
    def r(v,c):return ((v<<c)|(v>>(32-c)))&0xffffffff
    out=b'';ctr=0
    while len(out)<n:
        c=[0x61707865,0x3320646e,0x79622d32,0x6b206574];k=struct.unpack('<8I',key);nn=struct.unpack('<2I',nonce)
        st=[c[0],*k[:4],c[1],*nn,ctr&0xffffffff,ctr>>32,c[2],*k[4:],c[3]];x=st[:]
        def q(a,b,cc,d):
            x[b]^=r((x[a]+x[d])&0xffffffff,7);x[cc]^=r((x[b]+x[a])&0xffffffff,9);x[d]^=r((x[cc]+x[b])&0xffffffff,13);x[a]^=r((x[d]+x[cc])&0xffffffff,18)
        for _ in range(10):
            q(0,4,8,12);q(5,9,13,1);q(10,14,2,6);q(15,3,7,11);q(0,1,2,3);q(5,6,7,4);q(10,11,8,9);q(15,12,13,14)
        out+=struct.pack('<16I',*[(x[i]+st[i])&0xffffffff for i in range(16)]);ctr+=1
    return out[:n]
def read(path,pw,kf=None):
    d=open(path,'rb').read();s1,s2,mi,ma=struct.unpack('<IIHH',d[:12]);p=12;h={}
    while True:
        if ma==4: i,sz=struct.unpack('<BI',d[p:p+5]);p+=5
        else: i,sz=struct.unpack('<BH',d[p:p+3]);p+=3
        h[i]=d[p:p+sz];p+=sz
        if i==0:break
    parts=[hashlib.sha256(pw.encode()).digest()]
    if kf: parts.append(hashlib.sha256(kf).digest())
    comp=hashlib.sha256(b''.join(parts)).digest()
    if ma==4:
        vd=h[11];q=2;kdf={}
        while vd[q]!=0:
            t=vd[q];kl=struct.unpack('<i',vd[q+1:q+5])[0];k=vd[q+5:q+5+kl].decode();q+=5+kl;vl=struct.unpack('<i',vd[q:q+4])[0];kdf[k]=vd[q+4:q+4+vl];q+=4+vl
        u=kdf['$UUID'].hex()
        if u.startswith('9e29'):
            tk=Argon2id(salt=kdf['S'],length=32,iterations=struct.unpack('<Q',kdf['I'])[0],lanes=struct.unpack('<I',kdf['P'])[0],memory_cost=struct.unpack('<Q',kdf['M'])[0]//1024).derive(comp)
        else:
            e=Cipher(algorithms.AES(kdf['S']),modes.ECB()).encryptor();x=comp
            for _ in range(struct.unpack('<Q',kdf['R'])[0]):x=e.update(x)
            tk=hashlib.sha256(x).digest()
    else:
        e=Cipher(algorithms.AES(h[5]),modes.ECB()).encryptor();x=comp
        for _ in range(struct.unpack('<Q',h[6])[0]):x=e.update(x)
        tk=hashlib.sha256(x).digest()
    key=hashlib.sha256(h[4]+tk).digest()
    def dec(ct):
        if h[2].hex().startswith('d603'):
            return Cipher(algorithms.ChaCha20(key,b'\0'*4+h[7]),None).decryptor().update(ct)
        pt=Cipher(algorithms.AES(key),modes.CBC(h[7])).decryptor().update(ct);u=padding.PKCS7(128).unpadder();return u.update(pt)+u.finalize()
    if ma==4:
        hdr=d[:p];assert hashlib.sha256(hdr).digest()==d[p:p+32]
        hk=hashlib.sha512(h[4]+tk+b'\x01').digest()
        bk=lambda i:hashlib.sha512(struct.pack('<Q',i)+hk).digest()
        assert hmac.new(bk(2**64-1),hdr,'sha256').digest()==d[p+32:p+64];p+=64;ct=b'';i=0
        while True:
            mac=d[p:p+32];sz=struct.unpack('<I',d[p+32:p+36])[0];blk=d[p+36:p+36+sz]
            assert hmac.new(bk(i),struct.pack('<QI',i,sz)+blk,'sha256').digest()==mac;p+=36+sz;i+=1
            if sz==0:break
            ct+=blk
        pt=dec(ct)
        if struct.unpack('<I',h[3])[0]:pt=gzip.decompress(pt)
        q=0;inner={}
        while True:
            i,sz=struct.unpack('<BI',pt[q:q+5]);inner[i]=pt[q+5:q+5+sz];q+=5+sz
            if i==0:break
        xml=pt[q:].decode();hh=hashlib.sha512(inner[2]).digest()
        ks=Cipher(algorithms.ChaCha20(hh[:32],b'\0'*4+hh[32:44]),None).encryptor().update(b'\0'*10000)
    else:
        pt=dec(d[p:]);assert pt[:32]==h[9];q=32;data=b''
        while True:
            i,=struct.unpack('<I',pt[q:q+4]);hs=pt[q+4:q+36];sz,=struct.unpack('<I',pt[q+36:q+40]);blk=pt[q+40:q+40+sz];q+=40+sz
            if sz==0:break
            assert hashlib.sha256(blk).digest()==hs;data+=blk
        xml=gzip.decompress(data).decode()
        ks=salsa20(hashlib.sha256(h[8]).digest(),bytes([0xE8,0x30,0x09,0x4B,0x97,0x20,0x5D,0x2A]),10000)
        hh=re.search(r'<HeaderHash>(.*?)</HeaderHash>',xml).group(1);assert base64.b64decode(hh)==hashlib.sha256(d[:p]).digest(),'headerhash'
    off=0;vals=[]
    for m in re.finditer(r'Protected="True">(.*?)<',xml):
        raw=base64.b64decode(m.group(1));vals.append(bytes(a^b for a,b in zip(raw,ks[off:])).decode());off+=len(raw)
    print(path,'OK, KDBX',ma,mi,'- protected values:',len(vals))

if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
    kf = open(os.path.join(out, "keyfile.bin"), "rb").read()
    read(os.path.join(out, "v4-argon2id.kdbx"), "secret")
    read(os.path.join(out, "v4-chacha-aeskdf.kdbx"), "secret")
    read(os.path.join(out, "v3-keyfile.kdbx"), "secret", kf)
    print("All test databases verified independently.")
