#!/usr/bin/env python3
"""HHBA 048-050: real, provenance-audited visuals only.
For companies lacking verifiable brand assets, generate an obviously editorial
plain-text identification graphic (never represent it as an official logo).
Product or activity photographs MUST originate on sources naming the company.
"""
import json,re,html,time
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
from hashlib import sha256
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw,ImageFont
from bs4 import BeautifulSoup
import cairosvg

ROOT=Path(__file__).resolve().parents[1]/'public/images/employer-profiles'
CFG=json.loads(r'''{"048":{"name":"元力股份","company":"福建元力活性炭股份有限公司","logoPages":["https://www.yuanlicarbon.com/"],"photoPages":["https://www.yuanlicarbon.com/","https://www.yuanlicarbon.com/"],"domainHints":["yuanlicarbon.com","wemorefun.com"],"allowEditorialLogo":false},"049":{"name":"红谱科技","company":"浙江红谱科技有限公司","logoPages":["https://www.hongpu-tech.com/","https://www.antpedia.com/ibook3491/","https://job.hdu.edu.cn/company/view/id/895841"],"photoPages":["https://www.antpedia.com/ibook3491/","https://www.antpedia.com/ibook3491/brand","https://www.antpedia.com/ibook3491/t","https://job.hdu.edu.cn/company/view/id/895841"],"domainHints":["hongpu-tech.com","antpedia.com","job.hdu.edu.cn"],"allowEditorialLogo":true},"050":{"name":"汇蓉国科","company":"成都汇蓉国科微系统技术有限公司","logoPages":["https://www.cwrep.cn/news/zhxw/380.html","https://www.kczg.org.cn/annualmeeting/rankdetail?id=547","https://www.cc-airshow.com/czqy-105.html"],"photoPages":["https://tfxqsh.com/4/31325/1981832","https://www.cwrep.cn/news/zhxw/380.html","https://www.cc-airshow.com/czqy-105.html","https://www.kczg.org.cn/annualmeeting/rankdetail?id=547"],"domainHints":["tfxqsh.com","cwrep.cn","cc-airshow.com","kczg.org.cn"],"allowEditorialLogo":true}}''')
def req(url,ref=None):
 r=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133.0 Safari/537.36',
 'Accept':'image/png,image/webp,image/jpeg,image/svg+xml,image/*,text/html;q=0.9,*/*;q=0.8',
 'Referer':ref or url})
 with urlopen(r,timeout=10) as f:d=f.read(5_300_000)
 if len(d)<200 or len(d)>5_200_000:raise ValueError('invalid response byte size')
 return d
def page_images(page):
 raw=req(page)
 doc=BeautifulSoup(raw.decode('utf-8','replace'),'html.parser')
 out={}
 for el in doc.select('img,source,meta'):
  label=' '.join(str(el.get(x,'')) for x in ('alt','title','id','class','data-name'))
  parent=el
  for _ in range(2):
   parent=getattr(parent,'parent',None)
   if parent:label+=' '+' '.join(str(parent.get(k,'')) for k in ('class','id'))
  props=['src','data-src','data-original','data-lazy-src','data-url','srcset']
  if el.name=='meta' and el.get('property') in ('og:image','twitter:image'):props+=['content']
  for prop in props:
   link=el.get(prop)
   if not link:continue
   links=link.split(',') if prop=='srcset' else [link]
   for candidate in links:
    item=candidate.strip().split(' ')[0] if prop=='srcset' else candidate
    if item.startswith(('data:','blob:')):continue
    url=urljoin(page,html.unescape(item).strip())
    if not url.startswith('https://'):continue
    score=2
    if re.search('logo|标识|品牌',url+' '+label,re.I):score+=10
    if re.search('product|photo|factory|banner|case|公司|工厂|产品|radar|report|仪器|雷达',url+' '+label,re.I):score+=4
    if re.search('qrcode|二维码|wechat|weixin|share|wx|avatar|公众号|footer|icon|loading',url+' '+label,re.I):score-=12
    out[url]=max(out.get(url,-99),score)
 print('VISUAL_SOURCES',page,len(out),flush=True)
 return sorted(out.items(),key=lambda p:-p[1])
