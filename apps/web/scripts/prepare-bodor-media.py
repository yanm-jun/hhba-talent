#!/usr/bin/env python3
"""Download Bodor 033 independent factual logo and two company photos.

CI cannot access bodor.cn's media server (404/418). Use independent
documentary reporting / DreamPark building project, never generated images.
Fail publication instead of substituting an unverifiable photograph.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
from PIL import Image,ImageOps
from hashlib import sha256
import json,time
root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-033'
root.mkdir(parents=True,exist_ok=True)
sources=[
 ('logo.webp',[
  ('https://simmtime-product.oss-cn-shenzhen.aliyuncs.com/exhibitor/company-logo/1677648088234-7a2a939273095195ef6bba51.png','https://www.iteschina.com/zh-cn/exhibitor-list/details/13472/jinan-bodor-cnc-machine')]),
 ('photo1.jpg',[
  ('https://q2.itc.cn/images01/20241206/d3da55e208ba44a2b68412f15564cc37.png','https://www.sohu.com/a/833840148_99978832'),
  ('https://toleriem.b-cdn.net/app/uploads/sites/16/2025/05/Image1.jpg','https://www.tolerie-mag.com/publi-info/bodor-laser-se-classe-n1-mondial-des-ventes-de-machines-de-decoupe-laser-a-fibre-pour-la-sixieme-annee-consecutive/')]),
 ('photo2.jpg',[
  ('https://www.goldmantis.com/Public/Uploads/ueditor/upload/image/20260413/1776044638160574.jpg','https://www.goldmantis.com/en/projects/337'),
  ('https://p6.itc.cn/images01/20231207/65ad63b7918d45e2a130914bec1e71fb.jpeg','https://www.geekpark.net/news/328666')])
]
audit={}
digests=set()
for name,alternates in sources:
 last=''
 for url,article in alternates:
  if name in audit:break
  for attempt in range(2):
   try:
    req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36','Accept':'image/avif,image/webp,image/png,image/jpeg,image/*','Referer':article})
    with urlopen(req,timeout=23) as handle:body=handle.read(9_000_001)
    if not 2500<len(body)<=9_000_000:raise ValueError('invalid source byte count')
    digest=sha256(body).hexdigest()
    if digest in digests:raise ValueError('duplicate media source')
    with Image.open(BytesIO(body)) as im:im.verify()
    im=ImageOps.exif_transpose(Image.open(BytesIO(body))).convert('RGB')
    if name=='logo.webp':
     if im.width<100 or im.height<30:raise ValueError('logo too small')
     im.thumbnail((1200,700));im.save(root/name,'WEBP',quality=90,method=5)
    else:
     if im.width<400 or im.height<280:raise ValueError('photo resolution too small')
     im.thumbnail((1600,1150));im.save(root/name,'JPEG',quality=86,optimize=True)
    if (root/name).stat().st_size<2500:raise ValueError('output too small')
    audit[name]={'verified':True,'source':url,'sourcePage':article,'sha256':digest,'width':im.width,'height':im.height}
    digests.add(digest)
    print('BODOR_IMAGE_VERIFIED',name,im.size,url)
    break
   except Exception as exc:
    last=str(exc)
    print('BODOR_SOURCE_RETRY',name,attempt+1,last[:200])
    time.sleep(0.8)
 if name not in audit:raise RuntimeError('BODOR_CANNOT_VERIFY_INDEPENDENT_IMAGE: '+name+' '+last)
assert len(audit)==3 and len(digests)==3 and all(v['verified'] for v in audit.values())
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('BODOR_033_THREE_INDEPENDENT_VERIFIED_ASSETS')
