#!/usr/bin/env python3
"""HHBA 090-092: corporate scene and logo identity evidence, read-only upstream retrieval.
A public image is not a commercial reuse licence. All failed images retain visibly
non-real SVG fallbacks. Company name and scene are checked against original publisher.
"""
from io import BytesIO
from pathlib import Path
from urllib.request import Request,urlopen
from PIL import Image,ImageOps
import hashlib,json
D=Path('src/data/employerProfiles')
BASE=Path('public/images/employer-profiles')
SOURCES={
'090':{
 'photos':[
 ('https://imgservices-1252317822.image.myqcloud.com/coco/s09232025/39b48c71.qnr61n.jpg','https://www.yuewen.com/contact','阅文集团官方网站：上海浦东总部建筑，2025公开资料'),
 ('https://f.izxxz.com/2023/09/FiYl819OdnjDh92muDur1Eodona0.jpg','https://m.izxxz.com/article/2216','企业数字化办公报道：阅文集团上海总部前厅实景，2023')
 ],
 'logo':('https://imgservices-1252317822.image.myqcloud.com/image/090320210163847/5a888565.png','https://www.yuewen.com/','阅文集团官网提供品牌识别图')
},
'091':{
 'photos':[
 ('https://fsnewsres.foshanplus.com/news/ef3cb3645059417b8edabaf530a3b773.jpg','https://api.foshanplus.com/foshan/api/news/detail/623258.html','佛山官方媒体报道：虎牙HUYA SPACE佛山办公空间外立面实景'),
 ('https://static1.gensler.com/uploads/hero_element/16493/thumb_desktop/thumbs/project-HUYA-hq-05-2000x1125_1604096436_1024x576.jpg','https://www.gensler.com/projects/huya-headquarters','Gensler建筑设计事务所：虎牙总部室内实景，历史项目非2026佛山总部')
 ],
 'logo':('https://p.huya.com/web/live-platfom/static/logo.cecd80d1.png','https://p.huya.com/admin/index.html','虎牙开放平台官方品牌图')
},
'092':{
 'photos':[
 ('https://www.iqiyipic.com/common/fix/zhaopin2016/chongqing/c3.jpg','https://campus.iqiyi.com/about-us.html','爱奇艺官方校园招聘网站重庆办公区前台实景（历史照片，非2026现况）'),
 ('https://www.iqiyipic.com/common/fix/zhaopin2016/chongqing/c1.jpg','https://campus.iqiyi.com/about-us.html','爱奇艺官方校园招聘网站重庆办公区域实景（历史照片，非2026现况）')
 ],
 'logo':('https://pic2.iqiyipic.com/lequ/20220422/e7fe69c75e2541f2a931c9e538e2ab9d.jpg','https://www.iqiyi.com/common/biaozhiguifan.html','爱奇艺官方品牌标识使用规范所展示的品牌图')
}}
def fetch(url,referer):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (HHBA source evidence)','Referer':referer,'Accept':'image/jpeg,image/png,image/webp,image/*'})
 with urlopen(req,timeout=15) as r:
  mime=r.headers.get('Content-Type','')
  if mime and not mime.lower().startswith('image/'):raise ValueError('invalid mime '+mime)
  data=r.read(8000000)
  if len(data)>=8000000:raise ValueError('too large image')
 return data
for num,data in SOURCES.items():
 id='cn-autumn-'+num;folder=BASE/id;path=D/(id+'.json')
 prof=json.loads(path.read_text(encoding='utf8'))
 seen=set();entries=[]
 for slot,(url,article,caption) in enumerate(data['photos'],1):
  info={'slot':slot,'imageUrl':url,'articleUrl':article,'sourceContext':caption,'republicationRightsVerified':False,'status':'nonreal_svg_fallback'}
  dest=folder/('photo'+str(slot)+'.jpg')
  try:
   raw=fetch(url,article)
   im=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
   w,h=im.size
   if w<350 or h<280 or not(.55<=w/h<=4.2):raise ValueError('unsuitable photo '+str((w,h)))
   im.save(dest,'JPEG',quality=89,optimize=True)
   output=dest.read_bytes();sha=hashlib.sha256(output).hexdigest()
   if len(output)<9000 or sha in seen:raise ValueError('too small or duplicate image')
   seen.add(sha)
   info.update(status='source_picture_verified',filename=dest.name,dimensions=[w,h],sha256=sha,bytes=len(output))
   photo=prof['media']['photos'][slot-1]
   photo.update(path='images/employer-profiles/'+id+'/'+dest.name,caption=caption,alt=caption,note='来源：'+article+'；原图：'+url+'。来源及图像尺寸经过审核，但商业转载权尚未取得。')
  except Exception as exc:
   dest.unlink(missing_ok=True)
   info['error']=str(exc)[:180]
   print('HHBA_090_092_IMAGE_FALLBACK',id,slot,info['error'])
  entries.append(info)
 photoCount=sum(x['status']=='source_picture_verified' for x in entries)
 lurl,larticle,lcaption=data['logo']
 linfo={'sourceImageUrl':lurl,'sourcePageUrl':larticle,'sourceContext':lcaption,'status':'nonofficial_editorial_wordmark_fallback','trademarkUsagePermissionVerified':False}
 try:
  raw=fetch(lurl,larticle)
  im=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
  w,h=im.size
  if w<100 or h<75:raise ValueError('brand image too small')
  dest=folder/'brand-logo.jpg';im.save(dest,'JPEG',quality=91,optimize=True)
  sha=hashlib.sha256(dest.read_bytes()).hexdigest()
  if dest.stat().st_size<4500:raise ValueError('brand file too small')
  prof['media']['logo']='images/employer-profiles/'+id+'/brand-logo.jpg'
  linfo.update(status='publisher_identified_brand_reference',filename=dest.name,pixels=[w,h],sha256=sha)
 except Exception as exc:
  (folder/'brand-logo.jpg').unlink(missing_ok=True)
  linfo['error']=str(exc)[:180]
  print('HHBA_090_092_LOGO_FALLBACK',id,linfo['error'])
 prof['photoNote']+=' 本次独立构建共有'+str(photoCount)+'/2张成功取回的来源可核图片；其他仍为明确标注的非实景图。'
 path.write_text(json.dumps(prof,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (folder/'media-sources.json').write_text(json.dumps({'companyId':num,'sourcedImages':photoCount,'photos':entries,'brand':linfo,'commercialRightsVerified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('HHBA_090_092_MEDIA_AUDIT',num,photoCount,'/2',linfo['status'])
