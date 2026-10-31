#!/usr/bin/env python3
"""Strict source-backed Guangdong Rural Credit building and Chengda event photo packaging.
Non-photographic assets are separate SVG with explicit editorial label, never photo.jpg.
Commercial reuse and copyright remain unverified.
"""
import json,hashlib,re,ssl
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request,urlopen
from PIL import Image,ImageOps
ROOT=Path("public/images/employer-profiles")
SSL=ssl.create_default_context(); SSL.options|=0x4
UA="Mozilla/5.0 (HHBA photo provenance audit)"
def fetch(url,ref=None):
 req=Request(url,headers={"User-Agent":UA,"Referer":ref or url,"Accept":"image/avif,image/webp,image/*,text/html,*/*;q=0.8"})
 with urlopen(req,timeout=28,context=SSL) as r:return r.read(10000000)
def save(id,n,url,ref,note):
 data=fetch(url,ref)
 im=ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB");w,h=im.size
 if w<425 or h<290 or w/h<0.68 or w/h>4:raise RuntimeError(f"invalid sourced photo {w}x{h} {url}")
 folder=ROOT/("cn-autumn-"+id);folder.mkdir(parents=True,exist_ok=True)
 fname=f"photo{n}.jpg";im.save(folder/fname,"JPEG",quality=91,optimize=True)
 out=(folder/fname).read_bytes()
 if len(out)<12000:raise RuntimeError(f"too small {len(out)} {url}")
 record={"filename":fname,"sourceImageUrl":url,"pageEvidence":ref,"sourceDescription":note,"dimensions":[w,h],"sha256":hashlib.sha256(out).hexdigest(),"rights":"photo original publisher; commercial republishing permission NOT verified"}
 print("HHBA_REAL_SOURCE_IMAGE",id,json.dumps(record,ensure_ascii=False));return record
# An unmistakably labeled building image in a 2024 report on Guangdong Rural Credit.
bank=save("069",1,"https://n.sinaimg.cn/finance/crawl/155/w550h405/20240722/c61f-3a7341623c76af3a7712122bcda0a2fa.png","https://finance.sina.com.cn/money/bank/gsdt/2024-07-22/doc-inceytkc4652453.shtml","Guangdong Rural Credit Union Building photographed exterior; news media, not company HQ interior")
(ROOT/"cn-autumn-069"/"media-sources.json").write_text(json.dumps([bank],ensure_ascii=False,indent=2)+"\n",encoding="utf8")
# Qingdao media article contains actual photos of Chengda Group—Qingdao University visits.
PAGES=[
"https://auto.qingdaonews.com/content/2025-12/03/content_23704648.htm",
"https://auto.qingdaonews.com/content/2025-11/07/content_23699709.htm",
]
class Images(HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.body=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=="img":
   url=next((d.get(k) for k in ("data-original","data-src","data-lazy","src") if d.get(k)),None)
   if url:self.images.append((url,d.get("alt","")))
 def handle_data(self,d):self.body.append(d.strip())
found=[];seen=set()
for page in PAGES:
 try:
  html=fetch(page).decode("utf8","ignore")
  parser=Images();parser.feed(html)
  if "成达集团" not in "".join(parser.body):raise RuntimeError("wrong company page")
  print("HHBA_CHENGDA_NEWS_IMAGE_CANDIDATES",page,json.dumps(parser.images[:50],ensure_ascii=False))
  for src,alt in parser.images:
   if len(found)>=2:break
   url=urljoin(page,src.strip().replace("&amp;","&"))
   if url in seen:continue
   seen.add(url)
   if any(k in url.lower() for k in ("logo","icon","avatar","ewm","weixin","erweima","qr","banner","footer","top_","1x1")):continue
   try:
    r=save("070",len(found)+1,url,page,"Actual Chengda Group event or dealership display shown in news article; "+alt[:90])
    if any(r["sha256"]==x["sha256"] for x in found):
     (ROOT/"cn-autumn-070"/r["filename"]).unlink(missing_ok=True);continue
    found.append(r)
   except Exception as exc:print("HHBA_CHENGDA_SKIP",url,str(exc)[:140])
 except Exception as exc:print("HHBA_CHENGDA_SOURCE_ERROR",page,str(exc)[:200])
 if len(found)>=2:break
if len(found)!=2:raise RuntimeError(f"Chengda actual news images verified: {len(found)}/2; fake photos forbidden")
(ROOT/"cn-autumn-070"/"media-sources.json").write_text(json.dumps(found,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("HHBA_069_070_SOURCE_MEDIA_OK")
