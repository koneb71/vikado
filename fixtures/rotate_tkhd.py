"""Patch the tkhd display matrix of an MP4 video track to 90 degrees clockwise.

ffmpeg 8 no longer writes a rotation matrix via -metadata rotate=, and the
h264_metadata rotate option writes a display-orientation SEI, which neither
mediabunny nor browsers use. The container matrix is what matters, so set it
directly.
"""

import struct
import sys

IDENTITY = (0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)
# 90 degrees clockwise: (x,y) -> (-y, x)
ROT90 = (0, 0x10000, 0, -0x10000 & 0xFFFFFFFF, 0, 0, 0, 0, 0x40000000)


def walk(buf, start, end, path=()):
    """Yield (box_type, payload_start, payload_end, path) for every box."""
    pos = start
    while pos + 8 <= end:
        size = struct.unpack_from(">I", buf, pos)[0]
        btype = bytes(buf[pos + 4 : pos + 8])
        header = 8
        if size == 1:
            size = struct.unpack_from(">Q", buf, pos + 8)[0]
            header = 16
        elif size == 0:
            size = end - pos
        if size < header:
            break
        yield btype, pos + header, pos + size, path
        if btype in (b"moov", b"trak", b"mdia", b"minf", b"stbl"):
            yield from walk(buf, pos + header, pos + size, path + (btype,))
        pos += size


def main(path):
    buf = bytearray(open(path, "rb").read())

    # a track is video if its mdia/hdlr handler type is 'vide'
    traks = []
    for btype, s, e, _ in walk(buf, 0, len(buf)):
        if btype == b"trak":
            traks.append((s, e))

    patched = 0
    for ts, te in traks:
        is_video = any(
            btype == b"hdlr" and bytes(buf[s + 8 : s + 12]) == b"vide"
            for btype, s, e, _ in walk(buf, ts, te)
        )
        if not is_video:
            continue
        for btype, s, e, _ in walk(buf, ts, te):
            if btype != b"tkhd":
                continue
            version = buf[s]
            off = s + 4 + (32 if version == 1 else 20) + 16
            before = struct.unpack_from(">9i", buf, off)
            struct.pack_into(">9I", buf, off, *ROT90)
            print(f"tkhd @{off}: {before[:4]} -> rotated 90")
            patched += 1

    if not patched:
        sys.exit("no video tkhd found")
    open(path, "wb").write(buf)
    print(f"patched {patched} track(s) in {path}")


if __name__ == "__main__":
    main(sys.argv[1])
