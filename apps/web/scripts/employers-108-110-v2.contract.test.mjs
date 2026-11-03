import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const route=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(route&&new RegExp(route).test('cn-autumn-108')&&new RegExp(route).test('cn-autumn-110'),'Employer pages 108–110 must reuse approved four-block V2');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Do not replace original four block sections');
assert(page.includes('if(batch3756)return job.category===major'),'Major chips must filter specific job categories');
assert(page.includes('reviewEvidenceBatch&&<a href={job.evidenceUrl}')&&page.includes('data-hhba-recruitment-outbound="true"'),'Original source links must follow outbound protection');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];
const expected={108:15,109:24,110:16};
for(const [num,name] of [['108','复旦微电子'],['109','金发科技'],['110','远光软件']]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(x=>x.id===id)?.name,name,'Original master order must remain intact');
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,expected[num]);assert.equal(new Set(p.jobs.map(j=>j.id)).size,p.jobs.length,'No duplicate job direction keys');
 assert.equal(p.business.length,6);
 assert(p.business.every(b=>b.title&&b.description.length>=25&&b.details.length===3),'Business section missing');
 assert(p.jobs.every(j=>j.title&&j.category&&j.city&&j.summary.length>=30&&j.requirements.length>=32),'Job summary or requirements missing');
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>=1),'Professional search requires job-level majors');
 assert(p.jobs.every(j=>j.currentOpenVerified===false),'Never imply confirmed realtime vacancies');
 assert(p.jobs.every(j=>j.url.startsWith('https://')&&j.evidenceUrl.startsWith('https://')));
 assert.equal(p.media.photos.length,2);
 const assets=[p.media.logo,...p.media.photos.map(j=>j.path)];
 assert.equal(new Set(assets).size,3);
 for(const asset of assets)assert(existsSync('public/'+asset)&&statSync('public/'+asset).size>400,'Missing labelled image: '+asset);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert.equal(audit.commercialReuseRightsVerified,false);
 assert(audit.photos.every(j=>j.status==='nonreal_svg_review_placeholder'&&!j.realPremisesPhotoDisplayed));
 assert(p.media.photos.every(j=>j.note.includes('非实景')),'No unlicensed real photo passed off as company image');
 const nameMatches=searchEmployersByIndividualRoles([p],name,{knownMajors:['软件工程','材料科学与工程']});
 assert.equal(nameMatches.length,1,'Company-name search must find employer');
 assert.equal(nameMatches[0].jobs.length,p.jobs.length,'Company-name search must preserve all job records');
 if(num==='108'){
  assert(p.jobs.every(j=>j.evidenceUrl.includes('job.xidian.edu.cn/campus/')),'2027 detailed JD from official school');
  assert(p.jobs.some(j=>j.title==='AI编译器工程师'));
  assert(p.jobs.some(j=>j.title==='WEB工程师'));
  assert(p.recruitment.note.includes('2026-10-31'),'Fudan 2027 autumn deadline visible');
 }
 if(num==='109'){
  assert(p.jobs.every(j=>j.evidenceUrl.includes('jdjywpt.jlu.edu.cn')),'All Kingfa named records from exact 2027 job table');
  assert(p.jobs.some(j=>j.title==='IT系统工程师'));
  assert(p.jobs.some(j=>j.title==='供应链管理储干'));
  assert(p.jobs.some(j=>j.city.includes('海外')),'International optional city groups must retain provenance');
 }
 if(num==='110'){
  assert(p.jobs.filter(j=>!j.title.includes('公告方向')).length===1,'Only FDE is an independent specific JD; do not inflate vacancy count');
  assert(p.jobs.some(j=>j.id==='fde'&&j.evidenceUrl.includes('jiuye.xtu.edu.cn')));
  assert(p.jobs.filter(j=>j.title.includes('公告方向')).length===15);
  assert(p.recruitment.note.includes('2026-10-30'));
 }
 profiles.push(p);console.log('HHBA_108_110_PROFILE_PASS',num,p.name,p.jobs.length);
}
const majors=['软件工程','微电子科学与工程','计算机科学与技术','材料科学与工程','机械工程','供应链管理','电气工程及其自动化'];
for(const m of majors){
 const results=searchEmployersByIndividualRoles(profiles,m,{knownMajors:majors});
 assert(results.every(r=>r.jobs.every(j=>matchesJobMajor(j,m))),'Major '+m+' incorrectly shows unrelated jobs');
}
assert(searchEmployersByIndividualRoles(profiles,'材料科学与工程',{knownMajors:majors}).some(r=>r.profile.id==='cn-autumn-109'));
assert(searchEmployersByIndividualRoles(profiles,'微电子科学与工程',{knownMajors:majors}).some(r=>r.profile.id==='cn-autumn-108'));
assert(searchEmployersByIndividualRoles(profiles,'软件工程',{knownMajors:majors}).some(r=>r.profile.id==='cn-autumn-110'));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'));
console.log('HHBA_EMPLOYERS_108_110_PASS',JSON.stringify({companies:3,jobOrDirectionRecords:55,Fudan2027DetailedRoles:15,KingfaNamedDirections:24,YGIndependentJobs:1,YGNamedDirections:15,liveVacanciesVerified:0,majorSearch:true,staticRoutes:true}));
