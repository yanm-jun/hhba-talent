import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles} from '../src/services/employerJobSearch.mjs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const regex=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(regex&&new RegExp(regex).test('cn-autumn-087')&&new RegExp(regex).test('cn-autumn-089'),'Four-block V2 must include current batch');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Approved 4-block layout cannot change');
assert(page.includes('if(batch3756)return job.category===major'),'Professional tabs must filter only matching job category');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const found=[];
let jobCount=0;
for(const [num,name,count] of [['087','嘉士伯',3],['088','森马',20],['089','无限极',2]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Roster order mismatch');
 assert.equal(p.name,name);assert.equal(p.id,id);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,count);assert.equal(p.business.length,6);
 assert.equal(p.media.photos.length,2);
 assert(p.business.every(b=>b.title&&b.description.length>=40&&b.details.length===3));
 assert(p.jobs.every(j=>j.id&&j.category&&j.title&&j.city&&j.summary.length>65&&j.requirements.length>95));
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.evidenceUrl.startsWith('https://')));
 assert(p.jobs.every(j=>j.url===p.recruitment.url&&j.majorNames.length===0&&j.editorialRelatedMajors.length>0));
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,count);
 assert.equal(new Set([p.media.logo,...p.media.photos.map(j=>j.path)]).size,3);
 for(const photo of [p.media.logo,...p.media.photos.map(j=>j.path)])
  assert(existsSync('public/'+photo)&&statSync('public/'+photo).size>400,'Missing logo/photo '+photo);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert.equal(audit.slots.length,2);
 for(const item of audit.slots){
  assert(item.sourceImageUrl.startsWith('https://')&&item.sourceWebPage.startsWith('https://'));
  assert(item.rightsVerified===false,'Never imply photo commercial license');
  const shown=p.media.photos[item.slot-1];
  if(item.status==='verified_source_image'){
   assert(item.sha256&&item.pixels[0]>=480&&item.pixels[1]>=270&&item.filename);
   assert(shown.path.endsWith(item.filename)&&existsSync('public/images/employer-profiles/'+id+'/'+item.filename),'Audited photo is not displayed');
  }else assert(shown.path.endsWith('.svg')&&shown.note.includes('非实景'),'Failed download must remain clearly non-real');
 }
 const search=searchEmployersByIndividualRoles([p],name,{knownMajors:['机械工程','视觉传达设计']});
 assert.equal(search.length,1,'Employer name search returned zero results: '+name);
 assert.equal(search[0].jobs.length,count,'Employer name search missed jobs for '+name);
 assert.equal(search[0].profile.id,id);
 found.push(p);jobCount+=count;
 if(num==='087'){
  assert(p.jobs.some(j=>j.title.includes('供应链')&&j.editorialRelatedMajors.includes('机械工程')));
  assert(p.recruitment.note.includes('2026-10-31'));
  assert(p.jobs.every(j=>j.requirements.includes('截止')));
 }
 if(num==='088'){
  assert.equal(p.jobs.filter(j=>j.city.includes('温州')).length,10);
  assert.equal(p.jobs.filter(j=>j.city.includes('上海')).length,8);
  assert.equal(p.jobs.filter(j=>j.city.includes('杭州')).length,2);
  assert(p.jobs.some(j=>j.title.includes('电商设计师')&&j.evidenceUrl.includes('wzu.edu.cn')));
  assert(p.jobs.some(j=>j.title.includes('童装设计师')&&j.city==='上海'));
  assert(p.jobs.every(j=>j.requirements.includes('Moka')||j.requirements.includes('JD')));
 }
 if(num==='089'){
  assert(p.jobs.some(j=>j.title.includes('科研极优生')));
  assert(p.jobs.some(j=>j.title.includes('大业务极优生')));
  assert(p.recruitment.note.includes('10月31日'));
 }
 console.log('HHBA_087_089_COMPANY_SEARCH_PASS',id,name,count,audit.sourcedPhotos,'verified-source photos');
}
const mech=searchEmployersByIndividualRoles(found,'机械工程',{knownMajors:['机械工程']});
assert(mech.some(x=>x.profile.id==='cn-autumn-087'&&x.jobs.some(j=>j.id==='supply-2027')),'Manufacturing role invisible to mechanical major');
assert(mech.every(x=>x.jobs.every(j=>j.editorialRelatedMajors.some(m=>m.includes('机械')))),'Major filter must not return unrelated company-wide jobs');
const design=searchEmployersByIndividualRoles(found,'视觉传达设计',{knownMajors:['视觉传达设计']});
assert(design.some(x=>x.profile.id==='cn-autumn-088'&&x.jobs.some(j=>j.id==='wz-visual')),'Semir design role missing from major search');
assert(design.every(x=>x.jobs.length<x.profile.jobs.length),'Design search must not return all company jobs');
const service=read('src/services/domesticRebuildJobs.ts'),market=read('src/components/UnifiedJobMarket.tsx');
assert(service.includes('employerProfiles.flatMap'),'Profile JSON must be included in job market registry');
assert(market.includes('<V2EmployerSearchResults'),'Job-market page must render employer search integration');
console.log('HHBA_087_089_BATCH_PASS',JSON.stringify({companies:3,jobs:jobCount,business:18,employerSearch:true,jobLevelMajorSearch:true}));
