import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=p=>readFileSync(p,'utf8');
const source=read('src/pages/UnifiedV2CompanyPage.tsx');
const regex=source.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(regex&&new RegExp(regex).test('cn-autumn-096')&&new RegExp(regex).test('cn-autumn-098'),'Four-block V2 route must include all new companies');
assert(source.includes('hhba-kpmg-photo-grid')&&source.includes('hhba-kpmg-service-grid'),'Approved original four-block layout required');
assert(source.includes('if(batch3756)return job.category===major'),'Professional chips must filter specific jobs');
assert(source.includes('href={job.url||p.recruitment.url}'),'Official role links must be independent; avoid pointing all jobs at generic portals');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const companies=[],counts={'096':5,'097':3,'098':8};
for(const [num,name] of [['096','宁波银行'],['097','汇丰中国'],['098','CASETiFY']]){
 const id='cn-autumn-'+num;
 const p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Company ordering and legal identity must match master screenshot');
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,counts[num]);assert.equal(p.business.length,6);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,p.jobs.length,'Individual role IDs must be unique');
 assert(p.jobs.every(j=>j.title&&j.category&&j.city&&j.summary.length>=50&&j.requirements.length>=50));
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.evidenceUrl.startsWith('https://')));
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>=2));
 assert(p.jobs.every(j=>new URL(j.url).host===new URL(p.recruitment.url).host),'Official links must belong to allowed ATS host');
 assert(p.business.every(b=>b.title&&b.description.length>=30&&b.details.length===3),'Business blocks must not be empty');
 assert.equal(p.media.photos.length,2);
 assert.equal(new Set([p.media.logo,...p.media.photos.map(x=>x.path)]).size,3);
 for(const a of [p.media.logo,...p.media.photos.map(x=>x.path)])assert(existsSync('public/'+a)&&statSync('public/'+a).size>100,'Missing asset '+a);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert(audit.photos.every(x=>x.status==='nonreal_svg_placeholder'));
 assert.equal(audit.commercialRightsVerified,false,'Do not imply sourced real photographs were authorized');
 assert(p.media.photos.every(x=>x.note.includes('非实景')),'Editor placeholder must be labelled non-real');
 const r=searchEmployersByIndividualRoles([p],name,{knownMajors:['计算机科学与技术','市场营销']});
 assert.equal(r.length,1,'Company must appear in the common search');
 assert.equal(r[0].jobs.length,p.jobs.length,'Company-name search must not drop job records');
 if(num==='096'){
  assert(p.recruitment.note.includes('2026-10-31'),'Ningbo fall deadline required');
  assert(p.jobs.some(j=>j.title.includes('金融科技定向生')));
  assert(p.jobs.every(j=>j.url===p.recruitment.url),'Ningbo lacks independently verified post links; use general portal');
 }
 if(num==='097'){
  assert(p.jobs.every(j=>j.evidenceUrl.includes('apply.careers.hsbc.com')));
  assert(p.jobs.every(j=>j.url===j.evidenceUrl),'HSBC must link to exact official post');
  assert(p.jobs.some(j=>j.city.includes('西安')));
  assert(p.recruitment.note.includes('2026-12-31'));
 }
 if(num==='098'){
  assert(p.jobs.every(j=>j.url===j.evidenceUrl));
  assert(p.jobs.every(j=>/greenhouse.io\/casetify\/jobs\/\d+/.test(j.url)));
  assert(p.jobs.some(j=>j.id==='mt-2027'&&j.requirements.includes('31 October 2026')));
  assert(p.jobs.some(j=>j.id==='tiktok')&&j.city==='深圳');
 }
 companies.push(p);
 console.log('HHBA_COMPANY_096_098_SEARCH_PASS',num,name,p.jobs.length);
}
const tech=searchEmployersByIndividualRoles(companies,'计算机科学与技术',{knownMajors:['计算机科学与技术']});
assert(tech.some(x=>x.profile.id==='cn-autumn-096'));
assert(tech.some(x=>x.profile.id==='cn-autumn-097'));
assert(tech.every(x=>x.jobs.every(j=>matchesJobMajor(j,'计算机科学与技术'))),'Professional query should not return unrelated jobs');
const marketing=searchEmployersByIndividualRoles(companies,'市场营销',{knownMajors:['市场营销']});
assert(marketing.some(x=>x.profile.id==='cn-autumn-098'));
assert(marketing.every(x=>x.jobs.every(j=>matchesJobMajor(j,'市场营销'))));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'),'New profiles must auto-register');
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'),'Profile positions must enter same job market');
console.log('HHBA_096_098_BATCH_PASS',JSON.stringify({companies:3,records:16,perCompany:counts,verifiedLiveApplicationCount:0,search:true,majorFilter:true,outboundExactSource:true}));
