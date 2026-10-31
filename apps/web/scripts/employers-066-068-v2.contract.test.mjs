import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const routeSource=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(routeSource,'Missing configured shared V2 route regex');
const routePattern=new RegExp(routeSource);
assert((routePattern.test('cn-autumn-066')&&routePattern.test('cn-autumn-068')&&routePattern.test('cn-autumn-080')),'063-068 must share the same four-block layout');
assert(page.includes('if(batch3756)return job.category===major'),'Exact category role selection must be preserved');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'));
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const firms=[['066','物产道富',6],['067','弘象',3],['068','甘肃能化集团',10]];
for(const [i,name,n] of firms){
 const id='cn-autumn-'+i,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.entries.find(x=>x.id===id)?.name,name,'Roster mismatch '+id);
 assert.equal(p.id,id);assert.equal(p.name,name);
 assert.equal(p.business.length,6);assert.equal(p.jobs.length,n);
 assert(p.business.every(s=>s.title&&s.description.length>28&&s.details.length===3));
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.city&&j.summary.length>38&&j.requirements.length>60&&j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')));
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&Array.isArray(j.editorialRelatedMajors)&&j.currentOpenVerified===false));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,n,'Duplicated jobs '+id);
 assert.equal(p.media.photos.length,2);
 const slots=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(slots).size,3);
 for(const f of slots)assert(existsSync('public/'+f)&&statSync('public/'+f).size>450,'Missing actual image '+f);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert.equal(audit.company,name);
 assert.equal(audit.officialLogo,false);
 const photos=p.media.photos;
 assert(photos.every(x=>x.note&&x.caption&&x.alt));
 if(i==='066'){
   assert(p.jobs.some(x=>x.id==='international-trainee'&&x.title.includes('2024—2026')));
   assert(p.jobs.some(x=>x.recruitmentType==='SOCIAL'));
 }
 if(i==='067'){
   assert(photos.every(x=>x.path.endsWith('.svg')&&x.note.includes('非')),'No unverified Hongxiang office photo claims');
   assert.equal(p.recruitment.status,'archived_source');
 }
 if(i==='068'){
   const quota=p.jobs.reduce((acc,j)=>acc+Number(j.title.match(/计划(\d+)人/)?.[1]||0),0);
   assert.equal(quota,340);
   assert.equal(p.jobs.length,10);
   assert(p.jobs.every(x=>x.recruitmentType==='CAMPUS'));
 }
 const mediaSource='public/images/employer-profiles/'+id+'/media-sources.json';
 if(i!=='067')assert(existsSync(mediaSource),'No image provenance produced for '+id);
 console.log('HHBA_ENTERPRISE_066_068_PASS',id,name,n);
}
console.log('HHBA_ENTERPRISE_066_068_TOTAL_PASS',JSON.stringify({companies:3,roles:19,businessCards:18,images:9}));
