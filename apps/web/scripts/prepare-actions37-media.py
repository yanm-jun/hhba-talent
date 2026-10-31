#!/usr/bin/env python3
"""Import genuine ACTIONS #037 logo and TWO DIFFERENT official workplace photos.
Sources are enumerated by company/publisher. Never synthesize image content.
Run before V2 profile factory test, and record source / SHA for review.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from io import BytesIO
from hashlib import sha256
from PIL import Image, ImageOps
import json, time

root = Path(__file__).resolve().parents[1] / 'public/images/employer-profiles/cn-autumn-037'
root.mkdir(parents=True, exist_ok=True)
# Once authentic media are checked into the branch, builds must be deterministic
# even when the company's image origin is temporarily unreachable.
audit_file = root / 'media-audit.json'
if audit_file.is_file():
  try:
    old_audit=json.loads(audit_file.read_text(encoding='utf-8'))
    expected={'logo.png','photo1.jpg','photo2.jpg'}
    if set(old_audit)==expected and all(
      old_audit[n].get('verified') and
      (root/n).is_file() and (root/n).stat().st_size>2600 and
      sha256((root/n).read_bytes()).hexdigest()==old_audit[n].get('sha256')
      for n in expected
    ):
      print('ACTIONS_037_THREE_VERIFIED_LOCAL_MEDIA_ALREADY_PINNED',flush=True)
      raise SystemExit(0)
  except (OSError,ValueError,KeyError):
    pass
media = {
  'logo.png': [
    ('https://www.gmitec.com/wp-content/uploads/2022/05/%E7%82%AC%E8%8A%AF.png',
     'https://www.gmitec.com/agent-products/actions/'),
    ('https://www.gsi24.com/ueditor/php/upload/image/20250820/1755670171154926.png',
     'https://www.gsi24.com/a/2247.html')
  ],
  'photo1.jpg': [
    ('https://www.actionstech.com/res/202011/04/e7f8a23aeb0484f0.jpg',
     'https://www.actionstech.com/index.php?id=join')
  ],
  'photo2.jpg': [
    ('https://www.actionstech.com/res/202011/04/a6360907bdeedd8e.jpg',
     'https://www.actionstech.com/index.php?id=join')
  ],
}
audit = {}
raw_hashes = set()
for filename, choices in media.items():
  error = 'not downloaded'
  for source, page in choices:
    candidates = [
      source,
      'https://wsrv.nl/?' + urlencode({'url': source,'output':'jpg' if filename.endswith('jpg') else 'png'})
    ]
    for download in candidates:
      try:
        request = Request(download, headers={
          'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36',
          'Accept':'image/avif,image/webp,image/png,image/jpeg,image/*',
          'Referer':page
        })
        with urlopen(request,timeout=25) as resp:
          raw=resp.read(5_100_000)
          if len(raw)>5_000_000 or len(raw)<2500:raise ValueError('invalid asset length')
        digest=sha256(raw).hexdigest()
        if digest in raw_hashes:raise ValueError('repeated source image')
        with Image.open(BytesIO(raw)) as preview:preview.verify()
        with Image.open(BytesIO(raw)) as im:
          im=ImageOps.exif_transpose(im)
          if im.width<220 or im.height<95:raise ValueError('asset resolution insufficient')
          if filename.endswith('.jpg'):
            if im.width<480 or im.height<275:raise ValueError('workplace photo too small')
            im=im.convert('RGB')
            im.thumbnail((1450,1030))
            im.save(root/filename, 'JPEG',quality=87,optimize=True)
          else:
            im.thumbnail((1000,820))
            im.save(root/filename, 'PNG',optimize=True)
          dimensions=[im.width, im.height]
        if (root/filename).stat().st_size<2600:raise ValueError('image blank or too small')
        raw_hashes.add(digest)
        audit[filename]={
          'verified': True, 'company':'炬芯科技股份有限公司',
          'source':source,'downloadUrl':download,'sourcePage':page,
          'sourceSha256':digest,
          'sha256':sha256((root/filename).read_bytes()).hexdigest(),
          'width':dimensions[0],'height':dimensions[1],
          'description':'Genuine company brand mark' if filename=='logo.png' else 'Company workplace photograph published on official recruitment page',
          'ownership':'All rights remain with original owner / publisher'
        }
        print('ACTIONS_037_MEDIA_IMPORTED',filename,dimensions,source,flush=True)
        break
      except Exception as exc:
        error=str(exc)
        print('ACTIONS_037_MEDIA_RETRY',filename,error[:180],flush=True)
    if filename in audit:break
    time.sleep(.4)
  if filename not in audit:
    raise RuntimeError('ACTIONS_037_MISSING_GENUINE_MEDIA '+filename+': '+error)
assert len(audit)==3 and len(raw_hashes)==3
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('ACTIONS_037_MEDIA_COMPLETE_THREE_SEPARATE_FILES',flush=True)
