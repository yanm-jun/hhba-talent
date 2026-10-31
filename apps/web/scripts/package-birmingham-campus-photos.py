#!/usr/bin/env python3
"""Download three legally attributable real University of Birmingham campus JPEGs.
Use Wikimedia Commons verified file pages; no Aston University substitution, no generated images.
"""
from pathlib import Path
import hashlib,urllib.parse,urllib.request,time
photos=[
 ('aston-webb.jpg','University of Birmingham - Aston Webb.jpg',45000),
 ('main-library.jpg','University of Birmingham - new main library (26663121392).jpg',60000),
 ('old-joe-2026.jpg','Old Joe 2026.jpg',60000)
]
target=Path('apps/web/public/images/study/birmingham')
target.mkdir(parents=True,exist_ok=True)
for output,name,minimum in photos:
 normalized=name.replace(' ','_')
 digest=hashlib.md5(normalized.encode('utf8')).hexdigest()
 encoded=urllib.parse.quote(normalized,safe='_,.()')
 folder=f'https://upload.wikimedia.org/wikipedia/commons/{digest[0]}/{digest[:2]}/'
 thumb=f'https://upload.wikimedia.org/wikipedia/commons/thumb/{digest[0]}/{digest[:2]}/{encoded}/'
 urls=[thumb+'1280px-'+encoded,thumb+'960px-'+encoded,folder+encoded,'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encoded+'?width=1280']
 fail=None
 for i,url in enumerate(urls):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'HHBA-University-Attribution/1.0 (creativecommons campus images; source and license on page)'})
   with urllib.request.urlopen(req,timeout=40) as r:data=r.read(7_000_000)
   if len(data)<minimum or not data.startswith(bytes((255,216,255))):raise ValueError('Not a valid substantive JPEG '+str(len(data)))
   (target/output).write_bytes(data)
   print('HHBA_BIRMINGHAM_REAL_CAMPUS_PHOTO',output,len(data),hashlib.sha256(data).hexdigest(),url,flush=True)
   break
  except Exception as error:
   fail=error
   print('BIRMINGHAM_PHOTO_RETRY',output,i+1,str(error)[:170],flush=True)
   time.sleep(2)
 else:raise RuntimeError('Cannot download specific licensed image; never substitute another university '+name+': '+str(fail))
assert len(list(target.glob('*.jpg')))==3
