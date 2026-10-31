#!/usr/bin/env python3
"""Localize the official PXW 034 identity and 2 independently sourced real photos.

Only documents with a traceable PXW company reference are candidates.
No AI pictures, stock substitutes, silent placeholders, or redirects on images.
Abort Pages release if images cannot be verified.
"""
from pathlib import Path
from urllib.request import urlopen,Request
from io import BytesIO
from PIL import Image,ImageOps
from hashlib import sha256
import json,time
out=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-034'
out.mkdir(parents=True,exist_ok=True)
items=[
 ('logo.webp',[
  ('https://portal-oss.zhiye.com/608369/image/904d8154-0f08-427a-8e98-4149aac0ee91.png','https://career.pxwsemi.com/'),
  ('https://static2.xunxiang.site/uploads/sites/210/2024/11/170a39b4d788220443511538ad54d3eb.png','https://www.pxwsemi.com/')
 ]),
 ('photo1.jpg',[
  ('https://static.mianbaoban-assets.eet-china.com/xinyu-images/MBXY-CR-7dc7fd7c6b7bece7394ec21ff72420c7.png','https://www.eet-china.com/mp/a466733.html'),
  ('https://i5.szhomeimg.com/o/2024/01/19/011919244918191.JPG','https://bbs.szhome.com/30-30430-detail-178644741.html')
 ]),
 ('photo2.jpg',[
  ('https://www.sz.gov.cn/img/3/3931/3931062/10525622.png','https://www.sz.gov.cn/cn/xxgk/zfxxgj/bmdt/content/mpost_10525622.html'),
  ('https://www.sz.gov.cn/img/3/3931/3931063/10525622.png','https://www.sz.gov.cn/cn/xxgk/zfxxgj/bmdt/content/mpost_10525622.html')
 ])
]
audit={}
used=set()
for filename,alternatives in items:
 error=''
 for url,page in alternatives:
  if filename in audit:break
  for attempt in range(2):
   try:
    req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36','Accept':'image/webp,image/png,image/jpeg,image/*','Referer':page})
    with urlopen(req,timeout=22) as response:raw=response.read(8_500_001)
    if not 1800<len(raw)<8_500_000:raise ValueError('unexpected image bytes')
    hash=sha256(raw).hexdigest()
    if hash in used:raise ValueError('same image content reused')
    with Image.open(BytesIO(raw)) as im: im.verify()
    with Image.open(BytesIO(raw)) as im:photo=ImageOps.exif_transpose(im).convert('RGB')
    if filename=='logo.webp':
     if photo.width<100 or photo.height<100:raise ValueError('logo resolution')
     photo.thumbnail((1000,1000))
     photo.save(out/filename,'WEBP',quality=90,method=5)
    else:
     if photo.width<350 or photo.height<240:raise ValueError('photo resolution')
     photo.thumbnail((1600,1150))
     photo.save(out/filename,'JPEG',quality=87,optimize=True)
    if (out/filename).stat().st_size<1800:raise ValueError('converted image too small')
    audit[filename]={'verified':True,'source':url,'sourcePage':page,'sha256':hash,'width':photo.width,'height':photo.height}
    used.add(hash)
    print('PXW_034_SOURCE_VERIFIED',filename,url,photo.size)
    break
   except Exception as exc:
    error=str(exc)
    print('PXW_034_RETRY',filename,attempt+1,error[:160])
    time.sleep(0.8)
 if filename not in audit:raise RuntimeError('PXW_034_REQUIRED_MEDIA_NOT_VERIFIABLE '+filename+' '+error)
assert len(audit)==3 and len(used)==3
(out/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('PXW_034_THREE_SOURCED_ASSETS_VERIFIED')
