import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=x=>readFileSync(x,'utf8');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const component=read('src/pages/UnifiedV2CompanyPage.tsx');
const regex=component.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(regex&&new RegExp(regex).test('cn-autumn-093')&&new RegExp(regex).test('cn-autumn-095'));
assert(component.includes('hhba-kpmg-photo-grid')&&component.includes('hhba-kpmg-service-grid'),'Maintain original four blocks');
assert(component.includes('if(batch3756)return job.category===major'),'Major chips must filter individual role categories');
const companies=[];
for(const [num,name,count] of [['093','中国华能',12],['094','中国大唐集团',10],['095','广发银行',3]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name);
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.business.length,6);assert(p.business.every(s=>s.details.length===3&&s.description.length>=30));
 assert.equal(p.jobs.length,count);assert.equal(new Set(p.jobs.map(x=>x.id)).size,count);
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.url===p.recruitment.url&&j.evidenceUrl.startsWith('https://')));
 assert(p.jobs.every(j=>j.title&&j.city&&j.summary.length>40&&j.requirements.length>48&&j.editorialRelatedMajors.length>=2));
 assert(p.jobs.every(j=>j.majorNames.length===0&&(num==='095'||!j.majorUnrestricted)));
 assert.equal(p.media.photos.length,2);
 assert.equal(new Set([p.media.logo,...p.media.photos.map(photo=>photo.path)]).size,3);
 for(const path of [p.media.logo,...p.media.photos.map(j=>j.path)])
  assert(existsSync('public/'+path)&&statSync('public/'+path).size>400,'Missing image/brand asset: '+path);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert.equal(audit.photos.length,2);assert.equal(audit.commercialRightsVerified,false);
 for(const photo of audit.photos){
  assert(photo.imageUrl.startsWith('https://')&&photo.articleUrl.startsWith('https://'));
  const displayed=p.media.photos[photo.slot-1];
  if(photo.status==='source_picture_verified'){
   assert(displayed.path.endsWith(photo.filename)&&photo.sha256&&photo.dimensions[0]>=450);
  }else{
   assert(displayed.path.endsWith('.svg')&&displayed.note.includes('非实景'),'Fallback cannot claim to be a real photo');
  }
 }
 const found=searchEmployersByIndividualRoles([p],name,{knownMajors:['电气工程及其自动化','金融学']});
 assert.equal(found.length,1,'Employer missing from unified search: '+name);
 assert.equal(found[0].jobs.length,count,'Company name search must expose source records');
 if(num==='093'){
  assert(p.jobs.every(j=>!j.title.includes('非具体JD')));
  assert(p.recruitment.note.includes('已截止'));
  assert(p.jobs.some(j=>j.title.includes('风电运维')));
  assert(p.jobs.some(j=>j.title.includes('审计管理')));
 }
 if(num==='094'){
  assert(p.jobs.every(j=>!j.title.includes('非具体JD')));
  assert(p.jobs.some(j=>j.title.includes('软件工程师')));
  assert(p.jobs.some(j=>j.title.includes('交互设计师')));
  assert(p.jobs.every(j=>j.evidenceUrl.includes('nankai.edu.cn')));
  assert(p.recruitment.note.includes('2026-10-31'));
 }
 if(num==='095'){
  assert(p.jobs.every(j=>!j.title.includes('非具体JD')));
  assert(p.jobs.some(j=>j.title.includes('金融科技')));
  assert(p.jobs.some(j=>j.title.includes('法律与风险管理')));
  assert(p.jobs.every(j=>j.evidenceUrl.includes('ncss.cn')));
  assert(p.recruitment.note.includes('2026-11-15'));
 }
 companies.push(p);
 console.log('HHBA_093_095_PASS',num,name,count,audit.sourcedImages);
}
const electrical=searchEmployersByIndividualRoles(companies,'电气工程及其自动化',{knownMajors:['电气工程及其自动化']});
assert(electrical.some(c=>c.profile.id==='cn-autumn-093'));
assert(electrical.some(c=>c.profile.id==='cn-autumn-094'));
assert(electrical.every(c=>c.jobs.every(j=>matchesJobMajor(j,'电气工程及其自动化'))));
const finance=searchEmployersByIndividualRoles(companies,'金融学',{knownMajors:['金融学']});
assert(finance.some(c=>c.profile.id==='cn-autumn-095'));
assert(finance.every(c=>c.jobs.every(j=>matchesJobMajor(j,'金融学'))));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'),'New data must auto-register');
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'),'All new roles must join common market');
console.log('HHBA_EMPLOYERS_093_095_BATCH_PASS',JSON.stringify({employers:3,verifiedNamedHistorical:22,publicPlatformRoleRecords:3,recordCount:25,marketSearch:true,majorFilter:true,liveJobCountVerified:0}));
