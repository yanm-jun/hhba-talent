#!/usr/bin/env python3
"""Collect explicitly identified documentary/company images, otherwise retain unmistakably labelled SVGs.
Images are editorial research materials; original publication is NOT a commercial-reuse license.
"""
from pathlib import Path
from io import BytesIO
import json, hashlib, urllib.request
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT=Path("public/images/employer-profiles")
PROFILES=Path("src/data/employerProfiles")
UA="Mozilla/5.0 HHBA/1.0 (+source audit)"
MEDIA={
 "078":[
  {"url":"https://www.news.cn/20260430/4cb2e1f9e54a4ab483e4387f37428da8/202604304cb2e1f9e54a4ab483e4387f37428da8_53973e7f595c407b8b8244fb59937847.jpg","article":"https://app.xinhuanet.com/news/article.html?articleId=202604304cb2e1f9e54a4ab483e4387f37428da8","caption":"新华社2026年中国邮政网点包裹扫描实景"},
  {"url":"https://hbrbapp.hubeidaily.net/640X800_pub_cb202411131041232429046ceq.jpg_e204e716e8d7435180d64d3ead1349a6.jpg","article":"https://news.hubeidaily.net/mobile/c_3329075.html","caption":"湖北日报武汉邮政智能分拣中心实景"}
 ],
 "079":[
  {"url":"https://k.sinaimg.cn/n/spider20250714/214/w2048h1366/20250714/f1f1-f42fc7602ae12aaf30f4a5927509763c.jpg/w700d1q75cms.jpg?by=cms_fixed_width","article":"https://news.sina.com.cn/zx/gj/2025-07-14/doc-inffmawy3271972.shtml","caption":"2025报道中通快递江西物流网点分拣作业"},
  {"url":"https://laos.zto.com/la/images/la_product_1.jpg","article":"https://laos.zto.com/","caption":"中通国际官方网站快件扫描宣传配图（场景真实性待独立确认）","editorialNote":"Official-brand website image; photographic scene not independently authenticated"}
 ],
 "080":[
  {"url":"https://zsrbapp.zsnews.cn/upload/20230111/a89911860f57f595dfcaefff94736773.jpg","article":"https://www.zsnews.cn/news/index/view/cateid/35/id/701064.html","caption":"中山网报道达能中山工厂数字化生产线实景"},
  {"url":"https://m.cnhubei.com/a/10001/202110/9f1fa084c3b444752f02f25a79291179.jpeg","article":"https://m.cnhubei.com/content/2021-10/22/content_14192434.html","caption":"湖北媒体报道达能湖北工厂脉动饮料生产线实景"}
 ]
}
def download(url, referer):
 req=urllib.request.Request(url,headers={"User-Agent":UA,"Referer":referer,"Accept":"image/jpeg,image/png,image/webp,image/*;q=0.9"})
 with urllib.request.urlopen(req,timeout=16) as r:
  if r.status!=200:raise RuntimeError("Non-200 "+str(r.status))
  data=r.read(9500000)
  if len(data)>9400000:raise RuntimeError("Image too large")
 return data
def run(id, sources):
 folder=ROOT/("cn-autumn-"+id)
 pfile=PROFILES/("cn-autumn-"+id+".json")
 profile=json.loads(pfile.read_text(encoding="utf-8"))
 results=[]
 for slot, entry in enumerate(sources,start=1):
  item={"slot":slot,"article":entry["article"],"imageUrl":entry["url"],"sourceContext":entry["caption"],"rightsVerified":False,"status":"fallback_nonreal_svg"}
  try:
   raw=download(entry["url"],entry["article"])
   im=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert("RGB")
   w,h=im.size
   if not(w>=520 and h>=300 and .68<=w/h<=4.1):raise RuntimeError("Unsuitable dimensions "+str((w,h)))
   dest=folder/("photo"+str(slot)+".jpg");im.save(dest,"JPEG",quality=90,optimize=True)
   dat=dest.read_bytes()
   if len(dat)<14000:raise RuntimeError("Insufficient image data")
   item.update(status="sourced_image",filename=dest.name,sha256=hashlib.sha256(dat).hexdigest(),pixels=[w,h],bytes=len(dat))
   src=profile["media"]["photos"][slot-1]
   src["path"]="images/employer-profiles/cn-autumn-"+id+"/"+dest.name
   src["caption"]=entry["caption"]
   src["alt"]=profile["name"]+"："+entry["caption"]
   src["note"]="原始报道："+entry["article"]+"；原图："+entry["url"]+"。图片并非AI生成，但真实性依据原始发布机构，商用转载许可尚未核实。"+entry.get("editorialNote","")
  except Exception as ex:
   item["error"]=str(ex)[:200]
   print("HHBA_078_080_FALLBACK",id,slot,item["error"])
  results.append(item)
 sourced=sum(x["status"]=="sourced_image" for x in results)
 profile["photoNote"]+=f" 本次独立构建取得{sourced}张来源可查的照片或企业图片，其余使用明显标示非实景的SVG。"
 pfile.write_text(json.dumps(profile,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 report={"companyId":id,"sourcedImages":sourced,"slots":results,"independentCommercialReusePermission":"NOT VERIFIED"}
 (folder/"media-sources.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("HHBA_078_080_PHOTO_AUDIT",id, sourced, "/ 2")
for id,src in MEDIA.items():run(id,src)