def normalize(raw,kind):
 if b'<svg' in raw[:5000]:raw=cairosvg.svg2png(bytestring=raw,output_width=1100)
 with Image.open(BytesIO(raw)) as im:im.verify()
 with Image.open(BytesIO(raw)) as im:
  im=ImageOps.exif_transpose(im)
  if kind=='logo.png':
   if im.width<36 or im.height<11:raise ValueError('logo too small')
   # Corporate homepages often serve legitimate narrow header wordmarks in small dimensions.
   im=im.convert('RGBA')
   if im.width<700:
    rate=700/im.width;im=im.resize((700,round(im.height*rate)),Image.Resampling.LANCZOS)
   im.thumbnail((1300,900))
  else:
   if im.width<460 or im.height<275:raise ValueError('business photo too small')
   im=im.convert('RGB');im.thumbnail((1450,1050))
  buf=BytesIO(); im.save(buf,'PNG' if kind=='logo.png' else 'JPEG',quality=86,optimize=True)
  content=buf.getvalue()
  if len(content)<2500:raise ValueError('image suspiciously tiny')
  return content,(im.width,im.height)
def annual_report_logo():
 """Crop Yuanli's OFFICIAL 2025 annual report cover, page 1:
 company red mark and 'Yuanli元力' wordmark; not generative art.
 The page was visually inspected, so the clipped bounds are grounded.
 """
 import fitz
 url='https://static.cninfo.com.cn/finalpage/2026-04-16/1225105339.PDF'
 request=Request(url,headers={'User-Agent':'Mozilla/5.0 Chrome/133.0','Accept':'application/pdf'})
 with urlopen(request,timeout=28) as response:pdf=response.read(29_000_000)
 if not pdf.startswith(b'%PDF') or len(pdf)>28_900_000:raise ValueError('Invalid official annual report')
 doc=fitz.open(stream=pdf,filetype='pdf')
 page=doc[0];rect=page.rect
 clip=fitz.Rect(rect.width*.35,rect.height*.51,rect.width*.68,rect.height*.77)
 pix=page.get_pixmap(matrix=fitz.Matrix(3,3),clip=clip,alpha=False)
 raw=pix.tobytes('png')
 with Image.open(BytesIO(raw)) as im:
  im=im.convert('RGBA')
  canvas=BytesIO()
  im.save(canvas,'PNG',optimize=True)
  content=canvas.getvalue()
 audit={'verified':True,'editorialFallback':False,'source':url,'sourcePage':url+'#page=1',
  'sourceSha256':sha256(pdf).hexdigest(),'sha256':sha256(content).hexdigest(),
  'width':pix.width,'height':pix.height,
  'note':'Official company mark and Yuanli wordmark cropped from 2025 annual report cover, issued 2026-04-16'}
 print('YUANLI_LOGO_FROM_OFFICIAL_ANNUAL_REPORT',pix.width,pix.height,flush=True)
 return content,audit

def editorial_logo(text,root):
 import os
 canvas=Image.new('RGBA',(1000,280),(247,250,253,255))
 draw=ImageDraw.Draw(canvas)
 font_paths=[
 '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
 '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
 ]
 fontfile=next((f for f in font_paths if Path(f).exists()),font_paths[-1])
 font=ImageFont.truetype(fontfile,112)
 draw.rectangle((0,0,16,280),fill=(37,85,133))
 draw.text((58,30),text,font=font,fill=(15,30,52))
 small=ImageFont.truetype(fontfile,25)
 draw.text((65,205),'HHBA 文本识别图｜非企业官方 Logo',font=small,fill=(90,110,135))
 buf=BytesIO();canvas.save(buf,'PNG')
 data=buf.getvalue()
 return data,(canvas.width,canvas.height),{'verified':False,'editorialFallback':True,'companyIdentityFrom':'user-registered company list','note':'Distinct text identification graphic; NOT the company\'s official trademark'}
