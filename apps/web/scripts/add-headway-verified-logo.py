#!/usr/bin/env python3
"""Only retrieve the employer-specific mark declared by verified Headway ATS board.

Never take Ashby's platform favicon, Google search results, or a same-name
Headway company. The exact ATS board must declare the logo as og:image.
"""
import json,hashlib,re,urllib.request,urllib.parse,html.parser,io,pathlib
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
BOARD="https://jobs.ashbyhq.com/headway"
class OG(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.titles=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=="meta" and a.get("property")=="og:image":self.images.append(a.get("content",""))
  if tag=="meta" and a.get("property")=="og:title":self.titles.append(a.get("content",""))
def fetch(url,cap=600000):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (HHBA verified employer source icon inspector)","Accept":"text/html,image/png,*/*"})
 with urllib.request.urlopen(req,timeout=35) as r:
  raw=r.read(cap+1)
  if len(raw)>cap:raise ValueError("image too large")
  return raw,r.geturl(),r.headers.get("Content-Type","")
page,final,mime=fetch(BOARD)
if final.rstrip("/")!=BOARD:raise ValueError("unexpected ATS source board redirect")
html=page.decode("utf-8","ignore")
meta=OG();meta.feed(html)
if len(meta.images)!=1:raise ValueError("Headway employer logo absent or ambiguous on Ashby board")
source=meta.images[0]
parsed=urllib.parse.urlparse(source)
if (parsed.scheme!="https" or parsed.hostname!="app.ashbyhq.com" or
 not parsed.path.startswith("/api/images/org-theme-logo/") or
 not parsed.path.endswith(".png") or parsed.username or parsed.password):
 raise ValueError("public image is not a Headway employer-specific ATS logo: "+source)
raw,actual,ctype=fetch(source)
if urllib.parse.urlsplit(actual).hostname!="app.ashbyhq.com":raise ValueError("unsafe image redirect")
if not raw.startswith(b"\x89PNG\r\n\x1a\n"):raise ValueError("ATS image is not original PNG")
img=Image.open(io.BytesIO(raw));img.load()
w,h=img.size
if img.format!="PNG" or not (48<=w<=1600 and 48<=h<=1600):
 raise ValueError("invalid logo dimensions "+str(img.size))
out=ROOT/"public/brands/brand-headway.png"
out.write_bytes(raw)
sha=hashlib.sha256(raw).hexdigest()
regpath=ROOT/"src/data/verifiedBrandAssets.json"
provpath=ROOT/"public/brands/PROVENANCE.json"
reg=json.loads(regpath.read_text());prov=json.loads(provpath.read_text())
if len(reg["records"])!=49 or len(prov["records"])!=49:raise ValueError("baseline 49 brands expected")
record={"company":"Headway","platform":"ashby","source":"headway","file":"brand-headway.png",
 "color":"#000000","wide":w/h>2.4,"kind":"brand-board-icon"}
if any((r["company"],r["platform"],r["source"])==("Headway","ashby","headway") for r in reg["records"]):
 raise ValueError("duplicate employer")
reg["records"].append(record)
prov["records"].append({"company":"Headway","platform":"ashby","boardSource":"headway",
 "file":"brand-headway.png","attribution":"original company-specific logo declared in Headway's public Ashby employer recruitment page, not Ashby's generic favicon",
 "sourceUrl":source,"sourcePage":BOARD,"fetchedUrl":actual,"sha256":sha,
 "reviewNote":"HTML og:image metadata on exact company ATS board, verified source identity; not a company-site download or partnership license",
 "dimensions":[w,h]})
regpath.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
provpath.write_text(json.dumps(prov,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("HHBA_HEADWAY_EMPLOYER_MARK_CONFIRMED",json.dumps({"company":"Headway","ATSBoard":BOARD,
  "source":source,"size":img.size,"wide":record["wide"],"sha256":sha,"allEmployerLogos":50}))
