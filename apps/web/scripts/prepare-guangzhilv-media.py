#!/usr/bin/env python3
"""Package three independently stored Guangzhilv assets.
Verified public image URLs are preferred. If a media host blocks fetches, write
an unmistakably labeled unavailable placeholder rather than substituting stock
photos or falsely presenting an invented company scene as real.
"""
from pathlib import Path
from io import BytesIO
import time
from urllib.request import Request, urlopen
from PIL import Image, ImageOps, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / "public/images/employer-profiles/cn-autumn-027"
root.mkdir(parents=True, exist_ok=True)

sources = {
    "logo.png": [
        "https://img.traveldaily.cn/user/photo/20000/29078_a800eab4e2b0ca78.png",
    ],
    "photo1.jpg": [
        "https://mma.prnasia.com/media2/2728894/Image4.jpg?p=medium600",
        "https://www.cityhui.com/uploads/allimg/180828/1-1PRQ350590-L.jpg",
    ],
    "photo2.jpg": [
        "https://p8.itc.cn/q_70/images03/20230323/3690fdf1616f46e6a101e157bb96bae9.jpeg",
    ],
}

def placeholder(name: str) -> Image.Image:
    im = Image.new("RGB", (960, 600), (245, 247, 247))
    draw = ImageDraw.Draw(im)
    draw.rectangle((28, 28, 932, 572), outline=(179, 190, 185), width=3)
    draw.rectangle((28, 28, 932, 136), fill=(20, 89, 65))
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = ImageFont.truetype(font_path, 50) if Path(font_path).exists() else ImageFont.load_default()
    tiny = ImageFont.truetype(font_path, 24) if Path(font_path).exists() else ImageFont.load_default()
    draw.text((65, 58), "GZL  /  COMPANY PROFILE", fill="white", font=tiny)
    draw.text((65, 280), "MEDIA NOT AVAILABLE", fill=(45, 71, 60), font=font)
    draw.text((65, 365), name + ": source media blocked or unavailable", fill=(95, 105, 102), font=tiny)
    draw.text((65, 418), "Not a photograph of Guangzhilv", fill=(95, 105, 102), font=tiny)
    return im

for name, urls in sources.items():
    image = None
    origin = ""
    for url in urls:
        try:
            request = Request(url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://www.google.com/"
            })
            with urlopen(request, timeout=20) as response:
                raw = response.read(9_000_001)
            if not (1000 < len(raw) < 9_000_000):
                raise ValueError("Media length outside expected bounds")
            image = Image.open(BytesIO(raw))
            image.verify()
            image = ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert("RGB")
            if image.width < 160 or image.height < 140:
                raise ValueError("Image too small")
            origin = url
            break
        except Exception as exc:
            print("MEDIA_SOURCE_UNAVAILABLE", name, str(exc)[:180])
    if image is None:
        image = placeholder(name)
        print("GUANGZHILV_MEDIA_PLACEHOLDER_ONLY", name)
    image.thumbnail((1800, 1400))
    dest = root / name
    if name.endswith(".png"):
        image.save(dest, "PNG", optimize=True)
    else:
        image.save(dest, "JPEG", quality=86, optimize=True)
    print("GUANGZHILV_MEDIA_PACKAGED", name, image.size, dest.stat().st_size, origin or "placeholder")
