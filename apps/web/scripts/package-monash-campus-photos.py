#!/usr/bin/env python3
"""3 real Monash Clayton campus photos, individually attributed under Commons CC licenses.
No generated/stock/substitute college images. Fail closed when authentic files unavailable.
"""
from pathlib import Path
import hashlib,urllib.parse,urllib.request,time
PHOTOS=[
 ('learning-teaching.jpg','Monash Learning and Teaching Building (43797320625).jpg',55000),
 ('menzies-building.jpg','Monash University Menzies Building.jpg',50000),
 ('biomedical-learning.jpg','Monash Biomedical Learning and Teaching Building (32697686457).jpg',55000)
]
out=Path('apps/web/public/images/study/monash')
out.mkdir(parents=True,exist_ok=True)
for local,name,minimum in PHOTOS:
 target=out/local
 if target.exists():
  d=target.read_bytes()
  if len(d)>=minimum and d.startswith(bytes((255,216,255))):
   print('MONASH_REUSE_EXISTING_LICENSED_IMAGE',local,hashlib.sha256(d).hexdigest(),flush=True)
   continue
 normalized=name.replace(' ','_')
 digest=hashlib.md5(normalized.encode('utf-8')).hexdigest()
 encoded=urllib.parse.quote(normalized,safe='_,.()')
 root='https://upload.wikimedia.org/wikipedia/commons'
 thumb=f'{root}/thumb/{digest[0]}/{digest[:2]}/{encoded}/'
 original=thumb+'1280px-'+encoded
 candidates=[
  'https://wsrv.nl/?'+urllib.parse.urlencode({'url':original,'output':'jpg'}),
  'https://images.weserv.nl/?'+urllib.parse.urlencode({'url':thumb+'960px-'+encoded,'output':'jpg'}),
  original,
  thumb+'960px-'+encoded,
  f'{root}/{digest[0]}/{digest[:2]}/{encoded}',
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encoded+'?width=1280'
 ]
 last=None
 for n,url in enumerate(candidates,1):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'HHBA-Monash-Campus-Attribution/1.0 (original university photos, CC credit on site)'})
   with urllib.request.urlopen(req,timeout=45) as resp:d=resp.read(7_000_000)
   if len(d)<minimum or not d.startswith(bytes((255,216,255))):raise ValueError('invalid JPEG size/type '+str(len(d)))
   target.write_bytes(d)
   print('HHBA_MONASH_LICENSED_CAMPUS_PHOTO',local,len(d),hashlib.sha256(d).hexdigest(),flush=True)
   break
  except Exception as exc:
   last=exc
   print('MONASH_IMAGE_RETRY',local,n,str(exc)[:140],flush=True)
   time.sleep(2)
 else:
  raise RuntimeError('Could not source correctly licensed Monash image '+name+': '+str(last))
assert len(list(out.glob('*.jpg')))==3
