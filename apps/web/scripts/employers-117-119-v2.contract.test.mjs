import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=f=>readFileSync(f,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const expr=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(expr&&new RegExp(expr).test('cn-autumn-117')&&new RegExp(expr).test('cn-autumn-119'),'Must render 117-119 with existing four-block V2 template');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Existing four blocks must remain');
assert(page.includes('if(batch3756)return job.category===major'),'Select a major only shows related category roles');
assert(page.includes('evidencedBatch&&<a href={job.evidenceUrl}')&&page.includes('data-hhba-recruitment-outbound="true"'),'Source links must be visible and guarded');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const profiles=[];
for(const [num,name,count] of [['117','邦盛科技',9],['118','屹唐半导体',22],['119','飞骧科技',15]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(e=>e.id===id)?.name,name,'Canonical master numbering changed');
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,count);assert.equal(new Set(p.jobs.map(j=>j.id)).size,count);
 assert.equal(p.business.length,6);assert(p.business.every(b=>b.title&&b.description.length>=25&&b.details.length===3));
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.city&&j.summary.length>=40&&j.requirements.length>=44));
 assert(p.jobs.every(j=>j.currentOpenVerified===false),'No claims of unverified real-time open positions');
 assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')));
 assert(p.jobs.every(j=>j.majorNames.length===0&&j.editorialRelatedMajors.length>=1));
 assert.equal(p.media.photos.length,2);
 const assets=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(assets).size,3);
 for(const f of assets)assert(existsSync('public/'+f)&&statSync('public/'+f).size>400,'Media absent: '+f);
 const a=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(a.companyId,num);assert.equal(a.commercialImageUsageVerified,false);
 assert.equal(a.officialLogoPermissionVerified,false);
 assert(a.photos.length===2&&a.photos.every(im=>im.status==='nonreal_svg_placeholder'&&!im.actualWorkplacePhoto&&!im.commercialRightsVerified));
 assert(p.media.photos.every(im=>im.note.includes('非实景')),'Editorial photos cannot resemble authorized company workplace');
 const hits=searchEmployersByIndividualRoles([p],name,{knownMajors:['机械工程','软件工程','微电子科学与工程']});
 assert.equal(hits.length,1,'Company must appear in shared employer/role search');
 assert.equal(hits[0].jobs.length,count,'Company name should preserve every archived job row');
 if(num==='117'){
  assert(p.jobs.every(j=>j.evidenceClass==='thirdparty_named_direction'),'Bangsun 2027 directions are not independently verified JDs');
  assert(p.jobs.every(j=>j.evidenceUrl.includes('jdjianli.com/campus/51134')));
  assert(p.recruitment.status==='unconfirmed'&&p.recruitment.note.includes('2026-10-31'));
  assert(p.sources.some(q=>q.includes('job.hdu.edu.cn'))&&p.overview.includes('2026届'),'Older campus hiring may inform employer only, not 2027 vacancy');
 }
 if(num==='118'){
  assert.equal(p.jobs.filter(j=>j.evidenceClass==='official_job_page').length,2,'Only two verified independent company job URLs');
  assert.equal(p.jobs.filter(j=>j.evidenceClass==='university_named_job_table').length,19,'University has nineteen additional job rows');
  assert.equal(p.jobs.filter(j=>j.evidenceClass==='thirdparty_named_direction').length,1,'Materials role must remain separately graded');
  assert(p.jobs.filter(j=>j.evidenceClass==='official_job_page').every(j=>j.evidenceUrl.includes('bestsemi.zhiye.com/campus/detail')));
  assert(p.jobs.some(j=>j.id==='simulation'&&j.city.includes('不一致')),'Contradictory school cities must remain unresolved');
  assert(p.jobs.some(j=>j.id==='field-process'&&j.city.includes('深圳')));
  assert(p.recruitment.note.includes('2026-10-30'));
 }
 if(num==='119'){
  assert(p.jobs.every(j=>j.evidenceClass==='thirdparty_named_direction'),'Lansus 2027 summary is named directions not separate online applications');
  assert(p.jobs.every(j=>j.evidenceUrl.includes('upjianli.com/xiaozhao/')));
  assert(p.jobs.some(j=>j.id==='rf-ic')&&p.jobs.some(j=>j.id==='devops'));
  assert(p.recruitment.note.includes('2026-10-30'));
  assert(p.jobs.every(j=>j.city.includes('未逐岗位核实')));
 }
 profiles.push(p);
 console.log('HHBA_117_119_PER_EMPLOYER_PASS',num,name,count);
}
const majors=['软件工程','计算机科学与技术','机械工程','电气工程及其自动化','微电子科学与工程','人工智能','物流管理','会计学'];
for(const major of majors){
 const result=searchEmployersByIndividualRoles(profiles,major,{knownMajors:majors});
 assert(result.every(r=>r.jobs.every(j=>matchesJobMajor(j,major))),'Role-level major filtering regressed for '+major);
}
assert(searchEmployersByIndividualRoles(profiles,'软件工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-117'));
assert(searchEmployersByIndividualRoles(profiles,'机械工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-118'));
assert(searchEmployersByIndividualRoles(profiles,'微电子科学与工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-119'));
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'));
console.log('HHBA_EMPLOYERS_117_119_BATCH_PASS',JSON.stringify({companies:3,archivedDisplayRows:46,universityNamedJobs:21,companyDirectJobUrls:2,thirdPartyDirections:25,liveOpenVerified:0,search:true}));
