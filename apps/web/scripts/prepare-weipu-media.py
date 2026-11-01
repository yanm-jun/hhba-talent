#!/usr/bin/env python3
"""Bundle 032 logo and two independent corporate photos (not stock or fake offices).
Source A: WEIPU medical analysis laboratory (official business site).
Source B: WEIPU showroom documented by Shanghai Yangpu district government.
On remote errors show an UNAVAILABLE label; never substitute another company's photo.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from io import BytesIO
from hashlib import sha256
from PIL import Image, ImageOps, ImageDraw, ImageFont
import json, time

root=Path(__file__).resolve().parents[1]/'public/images/employer-profiles/cn-autumn-032'
root.mkdir(parents=True,exist_ok=True)
logo=root/'logo.webp'
expected='c28e82b03e4ebaebcf46a72a54076ef2da6af2334739213de157f36df9766d08'
raw=logo.read_bytes()
assert sha256(raw).hexdigest()==expected, 'WEIPU user-provided logo changed: refuse to publish replacement'
with Image.open(BytesIO(raw)) as im:
 assert im.format=='WEBP' and im.size==(146,82), 'WEIPU logo changed dimensions/format'
audit={'logo.webp':{'verified':True,'source':'user-supplied WEIPU logo 2026-10-30','sha256':expected,'dimensions':[146,82]}}
# Source-backed photos were already retrieved and visually verified by the last
# successful Pages build (2026-11-01, run 41266911360). The published Pages
# assets are stable mirrors of those real photos, not replacement placeholders.
# Pin the exact deployed JPEG digest to reject stale, tampered or unrelated media.
previous_pages_mirrors={
 'https://yanm-jun.github.io/hhba-talent/images/employer-profiles/cn-autumn-032/photo1.jpg':{
   'sha256':'589c0407995d9d99fe268b049b7ebd2d1d46c725c5da3249c90efd840c56e9f5',
   'originalSource':'https://www.weipuyiyao.com/upload/division/1734560155144473428.jpg',
   'originalSourceSha256':'ca93cacaff00815c4af1372328f5ae12df1766f3355650b76ca8e4334d31d1c1',
   'article':'https://www.weipuyiyao.com/project/yiliaoqixieyanjiu/huaxuebiaozhengyanjiu'
 },
 'https://yanm-jun.github.io/hhba-talent/images/employer-profiles/cn-autumn-032/photo2.jpg':{
   'sha256':'5dabdf5ed905ad13b638c4cc13cf9672356954e808bc39532cf95d2de24244ca',
   'originalSource':'https://english.shyp.gov.cn/ywb/Infocus/index/0cc2381c80d746ea8326b45a2831f30f.png',
   'originalSourceSha256':'d76ccd0b75dfc73fd10fa3156c334ada0d91835b5524093622b564cb29b8c4a3',
   'article':'https://english.shyp.gov.cn/ywb/Infocus/20240423/453190.html'
 }
}
photos=[
 ('photo1.jpg', [
  ('https://yanm-jun.github.io/hhba-talent/images/employer-profiles/cn-autumn-032/photo1.jpg','https://www.weipuyiyao.com/project/yiliaoqixieyanjiu/huaxuebiaozhengyanjiu'),
  ('https://www.weipuyiyao.com/upload/division/1734560155144473428.jpg','https://www.weipuyiyao.com/project/yiliaoqixieyanjiu/huaxuebiaozhengyanjiu'),
  ('https://www.weipubio-tech.com/upload/images/07%285%29.png','https://www.weipubio-tech.com/news/148.html')
 ]),
 ('photo2.jpg', [
  ('https://yanm-jun.github.io/hhba-talent/images/employer-profiles/cn-autumn-032/photo2.jpg','https://english.shyp.gov.cn/ywb/Infocus/20240423/453190.html'),
  ('https://english.shyp.gov.cn/ywb/Infocus/index/0cc2381c80d746ea8326b45a2831f30f.png','https://english.shyp.gov.cn/ywb/Infocus/20240423/453190.html'),
  ('https://weipuyiyao.com/upload/division/1734558839028197935.jpg','https://weipuyiyao.com/project/heguiyanzhengfuwu/shengwufenxifuwu')
 ])
]
used={expected}
for filename,candidates in photos:
 selected=None
 err=''
 for image_url,article_url in candidates:
  for attempt in range(2):
   try:
    request=Request(image_url,headers={
      'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
      'Accept':'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8',
      'Referer':article_url})
    with urlopen(request,timeout=15) as response:
     source=response.read(8_000_001)
     if len(source)>8_000_000:raise ValueError('size limit exceeded')
    if len(source)<2_500:raise ValueError('incomplete media')
    with Image.open(BytesIO(source)) as im:im.verify()
    im=ImageOps.exif_transpose(Image.open(BytesIO(source))).convert('RGB')
    if im.width<420 or im.height<300:raise ValueError('image too small for corporate profile')
    digest=sha256(source).hexdigest()
    mirror=previous_pages_mirrors.get(image_url)
    if mirror and digest!=mirror['sha256']:
     raise ValueError('previously verified Pages mirror changed: checksum mismatch')
    if digest in used:raise ValueError('photo duplicates another photo/logo')
    used.add(digest);selected=(im,image_url,article_url,digest)
    break
   except Exception as ex:
    err=str(ex);print('WEIPU_RETRY',filename,attempt+1,err[:160]);time.sleep(0.7)
  if selected:break
 if selected:
  im,url,article,digest=selected;im.thumbnail((1600,1200))
  im.save(root/filename,'JPEG',quality=85,optimize=True)
  mirror=previous_pages_mirrors.get(url)
  audit[filename]={
   'verified':True,
   'source':mirror['originalSource'] if mirror else url,
   'article':mirror['article'] if mirror else article,
   'sha256':digest,
   'dimensions':[im.width,im.height],
   **({'verifiedSourceMirror':url,
       'verifiedOriginalSourceSha256':mirror['originalSourceSha256'],
       'mirrorBuildRun':41266911360} if mirror else {})
  }
  print('WEIPU_MEDIA_VERIFIED',filename,url,im.size)
 else:
  im=Image.new('RGB',(1200,700),(241,245,248))
  d=ImageDraw.Draw(im)
  d.rectangle((0,0,1200,112),fill=(21,99,153))
  f='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
  title=ImageFont.truetype(f,42) if Path(f).exists() else ImageFont.load_default()
  note=ImageFont.truetype(f,23) if Path(f).exists() else ImageFont.load_default()
  d.text((53,42),'WEIPU / SOURCE MEDIA UNAVAILABLE',fill='white',font=note)
  d.text((55,330),'OFFICIAL PHOTO UNAVAILABLE',fill=(55,72,89),font=title)
  d.text((55,408),'Not a photograph of the company',fill=(90,99,108),font=note)
  im.save(root/filename,'JPEG',quality=84)
  audit[filename]={'verified':False,'sources':[x[0] for x in candidates],'reason':err,'note':'Clearly marked unavailable; not a real corporate photograph'}
  print('WEIPU_MEDIA_UNAVAILABLE',filename,err)
 assert (root/filename).stat().st_size>1800
(root/'media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('WEIPU_MEDIA_READY',len(audit),sum(x.get('verified',False) for x in audit.values()))
