import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=path=>readFileSync(path,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const pattern=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(pattern&&new RegExp(pattern).test('cn-autumn-102')&&new RegExp(pattern).test('cn-autumn-104'),'New companies must reuse approved four-block layout');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Retain company image and 6-business blocks');
assert(page.includes('if(batch3756)return job.category===major'),'Specialty selection must filter individual role categories');
assert(page.includes('reviewSources&&<a href={job.evidenceUrl}')&&page.includes('data-hhba-recruitment-outbound="true"'),'Expose individual original vacancy evidence while respecting login gate');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];
for(const [num,name,count] of [['102','陕煤集团',2],['103','浙江省交通集团',13],['104','湖南钢铁集团',5]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(r=>r.id===id)?.name,name,'Fixed 156-name master order changed: '+id);
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,count);assert.equal(new Set(p.jobs.map(j=>j.id)).size,count);
 assert.equal(p.business.length,6);
 assert(p.business.every(b=>b.title&&b.description.length>22&&b.details.length===3),'Incomplete business content');
 assert(p.jobs.every(j=>j.title&&j.city&&j.category&&j.summary.length>45&&j.requirements.length>50),'Missing role descriptions');
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.url===p.recruitment.url&&j.evidenceUrl.startsWith('https://')),'Reject fake live openings and unapproved outbound URLs');
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>=1),'Specialties require individual position evidence');
 assert.equal(p.media.photos.length,2);
 const media=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(media).size,3,'Company images must not silently repeat same asset');
 for(const src of media)assert(existsSync('public/'+src)&&statSync('public/'+src).size>400,'Missing asset '+src);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);
 assert.equal(audit.commercialReuseRightsVerified,false);
 assert(audit.photos.length===2&&audit.photos.every(a=>a.status==='nonreal_svg_placeholder'&&!a.licenceVerified));
 assert(p.media.photos.every(q=>q.path.endsWith('.svg')&&q.note.includes('非实景')),'Unlicensed pictures must stay visibly non-real');
 const r=searchEmployersByIndividualRoles([p],name,{knownMajors:['电气工程及其自动化','计算机科学与技术']});
 assert.equal(r.length,1,'Employer unavailable in unified job search: '+name);
 assert.equal(r[0].jobs.length,count,'Employer search lost job data: '+name);
 if(num==='102'){
  assert(p.jobs.some(j=>j.id==='mt-function'&&j.title.includes('职能管理岗')));
  assert(p.jobs.some(j=>j.id==='mt-technology'&&j.title.includes('技术管理岗')));
  assert(p.recruitment.note.includes('2026-11-30')&&p.recruitment.note.includes('2026-10-31'));
  assert(p.jobs.every(j=>j.evidenceUrl.includes('1429903')),'Both independent positions must come from official special recruitment');
 }
 if(num==='103'){
  assert(p.jobs.every(j=>j.recruitmentSubject.includes('浙江交工')));
  assert(p.jobs.every(j=>j.evidenceUrl.includes('djdzp.cn/a/236')),'Not a fake group-wide vacancy');
  assert(p.jobs.some(j=>j.id==='fullstack'&&j.title.includes('全栈工程师')));
  assert(p.jobs.some(j=>j.id==='financial'&&j.city.includes('北京')));
 }
 if(num==='104'){
  assert.equal(p.recruitment.status,'unconfirmed','Group home must not be misrepresented as unified application portal');
  assert(p.jobs.filter(j=>j.recruitmentSubject.includes('衡阳华菱')).length===4);
  assert(p.jobs.filter(j=>j.recruitmentSubject.includes('湘潭钢铁')).length===1);
  assert(p.recruitment.note.includes('2026-11-20'));
  assert(p.jobs.some(j=>j.title.includes('材料工程师')));
 }
 profiles.push(p);
 console.log('HHBA_EMPLOYER_102_104_SEARCH_PASS',num,name,count);
}
for(const major of ['机械工程','电气工程及其自动化','计算机科学与技术','会计学','法学']){
 const hits=searchEmployersByIndividualRoles(profiles,major,{knownMajors:['机械工程','电气工程及其自动化','计算机科学与技术','会计学','法学']});
 assert(hits.every(h=>h.jobs.every(j=>matchesJobMajor(j,major))),'No extra company-wide roles for '+major);
}
assert(searchEmployersByIndividualRoles(profiles,'计算机科学与技术',{knownMajors:['计算机科学与技术']}).some(x=>x.profile.id==='cn-autumn-103'),'Zhejiang full stack job missing');
assert(searchEmployersByIndividualRoles(profiles,'电气工程及其自动化',{knownMajors:['电气工程及其自动化']}).some(x=>x.profile.id==='cn-autumn-104'),'Hunan electrical engineer missing');
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'),'Automatic Vite approved profile intake required');
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'),'Jobs must join old shared job market');
console.log('HHBA_EMPLOYERS_102_104_BATCH_PASS',JSON.stringify({companies:3,positionRecords:20,specific2027:true,sourceBacked:true,majorOnlyRelevantRoles:true,currentOpenVerified:0,priorModulesUntouched:true}));
