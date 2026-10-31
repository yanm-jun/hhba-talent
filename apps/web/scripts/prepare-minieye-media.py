#!/usr/bin/env python3
"""Package three independent real MINIEYE media assets with documentary sources.

The 2025 car show and 2022 product show are editorial event photographs, not
AI images and not purported photographs of company headquarters. No generic
stock substitutions. Fail CI rather than deploying blank image cards.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from io import BytesIO
from PIL import Image,ImageOps
from hashlib import sha256
import json,time
root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-035'
root.mkdir(parents=True,exist_ok=True)
sources=[
 ('logo.webp',[
  ('https://jg-app.obs.cn-north-4.myhuaweicloud.com/prod/upload/0/jpg/1F60DD5EBCD9240AAD5EF9B2BB3ABAD1.jpg','https://jg-static.eeo.com.cn/article/info?channelUuid=undefined&id=8e842347f06f499a80f142ef5c557e31'),
  ('https://gascloud.gasgoo.com/production/2026/01/d62144f1-ecb4-4e1f-9d2a-84395a41440b-1769469074.png','https://autonews.gasgoo.com/articles/news/minieye-secures-over-13-billion-yuan-smart-driving-order-from-a-top-automaker-2015804832508432385')
 ]),
 ('photo1.jpg',[
  ('https://ocmsmedia.sfccn.com/vod-4310da/image/default/D09B1B8152784CF9B666E3603D3B8837-6-2.jpg','https://www.21jingji.com/article/20250918/herald/2f8e3f77d2d994bd295c7fab80153ba2.html'),
  ('https://pic2.tidesight.com/22/img/202206/06141409329.jpg','https://www.tidesight.com/news/1364150.html')
 ]),
 ('photo2.jpg',[
  ('https://pic2.tidesight.com/22/img/202206/06141409329.jpg','https://www.tidesight.com/news/1364150.html'),
  ('https://www.seewayai.com/uploads/images/20230321/0940b1349a264ffe97ad7d764290e6f2.jpeg','https://www.seewayai.com/gongsixinwen/323')
 ])
]
audit={}
used=set()
for filename,options in sources:
 error=''
 for url,page in options:
  if filename in audit:break
  variants=[url,
   'https://wsrv.nl/?'+urlencode({'url':url,'output':'jpg' if filename.endswith('.jpg') else 'png'}),
   'https://images.weserv.nl/?'+urlencode({'url':url,'output':'jpg' if filename.endswith('.jpg') else 'png'})]
  for candidate in variants:
   if filename in audit:break
   try:
    req=Request(candidate,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36','Accept':'image/avif,image/webp,image/png,image/jpeg,image/*','Referer':page})
    with urlopen(req,timeout=12) as res:raw=res.read(8_000_001)
    if not 2400<len(raw)<8_000_000:raise ValueError('unrecognized media length')
    digest=sha256(raw).hexdigest()
    if digest in used:raise ValueError('same source photo would be reused')
    with Image.open(BytesIO(raw)) as im:im.verify()
    with Image.open(BytesIO(raw)) as im:photo=ImageOps.exif_transpose(im).convert('RGB')
    if filename=='logo.webp':
     if photo.width<280 or photo.height<100:raise ValueError('small logo')
     photo.thumbnail((1000,900));photo.save(root/filename,'WEBP',quality=90,method=5)
    else:
     if photo.width<450 or photo.height<290:raise ValueError('small documentary photo')
     photo.thumbnail((1600,1050));photo.save(root/filename,'JPEG',quality=87,optimize=True)
    if (root/filename).stat().st_size<2600:raise ValueError('image missing content')
    used.add(digest)
    audit[filename]={'verified':True,'source':url,'downloadUrl':candidate,'sourcePage':page,
                     'sha256':digest,'width':photo.width,'height':photo.height,
                     'copyright':'image remains property of original publisher; factual editorial visual'}
    print('MINIEYE_035_REAL_ASSET_VERIFIED',filename,photo.size,url,flush=True)
   except Exception as exc:
    error=str(exc);print('MINIEYE_035_ASSET_RETRY',filename,error[:135],flush=True)
   if filename in audit:break
  time.sleep(0.3)
 if filename not in audit:raise RuntimeError('MINIEYE_035_CANNOT_VERIFY_REAL_MEDIA '+filename+' '+error)
assert len(audit)==3 and len(used)==3
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('MINIEYE_035_THREE_INDEPENDENT_MEDIA_READY',flush=True)
