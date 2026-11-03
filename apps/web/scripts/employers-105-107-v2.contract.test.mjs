import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';

const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const regex=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(regex&&new RegExp(regex).test('cn-autumn-105')&&new RegExp(regex).test('cn-autumn-107'),'All 3 companies require four-block V2 route');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Existing four-block layout must remain');
assert(page.includes('if(batch3756)return job.category===major'),'Major selection must narrow to specific related role categories');
assert(page.includes('sourceReviewedBatch&&<a href={job.evidenceUrl}')&&page.includes('data-hhba-recruitment-outbound="true"'),'Expose original evidence through same safe external navigation');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];
const stats={'105':5,'106':4,'107':18};
for(const [num,name] of [['105','中国融通集团'],['106','中国信达'],['107','晶晨半导体']]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Numbered company order must match original roster');
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,stats[num]);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,stats[num],'No duplicated role IDs');
 assert.equal(p.business.length,6);
 assert(p.business.every(b=>b.title&&b.description.length>=25&&b.details.length===3));
 assert(p.jobs.every(j=>j.title&&j.city&&j.summary.length>=40&&j.requirements.length>=40&&j.category));
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>0));
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')));
 assert.equal(p.media.photos.length,2);
 const paths=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(paths).size,3);
 for(const file of paths)assert(existsSync('public/'+file)&&statSync('public/'+file).size>250,'Missing review image: '+file);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);
 assert.equal(audit.commercialUsageApproved,false);
 assert.equal(audit.brand.approvedToPublishAsCorporateLogo,false);
 assert(audit.photos.every(x=>x.status==='nonreal_svg_placeholder'&&x.commercialUsageApproved===false));
 assert(p.media.photos.every(x=>x.note.includes('非实景')),'Editorial photos must be visibly marked');
 const search=searchEmployersByIndividualRoles([p],name,{knownMajors:['软件工程','计算机科学与技术','金融学']});
 assert.equal(search.length,1,'Company must appear in unified search');
 assert.equal(search[0].jobs.length,p.jobs.length,'Company-name search must not lose role records');
 if(num==='105'){
  assert(p.overview.includes('第三方')&&p.recruitment.status==='unconfirmed','Do not imply third-party roles are officially verified');
  assert(p.recruitment.note.includes('2026-10-30'),'2027 fall campaign expired');
  assert(p.jobs.every(j=>/wondercv\.com|upcv\.tech/.test(j.evidenceUrl)),'All 5 roles must disclose third-party provenance');
  assert(p.jobs.every(j=>j.recruitmentSubject.includes('尚未核实')),'Hiring legal entity uncertainty must be visible');
 }
 if(num==='106'){
  assert(p.jobs.every(j=>j.title.includes('非独立职位ID')),'2027 official recruitment category is not an independently bookable vacancy');
  assert(p.jobs.every(j=>j.evidenceUrl.includes('cinda.com.cn')));
  assert(p.recruitment.note.includes('2026-10-31'),'Cinda October 31 deadline must be preserved');
  assert(p.overview.includes('22家分公司'));
 }
 if(num==='107'){
  assert(p.jobs.every(j=>/^j\d{5}$/.test(j.id)),'Use Amlogic independent official Beisen J IDs');
  assert(p.jobs.every(j=>j.evidenceUrl==='https://amlogicsh.zhiye.com/campus/jobs'),'Every chip job must have the official job list evidence');
  assert(p.jobs.some(j=>j.id==='j11733'&&j.city.includes('上海')));
  assert(p.jobs.some(j=>j.id==='j11700'&&j.city.includes('深圳')));
  assert(p.jobs.some(j=>j.id==='j11699'&&j.city.includes('成都')));
  assert(p.recruitment.note.includes('2026-11-03')&&!p.recruitment.note.includes('仍可投递18条'));
 }
 profiles.push(p);
 console.log('HHBA_EMPLOYERS_105_107_COMPANY_PASS',num,name,p.jobs.length);
}
for(const major of ['计算机科学与技术','软件工程','金融学','微电子科学与工程','人力资源管理']){
 const results=searchEmployersByIndividualRoles(profiles,major,{knownMajors:['计算机科学与技术','软件工程','金融学','微电子科学与工程','人力资源管理']});
 assert(results.every(x=>x.jobs.every(j=>matchesJobMajor(j,major))),'Exclude unrelated roles for '+major);
}
assert(searchEmployersByIndividualRoles(profiles,'微电子科学与工程',{knownMajors:['微电子科学与工程']}).some(r=>r.profile.id==='cn-autumn-107'));
assert(searchEmployersByIndividualRoles(profiles,'金融学',{knownMajors:['金融学']}).some(r=>r.profile.id==='cn-autumn-106'));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'));
console.log('HHBA_105_107_BATCH_PASS',JSON.stringify({companies:3,rows:27,sourceConfirmedOfficialIndividualAmlogic:18,officialCindaCategoriesOnly:4,thirdPartyRongtongPending:5,liveOpenVerified:0,unifiedSearch:true,majorSpecific:true}));
