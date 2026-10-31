#!/usr/bin/env python3
"""HHBA 051-053: source-backed media only. Never claim editorial wordmark is official.
Company 051 lacks a public official mark; parent/subsidiary views must be labeled.
All local files retain source URLs and SHA-256 in media-audit.json.
"""
import json,re,html,time
from urllib.request import Request,urlopen
from urllib.parse import urljoin
from io import BytesIO
from pathlib import Path
from hashlib import sha256
from PIL import Image,ImageDraw,ImageFont,ImageOps
from bs4 import BeautifulSoup
import cairosvg

ROOT=Path(__file__).resolve().parents[1]/'public/images/employer-profiles'
CFG={
 "051":{"name":"金中新材",
   "logo":[],"logoFallback":True,
   "photo1":["https://p7.itc.cn/images03/20200529/b7dd6e81b0f74e0c9a3e458d1e05e495.jpeg"],
   "photo2":[],"find":["https://www.ccement.com/news/content/50708155484195001.html","https://www.zhcement.com/article/19244.html",
      "https://www.ccement.com/news/content/51812640253835001.html"],
   "note":"photo1 is affiliated shareholder Jinyu Jidong plant, NOT Jinzhong HQ; photo2 is Jinzhong/Hengwei transaction or affiliated project."},
 "052":{"name":"宏川集团","logoFallback":True,
   "logo":[],"logoFind":["https://grgroup.cc/","https://grgroup.cc/about.html","https://www.grgroup.cc/human/005002.html"],
   "photo1":["https://career.cup.edu.cn/attachment/cup/ueditor/images/20181026/1540535814524187.jpg"],
   "photo2":[],
   "find":[],"note":"Headquarters image from university company listing; second picture from Hongchuan Group official Nangtong port operations news."},
 "053":{"name":"兰石集团","logoFallback":True,"logo":[],
   "logoFind":["https://www.lsjt.com.cn/","https://www.lansland.com/","https://www.lsjt.com.cn/lsgroup/lsgroup/guanyulanshijt/fazhanlicheng/index.html"],
   "photo1":["https://www.lansland.com/upload/1/cms/content/20251228/2005153501508898816.jpg"],
   "photo2":["https://www.lzxq.gov.cn/pic/003/020/730/00302073073_379c00e6.jpg"],
   "find":[],"note":"Official group industrial park and government reported 125MN press of Lanshi subsidiary."}
}
def fetch(url,referer=''):
 hdr={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133.0 Safari/537.36',
 'Referer':referer or url,'Accept':'image/avif,image/webp,image/jpeg,image/png,image/svg+xml,image/*,text/html;q=0.8,*/*;q=0.5'}
 req=Request(url,headers=hdr)
 with urlopen(req,timeout=17) as f:content=f.read(8_000_000)
 if not 200<len(content)<7_999_999:raise ValueError('invalid length')
 return content
def normalize(raw,kind):
 if b'<svg' in raw[:6000]:raw=cairosvg.svg2png(bytestring=raw,output_width=1100)
 with Image.open(BytesIO(raw)) as check:check.verify()
 with Image.open(BytesIO(raw)) as im:
  im=ImageOps.exif_transpose(im)
  if kind=='logo.png':
   if im.width<60 or im.height<20:raise ValueError('logo too small')
   im=im.convert('RGBA')
  else:
   if im.width<250 or im.height<170:raise ValueError('photo too small')
   if im.width/im.height>3.5 or im.height/im.width>3:raise ValueError('web decoration not usable photo')
   im=im.convert('RGB')
  if im.width<680:
   x=680/im.width; im=im.resize((680,max(1,round(im.height*x))),Image.Resampling.LANCZOS)
  im.thumbnail((1400,1050))
  b=BytesIO();im.save(b,'PNG' if kind=='logo.png' else 'JPEG',quality=87,optimize=True)
  return b.getvalue(),(im.width,im.height)
