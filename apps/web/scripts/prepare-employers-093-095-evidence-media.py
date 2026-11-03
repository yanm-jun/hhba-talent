#!/usr/bin/env python3
"""Build isolated 093–095 review media from explicitly attributed historical sources.
Image readability/identity source provenance != commercial reuse permission.
On failure keep clearly labelled non-real SVG placeholders; never silently substitute.
"""
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError
import hashlib,json

ROOT=Path("public/images/employer-profiles")
DATA=Path("src/data/employerProfiles")
LIMIT=9_000_000

def read_image(url, referer):
    host=urlparse(url).hostname
    if not host or urlparse(url).scheme!="https":
        raise ValueError("source requires HTTPS with hostname")
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 HHBA-source-audit/1.0","Referer":referer,"Accept":"image/*"})
    with urlopen(req,timeout=18) as response:
        target=response.geturl()
        if urlparse(target).scheme!="https":
            raise ValueError("redirect downgraded HTTPS")
        mime=response.headers.get("Content-Type","").lower()
        if mime and not mime.startswith("image/") and mime!="application/octet-stream":
            raise ValueError("nonimage response "+mime[:40])
        raw=response.read(LIMIT+1)
    if len(raw)>LIMIT:
        raise ValueError("source file too large")
    with Image.open(BytesIO(raw)) as image:
        image.load()
        image=ImageOps.exif_transpose(image).convert("RGB")
        w,h=image.size
        if w<450 or h<280 or w/h<0.50 or w/h>4.5:
            raise ValueError("image geometry unsuitable "+str((w,h)))
        buffer=BytesIO()
        image.save(buffer,"JPEG",quality=88,optimize=True)
        output=buffer.getvalue()
    if len(output)<7000:
        raise ValueError("tiny image output")
    return output,(w,h)

for num in ("093","094","095"):
    id="cn-autumn-"+num
    folder=ROOT/id
    jsonfile=DATA/(id+".json")
    prof=json.loads(jsonfile.read_text(encoding="utf8"))
    auditfile=folder/"media-sources.json"
    audit=json.loads(auditfile.read_text(encoding="utf8"))
    seen=set()
    count=0
    for item in audit["photos"]:
        slot=item["slot"]
        photo=prof["media"]["photos"][slot-1]
        target=folder/("photo"+str(slot)+".jpg")
        try:
            output,dimensions=read_image(item["imageUrl"],item["articleUrl"])
            sha=hashlib.sha256(output).hexdigest()
            if sha in seen:
                raise ValueError("duplicated source photo")
            seen.add(sha)
            target.write_bytes(output)
            count+=1
            item.update(status="source_picture_verified",sha256=sha,filename=target.name,dimensions=dimensions,bytes=len(output))
            photo.update(path="images/employer-profiles/"+id+"/"+target.name,
                caption=item["sourceContext"],
                alt=item["sourceContext"]+"，历史照片非当前办公状态证明",
                note="来源："+item["articleUrl"]+"；历史图片，商业转载授权尚未取得。")
        except Exception as e:
            target.unlink(missing_ok=True)
            item.update(status="nonreal_svg_fallback",error=str(e)[:160])
            print("HHBA_MEDIA_FALLBACK",num,slot,str(e)[:90])
    brand=audit["brand"]
    if num!="095":
        target=folder/"brand-logo.jpg"
        try:
            output,dimensions=read_image(brand["sourceImageUrl"],brand["sourcePageUrl"])
            target.write_bytes(output)
            prof["media"]["logo"]="images/employer-profiles/"+id+"/"+target.name
            brand.update(status="third_party_logo_reference_verified_not_licensed",filename=target.name,dimensions=dimensions,sha256=hashlib.sha256(output).hexdigest())
        except Exception as e:
            target.unlink(missing_ok=True)
            brand.update(status="nonofficial_editorial_wordmark_fallback",error=str(e)[:160])
            print("HHBA_LOGO_FALLBACK",num,str(e)[:90])
    audit["sourcedImages"]=count
    audit["commercialRightsVerified"]=False
    prof["photoNote"]+=" 本次预览取回的历史来源图片 "+str(count)+"/2 张；素材版权再利用许可待审。"
    jsonfile.write_text(json.dumps(prof,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    auditfile.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("HHBA_MEDIA_AUDITED",num,count,"source images; permission not cleared")
