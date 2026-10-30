#!/usr/bin/env python3
"""Collect 312 independent, source-licensed illustrative photographs, NOT employer premises.
Only include photographs with a clear Wikimedia Commons reuse license. No AI claims."""
import os, json, csv, re, time, random, zipfile, io, html, hashlib, sys
from collections import defaultdict
from urllib.parse import quote
import requests
from PIL import Image,ImageOps,ImageStat

QUEUE="apps/web/src/data/domesticAutumnImageProductionQueue20261029.json"
OUTPUT="hhba_156_companies_312_individual_industry_photos.zip"
LIMIT=int(os.environ.get("HHBA_PHOTO_LIMIT","312"))
BASE="https://commons.wikimedia.org/w/api.php"
HEADERS={"User-Agent":"HHBA-Illustrative-Photo-Research/1.0 (https://github.com/yanm-jun/hhba-talent; educational catalogue)"}
SEARCH={
 "金融服务":["modern bank interior","bank counter interior","office finance","bank building facade","financial district office"],
 "航空运输":["aircraft on apron","airport operations","airport maintenance hangar","airport control room","airline aircraft"],
 "能源及工程":["solar power plant","electricity substation","industrial power plant","wind turbine plant","electrical engineering factory"],
 "汽车及交通装备":["automobile production factory","automotive engineering","car assembly line","vehicle testing facility","automobile industry"],
 "医药与生命科学":["medical laboratory interior","biotechnology laboratory","research laboratory scientist","laboratory instruments","pharmaceutical production"],
 "物流交通及旅游":["cargo warehouse logistics","warehouse conveyor","cargo terminal containers","distribution centre interior","logistics sorting"],
 "文化传媒与互联网":["video editing studio","computer game development office","recording studio interior","creative team office","digital media production"],
 "科技研发与电子制造":["electronics laboratory","data center interior","electronics production line","computer engineering laboratory","semiconductor manufacturing"],
 "建设与地产":["architecture construction site","architectural model office","building construction engineering","civil engineering bridge","modern office architecture"],
 "食品农业及消费服务":["food factory processing","agricultural greenhouse","food quality laboratory","modern agriculture farm","food packaging production"],
 "企业综合服务":["office interior meeting room","modern business conference room","professional office workplace","coworking interior","office building interior"],
 "待核验行业":["office interior meeting room","modern workplace interior","office building interior","business meeting room","office desk interior"],
}
LICENSES=("CC0","Public domain","CC BY","CC-BY","CC BY-SA","CC-BY-SA")
BADWORDS=("diagram","map","logo","drawing","illustration","poster","screenshot","icon","seal","coat of arms","chart","vector","symbol","signboard","screenshot")
session=requests.Session();session.headers.update(HEADERS)
def plain(s):
 return re.sub(r"<[^>]*>","",html.unescape(str(s or ""))).replace("\n"," ").strip()
def commons(q,limit=200):
 params={"action":"query","format":"json","formatversion":2,"generator":"search","gsrsearch":q+" filetype:bitmap","gsrnamespace":6,"gsrlimit":100,"prop":"imageinfo",
         "iiprop":"url|size|mime|extmetadata","iiurlwidth":1200,"maxlag":5}
 count=0; cont={}
 for page in range(4):
  for attempt in range(4):
   try:
    r=session.get(BASE,params={**params,**cont},timeout=40)
    if r.status_code in (429,502,503,504):time.sleep(3*(attempt+1));continue
    r.raise_for_status();d=r.json();break
   except Exception as e:
    print("API_WARNING",q,str(e)[:100],flush=True)
    time.sleep(2*(attempt+1))
  else:break
  if "error" in d:
   print("API_ERROR",q,str(d["error"])[:160],flush=True);break
  for row in d.get("query",{}).get("pages",[]):
   title=row.get("title","");ii=(row.get("imageinfo") or [None])[0]
   if not ii:continue
   meta=ii.get("extmetadata") or {}
   license=plain((meta.get("LicenseShortName") or {}).get("value",""))
   usage=plain((meta.get("UsageTerms") or {}).get("value",""))
   if not any(license.lower().startswith(t.lower()) for t in LICENSES):continue
   if not (ii.get("mime","").lower() in ("image/jpeg","image/png","image/webp")):continue
   if ii.get("width",0)<900 or ii.get("height",0)<550:continue
   if ii.get("width",1)/max(1,ii.get("height",1))<1.18:continue
   if any(b in title.lower() for b in BADWORDS):continue
   url=ii.get("thumburl")
   if not url or not url.startswith("https://"):continue
   yield {"title":title,"url":url,"page":ii.get("descriptionurl",''),"license":license,"terms":usage,
          "author":plain((meta.get("Artist") or {}).get("value",""))[:300],
          "credit":plain((meta.get("Credit") or {}).get("value",""))[:300],
          "original":ii.get("url","")}
   count+=1
   if count>=limit:return
  if "continue" not in d:break
  cont=d["continue"]
