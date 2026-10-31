import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=f=>fs.readFileSync(f,'utf8');
const p=['045','046','047'].map(id=>JSON.parse(read('src/data/employerProfiles/cn-autumn-'+id+'.json')));
const counts=[7,3,7];
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(page.includes("const batch4547=['cn-autumn-045','cn-autumn-046','cn-autumn-047'].includes(id)"),'Reuse V2 standard template');
assert(page.includes('if(minieye||batch4547)return job.category===major'),'Filter only selected job category');
assert(page.includes('j.category===g.label'),'Chip counts reflect matching jobs');
assert(page.includes('batchGroups'),'Groups built from company-specific job categories');
assert(page.includes('hhba-kpmg-photo-grid'),'First section shows exactly two photos');
assert(page.includes('data-hhba-recruitment-outbound="true"'),'Login gate for official apply link retained');
assert(page.includes('站内岗位详情'),'Job details link still visible');
for(const h of ['适合哪些专业背景？','招聘岗位','主要业务与专业服务'])assert(page.includes(h),'Section missing '+h);
for(let i=0;i<3;i++){
 const x=p[i],num=String(45+i).padStart(3,'0');
 assert.equal(x.id,'cn-autumn-'+num);
 assert.equal(x.jobs.length,counts[i]);
 assert.equal(x.business.length,6);
 assert.equal(new Set(x.jobs.map(j=>j.id)).size,counts[i],'Job ID collision');
 assert(new Set(x.jobs.map(j=>j.category)).size>=3);
 assert(x.jobs.every(j=>j.title&&j.city&&j.summary.length>=25&&j.requirements.length>=45));
 assert(x.jobs.every(j=>j.currentOpenVerified===false&&!j.majorUnrestricted),'No false real-time hiring assurance');
 assert(x.jobs.every(j=>j.majorNames.length>=1&&j.evidenceUrl.startsWith('https://')&&j.url===x.recruitment.url));
 const names=[x.media.logo,...x.media.photos.map(photo=>photo.path)];
 assert.equal(new Set(names).size,3);
 for(const n of names){
  assert(fs.existsSync('public/'+n),'Missing authentic local media '+n);
  assert(fs.statSync('public/'+n).size>=2000,'Empty image '+n);
 }
 const provenance=JSON.parse(read('public/images/employer-profiles/cn-autumn-'+num+'/media-audit.json'));
 assert.deepEqual(Object.keys(provenance).sort(),['logo.png','photo1.jpg','photo2.jpg']);
 assert.equal(new Set(Object.values(provenance).map(m=>m.sourceSha256)).size,3,'Duplicated photo');
 for(const [filename,v] of Object.entries(provenance)){
  assert(v.verified&&v.company===x.name&&v.source.startsWith('https://'),'Media provenance bad');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('public/images/employer-profiles/cn-autumn-'+num+'/'+filename)).digest('hex'),v.sha256,'Media hash altered');
 }
 console.log('HHBA_V2_COMPANY_0'+num+'_PASS',JSON.stringify({name:x.name,jobs:counts[i],business:6,images:3}));
}
assert(p[0].jobs.some(j=>j.title.includes('软件工程师')&&j.majorNames.includes('计算机科学与技术')),'Software roles not misfiled');
assert(p[0].jobs.some(j=>j.title.includes('生产管培生')&&j.majorNames.includes('机械工程')),'Mechanical major supported');
assert(p[1].jobs.length===3&&p[1].jobs.every(j=>j.evidenceUrl.includes('vsol.com.cn/join-us/campus-recruitment')),'Three direct official source jobs');
const vsolMedia=JSON.parse(read('public/images/employer-profiles/cn-autumn-046/media-audit.json'));
assert(/images\\.crunchbase\\.com|smartgridmexico\\.mx/.test(vsolMedia['logo.png'].source),'Brand mark must belong to Guangzhou optical equipment manufacturer; unrelated Korean Wikimedia mark prohibited');
assert(p[2].name==='瀚通通讯'&&p[2].displayName.includes('瀛通通讯（名录原标：瀚通通讯）'),'Original name retained without asserting legal identity');
assert(p[2].jobs.every(j=>j.recruitmentSubject==='瀛通通讯股份有限公司'),'Do not fabricate a HanTong legal entity');
console.log('HHBA_045_046_047_FOUR_PANEL_SUMMARY_17_JOBS_18_SERVICES_9_IMAGES_OK');
