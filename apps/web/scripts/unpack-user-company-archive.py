"""Unpack screened 50-employer JPG/PNG/WebP archive with exact names and SHA256s."""
from pathlib import Path, PurePosixPath
from io import BytesIO
from zipfile import ZipFile
import hashlib, json, re
ROOT=Path('media-inbox')
EXPECTED_SHA='4a9e84d482ac6d434ba66289de3d3f444ce63b21c87e607e662ba53773c9db8d'
parts=sorted((ROOT/'packed').glob('user50.part*'))
if not parts:
 print('HHBA_USER_MEDIA_ARCHIVE_NOT_PROVIDED')
 raise SystemExit(0)
assert len(parts)==13
assert [x.name for x in parts]==[f'user50.part{i:02}' for i in range(1,14)]
content=b''.join(p.read_bytes() for p in parts)
assert hashlib.sha256(content).hexdigest()==EXPECTED_SHA,'ZIP SHA256 mismatch'
names=json.loads(Path('src/data/domesticComplete50Target.json').read_text(encoding='utf8'))['companyNames']
assert len(set(names))==len(names)==50
out={n:{'logo':0,'photo':0} for n in names}
i=0
with ZipFile(BytesIO(content)) as z:
 audit=json.loads(z.read('company-audit.json').decode('utf8'))
 assert audit['kept']==171 and audit['quarantined']==11
 recorded={x['company']:{y['name']:y['sha256'] for y in x['imported']} for x in audit['companies']}
 assert len(recorded)==50 and set(recorded)==set(names)
 for entry in z.infolist():
  if entry.is_dir():continue
  p=PurePosixPath(entry.filename)
  if len(p.parts)!=3 or p.parts[0]!='media-inbox':continue
  name,filename=p.parts[1:]
  assert name in out
  assert filename=='sources.json' or re.fullmatch(r'(?:logo|headquarters|office|factory|product|screenshot)(?:[-_][\w-]+)?\.(?:png|jpe?g|webp|gif)',filename,re.I),filename
  assert entry.file_size<15_000_000
  b=z.read(entry)
  if filename!='sources.json':
   assert hashlib.sha256(b).hexdigest()==recorded[name].get(filename),'Mismatched employer photo or bad hash'
   out[name]['logo' if filename.startswith('logo.') else 'photo']+=1;i+=1
  dest=ROOT/name/filename
  dest.parent.mkdir(parents=True,exist_ok=True)
  dest.write_bytes(b)
assert i==171
assert all(x['logo']==1 and x['photo']>=1 for x in out.values())
Path('preview-reports').mkdir(exist_ok=True)
Path('preview-reports/user-archive-extraction.json').write_text(json.dumps({'zipSha256':EXPECTED_SHA,'companies':50,'images':171,'logos':50,'photos':121,'byCompany':out},ensure_ascii=False,indent=2),encoding='utf8')
print('HHBA_USER_MEDIA_ARCHIVE_VERIFIED',json.dumps({'companies':50,'logos':50,'photos':121,'images':171},ensure_ascii=False))
