#!/usr/bin/env python3
"""Retrieve actual corporation/agency image evidence, preserve explicit provenance.
Unobtainable photos remain VISIBLY labelled HHBA editorial SVGs, not fake real photos.
Never infer the company's identity from a visually similar building or manufacturing plant.
"""
import hashlib,json,re,ssl
from pathlib import Path
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
from io import BytesIO
from PIL import Image,ImageOps
BASE=Path("public/images/employer-profiles")
DATA=Path("src/data/employerProfiles")
CTX=ssl.create_default_context();CTX.options|=0x4
UA="Mozilla/5.0 (compatible; HHBA Evidence Media Packaging/1.0)"
class Images(HTMLParser):
 def __init__(self):super().__init__();self.candidates=[];self.pageText=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ('img','source','meta'):
   src=next((a.get(k) for k in ('data-original','data-src','data-lazy','data-image','src','content','srcset') if a.get(k)),None)
   if src:
    if 'srcset' in a and src==a['srcset']:src=src.split(',')[0].strip().split(' ')[0]
    alt=a.get('alt','') or a.get('title','') or a.get('property','')
    self.candidates.append((src,alt))
 def handle_data(self,text):
  if text.strip():self.pageText.append(text.strip())
def get(url,ref=None):
 req=Request(url,headers={'User-Agent':UA,'Referer':ref or url,'Accept':'image/avif,image/webp,image/png,image/jpeg,text/html,*/*;q=0.8'})
 with urlopen(req,timeout=24,context=CTX) as res:
  if res.status!=200:raise RuntimeError('Bad HTTP response: '+str(res.status))
  return res.read(11_000_000)
def source_candidates(page,domain,textcheck):
 raw=get(page).decode('utf-8','ignore')
 obj=Images();obj.feed(raw)
 if textcheck not in raw and textcheck not in ' '.join(obj.pageText):
  raise RuntimeError('Official or government page does not establish company identity: '+page)
 results=[]
 for src,alt in obj.candidates:
  src=unescape(src).replace('\\/','/')
  url=urljoin(page,src)
  if url.startswith('http') and not any(k in url.lower() for k in ('logo','icon','sprite','blank','qrcode','avatar','footer','wechat','pixel','tracking','emoji')):
   results.append((url,alt,page))
 # Raw CMS inline asset strings; do not accept unknown domains for explicit brands
 for x in re.findall(r'(?:(?:https?:)?//|/)[^"<>\\s]+?\\.(?:jpe?g|png|webp)(?:\\?[^"<>\\s]*)?',raw,re.I):
  url=urljoin(page,x.replace('\\/','/'))
  results.append((url,'CMS image element',page))
 return [(u,alt,page) for u,alt,page in results if (urlparse(u).hostname or '').endswith(domain) or domain=='*']
def store(id,slot,url,page,description,phototype='real-image'):
 content=get(url,page)
 try:im=ImageOps.exif_transpose(Image.open(BytesIO(content))).convert('RGB')
 except Exception as e:raise RuntimeError('Not an image '+url) from e
 w,h=im.size
 if w<520 or h<300 or w/h<0.67 or w/h>4.1:raise RuntimeError(f'Image too small/odd {w}x{h} at {url}')
 folder=BASE/('cn-autumn-'+id);folder.mkdir(parents=True,exist_ok=True)
 fname='photo'+str(slot)+'.jpg';im.save(folder/fname,'JPEG',quality=90,optimize=True)
 bytes_=(folder/fname).read_bytes()
 if len(bytes_)<15000:raise RuntimeError('Too small for real official corporate imagery')
 entry={'slot':slot,'file':fname,'sourceImageUrl':url,'sourceWebPage':page,'sourceContext':description,'pixels':[w,h],'sha256':hashlib.sha256(bytes_).hexdigest(),'visualType':phototype,'independentRepublicationPermission':'not verified'}
 print('HHBA_072_074_REAL_IMAGE',id,json.dumps(entry,ensure_ascii=False))
 return entry
