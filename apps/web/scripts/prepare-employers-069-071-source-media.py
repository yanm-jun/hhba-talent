#!/usr/bin/env python3
"""Scrape attributable company/event photos into isolated HHBA review build.
No screenshot, generated art, or unrelated bank/dealer photo is labeled a real company photo.
On failure, the CI build fails rather than silently replacing a photo with fake content.
Copyright/use permission is unverified even if article is publicly readable.
"""
from __future__ import annotations
import hashlib,json,re,ssl
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
from html.parser import HTMLParser
from PIL import Image,ImageOps
from io import BytesIO

ROOT=Path("public/images/employer-profiles")
UA="Mozilla/5.0 (compatible; HHBA FirstPartyPhotoAudit/1.0)"
PAGES={
"069":[
 ("https://www.gdrcu.com/gdrcunew/nxdt/nsfc/202602/129907.html","Guangdong Rural Credit official network event; NOT HQ office"),
 ("https://www.gdrcu.com/gdrcunew/nxdt/nsfc/202609/136383.html","Guangdong rural commercial bank in-system training; NOT HQ office"),
 ("https://www.gdrcu.com/gdrcunew/nxdt/nxtdl/202606/133488.html","Guangdong Rural Credit official business reporting")
],
"070":[
 ("https://auto.qingdaonews.com/content/2025-12/03/content_23704648.htm","2025 Qingdao University—Chengda Group joint training ceremony"),
 ("https://auto.qingdaonews.com/content/2025-11/07/content_23699709.htm","Chengda Group actual exhibition booths at 2025 Qingdao auto show")
]
}
class Parsed(HTMLParser):
 def __init__(self):
  super().__init__();self.images=[];self.known=False;self.full=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='img':
   src=next((d.get(k) for k in ('data-original','data-src','data-lazy','data-image','src') if d.get(k)),None)
   if src:self.images.append((src,d.get('alt',''),dict(a)))
  if t=='meta' and d.get('property') in ('og:image','twitter:image'):
   if d.get('content'):self.images.append((d['content'],'meta-image',d))
 def handle_data(self,data):
  if data.strip():self.full.append(data.strip())
def get(url,ref=None):
 req=Request(url,headers={"User-Agent":UA,"Referer":ref or url,"Accept":"text/html,image/*,*/*;q=0.8"})
 context=ssl.create_default_context()
 context.options|=0x4  # OpenSSL SSL_OP_LEGACY_SERVER_CONNECT for Guangdong rural credit legacy portal
 with urlopen(req,timeout=28,context=context) as r:
  if r.status!=200:raise RuntimeError(f"HTTP {r.status}: {url}")
  return r.read(12_000_000)
for id,pages in PAGES.items():
 found=[];seen={};reports=[]
 for page,note in pages:
  try:
   text=get(page).decode("utf-8","ignore")
   parser=Parsed();parser.feed(text)
   context=" ".join(parser.full)
   must=("广东" if id=="069" else "成达")
   if must not in context:raise ValueError("Page is not grounded in named employer")
   imgs=list(parser.images)
   imgs += [(raw,"inline-reference",{}) for raw in re.findall(r'(?:(?:https?:)?//[^"\\s<>]+|/[^"\\s<>]+)\\.(?:jpe?g|png|webp)(?:\\?[^"\\s<>]*)?',text,re.I)]
   print("HHBA_IMAGE_SOURCE_PAGE",id,page,"Candidates",len(imgs))
   for raw,alt,attrs in imgs[:120]:
    if len(found)>=2:break
    if not raw or raw.startswith("data:"):continue
    link=urljoin(page,raw.replace("&amp;","&").replace("\\/","/"))
    if link in seen:continue
    seen[link]=1
    if any(k in link.lower() for k in ("logo","icon","qrcode","qr_","ewm","avatar","wechat","indexbanner","nopic","blank","footer","top_","bg.","pixel")):continue
    try:
     data=get(link,page)
     im=Image.open(BytesIO(data));im=ImageOps.exif_transpose(im)
     w,h=im.size
     if not(640<=w<=12000 and 345<=h<=12000 and 0.7<=w/h<=4.1):continue
     if len(data)<17000:continue
     digest=hashlib.sha256(im.convert("RGB").tobytes()).hexdigest()
     if any(r.get('sourcePixelSHA256')==digest for r in found):continue
     fname=f"photo{len(found)+1}.jpg"
     folder=ROOT/("cn-autumn-"+id);folder.mkdir(parents=True,exist_ok=True)
     im.convert("RGB").save(folder/fname,"JPEG",quality=91,optimize=True)
     outfile=(folder/fname).read_bytes()
     audit={"filename":fname,"exactImageUrl":link,"publishedNewsPage":page,
       "captionContext":note,"sourceAlt":alt,"pixels":[w,h],"sourcePixelSHA256":digest,
       "sha256":hashlib.sha256(outfile).hexdigest(),"fileBytes":len(outfile),
       "photoType":"actual organizational activity / news illustration; not claimed to be HQ or a specific job's office",
       "imageRights":"public article image; independent republication license not yet verified"}
     found.append(audit)
     print("HHBA_COMPANY_EVENT_REAL_PHOTO",id,json.dumps(audit,ensure_ascii=False))
    except Exception as error:
     print("HHBA_SKIP_CANDIDATE",id,str(error)[:180])
  except Exception as error:print("HHBA_SOURCE_UNREACHABLE",id,page,str(error)[:200])
  if len(found)>=2:break
 if len(found)!=2:raise RuntimeError(f"Company {id}: only {len(found)} credible article images acquired; do not synthesize/copy unrelated photos")
 (ROOT/("cn-autumn-"+id)/"media-sources.json").write_text(json.dumps(found,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("HHBA_069_070_FOUR_SOURCE_IMAGE_FILES_READY")
