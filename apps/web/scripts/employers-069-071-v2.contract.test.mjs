import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const routeSource=page.match(/const batch3756=\\/(.+?)\\/\\.test\\(id\\)/)?.[1];
assert(routeSource,'Missing configured shared V2 route regex');
const routePattern=new RegExp(routeSource);
assert((routePattern.test('cn-autumn-069')&&routePattern.test('cn-autumn-071')&&routePattern.test('cn-autumn-080')),'All three next firms need existing four-panel V2 route');
assert(page.includes('if(batch3756)return job.category===major'),'Exact category filter missing');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Four sections changed');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const cases=[['069','广东省农信联社',10],['070','青岛成达',2],['071','桃溪集团',2]];
for(const [num,display,count] of cases){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.entries.find(x=>x.id===id)?.name,display);
 assert.equal(p.id,id);assert.equal(p.jobs.length,count);assert.equal(p.business.length,6);
 assert(p.business.every(b=>b.description?.length>=25&&b.details?.length===3));
 assert(p.jobs.every(j=>j.category&&j.city&&j.title&&j.summary.length>=30&&j.requirements.length>=55));
 assert(p.jobs.every(j=>j.evidenceUrl?.startsWith('https://')&&j.url?.startsWith('https://')));
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&Array.isArray(j.editorialRelatedMajors)&&!j.currentOpenVerified));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,count);
 const files=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(files).size,3);
 for(const f of files)assert(fs.existsSync('public/'+f)&&fs.statSync('public/'+f).size>200,'Missing image '+f);
 const ledger=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert(ledger.company===p.name||ledger.company===p.displayName);
 if(num==='069'){
  assert.equal(p.recruitment.status,'official_portal');
  assert(p.recruitment.url.includes('gdrcu2027.iguopin.com'));
  assert(p.jobs.every(x=>x.recruitmentType==='CAMPUS'&&x.educationLabel.includes('硕士')));
 }else{
  assert.equal(p.recruitment.status,'archived_source');
  assert(p.jobs.every(x=>x.recruitmentType==='SOCIAL'),'Never invent a 2027 detailed job for 070/071');
 }
 if(num!=='071'){
  const sources=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
  assert.equal(sources.length,num==='069'?1:2);
  assert(sources.every(x=>x.sourceImageUrl&&x.pageEvidence&&x.sha256&&x.rights));
 }else{
  assert(p.media.photos.every(x=>x.path.endsWith('.svg')&&x.note.includes('非')));
 }
 console.log('HHBA_069_071_PROFILE_PASS',id,p.name,'jobs',p.jobs.length,'6 business modules');
}
console.log('HHBA_069_071_ALL_PASS',JSON.stringify({companies:3,roles:14,serviceCards:18,images:9}));
