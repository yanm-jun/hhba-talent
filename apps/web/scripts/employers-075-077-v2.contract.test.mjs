import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(page.includes('07[0-9]|08[0-3])$/.test(id)'),'Enterprise V2 four-block range must include 075-077');
assert(page.includes('if(batch3756)return job.category===major'),'Major tabs must show only matching role categories');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Preserve approved visual layout');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const companies=[['075','强生',4],['076','阿斯利康',4],['077','中国海油',5]];
let count=0;
for(const [n,name,total] of companies){
 const id='cn-autumn-'+n,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.entries.find(x=>x.id===id)?.name,name);
 assert.equal(p.id,id);assert.equal(p.name,name);
 assert.equal(p.schemaVersion,1);assert.equal(p.jobs.length,total);
 assert.equal(p.business.length,6);
 assert(p.business.every(x=>x.title&&x.description.length>25&&x.details.length===3));
 assert.equal(p.media.photos.length,2);
 for(const file of [p.media.logo,...p.media.photos.map(x=>x.path)])
  assert(existsSync('public/'+file)&&statSync('public/'+file).size>450,'Missing media '+file);
 assert.equal(new Set(p.media.photos.map(x=>x.path)).size,2);
 assert(p.jobs.every(j=>j.id&&j.category&&j.title&&j.city&&j.summary.length>=40&&j.requirements.length>=80));
 assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://')&&j.url===p.recruitment.url&&j.currentOpenVerified===false));
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>0));
 assert.equal(new Set(p.jobs.map(x=>x.id)).size,total);
 assert(p.jobs.some(x=>x.category==='机械 / 自动化'||x.category==='机械 / 电气'||x.category==='机械 / 供应链'));
 if(n==='077')assert(p.jobs.every(j=>j.title.includes('非具体JD')),'CNOOC category must not be represented as confirmed individual vacancy');
 if(n==='076')assert(p.recruitment.note.includes('2026-10-31'),'Expired recruitment deadlines must be explicit');
 if(n==='075')assert(p.overview.includes('分拆'),'J&J consumer-health business spin-off must not be overlooked');
 count+=p.jobs.length;
 console.log('HHBA_075_077_COMPANY_PASS',id,name,total);
}
console.log('HHBA_075_077_PASS',JSON.stringify({companies:3,roleOrDirectionRecords:count,businessCards:18,photosOrLabeledFallbacks:6}));
