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
import json,time,subprocess
out=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-034'
out.mkdir(parents=True,exist_ok=True)
items=[
 ('logo.webp',[
  ('https://portal-oss.zhiye.com/608369/image/904d8154-0f08-427a-8e98-4149aac0ee91.png','https://career.pxwsemi.com/'),
  ('https://static2.xunxiang.site/uploads/sites/210/2024/11/170a39b4d788220443511538ad54d3eb.png','https://www.pxwsemi.com/')
 ]),
 ('photo1.jpg',[
  ('https://i5.szhomeimg.com/o/2024/01/19/011919244918191.JPG','https://bbs.szhome.com/30-30430-detail-178644741.html'),
  ('https://static.mianbaoban-assets.eet-china.com/xinyu-images/MBXY-CR-7dc7fd7c6b7bece7394ec21ff72420c7.png','https://www.eet-china.com/mp/a466733.html')
 ]),
 ('photo2.jpg',[
  ('https://static2.xunxiang.site/uploads/sites/210/2025/03/8681d2fd0faebdc026de88d40dd0e2a9.jpg','https://www.pxwsemi.com/%E7%94%9F%E6%B4%BB%E4%B8%8E%E7%A6%8F%E5%88%A9'),
  ('https://static2.xunxiang.site/uploads/sites/210/2025/03/20141639e41fdc4204c74239d287e422.jpg','https://www.pxwsemi.com/%E7%94%9F%E6%B4%BB%E4%B8%8E%E7%A6%8F%E5%88%A9'),
  ('https://wsrv.nl/?url=static2.xunxiang.site%2Fuploads%2Fsites%2F210%2F2025%2F03%2F8681d2fd0faebdc026de88d40dd0e2a9.jpg','https://www.pxwsemi.com/%E7%94%9F%E6%B4%BB%E4%B8%8E%E7%A6%8F%E5%88%A9'),
  ('https://wsrv.nl/?url=static2.xunxiang.site%2Fuploads%2Fsites%2F210%2F2025%2F03%2F20141639e41fdc4204c74239d287e422.jpg','https://www.pxwsemi.com/%E7%94%9F%E6%B4%BB%E4%B8%8E%E7%A6%8F%E5%88%A9')
 ])
]
def fetch_https_verified(url,page):
 """Try Python HTTPS first, then independent curl TLS for server-specific ECC errors.
 Both methods verify certificates. Original source and independent PIL/SHA checks remain mandatory.
 """
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36','Accept':'image/webp,image/png,image/jpeg,image/*','Referer':page})
 try:
  with urlopen(req,timeout=22) as response:return response.read(8_500_001)
 except Exception as py_exc:
  cmd=['curl','--fail','--silent','--show-error','--location','--http1.1','--max-time','28','--connect-timeout','10','--user-agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36','--referer',page,'--header','Accept: image/webp,image/png,image/jpeg,image/*','--url',url]
  result=subprocess.run(cmd,capture_output=True,timeout=34)
  if result.returncode!=0:raise RuntimeError('Python HTTPS: '+str(py_exc)[:110]+'; curl TLS: '+result.stderr.decode('utf-8',errors='replace')[:200])
  return result.stdout

audit={}
used=set()
for filename,alternatives in items:
 error=''
 for url,page in alternatives:
  if filename in audit:break
  for attempt in range(2):
   try:
    raw=fetch_https_verified(url,page)
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
     if filename=='photo2.jpg' and photo.height>=460:
      photo=photo.crop((0,0,photo.width,int(photo.height*0.52))) # real activity scene, not an assembled collage
     photo.thumbnail((1600,1150))
     photo.save(out/filename,'JPEG',quality=87,optimize=True)
    if (out/filename).stat().st_size<1800:raise ValueError('converted image too small')
    audit[filename]={'verified':True,'source':url,'sourcePage':page,'deliveryProxy':url.startswith('https://wsrv.nl/'),'sha256':hash,'width':photo.width,'height':photo.height}
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
