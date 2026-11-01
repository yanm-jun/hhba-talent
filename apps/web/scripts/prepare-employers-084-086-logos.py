#!/usr/bin/env python3
"""Optional nominative logo references from documented Wikimedia files.
No trademark affiliation or commercial endorsement claimed. Safe SVG only.
"""
from pathlib import Path
import json,hashlib
from urllib.request import Request,urlopen
import xml.etree.ElementTree as ET
DATA=Path('src/data/employerProfiles');BASE=Path('public/images/employer-profiles')
links={
 '084':('https://commons.wikimedia.org/wiki/Special:FilePath/KraftHeinz.svg','https://commons.wikimedia.org/wiki/File:KraftHeinz.svg'),
 '085':('https://commons.wikimedia.org/wiki/Special:FilePath/Henkel-Logo.svg','https://commons.wikimedia.org/wiki/File:Henkel-Logo.svg')
}
for n,(url,source) in links.items():
 id='cn-autumn-'+n;folder=BASE/id
 profile_path=DATA/(id+'.json')
 p=json.loads(profile_path.read_text(encoding='utf-8'))
 audit={'companyId':n,'referencePage':source,'imageUrl':url,'status':'HHBA_nonofficial_fallback','trademarkLicenseGranted':False}
 try:
  req=Request(url,headers={'User-Agent':'Mozilla/5.0 (HHBA sourcing)','Accept':'image/svg+xml,*/*'})
  with urlopen(req,timeout=15) as res:raw=res.read(70000)
  if not(750<=len(raw)<=45000):raise ValueError('Unusual SVG byte size')
  root=ET.fromstring(raw)
  if not root.tag.endswith('svg'):raise ValueError('Not SVG')
  for node in root.iter():
   tag=node.tag.lower()
   if tag.endswith(('script','foreignobject','image','iframe','use')):raise ValueError('External/active SVG element')
   for att,value in node.attrib.items():
    a=att.lower()
    if a.startswith('on') or a.endswith('href') or 'javascript:' in value.lower() or 'url(' in value.lower():raise ValueError('Unsafe SVG attribute')
  content=raw.decode('utf-8-sig')
  if '<!doctype' in content.lower() or '<!entity' in content.lower():raise ValueError('XML unsafe constructs')
  out=folder/'brand-logo.svg';out.write_bytes(raw)
  p['media']['logo']='images/employer-profiles/'+id+'/brand-logo.svg'
  p['photoNote']+=' 品牌字标取自注明来源的识别性SVG，商标权仍归各自权利人，本站未获品牌背书。'
  profile_path.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  audit.update(status='reference_wordmark_verified',sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
  print('HHBA_084_086_WORDMARK',id,audit['sha256'][:12])
 except Exception as ex:
  (folder/'brand-logo.svg').unlink(missing_ok=True)
  audit['error']=str(ex)[:180]
  print('HHBA_084_086_LOGO_FALLBACK',id,audit['error'])
 (folder/'logo-sources.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
