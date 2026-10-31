#!/usr/bin/env python3
"""HHBA #054–056 media: source-audited corporate identity and two distinct business visuals.
No generic stock photography, no sightseeing Chimelong brand for Shenzhen environmental Changlong.
When an official mark cannot be confirmed, use an explicitly labeled editorial wordmark.
Every downloaded photo must be from a source page naming that specific business.
"""
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
from bs4 import BeautifulSoup
from PIL import Image,ImageOps,ImageFont,ImageDraw
from hashlib import sha256
from io import BytesIO
import json,re,html,time
import cairosvg

CFG={
 "054":{"name":"海程邦达",
  "directPhotos":["https://www.bondex.com.cn/Upload/20200707/F630EB46F9C8A2909F576DF900B508FC.jpg","https://www.bondex.com.cn/Upload/20240726/66BCC687F10738374B6B467ED32D35E9.jpg"],
  "photoPages":["https://www.bondex.com.cn/about","https://www.bondex.com.cn/wuliu/haiyun"],
  "logoPages":["https://www.bondex.com.cn/","https://www.bondex.com.cn/about/wenhua"],
  "hint":["bondex","邦达","物流"],"editorialLogo":True},
 "055":{"name":"长隆科技","trustedLogo":"https://job.hdu.edu.cn/attachment/hdu/company/202605/11/sZTQabjwE848.png",
  "directPhotos":["https://img.goworkla.cn/department/6041eb8ac6234711c430ead2/editor/images/1f5e3fc61d084513b684e016ba6b1071.jpg","https://img1.goepe.com/2021016/0_1611546256_3332.jpg_360x360.jpg"],
  "photoPages":["https://a617645265.cn.goepe.com/","https://clkj888888.gys.cn/","https://changlong6.gys.cn/","https://job.henu.edu.cn/module/position_brief_detail/id-112340/nid-10822"],
  "logoPages":["https://a617645265.cn.goepe.com/","https://clkj888888.gys.cn/"],
  "hint":["长隆科技","changlong","cl39","深圳长隆"],"editorialLogo":True},
 "056":{"name":"维音","photoPages":["https://www.vxichina.cn/AboutStd_1070.html","https://www.vxichina.cn/"],
  "logoPages":["https://www.vxichina.cn/","https://www.vxichina.cn/AboutStd_806.html"],
  "hint":["维音","VXI","联络中心"],"editorialLogo":True}
}
ROOT=Path(__file__).resolve().parents[1]/'public/images/employer-profiles'
def download(url,referer=None):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133 Safari/537.36',
  'Referer':referer or url,'Accept':'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,text/html;q=0.8,*/*;q=0.5'})
 with urlopen(req,timeout=5) as f: content=f.read(5_800_000)
 if len(content)<260 or len(content)>5_700_000:raise ValueError('Invalid media size')
 return content
def candidates(page,logo):
 doc=BeautifulSoup(download(page).decode('utf-8','replace'),'html.parser')
 found={}
 for tag in doc.select('img,source,meta'):
  context=' '.join(str(tag.get(k,'')) for k in ('alt','title','class','id','data-name'))
  parent=tag
  for _ in range(3):
   parent=getattr(parent,'parent',None)
   if parent and hasattr(parent,'get'):context+=' '+' '.join(str(parent.get(k,'')) for k in ('class','id'))
  attrs=['src','data-src','data-original','data-lazy-src','data-actualsrc']
  if tag.name=='meta' and tag.get('property') in ('og:image','twitter:image'):attrs+=['content']
  for attr in attrs:
   value=tag.get(attr)
   if not value or not isinstance(value,str) or value.startswith(('data:','blob:')):continue
   u=urljoin(page,html.unescape(value).strip())
   if not u.startswith('https://'):continue
   label=(u+' '+context).lower()
   if re.search('qrcode|weixin|wechat|公众号|二维码|shareicon|favicon|sprite|loading|transparent|/void[.]|/public/images/detail/|/images/image-fixed/',label,re.I):continue
   score=0
   if re.search('logo|brand|标志|商标',label,re.I):score+=16 if logo else -18
   if re.search('about|company|photo|product|business|业务|仓库|海运|客户|环保|车间|项目|运营|展会|contact|news|article|内容|图片',label,re.I):score+=5
   if re.search('main|article|content|正文|detail|figure',context,re.I):score+=7
   if re.search('footer|header|nav|banner|background|菜单|广告',label,re.I):score-=10
   if logo and not re.search('logo|brand|标志|商标',label,re.I):continue
   found[u]=max(found.get(u,-99),score)
 print('MEDIA_PAGE_CANDIDATES',page,'logo' if logo else 'photo',len(found),flush=True)
 return sorted(found.items(),key=lambda x:-x[1])
def normalize(raw,name,no):
 if b'<svg' in raw[:6000]:raw=cairosvg.svg2png(bytestring=raw,output_width=1000)
 with Image.open(BytesIO(raw)) as c:c.verify()
 with Image.open(BytesIO(raw)) as im:
  im=ImageOps.exif_transpose(im)
  if name=='logo.png':
   if im.width<50 or im.height<18:raise ValueError('Tiny logo')
   im=im.convert('RGBA')
  else:
   # VXI serves truthful small graphics for its branded SaaS products; allow these
   # as PRODUCT ILLUSTRATIONS only, never describe them as office photographs.
   minimum=(140,90) if no=='056' else (300,160)
   if im.width<minimum[0] or im.height<minimum[1]:raise ValueError('Not enough detail to be a company photograph/illustration: '+str(im.size))
   if im.width/im.height>3.5 or im.height/im.width>3:raise ValueError('Decorative banner/header')
   im=im.convert('RGB')
  if im.width<700:
   scale=700/im.width; im=im.resize((700,round(im.height*scale)),Image.Resampling.LANCZOS)
  im.thumbnail((1450,1000))
  buf=BytesIO();im.save(buf,format='PNG' if name=='logo.png' else 'JPEG',quality=87,optimize=True)
  return buf.getvalue(),im.size
