#!/usr/bin/env python3
"""Evidence-backed source photography. Never fabricate a company scene.
Image download does not grant a license for commercial redistribution.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
import hashlib,json
from PIL import Image,ImageOps
ROOT=Path('public/images/employer-profiles')
DATA=Path('src/data/employerProfiles')
SOURCES={
 '084':[
  dict(url='https://static.foodtalks.cn/image/post/aa06e8f194b5dd1fdfbd49c35a998c8c.jpg',article='https://www.foodtalks.cn/news/46923',caption='食品行业报道：卡夫亨氏阳江食品工厂门口与生产设施外观',subject='Kraft Heinz (Yangjiang) Foods Co., Ltd factory sign'),
  dict(url='https://www.krones.com/media/images/3_588x332px.jpg',article='https://www.krones.com/zh/company/press/magazine/reference/a-new-era-for-bottling-tomato-ketchup.php',caption='克朗斯设备供应商报道：亨氏青岛番茄酱生产线上工作人员与产品',subject='Heinz Qingdao bottling line personnel')
 ],
 '085':[
  dict(url='https://www.henkel.cn/resource/image/2095866/4x3/1000/750/c52dcb00cdaa17288e2db10c8d3eb08d/2B3C43F8B20A2B310FBEDAAE3115768D/photo-inspiration-center-shanghai-building-drone-shot-0244.webp',article='https://www.henkel.cn/brands-businesses/adhesive-technologies/open-innovation-and-venturing/inspiration-center-shanghai',caption='汉高官方网站：上海粘合剂创新体验中心航拍实景',subject='Henkel Shanghai Innovation Center'),
  dict(url='https://www.henkel.co.id/resource/image/2088486/3x2/1000/667/abd265b83d24de582e653143e226cce/4E0920A3ECA62D60F7E18E3B0A8F0865/photo-inspiration-center-shanghai-technicians-thermal-lab-33720.webp',article='https://www.henkel.co.id/in/pers/materi-media-dan-rilis-berita/2025-09-22-henkel-membuka-inspiration-center-di-shanghai-untuk-adhesive-technologies-di-tiongkok-2090100',caption='汉高官方新闻：上海研发中心研究人员在实验室工作',subject='Henkel Shanghai research lab')
 ],
 '086':[
  dict(url='https://eu-images.contentstack.com/v3/assets/blt93c8bc7a598af9f0/blt029487ebd048ead2/68792dce17f03d6ca6a95814/taicang2-min.png',article='https://www.reckitt.com/news/introducing-our-new-world-class-facility-in-taicang/',caption='利洁时官方网站：利洁时（苏州）有限公司太仓设施实景',subject='Reckitt Suzhou Taicang factory campus'),
  dict(url='https://www.sthu.cn/_upload/article/images/0e/c9/289d4c624ef28f013960c0b8bcb0/72c5a617-35d4-4b19-a11c-2c7dd7722050.jpg',article='https://www.sthu.cn/2c/9b/c2438a76955/page.htm',caption='上海师范大学天华学院报道：利洁时苏州公司门牌实景',subject='RB Suzhou Co Ltd corporate sign')
 ]
}
def download(url,ref):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; HHBA editorial verification)','Referer':ref,'Accept':'image/avif,image/webp,image/jpeg,image/png,image/*;q=.8'})
 with urlopen(req,timeout=17) as r:
  content_type=r.headers.get('Content-Type','')
  if content_type and not content_type.lower().startswith('image/'):raise ValueError('Nonimage MIME: '+content_type)
  buf=r.read(8500000)
  if len(buf)>=8500000:raise ValueError('Source image exceeds size limit')
 return buf
for num,images in SOURCES.items():
 id='cn-autumn-'+num;folder=ROOT/id;path=DATA/(id+'.json')
 p=json.loads(path.read_text(encoding='utf-8'));result=[];seen=set()
 for slot,photo in enumerate(images,1):
  audit={**photo,'slot':slot,'status':'fallback_nonreal_svg','rightsForCommercialUseVerified':False}
  try:
   data=download(photo['url'],photo['article'])
   im=ImageOps.exif_transpose(Image.open(BytesIO(data))).convert('RGB')
   w,h=im.size
   if not(w>=520 and h>=300 and .62<=w/h<=4.3):raise ValueError('Photo aspect/dimensions unsuitable '+str([w,h]))
   file=folder/('photo'+str(slot)+'.jpg')
   im.save(file,format='JPEG',quality=89,optimize=True)
   raw=file.read_bytes();hash=hashlib.sha256(raw).hexdigest()
   if len(raw)<10000 or hash in seen:raise ValueError('Image too small or duplicate')
   seen.add(hash)
   audit.update(status='sourced_documentary_photo',sha256=hash,file=file.name,pixels=[w,h],bytes=len(raw))
   entry=p['media']['photos'][slot-1]
   entry['path']='images/employer-profiles/'+id+'/'+file.name
   entry['caption']=photo['caption']+'（来源可追溯，不等于获得转载授权）'
   entry['alt']=photo['caption']
   entry['note']='原始文章 '+photo['article']+'；原始图片 '+photo['url']+'。只核对来源、尺寸、格式、文件SHA-256；未取得商业转载授权。'
  except Exception as ex:
   (folder/('photo'+str(slot)+'.jpg')).unlink(missing_ok=True)
   audit['error']=str(ex)[:220]
   print('HHBA_084_086_PHOTO_FALLBACK',id,slot,audit['error'])
  result.append(audit)
 count=sum(x['status']=='sourced_documentary_photo' for x in result)
 p['photoNote']+=f' 此次审查构建：{count}/2张实名出处图片；其他槽仍为明显标注的非实景示意。'
 path.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (folder/'media-sources.json').write_text(json.dumps({'companyId':num,'sourcedPhotos':count,'images':result,'commercialReuseRightsVerified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('HHBA_084_086_MEDIA_AUDIT',id,count,'of',len(result))
