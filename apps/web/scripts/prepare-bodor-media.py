#!/usr/bin/env python3
"""Verify and localize genuine Bodor 033 corporate assets for GitHub Pages.

Logo source: official ITES exhibitor listing for Jinan Bodor Laser.
Photo1: Bodor's own official brand page, Dream Park factory.
Photo2: campus builder Gold Mantis's Bodor DreamPark project photo.
No generated pictures, stock photos or silent substitution.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from io import BytesIO
from PIL import Image, ImageOps
from hashlib import sha256
import json, time

root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-033'
root.mkdir(parents=True,exist_ok=True)
sources=[
 ('logo.webp','https://simmtime-product.oss-cn-shenzhen.aliyuncs.com/exhibitor/company-logo/1677648088234-7a2a939273095195ef6bba51.png','https://www.iteschina.com/zh-cn/exhibitor-list/details/13472/jinan-bodor-cnc-machine'),
 ('photo1.jpg','https://www.bodor.cn/brand/img/factory/0.webp?v=0.1','https://www.bodor.cn/brand/'),
 ('photo2.jpg','https://www.goldmantis.com/Public/Uploads/ueditor/upload/image/20260413/1776044638160574.jpg','https://www.goldmantis.com/en/projects/337')
]
audit={}
digests=set()
for filename,url,article in sources:
 last=None
 for attempt in range(3):
  try:
   req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    'Accept':'image/webp,image/avif,image/png,image/jpeg,image/*;q=0.8',
    'Referer':article})
   with urlopen(req,timeout=25) as f:
    body=f.read(9_000_001)
    if len(body)>9_000_000 or len(body)<2000:raise ValueError('invalid image download size')
   digest=sha256(body).hexdigest()
   if digest in digests:raise ValueError('duplicate image bytes')
   with Image.open(BytesIO(body)) as im:
    im.verify()
   im=ImageOps.exif_transpose(Image.open(BytesIO(body))).convert('RGB')
   if filename=='logo.webp':
    if im.width<100 or im.height<30:raise ValueError('logo too small')
    im.thumbnail((1200,600))
    im.save(root/filename,'WEBP',quality=90,method=5)
   else:
    if im.width<420 or im.height<290:raise ValueError('factory image resolution too low')
    im.thumbnail((1600,1150))
    im.save(root/filename,'JPEG',quality=87,optimize=True)
   assert (root/filename).stat().st_size>2500
   digests.add(digest)
   audit[filename]={'verified':True,'source':url,'sourcePage':article,'sha256':digest,'width':im.width,'height':im.height}
   print('BODOR_SOURCE_VERIFIED',filename,url,im.size)
   break
  except Exception as exc:
   last=str(exc)
   print('BODOR_SOURCE_RETRY',filename,attempt+1,last[:230])
   time.sleep(1.5)
 else:
  raise RuntimeError('BODOR_OFFICIAL_MEDIA_MISSING: '+filename+' '+str(last))
assert len(audit)==3 and all(a['verified'] for a in audit.values())
assert len(digests)==3
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('BODOR_033_THREE_INDEPENDENT_VERIFIED_ASSETS')
