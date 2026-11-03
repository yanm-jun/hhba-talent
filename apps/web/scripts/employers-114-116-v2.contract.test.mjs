import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=x=>readFileSync(x,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const regex=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(regex&&new RegExp(regex).test('cn-autumn-114')&&new RegExp(regex).test('cn-autumn-116'),'Current branch must render three employers in original V2 four-block layout');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'No company layout redesign');
assert(page.includes('if(batch3756)return job.category===major'),'Selected majors must restrict individual role categories');
assert(page.includes('reviewSourceBatch&&<a href={job.evidenceUrl}')&&page.includes('data-hhba-recruitment-outbound="true"'),'Expose original evidence with outbound guard');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];const counts={'114':16,'115':5,'116':17};
for(const [num,name] of [['114','索恩格电动'],['115','胜帮科技'],['116','恒神股份']]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Employer ID and canonical name mismatch');
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,counts[num]);assert.equal(new Set(p.jobs.map(j=>j.id)).size,p.jobs.length,'Duplicate job keys');
 assert.equal(p.business.length,6);
 assert(p.business.every(j=>j.title&&j.description.length>=26&&j.details.length===3),'Missing six business blocks');
 assert(p.jobs.every(j=>j.title&&j.city&&j.category&&j.summary.length>=44&&j.requirements.length>=42),'Job descriptions or requirements missing');
 assert(p.jobs.every(j=>j.currentOpenVerified===false),'No unverified real-time job availability');
 assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')));
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>=1),'Search should have individual majors');
 assert.equal(p.media.photos.length,2);
 const media=[p.media.logo,...p.media.photos.map(j=>j.path)];
 assert.equal(new Set(media).size,3);
 for(const item of media)assert(existsSync('public/'+item)&&statSync('public/'+item).size>450,'Missing company picture: '+item);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert.equal(audit.commercialReuseRightsVerified,false);
 assert(audit.photos.length===2&&audit.photos.every(im=>im.status==='nonreal_svg_placeholder'&&!im.authenticCorporatePremisesPhotoDisplayed&&!im.permissionVerified));
 assert(p.media.photos.every(im=>im.path.endsWith('.svg')&&im.note.includes('非实景')),'No photo passed as genuine without rights');
 const hits=searchEmployersByIndividualRoles([p],name,{knownMajors:['机械工程','化学工程与工艺','高分子材料与工程']});
 assert.equal(hits.length,1,'Employer must appear in existing global search');
 assert.equal(hits[0].jobs.length,p.jobs.length,'Employer name search must retain all evidence records');
 if(num==='114'){
  assert(p.jobs.every(j=>j.evidenceClass==='third_party_named_direction'),'FASTEL official independent job IDs are unverified');
  assert(p.jobs.every(j=>j.evidenceUrl.includes('upcv.tech/xiaozhao/')));
  assert(p.jobs.some(j=>j.id==='ai'&&j.city==='常州'),'AI application single city from original table');
  assert(p.jobs.some(j=>j.id==='mechanical'&&j.city.includes('长沙、常州')));
  assert(p.recruitment.note.includes('2026-10-31')&&p.recruitment.status==='unconfirmed');
  assert(p.overview.includes('索恩格汽车部件'),'Distinct SEG Chinese company cannot be mixed in');
 }
 if(num==='115'){
  assert(p.jobs.every(j=>j.evidenceClass==='job_level_school_or_recruiter'));
  assert(p.jobs.every(j=>/gaoxiaojob.com\/job\/detail\/\d+/.test(j.evidenceUrl)),'Five detailed job records each have specific source');
  assert(p.jobs.filter(j=>j.city.includes('上海')).length===3&&p.jobs.filter(j=>j.city.includes('湖州')).length===2);
  assert(p.jobs.some(j=>j.id==='electro-operator'&&j.educationLabel.includes('大专')));
  assert(p.jobs.some(j=>j.id==='process'&&j.educationLabel.includes('3人')));
  assert(p.recruitment.note.includes('12人')&&p.recruitment.note.includes('2026-10-31'));
 }
 if(num==='116'){
  assert(p.jobs.filter(j=>j.evidenceClass==='school_individual_job').length===1);
  assert(p.jobs.filter(j=>j.evidenceClass==='thirdparty_named_direction').length===16);
  assert(p.jobs.find(j=>j.id==='materials').evidenceUrl.includes('job.tiangong.edu.cn'));
  assert(p.jobs.some(j=>j.id==='carbon')&&p.jobs.some(j=>j.id==='prepreg'));
  assert(p.recruitment.note.includes('2026-10-31')&&p.recruitment.note.includes('2026-12-31')&&p.recruitment.note.includes('65人'),'Two independent recruitment campaigns must remain distinct');
  assert(p.sources.some(u=>u.includes('469137564389376')),'Different 2026 social recruitment link must remain');
 }
 profiles.push(p);
 console.log('HHBA_EMPLOYER_114_116_SOURCE_PASS',num,name,p.jobs.length);
}
const majors=['机械工程','电气工程及其自动化','软件工程','人工智能','化学工程与工艺','高分子材料与工程','供应链管理'];
for(const m of majors){
 const result=searchEmployersByIndividualRoles(profiles,m,{knownMajors:majors});
 assert(result.every(x=>x.jobs.every(j=>matchesJobMajor(j,m))),'Only related role results must show for '+m);
}
assert(searchEmployersByIndividualRoles(profiles,'机械工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-114'));
assert(searchEmployersByIndividualRoles(profiles,'化学工程与工艺',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-115'));
assert(searchEmployersByIndividualRoles(profiles,'高分子材料与工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-116'));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'));
console.log('HHBA_114_116_BATCH_PASS',JSON.stringify({companies:3,records:38,independentJobEvidence:6,announcedJobDirections:32,realTimeOpenVerified:0,distinct2026SocialCampaign:true}));
