#!/usr/bin/env python3
"""HHBA 099–101 independently reviewable historical photo sourcing.
Never pretend that public online visibility means commercial reuse permission.
Download only the 2 specifically attributed historical images per employer;
preserve explicit non-real SVG fallback when source is unavailable.
"""
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from PIL import Image, ImageOps
import hashlib, json

BASE = Path('public/images/employer-profiles')
DATA = Path('src/data/employerProfiles')
MAX_BYTES = 9_000_000

def fetch(url, referer):
    if urlparse(url).scheme != 'https':
        raise ValueError('Only HTTPS provenance is permitted')
    req = Request(url, headers={'User-Agent':'Mozilla/5.0 HHBA Media Review',
       'Accept':'image/jpeg,image/png,image/webp,image/*',
       'Referer':referer})
    with urlopen(req, timeout=12) as res:
        if urlparse(res.geturl()).scheme != 'https':
            raise ValueError('Non-HTTPS redirect')
        mime=res.headers.get('Content-Type','').lower()
        if mime and not mime.startswith('image/'):
            raise ValueError('Non-image media '+mime[:80])
        raw = res.read(MAX_BYTES+1)
    if len(raw)>MAX_BYTES:
        raise ValueError('Too many source bytes')
    with Image.open(BytesIO(raw)) as im:
        im.load()
        im=ImageOps.exif_transpose(im).convert('RGB')
        w,h=im.size
        if w<350 or h<275 or w/h<0.45 or w/h>4.5:
            raise ValueError('Image unsuitable '+str((w,h)))
        output=BytesIO()
        im.save(output,'JPEG',quality=87,optimize=True)
        encoded=output.getvalue()
    if len(encoded)<7000:
        raise ValueError('Result file too small')
    return encoded,(w,h)

for num in ('099','100','101'):
    id='cn-autumn-'+num
    folder=BASE/id
    profilefile=DATA/(id+'.json')
    profile=json.loads(profilefile.read_text(encoding='utf8'))
    auditfile=folder/'media-sources.json'
    audit=json.loads(auditfile.read_text(encoding='utf8'))
    seen=set()
    successes=0
    for photo in audit['photos']:
        slot=photo['slot']
        dst=folder/('photo'+str(slot)+'.jpg')
        try:
            raw,pixels=fetch(photo['imageUrl'],photo['articleUrl'])
            sha=hashlib.sha256(raw).hexdigest()
            if sha in seen:
                raise ValueError('Duplicated photo output')
            seen.add(sha)
            dst.write_bytes(raw)
            successes+=1
            photo.update(status='source_picture_verified',filename=dst.name,
                dimensions=list(pixels),sha256=sha,bytes=len(raw))
            profile['media']['photos'][slot-1].update(
                path='images/employer-profiles/'+id+'/'+dst.name,
                caption=photo['sourceContext'],
                alt=photo['sourceContext']+'（历史现场照片，非当前状态）',
                note='历史实景：'+photo['articleUrl']+'。图片作者及转载许可未完成审核，暂限隔离验收。'
            )
        except Exception as e:
            dst.unlink(missing_ok=True)
            photo['status']='nonreal_svg_fallback'
            photo['error']=str(e)[:170]
            print('HHBA_HISTORY_PHOTO_FALLBACK',num,slot,photo['error'])
    audit['sourcedImages']=successes
    profile['photoNote']+=' 本次独立构建取回的实景来源图片 '+str(successes)+'/2；其他为显著标注的非实景编辑图。'
    profilefile.write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    auditfile.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('HHBA_HISTORY_PHOTO_AUDIT',num,successes,'/2, commercial rights NOT verified')
