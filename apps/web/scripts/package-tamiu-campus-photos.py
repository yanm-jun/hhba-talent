#!/usr/bin/env python3
"""Source-credited real campus photos of Texas A&M International University (not Texas A&M College Station).
Published by Billy Hathorn on Wikimedia Commons; 1 PD-self, 2 CC BY-SA 3.0.
Each local JPEG has the author's name, date, license, link and cropping note on the page.
"""
from pathlib import Path
import hashlib, urllib.parse, urllib.request, time, sys

photos=[
 ('canseco-hall.jpg','Dr. F.M. Canseco Hall, TAMIU, Laredo, TX IMG 5425.JPG',50000),
 ('killam-library.jpg','Sue and Radcliffe Killam Library, TAMIU, Laredo, TX IMG 5427.JPG',50000),
 ('trade-center.jpg','Western Hemispheric Trade Center, TAMIU, Laredo, TX IMG 5432.JPG',50000)
]
target=Path('apps/web/public/images/study/tamiu')
target.mkdir(parents=True, exist_ok=True)
for output,name,min_size in photos:
    normalized=name.replace(' ','_')
    digest=hashlib.md5(normalized.encode('utf-8')).hexdigest()
    encoded=urllib.parse.quote(normalized,safe='_,.')
    folder=f'https://upload.wikimedia.org/wikipedia/commons/{digest[0]}/{digest[:2]}/'
    thumb=f'https://upload.wikimedia.org/wikipedia/commons/thumb/{digest[0]}/{digest[:2]}/{encoded}/'
    candidates=[thumb+'1280px-'+encoded,thumb+'1024px-'+encoded,folder+encoded,'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encoded+'?width=1280']
    error=None
    for i,url in enumerate(candidates):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'HHBA-TAMIU-Photo-Attribution/1.0 (license and author credited on live website)'})
            with urllib.request.urlopen(req,timeout=45) as response: data=response.read(6_000_000)
            if len(data)<min_size or not data.startswith(bytes((255,216,255))):
                raise ValueError('Invalid or too-small JPEG: '+str(len(data)))
            (target/output).write_bytes(data)
            print('HHBA_TAMIU_LICENSED_CAMPUS_PHOTO',output,'bytes',len(data),'sha256',hashlib.sha256(data).hexdigest(),'from',url)
            break
        except Exception as exc:
            error=exc
            print('TAMIU_PHOTO_RETRY',output,i+1,str(exc)[:170],flush=True)
            time.sleep(2)
    else:
        raise RuntimeError('Authentic image unavailable; refuse substitute photo: '+name+': '+str(error))
assert len(list(target.glob('*.jpg')))==3
