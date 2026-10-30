#!/usr/bin/env python3
"""Build 030 static corporate media: approved user logo and two sourced photos."""
from pathlib import Path
from urllib.request import Request, urlopen
from hashlib import sha256
from io import BytesIO
from PIL import Image, ImageOps
import json, time

root = Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-030'
root.mkdir(parents=True, exist_ok=True)
logo = root/'logo.png'
EXPECTED = '3097ec303bea009156d25193d9db5d938bd3e94728251ded2510f6190741ff6c'
raw = logo.read_bytes()
assert sha256(raw).hexdigest()==EXPECTED, 'JSGX logo must remain the user-approved file'
with Image.open(BytesIO(raw)) as im:
 assert im.size==(88,106) and im.format=='PNG', 'Approved logo changed'
audit = {'logo.png': {'source': 'user-supplied JSGX logo, supplied 2026-10-30',
 'sha256': EXPECTED, 'verified': True, 'dimensions': [88,106], 'fixedAsset': str(logo)}}
print('JSGX_APPROVED_LOGO_LOCKED', EXPECTED)
photos=[
 ('photo1.jpg',
  'https://www.njit.edu.cn/__local/C/14/3C/61F6F0A48033795683879DD8946_ECD55015_2B4D2.jpg',
  'https://www.njit.edu.cn/info/1042/23079.htm'),
 ('photo2.jpg',
  'https://www.ceeia.com/ewebeditor/uploadfile/20241218155205313902.png',
  'https://www.ceeia.com/QYDT/d/202412/dad566f79f2444e5998e5e583c981f7b.html')]
seen={EXPECTED}
for name,url,article in photos:
 last=None
 for attempt in range(3):
  try:
   req=Request(url,headers={'User-Agent':'Mozilla/5.0 (HHBA educational directory)','Accept':'image/avif,image/webp,image/png,image/jpeg,image/*'})
   with urlopen(req,timeout=18) as resp:
    data=resp.read(12000001)
    assert len(data)<12000001 and len(data)>3000,'Image size outside safe bounds'
    assert 'image' in resp.headers.get('Content-Type','image/jpeg').lower(),'Expected image'
   with Image.open(BytesIO(data)) as check:check.verify()
   im=ImageOps.exif_transpose(Image.open(BytesIO(data))).convert('RGB')
   assert im.width>=450 and im.height>=280,'Original photograph is too small'
   h=sha256(data).hexdigest()
   assert h not in seen,'Photo duplicates approved logo or another photograph'
   seen.add(h)
   im.thumbnail((1600,1200))
   im.save(root/name,format='JPEG',quality=83,optimize=True)
   assert (root/name).stat().st_size>5000
   audit[name]={'verified': True, 'source':url, 'article':article, 'sha256':h, 'dimensions':[im.width,im.height]}
   print('JSGX_SOURCED_PHOTO_READY',name,url,im.size)
   break
  except Exception as exc:
   last=str(exc)
   print('JSGX_MEDIA_RETRY',name,attempt+1,last[:160])
   time.sleep(2)
 else:
  raise RuntimeError('Officially identified project/event photo unavailable: '+name+' '+str(last))
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len(audit)==3 and all(v['verified'] for v in audit.values())
print('JSGX_THREE_INDEPENDENT_LOCAL_ASSETS_READY')
