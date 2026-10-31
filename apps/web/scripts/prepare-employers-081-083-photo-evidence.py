#!/usr/bin/env python3
"""Use only specifically attributed company/project photos with source-level image evidence.
Website publication does not establish commercial reproduction rights.
If any check fails, keep clearly labelled non-real SVG.
"""
from pathlib import Path
from io import BytesIO
from urllib.request import Request,urlopen
from PIL import Image,ImageOps
import json,hashlib
BASE=Path('public/images/employer-profiles')
DATA=Path('src/data/employerProfiles')
SOURCES={
 '081':[
  ('https://imagecloud.thepaper.cn/thepaper/image/325/374/965.jpg',
   'https://www.thepaper.cn/newsDetail_forward_28982990',
   '澎湃新闻：安利（中国）植物研发中心真实入口（江苏无锡）'),
  ('https://static.timesmedia.com.cn/fusion-platform/f364007336ec743563867be0c50a927d/20241115/28a0d3bff3c04c1fb9cf76408633405c.png',
   'https://www.time-weekly.com/post/316097',
   '时代周报：安利广州生产基地实际参访活动合照')
 ],
 '082':[
  ('https://www.taikooplace.com/static-assets/images/final-image/our-company/company-hk3.jpg?f=auto&mw=645',
   'https://www.taikooplace.com/en/our-company',
   '太古地产旗下太古坊办公建筑群实景；下属业务项目，非集团总部'),
  ('https://www.taikooplace.com/static-assets/images/final-image/building/1tp-1.jpg?f=auto&mw=1440',
   'https://www.taikooplace.com/en/our-buildings',
   '太古地产太古坊标识办公楼实景；太古地产子公司业务')
 ],
 '083':[
  ('https://p4.itc.cn/images01/20220211/50ea293ef335495ab00e36d937c1ca9c.jpeg',
   'https://www.sohu.com/a/522042738_120048229',
   '搜狐汽车实拍报道：福特中国上海设计中心内部办公及展示空间'),
  ('https://p7.itc.cn/images01/20220211/529a8a306e94458f88210d7199fc468c.jpeg',
   'https://www.sohu.com/a/522042738_120048229',
   '搜狐汽车实拍报道：福特中国上海设计中心公共休息与协作空间')
 ]
}
def download(url,referer):
 r=Request(url,headers={'User-Agent':'Mozilla/5.0 (HHBA editorial source verification)','Referer':referer,'Accept':'image/jpeg,image/png,image/webp,image/*'})
 with urlopen(r,timeout=15) as stream:
  data=stream.read(9000000)
  if len(data)>=9000000:raise ValueError('Image is too large')
 return data
for number,pictures in SOURCES.items():
 id='cn-autumn-'+number
 path=DATA/(id+'.json')
 folder=BASE/id
 p=json.loads(path.read_text(encoding='utf-8'))
 results=[]
 used=set()
 for ix,(url,article,context) in enumerate(pictures,1):
  record={'slot':ix,'sourceImageUrl':url,'sourceWebPage':article,'sourceContext':context,'status':'non-real editorial SVG fallback','independentCommercialReusePermission':'not verified'}
  try:
   content=download(url,article)
   im=ImageOps.exif_transpose(Image.open(BytesIO(content))).convert('RGB')
   w,h=im.size
   if not(w>=500 and h>=300 and .65<=w/h<=4.2):raise ValueError('Invalid dimensions '+str((w,h)))
   dest=folder/('photo'+str(ix)+'.jpg')
   im.save(dest,'JPEG',quality=90,optimize=True)
   buf=dest.read_bytes()
   sha=hashlib.sha256(buf).hexdigest()
   if len(buf)<14000 or sha in used:raise ValueError('Not a sufficiently sized distinct source image')
   used.add(sha)
   record.update(status='sourced documentary photograph',file=dest.name,pixels=[w,h],sha256=sha,bytes=len(buf))
   photo=p['media']['photos'][ix-1]
   photo['path']='images/employer-profiles/'+id+'/'+dest.name
   photo['caption']=context+'（可溯源实拍）'
   photo['alt']=context
   photo['note']='公开来源：'+article+'，原始图片：'+url+'；原作者版权及商业转载许可尚未核查。'
  except Exception as exc:
   (folder/('photo'+str(ix)+'.jpg')).unlink(missing_ok=True)
   record['error']=str(exc)[:190]
   print('HHBA_081_083_MEDIA_FALLBACK',number,ix,record['error'])
  results.append(record)
 count=sum(x['status']=='sourced documentary photograph' for x in results)
 (folder/'media-sources.json').write_text(json.dumps({'companyId':number,'actualPhotos':count,'images':results,'rightsVerified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 p['photoNote']+=' 本次构建校验实景照片 '+str(count)+'/2；无可靠原图时仍为显著标示非实景的SVG。'
 path.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('HHBA_081_083_SOURCE_REPORT',number,count,'/2')
