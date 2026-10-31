import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const ids=Array.from({length:14},(_,n)=>String(n+37).padStart(3,'0'));
const profiles=ids.map(n=>JSON.parse(read('src/data/employerProfiles/cn-autumn-'+n+'.json')));
const source=read('src/pages/UnifiedV2CompanyPage.tsx');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const index=new Map(roster.entries.map(x=>[x.id,x.name]));
assert(source.includes('const batch3750=/^cn-autumn-(?:03[7-9]|04[0-9]|050)$/.test(id)'), 'Only target 14 V2 employers use merged layout');
assert(source.includes('if(batch3750)return job.category===major'), 'Professional group must filter by actual role category');
assert(source.includes('j.category===g.label'), 'Accurate per-group job counts');
assert(source.includes('batch3750?p.recruitment.label'), 'Source-appropriate hiring warning (do not call all listings official)');
assert(source.includes('hhba-kpmg-photo-grid') && source.includes('hhba-kpmg-service-grid'), 'Four-panel original photo and business sections');
assert(source.includes('data-hhba-recruitment-outbound="true"') && source.includes('站内岗位详情'), 'Auth and internal job detail links');
const expectedCount={ '037':10,'038':9,'039':12,'040':13,'041':14,'042':7,'043':3,'044':10,'045':7,'046':3,'047':7,'048':1,'049':4,'050':6 };
let jobs=0,media=0,services=0;
const allNames=new Set();
for(const [indexInBatch,p] of profiles.entries()){
  const num=ids[indexInBatch],id='cn-autumn-'+num;
  assert.equal(p.id,id);
  assert.equal(p.name,index.get(id),'Never change original company roster identity');
  assert(!allNames.has(p.name),'Duplicate named employer');
  allNames.add(p.name);
  assert.equal(p.jobs.length,expectedCount[num]);
  assert.equal(p.business.length,6,'Each company has six detailed business sections');
  assert.equal(new Set(p.jobs.map(j=>j.id)).size,p.jobs.length,'Unique job IDs');
  assert(p.jobs.every(j=>j.title && j.summary && j.requirements && j.city && j.category));
  assert(p.jobs.every(j=>j.currentOpenVerified===false),'No claims of realtime open jobs');
  assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://') && j.url.startsWith('https://')));
  assert(p.jobs.every(j=>j.majorNames.length>0 && j.educationLabel));
  assert(p.jobs.every(j=>['CAMPUS','SOCIAL','INTERNSHIP'].includes(j.recruitmentType)));
  assert(p.jobs.every(j=>j.recruitmentSubject));
  assert(['official_portal','archived_source','unconfirmed'].includes(p.recruitment.status));
  assert(p.media.photos.length===2 && p.media.photos.every(x=>x.caption&&x.alt&&x.note));
  const paths=[p.media.logo,...p.media.photos.map(photo=>photo.path)];
  assert.equal(new Set(paths).size,3);
  const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
  assert.deepEqual(Object.keys(audit).sort(),['logo.png','photo1.jpg','photo2.jpg']);
  const contentSha=new Set();
  for(let k=0;k<3;k++){
    const path='public/'+paths[k];
    assert(existsSync(path)&&statSync(path).size>120,'Missing actual binary '+path);
    const data=readFileSync(path);
    const actual=createHash('sha256').update(data).digest('hex');
    const entry=audit[k===0?'logo.png':'photo'+k+'.jpg'];
    assert(entry && entry.sha256===actual,'Media audit digest must match binary bytes '+path);
    assert(!contentSha.has(actual),'Duplicate company photo '+id);
    contentSha.add(actual);
  }
  if(num==='049'||num==='050'){
    assert(audit['logo.png'].editorialFallback===true && audit['logo.png'].verified===false,
      'Editorial company text must never be labelled official logo');
    assert(p.photoNote.includes('非企业官方Logo'));
    assert(p.recruitment.status==='unconfirmed');
  }
  if(num==='050'){
    assert(!audit['photo1.jpg'].source.includes('parkworld.net') &&
           !audit['photo1.jpg'].source.includes('saas-chengdu') &&
           !audit['photo1.jpg'].source.includes('20260514/943d9d62'),
           'Reject previously visually identified irrelevant graphics');
  }
  jobs+=p.jobs.length;media+=3;services+=p.business.length;
  console.log('MERGE_READY_V2',num,p.name,'jobs='+p.jobs.length,'images=3');
}
assert.equal(jobs,106);
assert.equal(services,84);
assert.equal(media,42);
console.log('HHBA_037_TO_050_ALL_14_EMPLOYERS_106_JOBS_84_SERVICES_42_LOCAL_IMAGES_PASS');
