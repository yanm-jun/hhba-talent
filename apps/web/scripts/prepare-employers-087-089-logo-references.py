#!/usr/bin/env python3
"""Preserve visibly recognizable, source-referenced brand identification images.
A logo reference is not a trademark license or endorsement. Failed validation
leaves a prominently identified nonofficial HHBA editorial wordmark in place.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
from PIL import Image,ImageOps
import json,hashlib
ROOT=Path('public/images/employer-profiles')
DATA=Path('src/data/employerProfiles')
SOURCES={
 '087':{'url':'https://commons.wikimedia.org/wiki/Special:FilePath/Carlsberg_Group.png',
        'page':'https://commons.wikimedia.org/wiki/File:Carlsberg_Group.png',
        'note':'Wikimedia reference: Carlsberg Group wordmark, file PD-textlogo; trademark protections remain'},
 '088':{'url':'https://5b0988e595225.cdn.sohucs.com/q_70%2Cc_zoom%2Cw_640/images/20181017/75468dda5cb445b3895f5787b49b7bd1.jpeg',
        'page':'https://www.sohu.com/a/260073040_329037',
        'note':'Sohu 2018 reported Semir rebranding reference image; current brand guidelines unverified'},
 '089':{'url':'https://framerusercontent.com/images/jyjfPJT5N0n8cCAYLevAqfOEUA.png?height=4167&scale-down-to=4096&width=4167',
        'page':'https://infinitus.com.hk/brandstory',
        'note':'Official Infinitus Hong Kong regional wordmark; mainland visual identity may differ'}
}
for n,x in SOURCES.items():
 id='cn-autumn-'+n;path=DATA/(id+'.json');p=json.loads(path.read_text('utf8'))
 folder=ROOT/id
 record={'companyId':n,'sourceWebPage':x['page'],'sourceImageUrl':x['url'],'identityNote':x['note'],'commercialTrademarkRightsVerified':False,'status':'nonofficial_HHBA_wordmark_fallback'}
 try:
  r=Request(x['url'],headers={'User-Agent':'Mozilla/5.0 (HHBA corporate identification)','Referer':x['page'],'Accept':'image/png,image/jpeg,image/webp,*/*'})
  with urlopen(r,timeout=16) as conn:
   mime=conn.headers.get('Content-Type','')
   if mime and not mime.lower().startswith('image/'):raise ValueError('MIME mismatch '+mime)
   raw=conn.read(6500000)
  if len(raw)>=6500000:raise ValueError('Logo file limit exceeded')
  im=ImageOps.exif_transpose(Image.open(BytesIO(raw)))
  if im.mode not in ('RGB','RGBA'):im=im.convert('RGBA')
  w,h=im.size
  if w<130 or h<35 or w/h>12.5:raise ValueError('Bad logo aspect '+str((w,h)))
  target=folder/'brand-logo.png'
  im.save(target,'PNG',optimize=True)
  sha=hashlib.sha256(target.read_bytes()).hexdigest()
  p['media']['logo']='images/employer-profiles/'+id+'/brand-logo.png'
  path.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  record.update(status='sourced_brand_reference',sha256=sha,pixels=[w,h],filename=target.name)
  print('HHBA_BRAND_IMAGE_REFERENCE',id,sha[:15])
 except Exception as exc:
  (folder/'brand-logo.png').unlink(missing_ok=True)
  record['error']=str(exc)[:180]
  print('HHBA_BRAND_EDITORIAL_FALLBACK',id,record['error'])
 (folder/'logo-sources.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