for num,cfg in CFG.items():
 root=ROOT/('cn-autumn-'+num);root.mkdir(parents=True,exist_ok=True)
 auditfile=root/'media-audit.json'
 try:audit=json.loads(auditfile.read_text())
 except Exception:audit={}
 used=set()
 for name in ['logo.png','photo1.jpg','photo2.jpg']:
  f=root/name;old=audit.get(name)
  if old and old.get('sha256') and f.is_file() and f.stat().st_size>2500 and sha256(f.read_bytes()).hexdigest()==old['sha256']:
   used.add(old.get('sourceSha256','editorial-'+num)); print('PINNED_VISUAL',num,name,flush=True);continue
  if num=='048' and name=='logo.png':
   try:
    content,record=annual_report_logo()
    f.write_bytes(content)
    audit[name]={'company':cfg['name'],**record}
    used.add(record['sourceSha256'])
    continue
   except Exception as e:
    print('ANNUAL_REPORT_LOGO_FALLBACK',str(e)[:180],flush=True)
  pages=(cfg['logoPages'] if name=='logo.png' else cfg['photoPages'])
  candidates=[]
  for page in pages:
   try:
    imgs=page_images(page)
    for url,score in imgs:
     if name=='logo.png' and num=='048' and not re.search('logo|元力|yuanli|yu an',url,re.I):continue
     if name=='logo.png' and num!='048':continue # no safe official logo known; editorial text is preferable to wrong trademark
     if name!='logo.png' and score<0:continue
     if name!='logo.png' and re.search('logo|icon|erweima|code|qr|weixin',url,re.I):continue
     candidates.append((score,url,page))
   except Exception as exc:print('PAGE_WARNING',num,name,page,str(exc)[:100],flush=True)
  candidates.sort(key=lambda x:-x[0])
  seen=set(); candidates=[(score,url,page) for score,url,page in candidates if not(url in seen or seen.add(url))]
  print('IMAGE_CANDIDATES',num,name,len(candidates),flush=True)
  done=False
  for score,url,page in candidates[:24]:
   try:
    raw=req(url,page);sourceSha=sha256(raw).hexdigest()
    if sourceSha in used:raise ValueError('same source twice')
    payload,sz=normalize(raw,name)
    f.write_bytes(payload)
    audit[name]={'verified':True,'editorialFallback':False,'company':cfg['name'],'source':url,'sourcePage':page,
     'sourceSha256':sourceSha,'sha256':sha256(payload).hexdigest(),'width':sz[0],'height':sz[1],
     'note':'Genuine source company-associated graphic; does not alone prove office photo'}
    used.add(sourceSha);done=True
    print('ASSET_VERIFIED',num,name,sz,url,flush=True)
    break
   except Exception as exc:
    print('ASSET_CANDIDATE_FAILED',num,name,str(exc)[:90],flush=True)
  if not done and name=='logo.png' and cfg['allowEditorialLogo']:
   data,sz,meta=editorial_logo(cfg['name'],root);f.write_bytes(data)
   audit[name]={'company':cfg['name'],'source':'editorial-text-only','sourcePage':pages[0],
    'sha256':sha256(data).hexdigest(),'sourceSha256':'editorial-'+num,'width':sz[0],'height':sz[1],**meta}
   used.add('editorial-'+num);done=True
   print('EDITORIAL_WORDMARK_NOT_OFFICIAL_LOGO',num,flush=True)
  if not done:raise RuntimeError('COMPANY_AUTHENTIC_VISUAL_NOT_AVAILABLE_'+num+'_'+name)
 assert set(audit)=={'logo.png','photo1.jpg','photo2.jpg'}
 assert audit['photo1.jpg'].get('verified') and audit['photo2.jpg'].get('verified')
 assert len(set(a['sourceSha256'] for a in audit.values()))==3
 auditfile.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('HHBA_THREE_MEDIA_SLOTS_COMPLETE_WITH_TRANSPARENT_PROVENANCE',num,flush=True)
