#!/usr/bin/env python3
"""Source-backed photographic and product media for HHBA #066-068.
First-party company photography is retrieved from exact media URLs referenced
by the company's official webpage, not guessed company names or stock imagery.
Photo rights and reproduction permissions remain separately unverified.
"""
from urllib.request import Request,urlopen
from pathlib import Path
from io import BytesIO
from PIL import Image,ImageOps
from hashlib import sha256
import json

ROOT=Path("public/images/employer-profiles")
UA="Mozilla/5.0 (HHBA corporate source-image QA/1.0)"
ASSETS={
"066":[
 ("photo1.jpg","https://omo-oss-image.thefastimg.com/portal-saas/pg2025112512521879813/cms/image/890620b5-7b92-4419-a8bf-e487a65712eb.jpg",
  "https://www.daofortune.com/About.html","Real employee group activity, company official About / 员工风采 gallery"),
 ("photo2.jpg","https://omo-oss-image.thefastimg.com/portal-saas/pg2025112512521879813/cms/image/a2b34803-ea63-4b96-820a-719bee64bddd.jpg",
  "https://www.daofortune.com/About.html","Second independent staff group activity, official company About / 员工风采 gallery")
],
"068":[
 ("photo1.jpg","https://liuhuahuagong.com/hdupf/gimg/202506/20250610112656_333342.jpg",
  "https://liuhuahuagong.com/","Real industrial facility operated by LiuHua Chemical, subsidiary of Gansu Energy Chemical Group"),
 ("photo2.jpg","https://www.liuhuahuagong.com/hdupf/img/202509/202509301759224056485957.jpg",
  "https://www.liuhuahuagong.com/col_xwzx1/202509/27352E666DC3E4FDCBC8D1F091EEB43B.htm",
  "Real air-separation facility in subsidiary's 2025 performance test article")
]}
for id,photos in ASSETS.items():
 folder=ROOT/("cn-autumn-"+id);folder.mkdir(parents=True,exist_ok=True)
 provenance=[]
 for filename,url,page,note in photos:
  req=Request(url,headers={"User-Agent":UA,"Referer":page,"Accept":"image/avif,image/webp,image/*,*/*;q=0.8"})
  with urlopen(req,timeout=35) as response:
   if response.status!=200:raise RuntimeError("Source image HTTP "+str(response.status)+": "+url)
   content=response.read(9_000_000)
  try: image=ImageOps.exif_transpose(Image.open(BytesIO(content)))
  except Exception as exc:raise RuntimeError("Source is not a photograph: "+url) from exc
  width,height=image.size
  if width<430 or height<260 or width/height<0.7 or width/height>4:
   raise RuntimeError("Image is too small or wrong aspect: "+str((width,height))+" "+url)
  destination=folder/filename
  image.convert("RGB").save(destination,"JPEG",quality=90,optimize=True)
  actual=destination.read_bytes()
  if len(actual)<12000:raise RuntimeError("Tiny photo: "+filename)
  provenance.append({"filename":filename,"exactSourceUrl":url,"firstPartyWebPage":page,
    "sourceDescription":note,"dimensions":[width,height],"sha256":sha256(actual).hexdigest(),
    "verifiedAsActualPhoto":True,"independentPublicationPermission":"not-verified"})
  print("HHBA_GENUINE_COMPANY_PHOTO",id,filename,len(actual),width,height,url)
 (folder/"media-sources.json").write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("HHBA_066_068_FOUR_SOURCE_PHOTOGRAPHS_READY")
