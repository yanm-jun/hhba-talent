"""Create a synthetic PDF with a *genuinely embedded* subset Chinese TTF.

CI-only fixture; source font comes from the runner's OS font package. No font
file is vendored in the HHBA repository and no candidate document is used.
Requires: python3 -m pip install fonttools, fonts-arphic-gbsn00lp.
"""
from __future__ import annotations
import io
import pathlib
import sys
from fontTools.ttLib import TTFont
from fontTools import subset

SOURCE = "中国测试"
FONT = pathlib.Path("/usr/share/fonts/truetype/arphic-gbsn00lp/gbsn00lp.ttf")

def make_fixture(output: pathlib.Path) -> None:
    if not FONT.is_file():
        raise RuntimeError("synthetic CJK QA font not installed")
    options = subset.Options()
    options.notdef_glyph = True
    options.notdef_outline = True
    face = TTFont(str(FONT))
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=[ord(ch) for ch in SOURCE])
    subsetter.subset(face)
    stream = io.BytesIO()
    face.save(stream)
    ttf = stream.getvalue()
    if not ttf.startswith(b"\x00\x01\x00\x00") or len(ttf) > 100_000:
        raise RuntimeError("unexpected subset font, abort synthetic test")
    cmap = face["cmap"].getBestCmap()
    codes = {ch: face.getGlyphID(cmap[ord(ch)]) for ch in SOURCE}
    if any(code == 0 or code > 65535 for code in codes.values()):
        raise RuntimeError("glyph subset failed")
    units = face["head"].unitsPerEm
    widths = " ".join(
        f"{codes[ch]} [{round(face['hmtx'][cmap[ord(ch)]][0] * 1000 / units)}]"
        for ch in SOURCE
    )
    to_unicode = [
        "/CIDInit /ProcSet findresource begin",
        "12 dict begin",
        "begincmap",
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
        "/CMapName /HHBAToUnicode def",
        "/CMapType 2 def",
        "1 begincodespacerange",
        "<0000> <FFFF>",
        "endcodespacerange",
        f"{len(SOURCE)} beginbfchar",
        *(f"<{codes[ch]:04X}> <{ord(ch):04X}>" for ch in SOURCE),
        "endbfchar",
        "endcmap",
        "CMapName currentdict /CMap defineresource pop",
        "end",
        "end",
        "",
    ]
    cmap_data = "\n".join(to_unicode).encode("ascii")
    payload = (
        b"BT /F1 22 Tf 40 760 Td <"
        + "".join(f"{codes[ch]:04X}" for ch in SOURCE).encode("ascii")
        + b"> Tj ET"
    )
    name = "HHBAChineseFontQA"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        (
            f"<< /Type /Font /Subtype /Type0 /BaseFont /{name} "
            f"/Encoding /Identity-H /DescendantFonts [6 0 R] "
            f"/ToUnicode 7 0 R >>"
        ).encode("ascii"),
        f"<< /Length {len(payload)} >>\nstream\n".encode("ascii")
        + payload + b"\nendstream",
        (
            f"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /{name} "
            f"/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) "
            f"/Supplement 0 >> /FontDescriptor 8 0 R "
            f"/CIDToGIDMap /Identity /DW 1000 /W [{widths}] >>"
        ).encode("ascii"),
        f"<< /Length {len(cmap_data)} >>\nstream\n".encode("ascii")
        + cmap_data + b"\nendstream",
        (
            f"<< /Type /FontDescriptor /FontName /{name} /Flags 4 "
            f"/FontBBox [-200 -300 1200 1000] /ItalicAngle 0 /Ascent 900 "
            f"/Descent -200 /CapHeight 800 /StemV 80 /FontFile2 9 0 R >>"
        ).encode("ascii"),
        f"<< /Length {len(ttf)} /Length1 {len(ttf)} >>\nstream\n".encode("ascii")
        + ttf + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for index, body in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += f"{index} 0 obj\n".encode("ascii") + body + b"\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode("ascii")
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")
    pdf += (
        f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode("ascii")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(pdf)
    print(f"Synthetic embedded-CJK PDF created: {output} ({len(pdf)} bytes)")

if __name__ == "__main__":
    make_fixture(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "qa/generated-cjk-original.pdf"))
