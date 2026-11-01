#!/usr/bin/env python3
"""2026-11-01 HHBA review-only media collector for companies 087–089.
Preserve public source page, image URL, dimensions, SHA256 and copyright warnings.
Do not treat rendering, unrelated buildings or a failed download as a real company photograph.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import URLError,HTTPError
from io import BytesIO
import hashlib,json
from PIL import Image,ImageOps
ROOT=Path('public/images/employer-profiles')
DATA=Path('src/data/employerProfiles')
SOURCES={
 "087":[
  {"url":"https://www.carlsberggroup.com/media/lsbam55l/%C3%B3%C3%B0-%C3%A3-_20240828211810.jpg",
   "article":"https://www.carlsberggroup.com/newsroom/carlsberg-opens-foshan-sanshui-brewery/",
   "caption":"嘉士伯集团官方新闻：佛山三水工厂真实罐体设施"},
  {"url":"https://news.cau.edu.cn/images/2023-05/aa1211bb56e04a3f8cc210a85dfaeacc.png",
   "article":"https://news.cau.edu.cn/jcdt/f7175d6c25fa498d8ce74bade794ebfb.htm",
   "caption":"中国农业大学2023实地参访嘉士伯中国大理工厂生产现场"}
 ],
 "088":[
  {"url":"https://www.semir.com/img/about/about-honor-1-sp.jpg",
   "article":"https://www.semir.com/about.html",
   "caption":"森马集团官方关于我们页面：温州森马集团总部实景"},
  {"url":"https://szjm.wzvtc.cn/_upload/article/images/38/03/88569ca94c89b815bbe0794d98a4/4fa6424d-29d8-40fb-acb0-eb8889aeb5b2.png",
   "article":"https://szjm.wzvtc.cn/2026/0608/c165937a4394629/page.htm",
   "caption":"温州职业技术学院2026年访企森马集团实际办公接待现场"}
 ],
 "089":[
  {"url":"https://pic1.nmgnews.com.cn/003/003/790/00300379023_9313e134.jpg",
   "article":"https://china.nmgnews.com.cn/system/2020/06/24/012933799.shtml",
   "caption":"内蒙古新闻网2020报道：无限极生产基地真实航拍"},
  {"url":"https://framerusercontent.com/images/dYWyBUeJTwuP3e4yYvEVJDslvo.jpg?height=900&width=1200",
   "article":"https://www.infinitus-int.com/en/technologies",
   "caption":"无限极全球网站技术介绍：企业研发设施外观"}
 ]
}
for n,images in SOURCES.items():
 id='cn-autumn-'+n;folder=ROOT/id;path=DATA/(id+'.json')
 profile=json.loads(path.read_text(encoding='utf8'))
 result=[]
 for k,item in enumerate(images,1):
  report={"slot":k,"sourceImageUrl":item['url'],"sourceWebPage":item['article'],
          "context":item['caption'],"rightsVerified":False,"status":"nonreal_svg_fallback"}
  try:
   request=Request(item['url'],headers={"User-Agent":"Mozilla/5.0 (HHBA sourcing QA)","Referer":item['article'],"Accept":"image/jpeg,image/png,image/webp,*/*;q=0.8"})
   with urlopen(request,timeout=15) as response:
    mime=response.headers.get('Content-Type','')
    if mime and not mime.lower().startswith('image/'):raise ValueError('nonimage media '+mime)
    raw=response.read(9000000)
   if len(raw)>=9000000:raise ValueError('Image too large')
   im=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
   w,h=im.size
   if w<480 or h<270 or not(0.55<=w/h<=4.5):raise ValueError('Size/aspect invalid '+str((w,h)))
   out=folder/('photo'+str(k)+'.jpg')
   im.save(out,'JPEG',quality=90,optimize=True)
   bytes_=out.read_bytes()
   if len(bytes_)<9500:raise ValueError('Too-small image')
   digest=hashlib.sha256(bytes_).hexdigest()
   report.update(status='verified_source_image',sha256=digest,pixels=[w,h],size=len(bytes_),filename=out.name)
   photo=profile['media']['photos'][k-1]
   photo['path']='images/employer-profiles/'+id+'/'+out.name
   photo['caption']=item['caption']+'（原始报道有图，商业转载授权未核）'
   photo['alt']=item['caption']
   photo['note']='文章来源：'+item['article']+'；原图：'+item['url']+'；已核像素及SHA256，尚未确认商用转载许可。'
  except Exception as exc:
   (folder/('photo'+str(k)+'.jpg')).unlink(missing_ok=True)
   report['error']=str(exc)[:210]
   print('HHBA_087_089_FALLBACK',id,k,report['error'])
  result.append(report)
 count=sum(x['status']=='verified_source_image' for x in result)
 profile['photoNote']+=' 此次构建取得'+str(count)+'/2张已验证来源图片；失败槽仍为标注的非实景SVG。'
 path.write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (folder/'media-sources.json').write_text(json.dumps({'companyId':n,'sourcedPhotos':count,'slots':result,'commercialReproductionPermission':False},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('HHBA_087_089_MEDIA',id,count,'/2')
