#!/usr/bin/env python3
"""Import identity-matched brand wordmarks for prepublication review.
Their source pages describe possible trademark protections; no brand endorsement or commercial authorization is asserted.
Fall back to the HHBA-labelled editorial identifiers if unavailable.
"""
from pathlib import Path
from urllib.request import Request,urlopen
import xml.etree.ElementTree as ET
import hashlib,json,re
root=Path('public/images/employer-profiles')
data=Path('src/data/employerProfiles')
logos={
 '081':('https://commons.wikimedia.org/wiki/Special:FilePath/AMWAY_Logo_neu.svg',
        'https://commons.wikimedia.org/wiki/File:AMWAY_Logo_neu.svg',
        'Amway wordmark from an independent Commons vector record; trademark use restricted'),
 '082':('https://commons.wikimedia.org/wiki/Special:FilePath/Swire_Logo.svg',
        'https://commons.wikimedia.org/wiki/File:Swire_Logo.svg',
        'Swire Group logo vector credited to Swire Group; trademark use restricted')
}
for number,(url,source,label) in logos.items():
 id='cn-autumn-'+number
 folder=root/id
 pfile=data/(id+'.json')
 p=json.loads(pfile.read_text('utf8'))
 status={'companyId':number,'sourcePage':source,'sourceVectorUrl':url,'brandReference':label,'commercialTrademarkRightsConfirmed':False,'status':'editorial_fallback'}
 try:
  req=Request(url,headers={'User-Agent':'Mozilla/5.0 (HHBA logo source research)','Accept':'image/svg+xml,*/*'})
  with urlopen(req,timeout=16) as res:raw=res.read(100000)
  if len(raw)<700 or len(raw)>30000:raise ValueError('Unexpected SVG size')
  s=raw.decode('utf-8-sig')
  if re.search(r'<script\b|<foreignObject\b|<image\b|<iframe\b|javascript:|onload\s*=|onerror\s*=|@import|https?://',s,re.I):raise ValueError('Unsafe SVG content')
  tree=ET.fromstring(s)
  if not tree.tag.endswith('svg'):raise ValueError('Not an SVG image')
  if any(tag.tag.lower().endswith(('script','foreignobject','image')) for tag in tree.iter()):raise ValueError('Invalid SVG element')
  for tag in tree.iter():
   for a in tag.attrib:
    if a.lower().startswith('on') or a.lower().endswith('href'):raise ValueError('Unsafe SVG attribute')
  target=folder/'brand-logo.svg'
  target.write_bytes(raw)
  p['media']['logo']='images/employer-profiles/'+id+'/brand-logo.svg'
  p['photoNote']+=' 品牌名称采用有来源的非官方转录SVG参考，商标使用权仍归权利人。'
  pfile.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  status.update(status='validated_identification_reference',sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
  print('HHBA_BRAND_SOURCE_LOGO',number,status['sha256'][:16])
 except Exception as e:
  (folder/'brand-logo.svg').unlink(missing_ok=True)
  status['error']=str(e)[:180]
  print('HHBA_BRAND_EDITORIAL_FALLBACK',number,status['error'])
 (folder/'brand-sources.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
