#!/usr/bin/env python3
"""Three companies, nine individual site-owned visual assets, with SHA-256 audit.
Logo is chosen exclusively from a verified company's own homepage branding.
The two additional pictures are official product/technology graphics, not staff photos.
No AI, no composites, no cross-company image fallbacks.
"""
import json,re,html,time
from pathlib import Path
from io import BytesIO
from hashlib import sha256
from urllib.parse import urljoin,urlparse,urlencode
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
import cairosvg

ROOT=Path(__file__).resolve().parents[1]/'public/images/employer-profiles'
CONFIG={"042":{"name":"艾普工华","home":["https://www.epichust.com/","https://epichust.com/p/company_profile"],"images":{"photo1.jpg":[["https://www.epichust.com/uploads/20240402/008b6d72b17c0fe4f76b8874afb07920.png","https://www.epichust.com/Intelligent_decision/12.html"]],"photo2.jpg":[["https://www.epichust.com/uploads/20240228/ecbe367c55914cab674a74185a6d0ea5.png","https://www.epichust.com/Complete_vehicle/172.html"]]}},"043":{"name":"迦智科技","home":["https://www.iplusmobot.cn/","https://www.iplusmobot.cn/about.html"],"images":{"photo1.jpg":[["https://www.iplusmobot.cn/public/static/images/about/Family.jpg","https://www.iplusmobot.cn/about.html"]],"photo2.jpg":[["https://www.iplusmobot.cn/Upload/goods/20240627/1952244a207d19a62c7b9e52e7048261.png","https://www.iplusmobot.cn/product/178/id/280"]]}},"044":{"name":"博顿光电","home":["https://www.ibdtec.cn/","https://www.ibdtec.cn/about/company"],"images":{"photo1.jpg":[["https://www.ibdtec.cn/uploads/images/20240223/fb949fa27266c15deb61c767eaeccf60.jpg","https://www.ibdtec.cn/"]],"photo2.jpg":[["https://www.ibdtec.cn/uploads/images/20230815/231870d49c8ddafd89b41559e0558d94.jpg","https://www.ibdtec.cn/product/solutions/RIBER/22"]]}}}
def read(url,referer=None):
 request=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36','Accept':'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,text/html,*/*;q=0.8','Referer':referer or url})
 with urlopen(request,timeout=18) as resp:
  data=resp.read(6_100_000)
 if not 180<len(data)<6_000_000:raise ValueError('unrecognized response byte length')
 return data
def logo_candidates(home):
 records={}
 for homepage in home:
  try:
   webpage=read(homepage).decode('utf-8','replace')
   doc=BeautifulSoup(webpage,'html.parser')
   for img in doc.select('img,source'):
    attrs=' '.join(str(img.get(k,'')) for k in ('alt','class','id','title','src','data-src','data-original'))
    anc=img.parent
    for _ in range(3):
     if anc and getattr(anc,'attrs',None): attrs+=' '+' '.join(str(anc.get(k,'')) for k in ('class','id','title'))
     anc=getattr(anc,'parent',None)
    for attr in ('src','data-src','data-original','data-lazy-src'):
     path=img.get(attr)
     if not path or path.startswith('data:'):continue
     u=urljoin(homepage,html.unescape(path).strip())
     if urlparse(u).scheme not in ('https','http'):continue
     # only use visual assets from the original company's official host
     if urlparse(u).hostname != urlparse(homepage).hostname:continue
     score=(10 if re.search('logo',attrs,re.I) else 0)
     score+=6 if re.search(r'logo|brand|企业标志',u,re.I) else 0
     score+=5 if re.search('header|navbar|top-logo|head-logo',attrs,re.I) else 0
     if score<7:continue
     records[u]=max(records.get(u,0),score)
   for cand in re.findall(r'''url\(\s*['"]?([^)'"]*logo[^)'"]*)['"]?\s*\)''',webpage,re.I):
    u=urljoin(homepage,html.unescape(cand))
    if urlparse(u).hostname==urlparse(homepage).hostname:records[u]=max(records.get(u,0),9)
  except Exception as e:print('LOGO_HTML_WARNING',homepage,str(e)[:130],flush=True)
 return [u for u,s in sorted(records.items(),key=lambda x:-x[1])]
def convert(raw,name):
 if b'<svg' in raw[:6000]:
  raw=cairosvg.svg2png(bytestring=raw,output_width=1000)
 with Image.open(BytesIO(raw)) as im:im.verify()
 with Image.open(BytesIO(raw)) as im:
  im=ImageOps.exif_transpose(im)
  if im.width<180 or im.height<40:raise ValueError('resolution too small')
  if name=='logo.png':
   im=im.convert('RGBA')
   im.thumbnail((1250,850))
   # preserve logo aspect ratio, never crop
  else:
   if im.width<420 or im.height<250:raise ValueError('product image too small')
   im=im.convert('RGB');im.thumbnail((1500,1050))
  out=BytesIO()
  im.save(out,format='PNG' if name.endswith('.png') else 'JPEG',quality=88,optimize=True)
  blob=out.getvalue()
  if len(blob)<1800:raise ValueError('possible empty image')
  return blob,(im.width,im.height)
for num,c in CONFIG.items():
 path=ROOT/('cn-autumn-'+num);path.mkdir(parents=True,exist_ok=True)
 auditpath=path/'media-audit.json'
 try:audit=json.loads(auditpath.read_text())
 except Exception:audit={}
 used=set()
 images={'logo.png':[(u,c['home'][0]) for u in logo_candidates(c['home'])],**c['images']}
 print('LOGO_CANDIDATES',num,images['logo.png'][:9],flush=True)
 for name,options in images.items():
  filename=path/name
  saved=audit.get(name)
  if saved and saved.get('verified') and filename.is_file() and filename.stat().st_size>1800 and sha256(filename.read_bytes()).hexdigest()==saved.get('sha256'):
   print('HHBA_MEDIA_PINNED',num,name,flush=True);used.add(saved['sourceSha256']);continue
  error='No company-owned source'
  for src,ref in options:
   for url in [src]+(['https://wsrv.nl/?'+urlencode({'url':src,'output':'jpg'})] if name!='logo.png' else []):
    try:
     raw=read(url,ref)
     sh=sha256(raw).hexdigest()
     if sh in used:raise ValueError('duplicate asset reused')
     content,dimensions=convert(raw,name)
     filename.write_bytes(content)
     audit[name]={'verified':True,'company':c['name'],'source':src,'sourcePage':ref,'retrievedFrom':url,
                  'sourceSha256':sh,'sha256':sha256(content).hexdigest(),
                  'width':dimensions[0],'height':dimensions[1],
                  'type':'official corporate brand' if name=='logo.png' else 'official product or business illustration',
                  'ownership':'Original rights holders retain copyright'}
     used.add(sh)
     print('HHBA_MEDIA_OK',num,name,dimensions,src,flush=True)
     break
    except Exception as e:
     error=str(e)
     print('HHBA_MEDIA_RETRY',num,name,error[:135],flush=True)
   if name in audit and filename.is_file() and sha256(filename.read_bytes()).hexdigest()==audit[name]['sha256']:break
   time.sleep(.2)
  if name not in audit or not filename.is_file() or filename.stat().st_size<1800:
   raise RuntimeError('UNVERIFIED_OR_MISSING_HHBA_COMPANY_MEDIA_'+num+'_'+name+': '+error)
 assert set(audit)=={'logo.png','photo1.jpg','photo2.jpg'}
 assert len(used)==3
 auditpath.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('THREE_INDEPENDENT_COMPANY_MEDIA_COMPLETE',num,flush=True)
