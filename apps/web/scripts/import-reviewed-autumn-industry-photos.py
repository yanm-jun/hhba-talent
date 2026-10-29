#!/usr/bin/env python3
"""Stage human-reviewed independent Wikimedia Commons reference photographs.

Never label these as employer photographs, founder photographs, AI creations or
the employer's actual office. Do not import anything absent from this approved
photo-by-photo whitelist. The original ZIP may contain badly mismatched images.
"""
import argparse,csv,hashlib,io,json,re,zipfile
from pathlib import Path
from PIL import Image

# IDs individually checked against the 312-photo visual audit contact sheets.
# This is an approved subset, NOT a claim that all 312 are appropriate.
APPROVED={
 '002':(1,2),'004':(1,2),'010':(1,),'014':(1,),
 '029':(1,2),'054':(1,2),'075':(2,),'093':(1,2),
 '121':(2,),'128':(1,2),'155':(1,),
}
def license_url(name):
 n=name.strip().lower()
 if n in ('public domain','cc0'):return 'https://creativecommons.org/publicdomain/mark/1.0/' if n=='public domain' else 'https://creativecommons.org/publicdomain/zero/1.0/'
 m=re.match(r'cc by(-sa)? (\d+\.\d+)',n)
 if m:return 'https://creativecommons.org/licenses/by'+('-sa' if m.group(1) else '')+'/'+m.group(2)+'/'
 return None
def run(inp, webroot):
 candidates=list(Path(inp).glob('**/*.zip'))
 source=next((p for p in candidates if 'individual_industry_photos' in p.name),None)
 if source is None:raise RuntimeError('Required original photo ZIP absent; refuse silent empty publication')
 out=Path(webroot)
 with zipfile.ZipFile(source) as z:
  names=set(z.namelist())
  assert 'PHOTO_SOURCES_AND_LICENSES.csv' in names
  rows=list(csv.DictReader(io.TextIOWrapper(z.open('PHOTO_SOURCES_AND_LICENSES.csv'),encoding='utf-8-sig')))
  assert len(rows)==312
  index={(x['employer_id'],x['image_id'][-2:]):x for x in rows}
  entries={}; hashes=set();audit=[]
  # A subsequent editorial correction must remove old unapproved photos as well.
  photo_dir=out/'images'/'autumn-industry-references'
  if photo_dir.exists():
   for old in photo_dir.glob('cn-autumn-*.jpg'): old.unlink()
  for short,nums in APPROVED.items():
   cid='cn-autumn-'+short; photos=[]
   for num in nums:
    key=(cid,f'{num:02d}')
    row=index.get(key)
    if not row:raise ValueError('Missing source photo '+str(key))
    lp=license_url(row['license'])
    if not lp:raise ValueError('Missing valid reuse license: '+str(key))
    src=row['path']
    if src not in names:raise ValueError('File missing: '+src)
    assert row['employer_id']==cid and row['source_page'].startswith('https://commons.wikimedia.org/wiki/File:')
    contents=z.read(src)
    sha=hashlib.sha256(contents).hexdigest()
    if sha in hashes:raise ValueError('Duplicate visual asset: '+cid)
    hashes.add(sha)
    im=Image.open(io.BytesIO(contents));im.verify()
    filename=f'{cid}-{num:02d}.jpg'
    dest=out/'images'/'autumn-industry-references'/filename
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(contents)
    image={
      'id':f'{cid}-reference-{num:02d}',
      'file':'images/autumn-industry-references/'+filename,
      'imageType':'licensed_industry_reference_not_actual_employer',
      'label':'行业场景参考图 · 非该企业实景',
      'alt':row['category_hint']+'行业参考照片，不是'+row['employer_name']+'的真实办公或经营地点',
      'companyId':cid,'companyName':row['employer_name'],
      'sourceUrl':row['source_page'],'license':row['license'],'licenseUrl':lp,
      'author':row.get('author') or '原始作者见来源页面',
      'credit':row.get('credit') or '',
      'changes':'根据图库原图裁切并缩放为1200×675（既有照片包操作）',
      'sha256':sha,
    }
    photos.append(image)
    audit.append((cid,num,row['source_page'],row['license']))
   entries[cid]=photos
 manifest={
  'schemaVersion':'1.0',
  'source':'HHBA previously assembled 312 independent industry reference photo ZIP, provenance from Wikimedia Commons',
  'policy':'The approved subset consists of generic licensed industry reference photos, not actual company photography and not AI-generated images. Editorial approval is limited to scene/category plausibility, not employer identity.',
  'totalCompanyNamesInSource':156,
  'totalSourcePhotos':312,
  'approvedCompanies':len(entries),
  'approvedPhotos':len(audit),
  'entries':entries
 }
 target=out/'data'/'domestic-autumn-industry-photos.json'
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 readme=out/'images'/'autumn-industry-references'/'README-SOURCES.txt'
 readme.write_text('PHOTO TYPE: licensed stock/industry reference. These pictures do not show the named enterprises.\nIndividual attribution, license, original source and modification notice are in /data/domestic-autumn-industry-photos.json.\n',encoding='utf-8')
 assert len(audit)==sum(map(len,APPROVED.values()))
 print('HHBA_APPROVED_REFERENCE_PHOTOS',len(entries),len(audit),'SOURCE_REJECTED',312-len(audit))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--artifact-dir',required=True);p.add_argument('--web-root',required=True);a=p.parse_args()
 run(a.artifact_dir,a.web_root)