def commit(id,photos):
 if not photos: print('HHBA_MISSING_REAL_PHOTOS',id,'Fallback clearly labeled editorial SVGs');return
 file=DATA/('cn-autumn-'+id+'.json');p=json.loads(file.read_text(encoding='utf8'))
 for e in photos:
  i=e['slot']-1
  x=p['media']['photos'][i]
  x['path']='images/employer-profiles/cn-autumn-'+id+'/'+e['file']
  x['caption']=p['displayName']+' · '+e['sourceContext']+'（有来源的真实图片）'
  x['alt']=p['name']+'：'+e['sourceContext']
  x['note']='实际来源：'+e['sourceWebPage']+'；原图：'+e['sourceImageUrl']+'。这是可溯源的实际照片/照片资料，非AI合成；原发布者的商业转载授权尚需单独核查。'
 p['photoNote']+=' 本次构建获得 '+str(len(photos))+' 张有原始来源且SHA-256完整的真实资料照片，未获取的媒体槽仍显示明确标注的编辑性SVG。'
 file.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def collect(id,sources,needle,domain,limit=2,ban=None):
 result=[];seen=set()
 for page,context in sources:
  try:
   candidates=source_candidates(page,domain,needle)
   # only source captions/content from named entity official page
   candidates.sort(key=lambda o:(0 if any(w in (o[1] or '').lower() for w in ('office','beijing','shanghai','plant','厂','办公','工厂','厂区','项目','施工','建筑')) else 1,0 if 'og:image' in (o[1] or '') else 1))
   print('HHBA_MEDIA_CANDIDATES',id,page,len(candidates),json.dumps(candidates[:8],ensure_ascii=False))
   for url,alt,ref in candidates[:45]:
    if len(result)>=limit:break
    if url in seen:continue
    seen.add(url)
    if ban and ban in url:continue
    try:
     entry=store(id,len(result)+1,url,ref,context+((' '+alt[:35]) if alt else ''))
     if any(x['sha256']==entry['sha256'] for x in result):
      (BASE/('cn-autumn-'+id)/entry['file']).unlink(missing_ok=True);continue
     result.append(entry)
    except Exception as exc:print('HHBA_IMAGE_REJECT',id,url,str(exc)[:105])
  except Exception as exc:print('HHBA_OFFICIAL_PAGE_UNAVAILABLE',id,page,str(exc)[:180])
  if len(result)>=limit:break
 return result
# 072: municipal government construction department text explicitly credits 福州建工集团.
# Image selection is restricted to this specific government article; if no photo, keep SVG.
fj=collect('072',[
 ('https://zjj.fuzhou.gov.cn/zwgk/zlaqjg/202503/t20250324_4993333.htm','2025福州市住建局福州建工集团特级资质及工程案例报道配图'),
 ('https://gzw.fuzhou.gov.cn/zwgk/zpxx/202605/t20260527_5327138.htm','2026福州市国资委福州建工招聘报道配图')],
 '福州建工','fuzhou.gov.cn')
commit('072',fj)
# 073: exact Microsoft-owned published research centre building, not generic skyline.
ms=[]
try:ms.append(store('073',1,'https://www.microsoft.com/en-us/research/wp-content/uploads/2023/03/Beijing-Lab.jpg',
 'https://www.microsoft.com/en-us/research/labs-locations/','微软亚洲研究院北京园区建筑真实外观'))
except Exception as e:print('HHBA_MS_BEIJING_FAIL',str(e))
if ms:
 for u,alt,page in source_candidates('https://careers.microsoft.com/v2/global/en/locations/shanghai.html','*','Shanghai'):
  if 'office' not in (alt or '').lower() or 'shanghai' not in (alt or '').lower():continue
  try:
   e=store('073',2,u,page,'Microsoft Careers标注的上海办公区照片')
   if e['sha256']!=ms[0]['sha256']:ms.append(e);break
  except Exception as exc:print('HHBA_MS_SHANGHAI_SKIP',str(exc)[:110])
commit('073',ms)
# 074: exact Volkswagen-owned photo from its Anhui component facility.
vw=[]
try:vw.append(store('074',1,'https://m.volkswagengroupchina.com.cn/MediaFile/Sync/20231121195935/20231121195935.jpg',
 'https://volkswagengroupchina.com.cn/en/news/Detail?ArticleID=EBF2FEE3F8104A5D84731F1FE1D2ABBB','大众安徽高压电池生产实际现场'))
except Exception as e:print('HHBA_VW_FIRST_FAIL',str(e))
if vw:
 for u,alt,page in source_candidates('https://www.volkswagen-newsroom.com/en/images/detail/volkswagen-group-china-88096','*','Volkswagen'):
  if any(z in u.lower() for z in ('logo','sprite','icon')):continue
  try:
   e=store('074',2,u,page,'Volkswagen官方新闻图片库·大众安徽整车总装车间')
   if e['sha256']!=vw[0]['sha256']:vw.append(e);break
  except Exception as exc:print('HHBA_VW_NEWSROOM_SKIP',str(exc)[:110])
commit('074',vw)
for id,x in [('072',fj),('073',ms),('074',vw)]:
 folder=BASE/('cn-autumn-'+id)
 folder.mkdir(parents=True,exist_ok=True)
 (folder/'media-sources.json').write_text(json.dumps({'companyId':id,'images':x,'actualPhotos':len(x),'declaredSlots':2,'rightsVerified':False,'notice':'Editorial reuse permission not independently confirmed; other image slots use labeled SVG placeholders'},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('HHBA_072_074_MEDIA_SOURCE_AUDIT_READY',json.dumps({'072':len(fj),'073':len(ms),'074':len(vw)}))
