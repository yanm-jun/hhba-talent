#!/usr/bin/env python3
"""Bundle Zhongjian Luqiao brand media from attributable company-owned pages.
Never use a construction photo from another contractor to fill a missing asset.
If a site blocks fetches, replace it with a conspicuous UNAVAILABLE card.
"""
from pathlib import Path
from io import BytesIO
from urllib.request import Request, urlopen
from PIL import Image, ImageOps, ImageDraw, ImageFont
import json
root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-028'
root.mkdir(parents=True,exist_ok=True)
sources={
 'logo.png':[
  'https://campus.51job.com/zjlq2024/images/logo.png',
  'https://rb.cscec.com/images/P020221018637532544994.png'
 ],
 'photo1.jpg':[
  'https://rb.cscec.com/ywly/jpgc/202210/W020240220352680758821.jpg',
  'https://rb.cscec.com/ywly/jpgc/202210/W020240220352682774881.jpg',
  'https://campus.51job.com/zjlq2024/images/bannerp6.png'
 ],
 'photo2.jpg':[
  'https://rb.cscec.com/ywly/jpgc/202210/W020221019585995748854.png',
  'https://campus.51job.com/zjlq2024/images/bannerp7.png',
  'https://campus.51job.com/zjlq2024/images/bannerp9.png'
 ]
}
def unavailable(name):
 im=Image.new('RGB',(1050,640),(243,246,247));d=ImageDraw.Draw(im)
 d.rectangle((25,25,1025,615),outline=(165,179,182),width=3)
 d.rectangle((25,25,1025,125),fill=(4,71,120))
 fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 font=ImageFont.truetype(fontpath,44) if Path(fontpath).exists() else ImageFont.load_default()
 small=ImageFont.truetype(fontpath,22) if Path(fontpath).exists() else ImageFont.load_default()
 d.text((50,59),'CSCEC ROAD & BRIDGE  /  HHBA',fill='white',font=small)
 d.text((55,286),'SOURCE IMAGE UNAVAILABLE',fill=(4,71,120),font=font)
 d.text((55,368),f'{name}: cannot verify or download company image',fill=(75,92,95),font=small)
 d.text((55,420),'This is NOT a company photo or official logo.',fill=(75,92,95),font=small)
 return im
status={}
for name,urls in sources.items():
 image=None
 for url in urls:
  try:
   req=Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    'Referer':'https://rb.cscec.com/','Accept':'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8'})
   with urlopen(req,timeout=18) as resp:
    raw=resp.read(12_000_001)
   if not 2500<len(raw)<12_000_000:raise ValueError('media length outside expected bounds')
   rawim=Image.open(BytesIO(raw));rawim.verify()
   image=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
   if image.width<220 or image.height<120:raise ValueError('media dimensions too small')
   status[name]={'source':url,'verified':True,'original_size':image.size}
   break
  except Exception as exc:
   print('ZHONGLUQIAO_MEDIA_SOURCE_UNAVAILABLE',name,url,str(exc)[:130])
 if image is None:
  image=unavailable(name)
  status[name]={'source':None,'verified':False,'warning':'A visual placeholder; not a company photo or an official logo'}
  print('ZHONGLUQIAO_MEDIA_PLACEHOLDER_ONLY',name)
 image.thumbnail((1800,1350))
 target=root/name
 if name.endswith('.png'):image.save(target,'PNG',optimize=True)
 else:image.save(target,'JPEG',quality=86,optimize=True)
 if target.stat().st_size<1500:raise ValueError('invalid media: '+name)
 print('ZHONGLUQIAO_MEDIA_PACKAGED',name,image.size,target.stat().st_size,status[name]['source'])
(root/'media-audit.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
