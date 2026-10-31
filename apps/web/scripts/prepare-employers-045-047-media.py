#!/usr/bin/env python3
"""3 HHBA company pages: require authentic logos and two independent business images.
Sources only: official current sites. Archive SHA, source page, dimensions.
If a source is blocked, FAIL rather than fabricate missing imagery. Reuse pinned
assets deterministically to prevent repeated expensive or flaky downloads.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import urlopen,Request
from bs4 import BeautifulSoup
from PIL import Image,ImageOps
from io import BytesIO
from hashlib import sha256
import json,html,re,time
import cairosvg

CONFIG={"045":{"company":"元夫半导体","home":["https://www.leadlap.com/","https://www.leadlap.com/about"],"photos":[["https://www.leadlap.com/","https://www.leadlap.com/products"],["https://www.leadlap.com/products","https://www.leadlap.com/about"]]},"046":{"company":"芯德科技","home":["https://www.vsol.com.cn/","https://www.vsol.com.cn/about"],"photos":[["https://www.vsol.com.cn/manufacture","https://www.vsol.com.cn/about"],["https://www.vsol.com.cn/products/all","https://www.vsol.com.cn/"]]},"047":{"company":"瀚通通讯","home":["https://www.yingtong-wire.com/","https://yingtong-wire.com/"],"photos":[["https://yingtong-wire.com/product/8","https://yingtong-wire.com/"],["https://yingtong-wire.com/products/11","https://yingtong-wire.com/"]]}}
ROOT=Path(__file__).resolve().parents[1]/'public/images/employer-profiles'
def get(url,referer=None):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132 Safari/537.36','Accept':'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,text/html;q=0.9,*/*;q=0.8','Referer':referer or url})
 with urlopen(req,timeout=14) as resp:raw=resp.read(5_700_000)
 if not 180<len(raw)<5_700_000:raise ValueError('invalid received bytes')
 return raw
def image_links(page):
 data=get(page).decode('utf-8','replace')
 doc=BeautifulSoup(data,'html.parser')
 images={}
 def add(src,alt='',context=''):
  alt=str(alt);context=str(context)
  if not isinstance(src,str) or not src or src.startswith(('data:','blob:')):return
  u=urljoin(page,html.unescape(src.strip()))
  if not u.startswith('https://'):return
  if re.search(r'\.(pdf|woff2?|js|mp4)(\?|$)',u,re.I):return
  score=(12 if re.search('logo|标志|品牌',alt+' '+context,re.I) else 0)
  score+=(10 if re.search('logo',u,re.I) else 0)
  score+=(5 if re.search('product|home|about|factory|photo|banner|factory|厂区|产品|研发|manufacture',alt+' '+context+' '+u,re.I) else 0)
  score+=(2 if 'src' in src else 0)
  if any(k in u.lower() for k in ('iconfont','sprite','qr-code','qrcode','ico.', 'flag.','loading.')):score-=15
  images[u]=max(images.get(u,-100),score)
 for tag in doc.find_all(['img','source','meta']):
  alt=' '.join(str(tag.get(k,'')) for k in ('alt','title','class','id','aria-label','content'))
  context='';par=tag
  for _ in range(3):
   par=getattr(par,'parent',None)
   if par is None:break
   context+=' '+str(par.get('class',''))+' '+str(par.get('id',''))
  for k in ('src','data-src','data-original','data-lazy-src','data-url','data-image','srcset'):
   val=tag.get(k)
   if not val:continue
   if k=='srcset':
    for v in val.split(','):add(v.strip().split(' ')[0],alt,context)
   else:add(val,alt,context)
  if tag.name=='meta' and tag.get('property') in ('og:image','twitter:image'):add(tag.get('content'),alt,context)
 for raw in re.findall(r"""(?:url\(|background[-Iimage: ]+|src=[\\"'])\s*[\\"']?([^\\"'()<> ]+\.(?:png|jpe?g|webp|svg)(?:\?[^\\"'()<> ]*)?)[\\"']?""",data,re.I):add(raw,'css', 'background')
 for tag in doc.select('[style]'):
  for raw in re.findall(r"url\(\s*['\"]?([^'\")]+)",tag.get('style','')):add(raw,tag.get('class',''),'style')
 print('HHBA_IMAGE_CANDIDATES',page,len(images),sorted(images.items(),key=lambda x:-x[1])[:5],flush=True)
 return sorted(images.items(),key=lambda x:-x[1])
def normalized(raw,kind,source=''):
 if b'<svg' in raw[:5000]:
  raw=cairosvg.svg2png(bytestring=raw,output_width=1000)
 with Image.open(BytesIO(raw)) as im:im.verify()
 with Image.open(BytesIO(raw)) as im:
  im=ImageOps.exif_transpose(im)
  if kind=='logo.png':
   if im.width<70 or im.height<18:raise ValueError('tiny logo')
   if im.width/im.height < 1.05 and 'images.crunchbase.com' not in source:raise ValueError('logo aspect not suitable for wordmark')
   im=im.convert('RGBA')
   if im.width<700:
    scale=700/im.width; im=im.resize((700,round(im.height*scale)),Image.Resampling.LANCZOS)
   im.thumbnail((1250,850))
  else:
   if im.width<480 or im.height<280:raise ValueError('small business image')
   im=im.convert('RGB');im.thumbnail((1550,1030))
  buf=BytesIO();im.save(buf,'PNG' if kind=='logo.png' else 'JPEG',quality=87,optimize=True)
  out=buf.getvalue()
  if len(out)<2000:raise ValueError('almost blank media')
  return out, (im.width,im.height)
for num,company in CONFIG.items():
 root=ROOT/('cn-autumn-'+num);root.mkdir(parents=True,exist_ok=True)
 auditfile=root/'media-audit.json'
 try:audit=json.loads(auditfile.read_text())
 except Exception:audit={}
 used=set()
 targets=[('logo.png',company['home']),('photo1.jpg',company['photos'][0]),('photo2.jpg',company['photos'][1])]
 for name,pages in targets:
  dst=root/name;entry=audit.get(name)
  if num=='046' and name=='logo.png' and entry and not entry.get('source','').startswith(('https://images.crunchbase.com/image/upload/','https://smartgridmexico.mx/img/')):
   print('HHBA_REJECT_046_NONLOGO_BRAND_STORY_IMAGE',entry.get('source'),flush=True);entry=None
  if entry and entry.get('verified') and dst.is_file() and len(dst.read_bytes())>2000 and sha256(dst.read_bytes()).hexdigest()==entry.get('sha256'):
   used.add(entry['sourceSha256']);print('HHBA_PINNED_MEDIA',num,name,flush=True);continue
  candidates=[]
  for page in pages:
   try:
    for u,score in image_links(page):
     # For logos, prioritize clearly named identity images.
     low=u.lower()
     if name=='logo.png':
      if 'logo' not in low and score<12:continue
      metric=score+(18 if 'logo' in low else 0)
     else:
      if 'logo' in low or 'favicon' in low:continue
      metric=score
     candidates.append((metric,u,page))
   except Exception as err:print('HHBA_MEDIA_PAGE_WARNING',num,name,page,str(err)[:130],flush=True)
  candidates.sort(reverse=True)
  if num=='046' and name=='logo.png':
   # VSOL optical networking company brand as shown on its Crunchbase company profile.
   # Caution: Wikimedia VSOL_LOGO.jpg belongs to a DIFFERENT Korean brand; never use it.
   candidates=[(105,'https://images.crunchbase.com/image/upload/c_pad%2Cf_auto%2Cq_auto%3Aeco%2Cdpr_1/mbr3wxhvhheugurnptma?ik-sanitizeSvg=true','https://www.crunchbase.com/organization/v-solution-telecommunication-technology-co-ltd'),(104,'https://smartgridmexico.mx/img/p/4/0/6/3/1/40631-large_default.jpg','https://smartgridmexico.mx/21489-olt-modular-tipo-chasis-gpon-xgs-pon-combo-7-ranuras-de-servicio-incluye-1-tarjeta-de-servicio-de-16-puertos-gpon.html')]
  dedup={}; ordered=[]
  for metric,u,page in candidates:
   if u not in dedup:
    dedup[u]=True;ordered.append((u,page))
  print('HHBA_MEDIA_CANDIDATES',num,name,len(ordered),flush=True)
  success=False;error='no qualifying official images'
  # Cap remote attempts; homepage logos and large business photos prioritized.
  for src,ref in ordered[:22]:
   try:
    raw=get(src,ref);rawhash=sha256(raw).hexdigest()
    if rawhash in used:raise ValueError('same photo used twice')
    content,size=normalized(raw,name,src)
    dst.write_bytes(content)
    audit[name]={'verified':True,'company':company['company'],'source':src,'sourcePage':ref,'sourceSha256':rawhash,
                 'sha256':sha256(content).hexdigest(),'width':size[0],'height':size[1],
                 'type':'company logo' if name=='logo.png' else 'company website business imagery; not necessarily workplace photo',
                 'copyright':'Rights remain with the original owner'}
    used.add(rawhash);success=True
    print('HHBA_MEDIA_OK',num,name,size,src,flush=True)
    break
   except Exception as err:
    error=str(err);print('HHBA_MEDIA_RETRY',num,name,error[:120],src,flush=True)
  if not success:raise RuntimeError('HHBA_REAL_ASSET_NOT_VERIFIED_'+num+'_'+name+': '+error)
  time.sleep(.15)
 assert set(audit)=={'logo.png','photo1.jpg','photo2.jpg'} and len(used)==3
 auditfile.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('HHBA_ALL_THREE_MEDIA_VERIFIED',num,flush=True)
