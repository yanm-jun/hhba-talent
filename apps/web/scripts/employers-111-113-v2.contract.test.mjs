import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=x=>readFileSync(x,'utf8');
const ui=read('src/pages/UnifiedV2CompanyPage.tsx');
const source=ui.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(source&&new RegExp(source).test('cn-autumn-111')&&new RegExp(source).test('cn-autumn-113'),'111–113 must enter same approved V2 route');
assert(ui.includes('hhba-kpmg-photo-grid')&&ui.includes('hhba-kpmg-service-grid'),'Preserve fixed four blocks');
assert(ui.includes('if(batch3756)return job.category===major'),'Major filter only returns job category');
assert(ui.includes('reviewSourceBatch&&<a href={job.evidenceUrl}')&&ui.includes('data-hhba-recruitment-outbound="true"'),'Original evidence link preserves existing login gating');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];const counts={'111':20,'112':6,'113':2};
for(const [num,name] of [['111','钱江摩托'],['112','舒客电商'],['113','AIA Digital+']]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Company numbering must match canonical roster');
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,counts[num]);assert.equal(new Set(p.jobs.map(x=>x.id)).size,p.jobs.length);
 assert.equal(p.business.length,6,'6 genuine industry business descriptions required');
 assert(p.business.every(b=>b.title&&b.description.length>=22&&b.details.length===3));
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.city&&j.summary.length>=40&&j.requirements.length>=35));
 assert(p.jobs.every(j=>j.currentOpenVerified===false),'No fake realtime active vacancies');
 assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')),'No invented URLs');
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>=1));
 assert.equal(p.media.photos.length,2);
 const assets=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(assets).size,3,'Do not repeat media slots');
 for(const x of assets)assert(existsSync('public/'+x)&&statSync('public/'+x).size>400,'Missing media '+x);
 const manifest=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(manifest.companyId,num);
 assert.equal(manifest.commercialReuseRightsVerified,false);
 assert(manifest.photos.length===2&&manifest.photos.every(x=>x.status==='nonreal_svg_fallback'&&!x.realImageDisplayed&&!x.copyrightPermissionVerified));
 assert(p.media.photos.every(x=>x.note.includes('非实景')),'All imagery must be conspicuously marked non-real');
 const hits=searchEmployersByIndividualRoles([p],name,{knownMajors:['机械工程','电子商务','人工智能']});
 assert.equal(hits.length,1,'Employer absent from unified global search');
 assert.equal(hits[0].jobs.length,p.jobs.length,'Employer name search loses records');
 if(num==='111'){
  assert.equal(p.jobs.filter(j=>j.evidenceClass==='school_individual_historic').length,2,'QJM has two separate WZU job listings');
  assert.equal(p.jobs.filter(j=>j.evidenceClass==='public_direction').length,18,'QJM remaining 18 directions cannot count as verified openings');
  assert(p.jobs.some(j=>j.title.startsWith('三电开发工程师')&&j.city.includes('温岭')));
  assert(p.jobs.some(j=>j.title.startsWith('研发设计工程师')&&j.city.includes('温岭')));
  assert(p.recruitment.note.includes('2026-10-31'),'Expired original application cutoff must be clear');
  assert(p.jobs.filter(j=>j.evidenceClass==='school_individual_historic').every(j=>j.evidenceUrl.includes('job.wzu.edu.cn')));
 }
 if(num==='112'){
  assert(p.jobs.every(j=>j.evidenceClass==='official_individual_listing'&&j.evidenceUrl.includes('tianzhulingshan.jobs.feishu.cn')));
  assert(p.jobs.some(j=>j.id==='ecomm'&&j.summary.includes('并非五条另外招聘的职位')));
  assert(p.jobs.some(j=>j.id==='graphic'));
  assert(p.recruitment.url.includes('jobs.feishu.cn'));
 }
 if(num==='113'){
  assert(p.jobs.every(j=>j.evidenceClass==='thirdparty_announcement_direction'),'AIA 2027 campus job IDs unverified');
  assert(p.jobs.every(j=>j.title.includes('官方职位ID待核')),'Do not imply two AIA official direct links');
  assert(p.recruitment.status==='unconfirmed');
  assert(p.jobs.some(j=>j.id==='fullstack')&&p.jobs.some(j=>j.id==='algorithm'));
  assert(p.recruitment.note.includes('2026-10-31'));
 }
 profiles.push(p);
 console.log('HHBA_111_113_INDIVIDUAL_COMPANY_PASS',num,name,p.jobs.length);
}
const majors=['机械工程','电气工程及其自动化','电子商务','广播电视编导','人工智能','计算机科学与技术'];
for(const major of majors){
 const hits=searchEmployersByIndividualRoles(profiles,major,{knownMajors:majors});
 assert(hits.every(h=>h.jobs.every(j=>matchesJobMajor(j,major))),'Unrelated jobs exposed for '+major);
}
assert(searchEmployersByIndividualRoles(profiles,'机械工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-111'));
assert(searchEmployersByIndividualRoles(profiles,'电子商务',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-112'));
assert(searchEmployersByIndividualRoles(profiles,'人工智能',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-113'));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'));
console.log('HHBA_111_113_BATCH_PASS',JSON.stringify({companies:3,displayRecords:28,documentedIndividualHistory:8,announcedDirectionsOnly:20,realTimeConfirmed:0,majorSearch:true}));