def pool_of(category):
 seen=set();items=[]
 for q in SEARCH.get(category,SEARCH["待核验行业"]):
  for x in commons(q,limit=190):
   if x["original"] not in seen:
    seen.add(x["original"]);items.append(x)
  print("SOURCE_POOL",category,q,len(items),flush=True)
 return items
def download(photo):
 try:
  r=session.get(photo["url"],timeout=40)
  if r.status_code!=200 or len(r.content)<7000:return None
  im=Image.open(io.BytesIO(r.content));im.load();im=im.convert("RGB")
  if im.width<580 or im.height<380:return None
  # Reject obviously flat charts/icons even if misclassified.
  st=ImageStat.Stat(im.resize((80,45)));var=sum(st.var)/3
  if var<160:return None
  return ImageOps.fit(im,(1200,675),method=Image.Resampling.LANCZOS,centering=(.5,.5))
 except Exception as e:
  print("IMAGE_WARNING",str(e)[:100],flush=True);return None
def main():
 with open(QUEUE,encoding="utf-8") as fh:data=json.load(fh)
 entries=data["entries"];assert len(entries)==156
 jobs=[(e,slot) for e in entries for slot in e["slots"]][:LIMIT]
 all_categories=set(e["categoryHint"] for e,slot in jobs)
 pools={cat:pool_of(cat) for cat in sorted(all_categories)}
 cursors=defaultdict(int);used=set();records=[];written=0
 with zipfile.ZipFile(OUTPUT,"w",compression=zipfile.ZIP_STORED) as z:
  for e,slot in jobs:
   cat=e["categoryHint"];items=pools.get(cat,[]);good=None;photo=None
   # Search current thematic pool, never reuse photo sources.
   while cursors[cat]<len(items):
    p=items[cursors[cat]];cursors[cat]+=1
    if p["original"] in used:continue
    candidate=download(p)
    if candidate is None:continue
    used.add(p["original"]);photo=p;good=candidate;break
   if good is None:
    print("UNFILLED",e["employerId"],slot["photoId"],cat,flush=True);continue
   photo_file=f'{e["employerId"]}/{slot["photoId"]}.jpg'
   out=io.BytesIO();good.save(out,"JPEG",quality=82,optimize=True,subsampling=0)
   z.writestr(photo_file,out.getvalue())
   records.append({"employer_id":e["employerId"],"employer_name":e["employerName"],"image_id":slot["photoId"],
     "path":photo_file,"category_hint":cat,"license":photo["license"],"usage":photo["terms"],"author":photo["author"],
     "credit":photo["credit"],"source_page":photo["page"],"source_image":photo["original"],
     "description":"Independent industry illustrative photograph, NOT a verified photo of the named employer. Cropped/downsized to 1200×675."})
   written+=1
   if written%25==0:print("PROGRESS",written,"/",len(jobs),flush=True)
  csvbuf=io.StringIO();fieldnames=list(records[0]) if records else ["employer_id","employer_name","image_id","path"]
  writer=csv.DictWriter(csvbuf,fieldnames=fieldnames);writer.writeheader();writer.writerows(records)
  z.writestr("PHOTO_SOURCES_AND_LICENSES.csv",csvbuf.getvalue().encode("utf-8-sig"))
  z.writestr("README_图片来源和使用说明.txt",(
     "HHBA 156家企业独立行业场景照片包\n"
     f"实际独立图片数量：{written} / 目标 {len(jobs)}，企业名称按提供的156家名单记录。\n"
     "重要：这些来自 Wikimedia Commons 的真实摄影照片，不是 AI 生成图，也不是所列企业的真实总部/办公室/员工实景。\n"
     "仅用作行业概念示意，切勿写成企业实景或者官方合作。\n"
     "每一张图片都有独立文件、来源、作者、许可证与原始链接，见 PHOTO_SOURCES_AND_LICENSES.csv。\n"
     "部分照片使用 CC BY、CC BY-SA 许可，公开使用需要相应署名、许可链接与改编标注；图片做过裁切缩放。\n"
     "未取得授权前，不要将其作为企业官方照片或 Logo 发布。\n"
   ).encode("utf-8"))
  z.writestr("STATUS.json",json.dumps({"requested":len(jobs),"created":written,"companies":156,"all_distinct_sources":len(used)==written,"type":"licensed stock illustrative photos, not AI generation or enterprise photographs"},ensure_ascii=False,indent=2))
 print("FINAL",OUTPUT,"COUNT",written,"SIZE",os.path.getsize(OUTPUT),flush=True)
 if written!=len(jobs):sys.exit(2)
if __name__=="__main__":main()
