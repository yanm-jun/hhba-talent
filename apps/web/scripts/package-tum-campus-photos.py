#!/usr/bin/env python3
"""Prepare three separately licensed REAL TUM Garching photographs from Commons.
    Do not fabricate a campus, substitute another location, or suppress required attribution.
    Fails the deployment if a correctly sourced picture can't be obtained.
"""
from pathlib import Path
import hashlib,urllib.parse,urllib.request,time
PHOTOS=[
 ("garching-panorama.jpg","Campus TU München, Garching.jpg",45000),
 ("advanced-study.jpg","TU München Garching - Institute for Advanced Study.jpg",60000),
 ("informatik-atrium.jpg","MI-Gebäude der TU München Magistrale2.JPG",55000)
]
root=Path("apps/web/public/images/study/tum")
root.mkdir(parents=True,exist_ok=True)
for local,name,minimum in PHOTOS:
 dest=root/local
 if dest.exists():
  old=dest.read_bytes()
  if len(old)>minimum and old.startswith(bytes((255,216,255))):
   print("HHBA_TUM_REUSE_VERIFIED",local,hashlib.sha256(old).hexdigest(),flush=True);continue
 normalized=name.replace(" ","_")
 md5=hashlib.md5(normalized.encode("utf-8")).hexdigest()
 encoded=urllib.parse.quote(normalized,safe="_,.()-")
 stem=f"https://upload.wikimedia.org/wikipedia/commons/thumb/{md5[0]}/{md5[:2]}/{encoded}/"
 source=stem+"1280px-"+encoded
 urls=[
  "https://wsrv.nl/?"+urllib.parse.urlencode({"url":source,"output":"jpg"}),
  "https://images.weserv.nl/?"+urllib.parse.urlencode({"url":stem+"1024px-"+encoded,"output":"jpg"}),
  source,
  stem+"1024px-"+encoded,
  f"https://upload.wikimedia.org/wikipedia/commons/{md5[0]}/{md5[:2]}/{encoded}",
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/"+encoded+"?width=1280"
 ]
 error=None
 for i,url in enumerate(urls):
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"HHBA-Actual-TUM-Photo-Attribution/1.0 (source and CC rights shown on school page)"})
   with urllib.request.urlopen(req,timeout=42) as resp: data=resp.read(7_000_000)
   if len(data)<minimum or not data.startswith(bytes((255,216,255))):
    raise ValueError("missing valid JPEG or too small: "+str(len(data)))
   dest.write_bytes(data)
   print("HHBA_TUM_REAL_LICENSED_CAMPUS_PHOTO",local,len(data),hashlib.sha256(data).hexdigest(),flush=True)
   break
  except Exception as exc:
   error=exc
   print("TUM_PHOTO_RETRY",local,i+1,str(exc)[:160],flush=True)
   time.sleep(2)
 else:raise RuntimeError("Cannot retrieve exactly licensed real TUM photo "+name+": "+str(error))
assert len(list(root.glob("*.jpg")))==3
