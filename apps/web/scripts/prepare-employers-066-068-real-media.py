#!/usr/bin/env python3
"""Prepare independently sourced corporate images for HHBA 066-068 static preview.
Do not invent photos or label an official product diagram as an office photograph.
Every downloaded image is validated and retains original URL and SHA-256 in the
build artifact's per-company media-sources.json. Only run in CI; no binary blobs
are committed as unverifiable or unlicensed "official" stock pictures.
"""
from __future__ import annotations
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps
import hashlib
import json
import re
import time

ROOT=Path("public/images/employer-profiles")
USER_AGENT="Mozilla/5.0 (compatible; HHBA-Enterprise-Evidence-Audit/1.0; sourced image attribution)"
SOURCES={
 "067":[("photo1.png","https://www.cnpresky.com/img/jingzhun.52bb8582.png",
          "Company website product-visual artwork, not a photograph")],
 "068":[("photo1.jpg","https://liuhuahuagong.com/hdupf/gimg/202506/20250610112656_333342.jpg",
          "Official LiuHua Chemical Group subsidiary site, real plant construction"),
        ("photo2.jpg","https://www.liuhuahuagong.com/hdupf/img/202509/202509301759224056485957.jpg",
          "Official LiuHua subsidiary site, genuine air separation facility")]
}
def get(url,referer=None):
    req=Request(url,headers={"User-Agent":USER_AGENT,"Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                             "Referer":referer or url, "Accept-Language":"zh-CN,zh;q=0.9"})
    with urlopen(req,timeout=22) as res:
        if res.status != 200: raise ValueError(f"HTTP {res.status}")
        data=res.read(9_000_000)
    return data
def save_image(company,filename,data,url,note,require_photograph=True):
    im=Image.open(BytesIO(data))
    im=ImageOps.exif_transpose(im)
    width,height=im.size
    if width<540 or height<260: raise ValueError(f"Image too small: {width}x{height}, {url}")
    if width/height<0.8 or width/height>3.8: raise ValueError(f"Unusual aspect ratio {width}/{height}: {url}")
    rgb=im.convert("RGB")
    output=ROOT/("cn-autumn-"+company)/filename
    output.parent.mkdir(parents=True,exist_ok=True)
    if filename.endswith(".jpg"):
        rgb.save(output,format="JPEG",quality=91,optimize=True)
    else:
        rgb.save(output,format="PNG",optimize=True)
    assert output.stat().st_size > 12000, (filename,output.stat().st_size)
    result={"filename":filename,"sourceUrl":url,"sourceNote":note,
            "width":width,"height":height,"sha256":hashlib.sha256(output.read_bytes()).hexdigest(),
            "photographClaim":require_photograph,
            "republishingRights":"Source public; independent reproduction license not confirmed"}
    print("HHBA_SOURCED_MEDIA",company,json.dumps(result,ensure_ascii=False))
    return result

for company,items in SOURCES.items():
    outputs=[]
    for filename,url,note in items:
        data=get(url,url.rsplit("/",1)[0]+"/")
        outputs.append(save_image(company,filename,data,url,note,company=="068"))
    (ROOT/("cn-autumn-"+company)/"media-sources.json").write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+"\n",encoding="utf8")

# Corporate events: crawl first-party news and staff-life pages, never an unowned stock search.
# Prefer first-party exact-story photos. No synthetic substitution if images cannot be verified.
class Images(HTMLParser):
    def __init__(self):super().__init__();self.images=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower() not in ("img","source"): return
        a=dict(attrs)
        for k in ("data-original","data-src","data-lazy","data-image","src","srcset"):
            val=a.get(k)
            if val:
                for item in (val.split(",") if k=="srcset" else [val]):
                    src=item.strip().split(" ")[0]
                    if src:self.images.append((src,a.get("alt",""),k))
                break

base_pages=[
 "https://www.daofortune.com/Business_Details/2060272087576154112.html",
 "https://www.daofortune.com/Blog_Details/52.html",
 "https://www.daofortune.com/About.html",
]
collected=[];visited=set();seen=set()
for page in base_pages:
    try:
        html=get(page).decode("utf-8","ignore")
    except Exception as err:
        print("HHBA_066_HTML_FETCH_RETRYABLE",page,str(err)[:180]);continue
    parser=Images();parser.feed(html)
    candidates=parser.images
    # Some CMS templates hold article pictures as JSON strings or CSS backgrounds.
    candidates += [(x,"","html-image-reference") for x in re.findall(r'(?:(?:https?:)?//[^"<>\\\\\\s]+|/[^"<>\\\\\\s]+)\\.(?:jpg|jpeg|png|webp)(?:\\?[^"<>\\\\\\s]*)?',html,re.I)]
    print("HHBA_066_CANDIDATE_COUNT",page,len(candidates))
    for src,alt,origin in candidates[:75]:
        url=urljoin(page,unescape(src).replace("\\/","/"))
        host=(urlparse(url).hostname or "").lower()
        if host not in ("www.daofortune.com","daofortune.com") and not host.endswith(".daofortune.com"):continue
        if url in seen:continue
        seen.add(url)
        if any(t in url.lower() for t in ("logo","icon","ewm","erweima","qr","cert","honor","avatar","banner","1x1","footer","wechat","svg")):continue
        try:
            data=get(url,page)
            im=Image.open(BytesIO(data))
            if im.width<650 or im.height<320 or not (0.85<im.width/im.height<3.5):continue
            digest=hashlib.sha256(data).hexdigest()
            if digest in visited:continue
            visited.add(digest)
            collected.append((url,data,page,alt))
            print("HHBA_066_FIRST_PARTY_CANDIDATE",url,im.size,"alt",alt[:65])
            if len(collected)>=2:break
        except Exception as err:
            print("HHBA_066_SKIP_IMAGE",url,str(err)[:90])
    if len(collected)>=2:break
if len(collected)<2:
    raise RuntimeError("Insufficient verified company-owned event photography at official Dao Fortune pages; do not publish fabricated photographs. Review source URL accessibility and official gallery.")
out=[]
for i,(url,data,page,alt) in enumerate(collected[:2],1):
    out.append(save_image("066",f"photo{i}.jpg",data,url,
             "Corporate event/workplace photograph extracted from Dao Fortune first-party page "+page+
             (" (alt: "+alt[:80]+")" if alt else ""),True))
(ROOT/"cn-autumn-066"/"media-sources.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("HHBA_066_068_CORPORATE_MEDIA_PACKAGING_OK",json.dumps({k:len(list((ROOT/("cn-autumn-"+k)).glob("photo*"))) for k in ("066","067","068")}))