def editorial_name(name):
 im=Image.new('RGBA',(1000,275),(246,248,253,255))
 d=ImageDraw.Draw(im)
 d.rectangle((0,0,18,275),fill=(30,78,137))
 paths=['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc','/usr/share/fonts/truetype/wqy/wqy-microhei.ttc']
 p=next((k for k in paths if Path(k).exists()),'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
 font=ImageFont.truetype(p,100);sm=ImageFont.truetype(p,22)
 d.text((52,24),name,font=font,fill=(18,41,77))
 d.text((60,211),'HHBA 文字识别图 · 非企业官方 Logo',font=sm,fill=(108,122,137))
 b=BytesIO();im.save(b,'PNG',optimize=True)
 return b.getvalue(),(im.width,im.height)
def article_images(page,logo=False):
 content=fetch(page).decode('utf-8','replace')
 soup=BeautifulSoup(content,'html.parser')
 candidates={}
 for im in soup.select('img'):
  label=' '.join(str(im.get(k,'')) for k in ('alt','title','class','id'))
  ancestor=im
  for _ in range(3):
   ancestor=getattr(ancestor,'parent',None)
   if ancestor and ancestor.name:
    label+=' '+' '.join(str(ancestor.get(k,'')) for k in ('class','id'))
  for k in ['src','data-src','data-original','data-actualsrc','data-lazy-src']:
   u=im.get(k)
   if not u or not isinstance(u,str) or u.startswith(('data:','blob:')):continue
   u=urljoin(page,html.unescape(u))
   if not u.startswith('https://'):continue
   score=0
   if re.search('article|content|news|资讯|正文|photo|detail|图文',label,re.I):score+=7
   if re.search('金中|恒威|金隅|宏川|兰石',label,re.I):score+=6
   if re.search('logo|标志|品牌',label+' '+u,re.I):score+=24 if logo else -12
   if re.search('qrcode|weixin|wechat|avatar|icon|二维码|二维码|footer|banner|广告|adver|share|hotlogo',label+' '+u,re.I):score-=24
   if logo and not re.search('logo|标志|品牌',label+' '+u,re.I):continue
   candidates[u]=max(score,candidates.get(u,-99))
 return sorted(candidates.items(),key=lambda kv:-kv[1])
for number,cfg in CFG.items():
 folder=ROOT/('cn-autumn-'+number);folder.mkdir(parents=True,exist_ok=True)
 auditfile=folder/'media-audit.json'
 try:audit=json.loads(auditfile.read_text())
 except Exception:audit={}
 used=set()
 # Previous assets used only when actual SHA matches and type is unchanged.
 for filename in ['logo.png','photo1.jpg','photo2.jpg']:
  target=folder/filename;old=audit.get(filename)
  if old and target.exists() and sha256(target.read_bytes()).hexdigest()==old.get('sha256'):
   used.add(old.get('sourceSha256',''))
   print('MEDIA_PINNED',number,filename,flush=True);continue
  options=list(cfg.get(filename.replace('.jpg','').replace('.png',''),[]))
  if filename=='logo.png':
   for page in cfg.get('logoFind',[]):
    try:
     options.extend([u for u,sc in article_images(page,True)[:7]])
    except Exception as e:print('LOGO_FIND_FAIL',number,str(e)[:90],flush=True)
  if filename=='photo1.jpg' and number=='053':
   for page in ['https://www.lansland.com/lsgroup/lsgroup/guanyulanshijt/index.html',
                'https://www.lansland.com/lsgroup/lsgroup/xinwenxuanchuan1995796606296453121/jituanyaowen/2028343080758349825.html']:
    try:
     listed=article_images(page)
     print('OFFICIAL_LANSHI_PHOTO_CANDIDATES',page,listed[:8],flush=True)
     options.extend(u for u,sc in listed if sc>=1 and not re.search('logo|banner|nav|icon',u,re.I))
    except Exception as e:print('LANSHI_PAGE_WARN',page,str(e)[:130],flush=True)
  if filename=='photo2.jpg' and number=='052':
   for page in ['https://www.grgroup.cc/newsview/17571.html','https://www.grgroup.cc/newsview/18029.html']:
    try:
     listed=article_images(page)
     print('OFFICIAL_HONGCHUAN_PHOTO_CANDIDATES',page,listed[:9],flush=True)
     options.extend(u for u,sc in listed if sc>=2 and not re.search('logo|icon|banner|share',u,re.I))
    except Exception as e:print('HONGCHUAN_PAGE_WARN',page,str(e)[:130],flush=True)
  if filename=='photo2.jpg' and number=='051':
   for page in cfg['find']:
    try:
     listed=article_images(page)
     print('CANDIDATE_NEWS',number,page,listed[:8],flush=True)
     options.extend(u for u,sc in listed if sc>=2)
    except Exception as e:print('PHOTO_FIND_FAIL',number,page,str(e)[:90],flush=True)
  ok=False
  for u in dict.fromkeys(options):
   try:
    raw=fetch(u)
    h=sha256(raw).hexdigest()
    if h in used:raise ValueError('same original image already used')
    out,dims=normalize(raw,filename)
    if len(out)<2400:raise ValueError('trivial data')
    target.write_bytes(out)
    audit[filename]={'verified':True,'editorialFallback':False,'company':cfg['name'],'source':u,
      'sourceSha256':h,'sha256':sha256(out).hexdigest(),'width':dims[0],'height':dims[1],
      'sourceNote':cfg['note'],'copyright':'Image rights retained by original publisher'}
    used.add(h);ok=True
    print('MEDIA_OK',number,filename,u,dims,flush=True)
    break
   except Exception as e:
    print('MEDIA_RETRY',number,filename,u,str(e)[:110],flush=True)
  if not ok and filename=='logo.png' and cfg.get('logoFallback'):
   out,dims=editorial_name(cfg['name'])
   target.write_bytes(out)
   h=sha256(out).hexdigest()
   audit[filename]={'verified':False,'editorialFallback':True,'company':cfg['name'],'source':'HHBA-editorial-text-only',
    'sourceSha256':h,'sha256':h,'width':dims[0],'height':dims[1],
    'sourceNote':'Not official logo; no fake claim of ownership'}
   used.add(h);ok=True
   print('MEDIA_EDITORIAL_NONOFFICIAL_LOGO',number,flush=True)
  if not ok:
   raise RuntimeError('REQUIRED_COMPANY_PHOTO_NOT_VERIFIED '+number+' '+filename)
  time.sleep(.1)
 if len(audit)!=3 or len({v['sourceSha256'] for v in audit.values()})!=3:
  raise ValueError('Missing or duplicate media for '+number)
 auditfile.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
 print('HHBA_COMPANY_ALL_THREE_SLOTS_COMPLETE',number,flush=True)
