#!/usr/bin/env python3
"""Bundle 029 media from its actual official POWERCHINA Power Investment pages.
Photos are chosen from company-authored PROJECT articles only; no third-party
power plant stock images. Reproducible, explicit provenance audit is written.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
from html.parser import HTMLParser
from io import BytesIO
from hashlib import sha256
from PIL import Image,ImageOps,ImageDraw,ImageFont
import json,re,time
root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-029'
root.mkdir(parents=True,exist_ok=True)
base='https://gs.powerchina.cn/'
article1='https://gs.powerchina.cn/col/col8855/art/2026/art_a3bd5bd98d594c49bb67a4eb7aee70b5.html'
article2='https://gs.powerchina.cn/col/col8855/art/2026/art_f9b4b94a210d427da7fe06d6dad62b7e.html'
article3='https://gs.powerchina.cn/col/col8855/art/2025/art_01d0b0fa242d47b7a5f4a4d8774849db.html'
pages={'logo.png':[base,'https://www.powerchina.cn/'],'photo1.jpg':[article1,article3], 'photo2.jpg':['https://www.powerchina.cn/zxzx/gsyw/art/2026/art_7dc5e0d1e4c54c69ad343f4c1510ae89.html',article2,article3]}
# Two actual views of this exact invested Pannan 2x660MW project, not another utility.
# These original images are published by POWERCHINA and a POWERCHINA EPC entity.
direct_photos={
 'photo1.jpg':[('https://www.powerchina.cn/cms_files/filemanager/1789/picture/20264/d235184c1121464e8091f2bfb83ee404.jpg',
                'https://www.powerchina.cn/col/col7440/art/2026/art_5da26c3edda040679b1f867dc6d86e27.html')],
 'photo2.jpg':[('https://gepcc.powerchina.cn/cms_files/filemanager/57/picture/20256/1b892fc428924165bde56dc27f1167a8.jpg',
                'https://gepcc.powerchina.cn/col/col503/art/2025/art_e14cdb073ef2437ab9413b3f291fbb55.html')]
}
headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36','Accept':'text/html,image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8'}
class Images(HTMLParser):
 def __init__(self): super().__init__();self.data=[]
 def handle_starttag(self,tag,attrs):
  if tag.lower()!='img':return
  attrs=dict(attrs)
  for key in ('src','data-src','data-original','data-lazy-src'):
   u=attrs.get(key)
   if u and not u.startswith('data:'): self.data.append((u,attrs))
cache={}
def read(url,limit=9_000_000,timeout=9):
 req=Request(url,headers=headers)
 with urlopen(req,timeout=timeout) as resp:
  data=resp.read(limit+1)
 if not 150<len(data)<=limit:raise ValueError('response size')
 return data
def candidates(url):
 if url not in cache:
  html=read(url).decode('utf-8',errors='ignore')
  parser=Images();parser.feed(html);cache[url]=parser.data
 return cache[url]
def valid_host(url):
 h=(urlparse(url).hostname or '').lower()
 return h in ('gs.powerchina.cn','www.powerchina.cn')
def placeholder(name):
 im=Image.new('RGB',(1150,690),(244,247,248));d=ImageDraw.Draw(im)
 d.rectangle((22,22,1128,668),outline=(155,179,190),width=3)
 d.rectangle((22,22,1128,132),fill=(19,81,134))
 fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 title=ImageFont.truetype(fontpath,42) if Path(fontpath).exists() else ImageFont.load_default()
 body=ImageFont.truetype(fontpath,24) if Path(fontpath).exists() else ImageFont.load_default()
 d.text((54,58),'POWERCHINA / HHBA COMPANY FILE',font=body,fill='white')
 d.text((54,306),'OFFICIAL MEDIA NOT AVAILABLE',font=title,fill=(20,81,125))
 d.text((54,388),f'{name} -- company source could not be verified',font=body,fill=(93,107,113))
 d.text((54,433),'Not a corporate photograph or an approved logo',font=body,fill=(93,107,113))
 return im
audit={};hashes=set()
for name,sources in pages.items():
 started=time.monotonic()
 chosen=None
 for url,article in direct_photos.get(name,[]):
  try:
   raw=read(url,timeout=20 if name=='photo2.jpg' else 9)
   chk=Image.open(BytesIO(raw));chk.verify()
   im=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
   if im.width<580 or im.height<290:raise ValueError('photo dimensions too small')
   h=sha256(raw).hexdigest()
   if h in hashes:raise ValueError('duplicate source image')
   chosen=(im,url,article,h)
   print('POWER_INVEST_VERIFIED_SOURCE_PHOTO',name,url,im.size)
   break
  except Exception as e:
   print('POWER_INVEST_OFFICIAL_PHOTO_SOURCE_REJECTED',name,url,str(e)[:150])
 for page in ([] if chosen else sources):
  if time.monotonic()-started>65:
   print('POWER_INVEST_FETCH_BUDGET_EXHAUSTED',name)
   break
  try:
   entries=candidates(page)
   ranked=[]
   for u,attrs in entries:
    absolute=urljoin(page,u)
    if not valid_host(absolute):continue
    meta=' '.join(str(v) for v in attrs.values()).lower()
    if name=='logo.png':
     score=(12 if re.search('logo|\u4e2d\u56fd\u7535\u5efa|powerchina|\u7535\u5efa\u7535\u6295',meta) else 0)
     if score==0:continue
    else:
     if re.search('logo|icon|footer|head|二维码|ewm|code|wx|qr',meta):continue
     score=(6 if re.search('/picture/|/uploads?/|/images?/|/img/|/art/',absolute.lower()) else 0)
    ranked.append((score,absolute))
   ranked.sort(reverse=True)
   for score,url in ranked[:7]:
    if time.monotonic()-started>65:break
    try:
     raw=read(url)
     check=Image.open(BytesIO(raw));check.verify()
     im=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
     if name=='logo.png':
      if im.width<120 or im.height<28 or im.width>8000:continue
     elif im.width<580 or im.height<290:continue
     h=sha256(raw).hexdigest()
     if h in hashes:continue
     if name!='logo.png' and im.width/im.height>4:continue
     chosen=(im,url,page,h)
     break
    except Exception as e:
     print('POWER_INVEST_IMAGE_REJECTED',name,url,str(e)[:105])
   if chosen:break
  except Exception as e: print('POWER_INVEST_ARTICLE_SOURCE_ERROR',name,page,str(e)[:180])
 if chosen:
  im,url,page,h=chosen;hashes.add(h)
  audit[name]={'verified':True,'source':url,'article':page,'sha256':h,'dimensions':[im.width,im.height]}
 else:
  im=placeholder(name)
  audit[name]={'verified':False,'source':None,'article':None,
   'warning':'Clearly labeled unavailable placeholder; NOT an actual company photo or logo'}
  print('POWER_INVEST_VISIBLE_PLACEHOLDER',name)
 im.thumbnail((1800,1400))
 dst=root/name
 if name.endswith('.png'):im.save(dst,'PNG',optimize=True)
 else:im.save(dst,'JPEG',quality=84,optimize=True)
 if dst.stat().st_size<1800:raise ValueError('Invalid output size '+name)
 print('POWER_INVEST_ASSET',name,im.size,dst.stat().st_size,audit[name].get('source'))
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
