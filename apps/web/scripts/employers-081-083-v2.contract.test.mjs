import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const range=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(range&&new RegExp(range).test('cn-autumn-081')&&new RegExp(range).test('cn-autumn-083'));
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'));
assert(page.includes('if(batch3756)return job.category===major'));
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
let total=0,real=0;
for(const [n,name,expected] of [['081','安利',11],['082','太古集团',5],['083','福特中国',9]]){
 const id='cn-autumn-'+n,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.entries.find(x=>x.id===id)?.name,name);
 assert.equal(p.id,id);assert.equal(p.schemaVersion,1);assert.equal(p.name,name);
 assert.equal(p.jobs.length,expected);assert.equal(p.business.length,6);
 assert(p.business.every(x=>x.title&&x.description.length>22&&x.details.length===3));
 assert.equal(p.media.photos.length,2);
 const media=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(media).size,3);
 for(const f of media)assert(existsSync('public/'+f)&&statSync('public/'+f).size>=450,'Missing image '+f);
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.city&&j.summary.length>=40&&j.requirements.length>=85));
 assert(p.jobs.every(j=>j.url===p.recruitment.url&&j.evidenceUrl.startsWith('https://')&&j.currentOpenVerified===false));
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&j.majorNames.length===0&&j.editorialRelatedMajors.length>0));
 assert.equal(new Set(p.jobs.map(x=>x.id)).size,expected);
 assert(p.jobs.every(j=>j.category!=='专业不限'));
 const report=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(report.companyId,n);assert.equal(report.images.length,2);
 for(const m of report.images){
  const photo=p.media.photos[m.slot-1];
  assert(m.sourceImageUrl.startsWith('https://')&&m.sourceWebPage.startsWith('https://'));
  if(m.status==='sourced documentary photograph'){
   real++;
   assert(m.file&&m.sha256&&m.pixels[0]>=500&&m.pixels[1]>=300);
   assert(photo.path.endsWith(m.file),'Downloaded photo must actually be visible');
  }else{
   assert(photo.path.endsWith('.svg')&&photo.note.includes('非实景'));
  }
 }
 if(n==='081'){
  assert(p.jobs.some(j=>j.id==='gen-ai'&&j.city.includes('广州')));
  assert(p.recruitment.note.includes('截止日'));
 }
 if(n==='082'){
  assert(p.jobs.some(j=>j.id==='smp-2027'&&j.requirements.includes('2026年9月11日')));
  assert(p.jobs.filter(j=>j.recruitmentType==='SOCIAL').length===2,'SFP/SHRLP must be experienced recruitment');
  assert(p.jobs.some(j=>j.id==='property-mainland-2027'&&j.recruitmentSubject.includes('太古地产')));
 }
 if(n==='083'){
  assert.equal(p.jobs.length,9);
  assert(p.recruitment.note.includes('2026-10-30'));
  assert(p.recruitment.url==='https://app.mokahr.com/campus-recruitment/ford/43706#/');
  assert(p.overview.includes('长安福特'));
 }
 total+=p.jobs.length;
 console.log('HHBA_081_083_COMPANY_PASS',id,name,p.jobs.length,report.actualPhotos,'sourced images');
}
console.log('HHBA_081_083_BATCH_PASS',JSON.stringify({companies:3,jobs:total,business:18,sourcedPhotos:real}));
