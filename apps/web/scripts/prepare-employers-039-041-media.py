#!/usr/bin/env python3
"""Package 3 verifiably distinct authentic assets for each of HHBA employers 039-041.
Never fabricate brand assets, never substitute stock or a different company.
Keep source URL and SHA256; skip download if the audited pinned file already exists.
"""
from pathlib import Path
from urllib.request import urlopen,Request
from urllib.parse import urlencode
from io import BytesIO
from hashlib import sha256
from PIL import Image,ImageOps
import os,json,time
import cairosvg
BASE=Path(__file__).resolve().parents[1]/'public/images/employer-profiles'
CONFIG={"039":{"name":"安世中国","files":{"logo.png":[["https://commons.wikimedia.org/wiki/Special:FilePath/Nexperia-logo.svg","https://commons.wikimedia.org/wiki/File:Nexperia-logo.svg"]],"photo1.jpg":[["https://i.guancha.cn/news/mainland/2025/10/19/20251019202551494.jpg","https://www.guancha.cn/economy/2025_10_19_793872_1.shtml"],["https://storage-public.zhaopin.cn/org/image/1683255445297831138/01-%E5%85%AC%E5%8F%B8%E5%85%A8%E6%99%AF.jpg","https://www.zhaopin.com/companydetail/CZ171829810.htm"]],"photo2.jpg":[["https://cms-image.pandaily.com/nexperia_7943a61342.png","https://pandaily.com/nexperia-china-issues-statement-on-wafer-supply-disruption"]]}},"040":{"name":"黑格科技","files":{"logo.png":[["https://www.heygears.com/en-logo.jpg","https://www.heygears.com/"]],"photo1.jpg":[["https://static3-uswest1.heygears.com/production_static/images/about/index/head-office6.webp","https://www.heygears.com/cn/aboutUs"]],"photo2.jpg":[["https://hg-website.oss-cn-shenzhen.aliyuncs.com/upload/resume/EUpn1565599600399.jpg","https://www.heygears.com/cn/news/14"]]}},"041":{"name":"晶云","files":{"logo.png":[["https://www.crystalpharmatech.com/uploads/image/20250928/%5BSVG_Edited_%E7%94%BB%E6%9D%BF%E5%B0%BA%E5%AF%B8%E8%B0%83%E6%95%B4%5D_%E6%99%B6%E4%BA%91%E8%8B%B1%E6%96%87%E6%A0%87%E5%BF%97-%E6%A8%AA%E7%89%88_%E7%94%BB%E6%9D%BF_1.webp","https://www.crystalpharmatech.com/"]],"photo1.jpg":[["https://www.crystalpharmatech.com.cn/Uploadfiles/Picture/2024-3-29/20243291717291120.jpg","https://www.crystalpharmatech.com.cn/news_view.aspx?contentid=108&t=15"]],"photo2.jpg":[["https://www.crystalpharmatech.com.cn/Uploadfiles/Picture/2025-8-5/2025851525386179.jpg","https://www.crystalpharmatech.com.cn/news_view.aspx?contentid=205&t=15"]]}}}
def download(url,referer):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/133 Safari/537.36',
 'Accept':'image/webp,image/png,image/jpeg,image/svg+xml,image/*',
 'Referer':referer})
 with urlopen(req,timeout=18) as res:raw=res.read(5_500_000)
 if len(raw)<300 or len(raw)>5_200_000:raise ValueError('untrusted size')
 return raw
def convert(raw,filename):
 if b'<svg' in raw[:4000] or (b'<?xml' in raw[:100] and b'<svg' in raw[:4000]):
  raw=cairosvg.svg2png(bytestring=raw,output_width=1100)
 with Image.open(BytesIO(raw)) as img:img.verify()
 with Image.open(BytesIO(raw)) as img:
  img=ImageOps.exif_transpose(img)
  if img.width<150 or img.height<45:raise ValueError('image dimension too small')
  if filename=='logo.png':
   img=img.convert('RGBA');img.thumbnail((1200,700))
  else:
   if img.width<450 or img.height<275:raise ValueError('photo dimension too small')
   img=img.convert('RGB');img.thumbnail((1550,1030))
  size=(img.width,img.height)
  buffer=BytesIO()
  if filename=='logo.png':img.save(buffer,'PNG',optimize=True)
  else:img.save(buffer,'JPEG',quality=87,optimize=True)
  result=buffer.getvalue()
  if len(result)<2500:raise ValueError('blank image')
  return result,size
for index,company in CONFIG.items():
 root=BASE/('cn-autumn-'+index)
 root.mkdir(parents=True,exist_ok=True)
 audit_file=root/'media-audit.json'
 try:audit=json.loads(audit_file.read_text())
 except Exception:audit={}
 used=set()
 for filename,options in company['files'].items():
  fp=root/filename
  previous=audit.get(filename)
  if previous and previous.get('verified') and fp.is_file() and fp.stat().st_size>=2500 and sha256(fp.read_bytes()).hexdigest()==previous.get('sha256'):
   print('HHBA_MEDIA_PINNED',index,filename,flush=True)
   used.add(previous['sourceSha256']);continue
  error='no sources'
  for url,page in options:
   try:
    candidates=[url]
    if filename!='logo.png':
     candidates.append('https://wsrv.nl/?'+urlencode({'url':url,'output':'jpg'}))
    for candidate in candidates:
     try:
      raw=download(candidate,page)
      sourceHash=sha256(raw).hexdigest()
      if sourceHash in used:raise ValueError('Duplicate image source')
      formatted,size=convert(raw,filename)
      fp.write_bytes(formatted)
      audit[filename]={
        'verified':True,'company':company['name'],'source':url,'sourcePage':page,
        'retrievedFrom':candidate,'sourceSha256':sourceHash,
        'sha256':sha256(formatted).hexdigest(),'width':size[0],'height':size[1],
        'note':'Real logo' if filename=='logo.png' else 'Real corporate or event photograph',
        'copyright':'Original rights holders retain rights'
      }
      used.add(sourceHash)
      print('HHBA_MEDIA_VERIFIED',index,filename,size,url,flush=True)
      break
     except Exception as e:
      error=str(e)
      print('HHBA_MEDIA_RETRY',index,filename,error[:160],flush=True)
    if filename in audit and audit[filename].get('sha256')==sha256(fp.read_bytes()).hexdigest():break
   except Exception as e:error=str(e)
  if filename not in audit or not fp.exists():raise RuntimeError('HHBA_AUTHENTIC_MEDIA_MISSING_'+index+'_'+filename+': '+error)
  time.sleep(.2)
 assert set(audit)=={'logo.png','photo1.jpg','photo2.jpg'}
 assert len(used)==3
 audit_file.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('HHBA_EMPLOYER_COMPLETE_REAL_MEDIA',index,flush=True)
