# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Techflow-IT
# Minimaler Assembler: erzeugt das WebAssembly-Modul für die Argon2-Blockfunktion G
import base64
def uleb(n):
    o=bytearray()
    while True:
        b=n&0x7f;n>>=7
        if n:o.append(b|0x80)
        else:o.append(b);return bytes(o)
def sleb(n):
    o=bytearray()
    while True:
        b=n&0x7f;n>>=7
        if (n==0 and not b&0x40) or (n==-1 and b&0x40):o.append(b);return bytes(o)
        o.append(b|0x80)
def vec(items):return uleb(len(items))+b''.join(items)
def sec(id,body):return bytes([id])+uleb(len(body))+body
I32,I64=0x7f,0x7e
LG=lambda i:b'\x20'+uleb(i);LS=lambda i:b'\x21'+uleb(i);LT=lambda i:b'\x22'+uleb(i)
I32C=lambda v:b'\x41'+sleb(v);I64C=lambda v:b'\x42'+sleb(v)
LD=b'\x29\x03\x00';ST=b'\x37\x03\x00'
ADD,MUL,AND,XOR,ROTR,SHL=b'\x7c',b'\x7e',b'\x83',b'\x85',b'\x8a',b'\x86'
CALL=lambda f:b'\x10'+uleb(f)
# --- GB(a,b,c,d): Parameter 0..3 = Byteadressen, Locals 4..7 = va,vb,vc,vd (i64)
def gb():
    va,vb,vc,vd=4,5,6,7
    c=b''
    for p,l in ((0,va),(1,vb),(2,vc),(3,vd)):c+=LG(p)+LD+LS(l)
    M=I64C(0xffffffff)
    def madd(x,y):# x = x + y + 2*lo(x)*lo(y)
        return LG(x)+LG(y)+ADD+LG(x)+M+AND+LG(y)+M+AND+MUL+I64C(1)+SHL+ADD+LS(x)
    def xr(x,y,r):# x = rotr(x^y, r)
        return LG(x)+LG(y)+XOR+I64C(r)+ROTR+LS(x)
    c+=madd(va,vb)+xr(vd,va,32)+madd(vc,vd)+xr(vb,vc,24)+madd(va,vb)+xr(vd,va,16)+madd(vc,vd)+xr(vb,vc,63)
    for p,l in ((0,va),(1,vb),(2,vc),(3,vd)):c+=LG(p)+LG(l)+ST
    body=vec([uleb(4)+bytes([I64])])+c+b'\x0b'
    return uleb(len(body))+body
# --- P(a0..a15)
def pfun():
    c=b''
    for q in ((0,4,8,12),(1,5,9,13),(2,6,10,14),(3,7,11,15),(0,5,10,15),(1,6,11,12),(2,7,8,13),(3,4,9,14)):
        c+=b''.join(LG(x) for x in q)+CALL(0)
    body=vec([])+c+b'\x0b';return uleb(len(body))+body
# --- fill(x,y,o,withXor): R bei 0, Z bei 1024
def fill():
    i,v=4,5
    c=I32C(0)+LS(i)
    # Schleife 1: R=Z=X^Y
    c+=b'\x03\x40'+LG(0)+LG(i)+b'\x6a'+LD+LG(1)+LG(i)+b'\x6a'+LD+XOR+LS(v)
    c+=LG(i)+LG(v)+ST+LG(i)+I32C(1024)+b'\x6a'+LG(v)+ST
    c+=LG(i)+I32C(8)+b'\x6a'+LT(i)+I32C(1024)+b'\x49'+b'\x0d\x00'+b'\x0b'
    Z=1024
    for r in range(8):
        base=Z+r*128;c+=b''.join(I32C(base+8*k) for k in range(16))+CALL(1)
    for col in range(8):
        base=Z+col*16;idx=[0,1,16,17,32,33,48,49,64,65,80,81,96,97,112,113];c+=b''.join(I32C(base+8*k) for k in idx)+CALL(1)
    # Schleife 2: Out = Z^R (^Out)
    c+=I32C(0)+LS(i)
    c+=b'\x03\x40'+LG(i)+I32C(1024)+b'\x6a'+LD+LG(i)+LD+XOR+LS(v)
    c+=LG(3)+b'\x04\x40'+LG(v)+LG(2)+LG(i)+b'\x6a'+LD+XOR+LS(v)+b'\x0b'
    c+=LG(2)+LG(i)+b'\x6a'+LG(v)+ST
    c+=LG(i)+I32C(8)+b'\x6a'+LT(i)+I32C(1024)+b'\x49'+b'\x0d\x00'+b'\x0b'
    body=vec([uleb(1)+bytes([I32]),uleb(1)+bytes([I64])])+c+b'\x0b';return uleb(len(body))+body
types=vec([b'\x60'+vec([bytes([I32])]*4)+vec([]),b'\x60'+vec([bytes([I32])]*16)+vec([])])
imports=vec([vec([b'e'])[0:0]+uleb(3)+b'env'+uleb(3)+b'mem'+b'\x02\x00\x01'])
funcs=vec([uleb(0),uleb(1),uleb(0)])
exports=vec([uleb(4)+b'fill'+b'\x00'+uleb(2)])
code=vec([gb(),pfun(),fill()])
mod=b'\x00asm\x01\x00\x00\x00'+sec(1,types)+sec(2,imports)+sec(3,funcs)+sec(7,exports)+sec(10,code)
open('argon2.wasm','wb').write(mod);print(len(mod),'Bytes');open('wasm_b64.txt','w').write(base64.b64encode(mod).decode())