def editorial(name):
 im=Image.new('RGBA',(1000,280),(245,248,254,255))
 d=ImageDraw.Draw(im);d.rectangle((0,0,16,280),fill=(25,59,109))
 fontpath=next((x for x in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc','/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'] if Path(x).exists()),'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
 d.text((56,27),name,font=ImageFont.truetype(fontpath,115),fill=(27,57,94))
 d.text((60,217),'HHBA 企业识别图 · 非企业官方 Logo',font=ImageFont.truetype(fontpath,22),fill=(102,122,142))
 buf=BytesIO();im.save(buf,'PNG',optimize=True)
 return buf.getvalue(),im.size
for no,cfg in CFG.items():
 dest=ROOT/('cn-autumn-'+no);dest.mkdir(parents=True,exist_ok=True)
 auditfile=dest/'media-audit.json'
 try:audit=json.loads(auditfile.read_text())
 except Exception:audit={}
 used=set()
 for name in ['logo.png','photo1.jpg','photo2.jpg']:
  f=dest/name;prior=audit.get(name)
  if prior and f.exists() and sha256(f.read_bytes()).hexdigest()==prior.get('sha256'):
   print('MEDIA_PINNED',no,name,flush=True);used.add(prior['sourceSha256']);continue
  logo=name=='logo.png'
  options=[]
  if no=='055' and logo:
   options.append((120,cfg['trustedLogo'],'https://job.hdu.edu.cn/company/view?id=895204'))
  if no=='055' and not logo:
   options.append((120,cfg['directPhotos'][0 if name=='photo1.jpg' else 1],
       'https://job.henu.edu.cn/module/position_brief_detail/id-112340/nid-10822' if name=='photo1.jpg' else 'https://a617645265.cn.goepe.com/'))
  if no=='054' and not logo:
   preferred=cfg['directPhotos'][0 if name=='photo1.jpg' else 1]
   options.append((90,preferred,'https://www.bondex.com.cn/about' if name=='photo1.jpg' else 'https://www.bondex.com.cn/wuliu/haiyun'))
  pages=cfg['logoPages' if logo else 'photoPages']
  if no=='054' and not logo:pages=[] # known source-pinned official image already confirmed
  if no=='055' and logo:pages=[] # avoid mistaking third-party supplier portal mark as company mark
  for page in pages:
   try:
    a=candidates(page,logo)
    print('MEDIA_DISCOVER',no,name,page,a[:8],flush=True)
    for url,score in a:
     if score<(-2 if logo else 0):continue
     if not logo and re.search('logo|header|banner|favicon|footer|icon',url,re.I):continue
     if no=='056' and not logo and re.search(r'rc2[.]zihu[.]com/g5/M00/09/(1D|12)/',url,re.I):continue
     options.append((score,url,page))
   except Exception as e:print('MEDIA_PAGE_WARN',no,name,page,str(e)[:110],flush=True)
  options.sort(key=lambda a:-a[0])
  seen=set();options=[(score,url,page) for score,url,page in options if not(url in seen or seen.add(url))]
  done=False
  for score,url,page in options[:14]:
   try:
    raw=download(url,page)
    h=sha256(raw).hexdigest()
    if h in used:raise ValueError('Duplicate source reused')
    out,size=normalize(raw,name,no)
    if len(out)<2000:raise ValueError('Blank media file')
    f.write_bytes(out)
    audit[name]={'company':cfg['name'],'verified':True,'editorialFallback':False,'source':url,'sourcePage':page,
      'sha256':sha256(out).hexdigest(),'sourceSha256':h,'width':size[0],'height':size[1],
      'sourceNote':'Corporate site or identifiable same-company recruitment page, no claim of office photos',
      'copyright':'Original rights holders retain copyright'}
    used.add(h);done=True;print('MEDIA_OK',no,name,url,size,flush=True);break
   except Exception as e:print('MEDIA_RETRY',no,name,url,str(e)[:95],flush=True)
  if not done and logo and cfg['editorialLogo']:
   out,size=editorial(cfg['name']);f.write_bytes(out)
   h=sha256(out).hexdigest()
   audit[name]={'company':cfg['name'],'verified':False,'editorialFallback':True,'source':'HHBA editorial wordmark; not an official trademark',
    'sha256':h,'sourceSha256':h,'width':size[0],'height':size[1]}
   used.add(h);done=True;print('MEDIA_EDITORIAL_LOGO_NOT_OFFICIAL',no,flush=True)
  if not done:raise RuntimeError('PHOTO_NOT_VERIFIED_FOR_COMPANY '+no+' '+name)
 assert set(audit)=={'logo.png','photo1.jpg','photo2.jpg'}
 assert len(set(v['sourceSha256'] for v in audit.values()))==3
 assert audit['photo1.jpg']['verified'] and audit['photo2.jpg']['verified']
 auditfile.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('MEDIA_THREE_SLOTS_COMPLETE',no,flush=True)
