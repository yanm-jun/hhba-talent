#!/usr/bin/env python3
"""Prepare 3 locally hosted, source-traceable Guangzhilv enterprise media assets."""
from pathlib import Path
from io import BytesIO
from urllib.request import Request, urlopen
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1] / "public/images/employer-profiles/cn-autumn-027"
root.mkdir(parents=True, exist_ok=True)
sources = {
    "logo.png": "https://img.traveldaily.cn/user/photo/20000/29078_a800eab4e2b0ca78.png",
    "photo1.jpg": "https://gzw.gz.gov.cn/img/0/251/251984/6881721.png",
    "photo2.jpg": "https://p8.itc.cn/q_70/images03/20230323/3690fdf1616f46e6a101e157bb96bae9.jpeg",
}
for name, url in sources.items():
    path = root / name
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; HHBA-EditorialMediaAudit/1.0)"})
    with urlopen(req, timeout=45) as response:
        raw = response.read(9_000_001)
    if len(raw) < 1000 or len(raw) > 9_000_000:
        raise ValueError(f"Media invalid length: {name}")
    im = Image.open(BytesIO(raw))
    im.verify()
    im = Image.open(BytesIO(raw))
    if im.width < 160 or im.height < 140:
        raise ValueError(f"Media too small: {name}, {im.size}")
    im = ImageOps.exif_transpose(im).convert("RGB")
    if name.endswith(".png"):
        im.save(path, "PNG", optimize=True)
    else:
        im.thumbnail((1800, 1400))
        im.save(path, "JPEG", quality=86, optimize=True)
    print(name, im.size, path.stat().st_size, url)
