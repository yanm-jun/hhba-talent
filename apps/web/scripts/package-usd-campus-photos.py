#!/usr/bin/env python3
"""Retrieve 3 rights-cleared, independently attributed USD photographs for GitHub Pages.
Names are verified against Commons file descriptions; never substitute a different college.
https://commons.wikimedia.org/wiki/File:Aerial_view_of_University_of_South_Dakota_Vermillion_Campus.jpg CC BY-SA 4.0 (anup khanal)
https://commons.wikimedia.org/wiki/File:Old_Main,_University_of_South_Dakota.jpg public domain, US NPS (Jack Boucher)
https://commons.wikimedia.org/wiki/File:University_of_South_Dakota_Belbas_Center_from_S_1.JPG CC0 (Ammodramus)
"""
from pathlib import Path
import hashlib
import time
import urllib.parse
import urllib.request

target=Path('apps/web/public/images/study/south-dakota')
target.mkdir(parents=True,exist_ok=True)
photos=[
 ('usd-campus-aerial.jpg','Aerial_view_of_University_of_South_Dakota_Vermillion_Campus.jpg',60000),
 ('usd-old-main-habs.jpg','Old_Main,_University_of_South_Dakota.jpg',60000),
 ('usd-belbas-center.jpg','University_of_South_Dakota_Belbas_Center_from_S_1.JPG',50000)
]
for output,name,minimum in photos:
    normalized=name.replace(' ','_')
    digest=hashlib.md5(normalized.encode('utf-8')).hexdigest()
    encoded=urllib.parse.quote(normalized,safe='_,')
    urls=[
      'https://upload.wikimedia.org/wikipedia/commons/thumb/'+digest[0]+'/'+digest[:2]+'/'+encoded+'/1280px-'+encoded,
      'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encoded+'?width=1280'
    ]
    error=None
    for attempt in range(4):
        try:
            req=urllib.request.Request(urls[attempt%len(urls)],headers={'User-Agent':'HHBA-Photo-Attribution/1.0 (three licensed USD campus photos; GH yanm-jun/hhba-talent)'})
            with urllib.request.urlopen(req,timeout=45) as response:
                data=response.read(3_000_000)
            if len(data)<minimum or not data.startswith(bytes((255,216,255))):
                raise ValueError('incorrect JPEG signature or too small: '+str(len(data)))
            (target/output).write_bytes(data)
            print('HHBA_USD_LICENSED_REAL_CAMPUS_PHOTO',output,'bytes',len(data),'SHA256',hashlib.sha256(data).hexdigest())
            break
        except Exception as exc:
            error=exc
            print('USD_PHOTO_RETRY',output,'attempt',attempt+1,str(exc)[:180])
            time.sleep(2)
    else:
        raise RuntimeError('Cannot verify photo '+output+': '+str(error))
assert len(list(target.glob('*.jpg')))==3
