#!/usr/bin/env python3
"""Dev-only PNG icon generator using the standard library; replace with official Aurora branding for release."""
import struct, zlib, math
from pathlib import Path

def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

def save_icon(size, destination):
    rows=[]
    for y in range(size):
        scan=bytearray([0])
        for x in range(size):
            u,v=x / size,y / size
            wave=math.sin((u*3.4+v*1.2)*math.pi)
            glow=max(0, 1-abs(v-(0.25+0.17*wave))*3)
            r=int(9+glow*36)
            g=int(25+glow*190)
            b=int(44+glow*114)
            # Abstract 'A' mark; placeholder for development packaging only.
            left=abs(u-(.30+.21*(.72-v)))<.038 and .18<v<.79
            right=abs(u-(.70-.21*(.72-v)))<.038 and .18<v<.79
            bar=.43<v<.50 and .40<u<.60
            if left or right or bar: r,g,b=218,255,245
            scan.extend((r,g,b,255))
        rows.append(bytes(scan))
    raw=zlib.compress(b"".join(rows),9)
    data=b"\x89PNG\r\n\x1a\n"
    data+=chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0))
    data+=chunk(b"IDAT",raw)+chunk(b"IEND",b"")
    Path(destination).parent.mkdir(parents=True,exist_ok=True)
    Path(destination).write_bytes(data)

save_icon(80,"dist/branding/icon.png")
save_icon(130,"dist/branding/largeicon.png")
