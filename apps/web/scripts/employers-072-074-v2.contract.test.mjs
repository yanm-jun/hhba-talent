import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(new RegExp(page.split('const batch3756=/')[1]?.split('/.test(id)')[0]||'^,'Shared 4-block range must include 072—077');
assert(page.includes('if(batch3756)return job.category===major'),'Professional tabs must filter only matching category roles');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'The established V2 four sections must remain');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const firms=[['072','福州建工集团',1],['073','微软',4],['074','大众汽车',6]];
let photo=0;
for(const [num,name,expected] of firms){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.entries.find(x=>x.id===id)?.name,name,'Roster company mismatch '+id);
 assert.equal(p.id,id);assert.equal(p.name,name);
 assert.equal(p.jobs.length,expected,'Job source count incorrect '+id);assert.equal(p.business.length,6);
 assert(p.business.every(b=>b.title&&b.description.length>=27&&b.details?.length===3));
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.summary.length>=35&&j.requirements.length>=70&&j.city));
 assert(p.jobs.every(j=>j.url.startsWith('https://')&&j.evidenceUrl.startsWith('https://')));
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&Array.isArray(j.editorialRelatedMajors)&&j.currentOpenVerified===false));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,expected);
 const files=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(files.length,3);assert.equal(new Set(files).size,3);
 for(const f of files)assert(existsSync('public/'+f)&&statSync('public/'+f).size>450,'Image missing '+f);
 const ledger=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert.equal(ledger.company,name);assert.equal(ledger.officialLogo,false);
 const sources=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(sources.companyId,num);
 for(const x of p.media.photos){
  assert(x.caption&&x.note&&x.alt);
  if(x.path.endsWith('.jpg')){photo++;assert(sources.images.some(a=>x.path.endsWith(a.file)&&a.sourceImageUrl&&a.sha256&&a.pixels[0]>=520),'No image-level source provenance for '+x.path);}
  else assert(x.path.endsWith('.svg')&&x.note.includes('非'),'Image fallback must be explicitly non-real '+x.path);
 }
 if(num==='072'){
  assert(p.jobs.length===1&&p.jobs[0].title.includes('待核'));
  assert.equal(p.jobs[0].recruitmentType,'SOCIAL');
  assert(p.jobs[0].majorNames.length===0,'Do not fabricate unpublished attachments');
  assert(p.recruitment.url.includes('fzrsrc.cn/news/'));
 }else if(num==='073'){
  assert(p.jobs.some(x=>x.id==='software-engineer-200055320'));
  assert(p.jobs.some(x=>x.id==='applied-scientist-200055326'));
  assert(p.recruitment.url.startsWith('https://careers.microsoft.com/'));
 }else{
  assert(p.jobs.every(j=>j.recruitmentType==='CAMPUS'));
  assert(p.recruitment.url.startsWith('https://app.mokahr.com/campus-recruitment/vwa/168597'));
  assert(!p.jobs.some(j=>j.recruitmentSubject.includes('一汽—大众')),'Do not merge subsidiary ATS');
 }
 console.log('HHBA_072_074_PROFILE_PASS',id,name,p.jobs.length,'6 business modules',sources.images.length,'sourced photographs');
}
console.log('HHBA_072_074_FINAL_PASS',JSON.stringify({companies:3,roleOrNoticeRecords:11,businessCards:18,photographs:photo,editorialSlots:6-photo}));
).test('cn-autumn-086'),'Shared 4-block range must include 072—077');
assert(page.includes('if(batch3756)return job.category===major'),'Professional tabs must filter only matching category roles');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'The established V2 four sections must remain');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const firms=[['072','福州建工集团',1],['073','微软',4],['074','大众汽车',6]];
let photo=0;
for(const [num,name,expected] of firms){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.entries.find(x=>x.id===id)?.name,name,'Roster company mismatch '+id);
 assert.equal(p.id,id);assert.equal(p.name,name);
 assert.equal(p.jobs.length,expected,'Job source count incorrect '+id);assert.equal(p.business.length,6);
 assert(p.business.every(b=>b.title&&b.description.length>=27&&b.details?.length===3));
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.summary.length>=35&&j.requirements.length>=70&&j.city));
 assert(p.jobs.every(j=>j.url.startsWith('https://')&&j.evidenceUrl.startsWith('https://')));
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&Array.isArray(j.editorialRelatedMajors)&&j.currentOpenVerified===false));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,expected);
 const files=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(files.length,3);assert.equal(new Set(files).size,3);
 for(const f of files)assert(existsSync('public/'+f)&&statSync('public/'+f).size>450,'Image missing '+f);
 const ledger=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert.equal(ledger.company,name);assert.equal(ledger.officialLogo,false);
 const sources=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(sources.companyId,num);
 for(const x of p.media.photos){
  assert(x.caption&&x.note&&x.alt);
  if(x.path.endsWith('.jpg')){photo++;assert(sources.images.some(a=>x.path.endsWith(a.file)&&a.sourceImageUrl&&a.sha256&&a.pixels[0]>=520),'No image-level source provenance for '+x.path);}
  else assert(x.path.endsWith('.svg')&&x.note.includes('非'),'Image fallback must be explicitly non-real '+x.path);
 }
 if(num==='072'){
  assert(p.jobs.length===1&&p.jobs[0].title.includes('待核'));
  assert.equal(p.jobs[0].recruitmentType,'SOCIAL');
  assert(p.jobs[0].majorNames.length===0,'Do not fabricate unpublished attachments');
  assert(p.recruitment.url.includes('fzrsrc.cn/news/'));
 }else if(num==='073'){
  assert(p.jobs.some(x=>x.id==='software-engineer-200055320'));
  assert(p.jobs.some(x=>x.id==='applied-scientist-200055326'));
  assert(p.recruitment.url.startsWith('https://careers.microsoft.com/'));
 }else{
  assert(p.jobs.every(j=>j.recruitmentType==='CAMPUS'));
  assert(p.recruitment.url.startsWith('https://app.mokahr.com/campus-recruitment/vwa/168597'));
  assert(!p.jobs.some(j=>j.recruitmentSubject.includes('一汽—大众')),'Do not merge subsidiary ATS');
 }
 console.log('HHBA_072_074_PROFILE_PASS',id,name,p.jobs.length,'6 business modules',sources.images.length,'sourced photographs');
}
console.log('HHBA_072_074_FINAL_PASS',JSON.stringify({companies:3,roleOrNoticeRecords:11,businessCards:18,photographs:photo,editorialSlots:6-photo}));
