import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(new RegExp(page.split('const batch3756=/')[1]?.split('/.test(id)')[0]||'^,'Shared V2 four-block page must cover 078-080');
assert(page.includes('if(batch3756)return job.category===major'),'Professional chips must filter exact matching role category');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Existing four-section layout must remain');
const profiles=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
let totalJobs=0;
for(const [num,name,number] of [['078','中国邮政',6],['079','中通快递',6],['080','达能',12]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(profiles.find(x=>x.id===id)?.name,name,'Wrong roster slot '+id);
 assert.equal(p.schemaVersion,1);assert.equal(p.id,id);assert.equal(p.name,name);
 assert.equal(p.jobs.length,number);assert.equal(p.business.length,6);
 assert(p.business.every(x=>x.title&&x.description.length>=28&&x.details.length===3));
 assert.equal(p.media.photos.length,2);
 assert.equal(new Set([p.media.logo,...p.media.photos.map(x=>x.path)]).size,3);
 for(const f of [p.media.logo,...p.media.photos.map(x=>x.path)]){
   assert(existsSync('public/'+f)&&statSync('public/'+f).size>=400,'Missing independently stored image '+f);
 }
 assert(p.jobs.every(x=>x.id&&x.title&&x.summary.length>=30&&x.requirements.length>=70&&x.category&&x.city));
 assert(p.jobs.every(x=>x.url===p.recruitment.url&&x.currentOpenVerified===false));
 assert(p.jobs.every(x=>x.evidenceUrl.startsWith('https://')&&x.majorNames.length===0&&Array.isArray(x.editorialRelatedMajors)));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,number);
 assert.equal(new Set(p.jobs.map(j=>j.category)).size>=5,true);
 assert.equal(JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json')).company,name);
 const src=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(src.companyId,num);
 assert.equal(src.slots.length,2);
 for(const slot of src.slots) {
   assert(slot.article.startsWith('https://')&&slot.imageUrl.startsWith('https://'));
   if(slot.status==='sourced_image'){
     const img='public/images/employer-profiles/'+id+'/'+slot.filename;
     assert(existsSync(img)&&statSync(img).size>13000,'Missing audited JPG');
     assert(slot.sha256&&slot.pixels[0]>=520&&slot.pixels[1]>=300,'Sourced photo without evidence');
     assert(p.media.photos[slot.slot-1].path.endsWith(slot.filename),'Downloaded image not used in profile');
   } else {
     assert(p.media.photos[slot.slot-1].path.endsWith('.svg'),'Fallback must retain visually labelled SVG');
     assert(p.media.photos[slot.slot-1].note.includes('非实景'),'Missing fallback disclosure');
   }
 }
 if(num==='078'){
   assert(p.jobs.every(x=>x.title.includes('非具体JD')),'China Post source is only category-level notice');
   assert(p.recruitment.note.includes('2026-10-31'));
   assert(p.recruitment.note.includes('10月7日'),'Do not equate Postal Savings Bank application deadline');
 }
 if(num==='079'){
   assert(p.jobs.every(x=>x.city==='上海市'),'Only the six sourced HQ roles are shown');
   assert(p.recruitment.note.includes('中通快运'),'Keep separate employer entity');
 }
 if(num==='080'){
   assert(p.jobs.filter(x=>x.category==='医药 / 临床营养').length===4);
   assert(p.jobs.some(x=>x.id==='marketing-multi'&&x.majorUnrestricted===true));
   assert(p.recruitment.url.includes('#/jobs'),'Exact official Moka job-list URL');
   assert(p.recruitment.note.includes('2026-10-31'),'Expired deadline visibly recorded');
 }
 totalJobs+=p.jobs.length;
 console.log('HHBA_078_080_PASS',num,name,p.jobs.length,src.slots.filter(s=>s.status==='sourced_image').length,'sourced images');
}
const links=read('src/services/employerProfiles.ts');
assert(links.includes("record.profile.id==='cn-autumn-080'&&u.hash==='#/jobs'"),'Danone exact Moka #/jobs exception must be scoped to this employer');
console.log('HHBA_078_080_BATCH_PASS',JSON.stringify({employers:3,records:totalJobs,businessModules:18,photoSlots:6}));
).test('cn-autumn-086'),'Shared V2 four-block page must cover 078-080');
assert(page.includes('if(batch3756)return job.category===major'),'Professional chips must filter exact matching role category');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Existing four-section layout must remain');
const profiles=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
let totalJobs=0;
for(const [num,name,number] of [['078','中国邮政',6],['079','中通快递',6],['080','达能',12]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(profiles.find(x=>x.id===id)?.name,name,'Wrong roster slot '+id);
 assert.equal(p.schemaVersion,1);assert.equal(p.id,id);assert.equal(p.name,name);
 assert.equal(p.jobs.length,number);assert.equal(p.business.length,6);
 assert(p.business.every(x=>x.title&&x.description.length>=28&&x.details.length===3));
 assert.equal(p.media.photos.length,2);
 assert.equal(new Set([p.media.logo,...p.media.photos.map(x=>x.path)]).size,3);
 for(const f of [p.media.logo,...p.media.photos.map(x=>x.path)]){
   assert(existsSync('public/'+f)&&statSync('public/'+f).size>=400,'Missing independently stored image '+f);
 }
 assert(p.jobs.every(x=>x.id&&x.title&&x.summary.length>=30&&x.requirements.length>=70&&x.category&&x.city));
 assert(p.jobs.every(x=>x.url===p.recruitment.url&&x.currentOpenVerified===false));
 assert(p.jobs.every(x=>x.evidenceUrl.startsWith('https://')&&x.majorNames.length===0&&Array.isArray(x.editorialRelatedMajors)));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,number);
 assert.equal(new Set(p.jobs.map(j=>j.category)).size>=5,true);
 assert.equal(JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json')).company,name);
 const src=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(src.companyId,num);
 assert.equal(src.slots.length,2);
 for(const slot of src.slots) {
   assert(slot.article.startsWith('https://')&&slot.imageUrl.startsWith('https://'));
   if(slot.status==='sourced_image'){
     const img='public/images/employer-profiles/'+id+'/'+slot.filename;
     assert(existsSync(img)&&statSync(img).size>13000,'Missing audited JPG');
     assert(slot.sha256&&slot.pixels[0]>=520&&slot.pixels[1]>=300,'Sourced photo without evidence');
     assert(p.media.photos[slot.slot-1].path.endsWith(slot.filename),'Downloaded image not used in profile');
   } else {
     assert(p.media.photos[slot.slot-1].path.endsWith('.svg'),'Fallback must retain visually labelled SVG');
     assert(p.media.photos[slot.slot-1].note.includes('非实景'),'Missing fallback disclosure');
   }
 }
 if(num==='078'){
   assert(p.jobs.every(x=>x.title.includes('非具体JD')),'China Post source is only category-level notice');
   assert(p.recruitment.note.includes('2026-10-31'));
   assert(p.recruitment.note.includes('10月7日'),'Do not equate Postal Savings Bank application deadline');
 }
 if(num==='079'){
   assert(p.jobs.every(x=>x.city==='上海市'),'Only the six sourced HQ roles are shown');
   assert(p.recruitment.note.includes('中通快运'),'Keep separate employer entity');
 }
 if(num==='080'){
   assert(p.jobs.filter(x=>x.category==='医药 / 临床营养').length===4);
   assert(p.jobs.some(x=>x.id==='marketing-multi'&&x.majorUnrestricted===true));
   assert(p.recruitment.url.includes('#/jobs'),'Exact official Moka job-list URL');
   assert(p.recruitment.note.includes('2026-10-31'),'Expired deadline visibly recorded');
 }
 totalJobs+=p.jobs.length;
 console.log('HHBA_078_080_PASS',num,name,p.jobs.length,src.slots.filter(s=>s.status==='sourced_image').length,'sourced images');
}
const links=read('src/services/employerProfiles.ts');
assert(links.includes("record.profile.id==='cn-autumn-080'&&u.hash==='#/jobs'"),'Danone exact Moka #/jobs exception must be scoped to this employer');
console.log('HHBA_078_080_BATCH_PASS',JSON.stringify({employers:3,records:totalJobs,businessModules:18,photoSlots:6}));
