#!/usr/bin/env python3
"""Southern Publishing Media (601900) V2 factual media intake.

The logo is extracted from the header image of SOUTHERN PUBLISHING's own
2016 public disclosure PDF (p.1). Never substitute a guessed wordmark.
Two independently published 2026 activity photographs are imported directly.
"""
import io,json,pathlib,hashlib,importlib.util
import requests,fitz
from PIL import Image,ImageOps
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("hhba_media",HERE/"factory-v2-media.py")
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ROOT=HERE.parent
id="cn-autumn-026"
p=json.loads((ROOT/"src/data/employerProfiles"/(id+".json")).read_text())
urls=p["mediaSources"]
loc=ROOT/"public/images/employer-profiles"/id
loc.mkdir(parents=True,exist_ok=True)
def secure_bytes(url,ctype=None):
 mod.approved_host(url)
 with mod.session.get(url,stream=True,timeout=(10,35),allow_redirects=False,verify=True) as r:
  r.raise_for_status()
  if r.is_redirect:raise ValueError("Redirect disallowed")
  ty=r.headers.get("Content-Type","").lower()
  if ctype and ctype not in ty:raise ValueError("Wrong content type "+ty)
  out=bytearray()
  for chunk in r.iter_content(65536):
   out.extend(chunk)
   if len(out)>18_000_000:raise ValueError("Overlarge file")
  return bytes(out)
def save(im,path):
 im=ImageOps.exif_transpose(im)
 im.load()
 if im.width<180 or im.height<60: raise ValueError("Unusable image dimensions "+str(im.size))
 im.thumbnail((1800,1200))
 buf=io.BytesIO()
 if path.suffix==".png":im.convert("RGBA").save(buf,"PNG",optimize=True)
 else:im.convert("RGB").save(buf,"WEBP",quality=87,method=6)
 data=buf.getvalue()
 if not 100<len(data)<5_000_000:raise ValueError("Invalid output media")
 path.write_bytes(data)
 return {"path":"images/employer-profiles/"+id+"/"+path.name,"size":len(data),"dimensions":[im.width,im.height],"sha256":hashlib.sha256(data).hexdigest()}
manifest={}
logo=loc/"logo.png"
pdf=secure_bytes(urls["logo"],"pdf")
doc=fitz.open(stream=pdf,filetype="pdf")
if not 1<=len(doc)<=150:raise ValueError("Unexpected disclosure PDF")
page=doc[0]
candidates=[]
for entry in page.get_images(full=True):
 try:
  xref=entry[0]
  for rect in page.get_image_rects(xref):
   if rect.y0<180 and rect.width>30 and rect.height>12:
    candidates.append((rect.width*rect.height,rect,xref))
 except:pass
print("SPM_PDF_HEADER_IMAGES",[(round(a,0),tuple(round(v,1) for v in r),x) for a,r,x in candidates])
if not candidates:raise ValueError("No source identity graphic in PDF header; cannot invent company logo")
# Top of page may include rectangular SPM wordmark. Choose the highest
# qualifying header mark, excluding adviser logos placed near the bottom.
candidates.sort(key=lambda x:(x[1].y0,-x[0]))
_,rect,xref=candidates[0]
# The official PDF's *embedded image* is the authoritative logo source.
d=doc.extract_image(xref)
if not d or not d.get("image"):raise ValueError("Cannot extract authentic PDF logo")
im=Image.open(io.BytesIO(d["image"])).convert("RGBA")
# Logo may be tiny in embedded PDF but vector/bitmap re-rendering is allowed.
if im.width<180 or im.height<60:
 im=im.resize((max(240,im.width*4),max(100,im.height*4)),Image.Resampling.LANCZOS)
manifest["logo"]={**save(im,logo),"source":urls["logo"],"sourceType":"public disclosure PDF p.1 embedded image","pdfRect":list(rect)}
for key in ("photo1","photo2"):
 target=loc/(key+".webp")
 contents=secure_bytes(urls[key],"image")
 with Image.open(io.BytesIO(contents)) as im:
  im.verify()
 with Image.open(io.BytesIO(contents)) as im:
  manifest[key]={**save(im,target),"source":urls[key],"sourceType":"independent published news/event photography"}
 if manifest[key]["dimensions"][0]<400:raise ValueError("Poor photo resolution "+key)
assert len({x["sha256"] for x in manifest.values()})==3,"Assets must be distinct"
(loc/"source-manifest-v2.json").write_text(json.dumps({"company":p["name"],"employer_id":id,"assets":manifest},ensure_ascii=False,indent=2)+"\n")
print("HHBA_SOUTHERN_026_MEDIA_READY",json.dumps(manifest,ensure_ascii=False))
