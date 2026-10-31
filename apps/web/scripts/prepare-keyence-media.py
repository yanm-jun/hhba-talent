#!/usr/bin/env python3
"""Package the actual KEYENCE brand and two different corporate-source photos.

Photos are publicly published by official KEYENCE China and KEYENCE Japan
recruiting websites. Source locations and licensing caveats are preserved in
the generated audit. No synthetic photos or unrelated building substitution.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from io import BytesIO
from PIL import Image,ImageOps
from hashlib import sha256
import json,time
out=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-157'
out.mkdir(parents=True,exist_ok=True)
items=[
 ('logo.webp','https://images.nuernbergmesse.de/files/a839528b-55fb-5a04-61fc-8046325c3739.png','https://www.euroguss.de/en/exhibitors/keyence-deutschland-gmbh-2464264'),
 ('photo1.jpg','https://www.keyence.com.cn/Images/about-us_corporate_index_img_01_2027772.jpg','https://www.keyence.com.cn/about-us/corporate/'),
 ('photo2.jpg','https://www.keyence-jobs.jp/img/common/work_business_img_02-02.jpg','https://www.keyence-jobs.jp/work/business/')
]
audit={}
digests=set()
for name,url,page in items:
 alternates=[url, 'https://wsrv.nl/?'+urlencode({'url':url,'output':'jpg' if name.endswith('jpg') else 'png'}),
             'https://images.weserv.nl/?'+urlencode({'url':url,'output':'jpg' if name.endswith('jpg') else 'png'})]
 error=''
 for candidate in alternates:
  if name in audit:break
  for attempt in range(2):
   try:
    req=Request(candidate,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
     'Accept':'image/avif,image/webp,image/jpeg,image/png,image/*','Referer':page})
    with urlopen(req,timeout=15) as res:raw=res.read(9_000_001)
    if not 3000<len(raw)<9_000_000:raise ValueError('unexpected media file length')
    digest=sha256(raw).hexdigest()
    if digest in digests:raise ValueError('not an independent photograph')
    with Image.open(BytesIO(raw)) as img:img.verify()
    with Image.open(BytesIO(raw)) as img:photo=ImageOps.exif_transpose(img).convert('RGB')
    if name=='logo.webp':
     if photo.width<200 or photo.height<100:raise ValueError('logo too small')
     photo.thumbnail((900,900));photo.save(out/name,'WEBP',quality=90,method=5)
    else:
     if photo.width<400 or photo.height<350:raise ValueError('corporate photo too small')
     photo.thumbnail((1600,1100));photo.save(out/name,'JPEG',quality=86,optimize=True)
    if (out/name).stat().st_size<2800:raise ValueError('bad converted file')
    audit[name]={'verified':True,'originalUrl':url,'downloadUrl':candidate,'sourcePage':page,
                 'sha256':digest,'width':photo.width,'height':photo.height,
                 'disclaimer':'real KEYENCE published image; image rights remain with original owner'}
    digests.add(digest)
    print('KEYENCE_157_MEDIA_VERIFIED',name,photo.size,url,flush=True)
    break
   except Exception as exc:
    error=str(exc);print('KEYENCE_157_IMAGE_RETRY',name,attempt+1,error[:160],flush=True)
    time.sleep(0.6)
 if name not in audit:raise RuntimeError('KEYENCE_157_MEDIA_UNAVAILABLE '+name+' '+error)
assert len(audit)==3 and len(digests)==3
(out/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('KEYENCE_157_LOGO_AND_TWO_REAL_PHOTOS_READY',flush=True)
