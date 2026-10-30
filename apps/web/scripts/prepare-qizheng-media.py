#!/usr/bin/env python3
"""Localize independent Cheezheng photos or visibly mark missing originals."""
from pathlib import Path
from urllib.request import urlopen,Request
from PIL import Image,ImageDraw,ImageFont
from io import BytesIO
import json,hashlib
d=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-031'
d.mkdir(parents=True,exist_ok=True)
logo=d/'logo.webp'
assert hashlib.sha256(logo.read_bytes()).hexdigest()=='2e463d79273336e655dab3ba8adb5806e6d3c27bc3392bd837f8c8beb871abb2'
images=[
 ('photo1.jpg','https://www.qzh.cn/hdupf/img/202206/202206101654825819351225.jpg'),
 ('photo2.jpg','https://www.qzh.cn/hdupf/img/202501/202501221737541200351262.jpg')
]
audit={'logo.webp':{'verified':True,'source':'user-provided logo','sha256':hashlib.sha256(logo.read_bytes()).hexdigest()}}
for filename,url in images:
 try:
  req=Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.qzh.cn/'})
  with urlopen(req,timeout=15) as response: raw=response.read(10000000)
  im=Image.open(BytesIO(raw));im.verify()
  im=Image.open(BytesIO(raw)).convert('RGB')
  assert im.width>=350 and im.height>=250
  im.thumbnail((1600,1200));im.save(d/filename,'JPEG',quality=84)
  audit[filename]={'verified':True,'source':url,'sha256':hashlib.sha256(raw).hexdigest()}
 except Exception as error:
  im=Image.new('RGB',(1200,700),(248,247,245));g=ImageDraw.Draw(im)
  g.rectangle((0,0,1200,95),fill=(165,122,69))
  g.text((50,30),'CHEEZHENG / MEDIA UNAVAILABLE',fill='white')
  g.text((50,330),'Official photo unavailable - not a company photograph',fill=(80,80,80))
  im.save(d/filename,'JPEG',quality=84)
  audit[filename]={'verified':False,'source':url,'error':str(error)[:200]}
(d/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
