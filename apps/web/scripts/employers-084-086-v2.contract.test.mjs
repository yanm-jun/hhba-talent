import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles} from '../src/services/employerJobSearch.mjs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const routeRange=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(routeRange&&new RegExp(routeRange).test('cn-autumn-084')&&new RegExp(routeRange).test('cn-autumn-086'));
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Approved four-block company structure must remain');
assert(page.includes('if(batch3756)return job.category===major'),'Professional category button must filter matching roles only');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];let total=0,sourced=0;
for(const [num,name,expected] of [['084','卡夫亨氏',3],['085','汉高',11],['086','利洁时',5]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Incorrect original employer position');
 assert.equal(p.name,name);assert.equal(p.id,id);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,expected);assert.equal(p.business.length,6);
 assert(p.business.every(x=>x.title&&x.description.length>32&&x.details.length===3));
 assert(p.jobs.every(x=>x.title&&x.category&&x.city&&x.summary.length>50&&x.requirements.length>100));
 assert(p.jobs.every(x=>x.majorNames.length===0&&x.editorialRelatedMajors.length>0&&x.currentOpenVerified===false));
 assert(p.jobs.every(x=>x.url===p.recruitment.url&&x.evidenceUrl.startsWith('https://')));
 assert.equal(new Set(p.jobs.map(x=>x.id)).size,expected);
 assert.equal(new Set(p.jobs.map(x=>x.category)).size,expected,'Each project category should support individual professional chips');
 assert.equal(p.media.photos.length,2);
 const media=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(media).size,3);
 for(const f of media)assert(existsSync('public/'+f)&&statSync('public/'+f).size>=450,'Missing independent media file '+f);
 const doc=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(doc.companyId,num);assert.equal(doc.images.length,2);
 assert(doc.commercialReuseRightsVerified===false);
 for(const m of doc.images){
  const photo=p.media.photos[m.slot-1];
  assert(m.url.startsWith('https://')&&m.article.startsWith('https://'));
  if(m.status==='sourced_documentary_photo'){
   sourced++;
   assert(photo.path.endsWith(m.file)&&m.sha256&&m.pixels[0]>=520&&m.pixels[1]>=300);
   assert(existsSync('public/images/employer-profiles/'+id+'/'+m.file),'Verified photo not packaged');
  }else assert(photo.path.endsWith('.svg')&&photo.note.includes('非实景'),'Unverified images must never pass as photographs');
 }
 if(num==='084'){
  assert(p.jobs.every(x=>x.requirements.includes('2026年10月31日')||x.requirements.includes('10月31日')),'Closed 2027 application must be disclosed');
  assert(p.jobs.some(x=>x.id==='manufacturing-global'&&x.title.includes('生产制造')));
 }
 if(num==='085'){
  assert(p.jobs.length===11);
  assert(p.jobs.some(x=>x.id==='adhesive-plant'&&x.city==='广州'&&x.requirements.includes('机械')));
  assert(p.jobs.some(x=>x.id==='digital-business'&&x.city==='上海'));
  assert(p.jobs.some(x=>x.id==='consumer-sales'&&x.requirements.includes('非艺术生')));
  assert(p.recruitment.note.includes('2026-10-31'));
 }
 if(num==='086'){
  assert(p.jobs.some(x=>x.id==='supply-nextgen'&&x.city.includes('青岛')&&x.requirements.includes('本科')));
  assert(p.jobs.some(x=>x.id==='rd-leadership'&&x.requirements.includes('硕士')));
  assert(p.recruitment.note.includes('10-31'));
 }
 profiles.push(p);total+=p.jobs.length;
 const companyHits=searchEmployersByIndividualRoles([p],name,{knownMajors:['机械工程']});
 assert.equal(companyHits.length,1,'Company-name search lost '+name);
 assert.equal(companyHits[0].jobs.length,expected,'Some company role was lost in search '+name);
 assert.equal(companyHits[0].profile.id,id);
 console.log('HHBA_084_086_EMPLOYER_SEARCH_PASS',id,name,expected);
}
const results=searchEmployersByIndividualRoles(profiles,'机械工程',{knownMajors:['机械工程']});
assert(results.length>=2,'Mechanical major must find relevant manufacturing employers');
assert(results.every(x=>x.jobs.every(j=>j.editorialRelatedMajors.some(m=>m.includes('机械')))),
 'Search must match relevant individual job, not display the entire unrelated employer list');
const market=read('src/services/domesticRebuildJobs.ts');
assert(market.includes('...employerProfiles.flatMap')||market.includes('employerProfiles.flatMap'),'New profile data must enter job market records');
const searchUI=read('src/components/UnifiedJobMarket.tsx');
assert(searchUI.includes('<V2EmployerSearchResults'),'Main recruitment search must actually include employer V2 search UI');
console.log('HHBA_084_086_BATCH_PASS',JSON.stringify({employers:3,roleRecords:total,businessCards:18,sourcedPhotos:sourced,companySearchVerified:true}));
