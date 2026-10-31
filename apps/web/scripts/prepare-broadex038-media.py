#!/usr/bin/env python3
"""Vendor THREE genuine, independently sourced BROADEX/EverProX media files.
- Logo: the CURRENT EverProX wordmark identified in current official homepage HTML.
- Photo 1: historical Broadex Shanghai R&D center building, on official former site.
- Photo 2: Broadex/EverPro corporate integration ceremony, official EverPro reporting.
No artificial imagery and no silent mismatched stock fallback. Verifiable SHA manifest.
"""
from pathlib import Path
from urllib.parse import urljoin,urlencode,urlparse
from urllib.request import Request,urlopen
from hashlib import sha256
from io import BytesIO
import json,re,html,time
from PIL import Image,ImageOps
from bs4 import BeautifulSoup

root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-038'
root.mkdir(parents=True,exist_ok=True)
auditpath=root/'media-audit.json'
if auditpath.is_file():
  try:
    pinned=json.loads(auditpath.read_text(encoding='utf-8'))
    names={'logo.png','photo1.jpg','photo2.jpg'}
    if set(pinned)==names and all(pinned[n].get('verified') and (root/n).is_file() and
         len((root/n).read_bytes())>=2600 and
         sha256((root/n).read_bytes()).hexdigest()==pinned[n].get('sha256')
         for n in names):
      print('BROADEX_038_VERIFIED_THREE_LOCAL_MEDIA_PINNED',flush=True)
      raise SystemExit(0)
  except (OSError,ValueError,KeyError):pass

def get(url,referer=None):
  req=Request(url,headers={
    'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133 Safari/537.36',
    'Accept':'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,*/*;q=0.8',
    'Referer':referer or 'https://www.everprox.com/'
  })
  with urlopen(req,timeout=20) as res:
    data=res.read(6_000_000)
  if not 2500<len(data)<6_000_000:raise ValueError('unusable byte length')
  return data

def images_from_homepage():
  base='https://www.everprox.com/'
  h=get(base).decode('utf-8','replace')
  soup=BeautifulSoup(h,'html.parser')
  candidates=[]
  for node in soup.select('img,source'):
    attrs=' '.join(str(node.get(k,'')) for k in ['class','id','alt','title','src','data-src','data-original'])
    par=node.parent
    for _ in range(3):
      if par and getattr(par,'attrs',None):
        attrs+=' '+' '.join(str(par.get(k,'')) for k in ['class','id'])
        par=par.parent
    for k in ['src','data-src','data-original','data-lazy-src']:
      u=node.get(k)
      if not u or u.startswith('data:'):continue
      u=urljoin(base,html.unescape(u))
      if urlparse(u).scheme not in ('http','https'):continue
      score=0
      if re.search('logo',attrs,re.I):score+=8
      if re.search('everprox|brand',attrs,re.I):score+=4
      if 'header' in attrs.lower() or 'navbar' in attrs.lower() or 'nav ' in attrs.lower():score+=4
      if re.search('logo|everprox',u,re.I):score+=5
      if score:candidates.append((score,u))
  # CSS background logos or inline CSS image references.
  for hit in re.findall(r'''url\(\s*['"]?([^)'"]+(?:logo|Logo)[^)'"]*)['"]?\s*\)''',h):
    u=urljoin(base,html.unescape(hit))
    candidates.append((6,u))
  uniq={}
  for score,url in candidates:uniq[url]=max(score,uniq.get(url,0))
  out=sorted(((score,u) for u,score in uniq.items()),reverse=True)
  print('BROADEX_038_OFFICIAL_LOGO_CANDIDATES',out[:20],flush=True)
  return [u for _,u in out]

def decode_image(raw,fmt):
  if b'<svg' in raw[:2000] or raw[:200].lstrip().startswith(b'<?xml'):
    import cairosvg
    raw=cairosvg.svg2png(bytestring=raw,output_width=1000)
  with Image.open(BytesIO(raw)) as img:img.verify()
  with Image.open(BytesIO(raw)) as img:
    img=ImageOps.exif_transpose(img)
    if fmt=='PNG':
      img=img.convert('RGBA')
      if img.width<180 or img.height<65:raise ValueError('logo too small')
      img.thumbnail((1000,850))
    else:
      if img.width<450 or img.height<280:raise ValueError('photo dimensions too small')
      img=img.convert('RGB');img.thumbnail((1450,980))
    out=BytesIO()
    img.save(out,format=fmt,quality=88,optimize=True)
    return out.getvalue(),[img.width,img.height]

media={
  'logo.png':[(u,'https://www.everprox.com/') for u in images_from_homepage()],
  'photo1.jpg':[
    ('https://en.broadex-tech.com/sites/default/files/Broadex%20Shanghai%201_2.jpg','https://en.broadex-tech.com/about/news'),
    ('https://en.broadex-tech.com/sites/default/files/styles/listing_image/public/Broadex%20Shanghai%201_2.jpg?itok=o68j7OKG','https://en.broadex-tech.com/about/news')
  ],
  'photo2.jpg':[
    ('https://www.everprotech.com.cn/upload/20240131/65b9d8c309ed4.jpg','https://www.everprotech.com.cn/view/473.html'),
    ('https://www.everprotech.com.cn/upload/20240131/65b9d8c309ed4.jpg','https://www.everprotech.com.cn/view/473.html')
  ]
}
audit={}
used=set()
for name,options in media.items():
  error='no usable sources'
  if name=='logo.png' and not options:raise RuntimeError('OFFICIAL_LOGO_NOT_IN_WEBSITE_HTML')
  for source,page in options:
    try:
      variants=[source]
      if name!='logo.png':
        variants.append('https://wsrv.nl/?'+urlencode({'url':source,'output':'jpg'}))
      for candidate in variants:
        try:
          raw=get(candidate,page)
          digest=sha256(raw).hexdigest()
          if digest in used:raise ValueError('duplicate image source')
          converted,dimensions=decode_image(raw,'PNG' if name.endswith('.png') else 'JPEG')
          if len(converted)<2600:raise ValueError('empty-like image')
          (root/name).write_bytes(converted)
          audit[name]={'verified':True,'source':source,'sourcePage':page,
              'retrievedFrom':candidate,'sourceSha256':digest,
              'sha256':sha256(converted).hexdigest(),
              'width':dimensions[0],'height':dimensions[1],
              'label':('Official EverProX identity asset' if name=='logo.png'
                 else 'Original real photo credited to company / original publisher'),
              'copyright':'Rights remain with respective owners'}
          used.add(digest)
          print('BROADEX_038_MEDIA_OK',name,dimensions,source,flush=True)
          break
        except Exception as exc:
          error=str(exc)
          print('BROADEX_038_MEDIA_RETRY',name,error[:165],candidate,flush=True)
    except Exception as exc:
      error=str(exc)
    if name in audit:break
  if name not in audit:raise RuntimeError('BROADEX_038_MEDIA_NOT_VERIFIED '+name+' '+error)
assert len(audit)==3 and len(used)==3
auditpath.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('BROADEX_038_MEDIA_SET_COMPLETE_1LOGO_2PHOTOS',flush=True)
