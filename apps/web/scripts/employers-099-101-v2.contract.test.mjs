import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';

const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const regex=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(regex&&new RegExp(regex).test('cn-autumn-099')&&new RegExp(regex).test('cn-autumn-101'),'New employers must be served by same V2 page');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Keep approved four blocks');
assert(page.includes('if(batch3756)return job.category===major'),'Selected majors filter individual job categories');
assert(page.includes('href={job.url||p.recruitment.url}')&&page.includes('data-hhba-recruitment-outbound="true"'),'Preserve role-specific source links and global login check');
const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const all=[];
const counts={'099':9,'100':16,'101':24};
for(const [num,name] of [['099','波士顿科学'],['100','东软'],['101','云天化集团']]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(roster.find(e=>e.id===id)?.name,name,'Roster numbering mismatch for '+id);
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.schemaVersion,1);
 assert.equal(p.jobs.length,counts[num]);
 assert.equal(new Set(p.jobs.map(x=>x.id)).size,p.jobs.length);
 assert.equal(p.business.length,6);
 assert(p.business.every(s=>s.title&&s.description.length>30&&s.details.length===3));
 assert(p.jobs.every(j=>j.id&&j.title&&j.category&&j.city&&j.summary.length>=35&&j.requirements.length>=38));
 assert(p.jobs.every(j=>Array.isArray(j.majorNames)&&j.majorNames.length===0&&j.editorialRelatedMajors.length>=1));
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')));
 assert(p.jobs.every(j=>new URL(j.url).host===new URL(p.recruitment.url).host),'Official role link uses unapproved host');
 assert.equal(p.media.photos.length,2);
 assert.equal(new Set([p.media.logo,...p.media.photos.map(x=>x.path)]).size,3);
 for(const file of [p.media.logo,...p.media.photos.map(x=>x.path)])assert(existsSync('public/'+file)&&statSync('public/'+file).size>400,'Missing image '+file);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert.equal(audit.photos.length,2);assert.equal(audit.commercialReuseRightsVerified,false);
 for(const im of audit.photos){
  assert(im.imageUrl.startsWith('https://')&&im.articleUrl.startsWith('https://'));
  const shown=p.media.photos[im.slot-1];
  if(im.status==='source_picture_verified'){
   assert(im.sha256&&im.dimensions[0]>=350&&shown.path.endsWith(im.filename),'Source image must be verified and displayed');
   assert(shown.note.includes('转载许可未完成审核'),'Historical photos may not be misrepresented as licensed');
  } else assert(shown.path.endsWith('.svg')&&shown.note.includes('非实景'),'Fallback must be clearly non-real');
 }
 const found=searchEmployersByIndividualRoles([p],name,{knownMajors:['软件工程','机械工程']});
 assert.equal(found.length,1,'Company must be searchable: '+name);
 assert.equal(found[0].jobs.length,p.jobs.length,'Company search should show all source rows for name');
 if(num==='099'){
  assert(p.jobs.every(j=>new URL(j.evidenceUrl).hostname==='jobs.bostonscientific.com'));
  assert(p.jobs.every(j=>j.url===j.evidenceUrl),'Use exact official Boston Scientific posting URL');
  assert(p.jobs.some(j=>j.id==='supplier-quality'&&j.requirements.includes('6年以上')));
 }
 if(num==='100'){
  assert(p.jobs.every(j=>j.evidenceUrl.includes('jlu.edu.cn')),'2027 campus specific job names must be traceable');
  assert(p.jobs.some(j=>j.title.includes('算法工程师')));
  assert(p.jobs.some(j=>j.title.includes('日语翻译')));
  assert(p.jobs.some(j=>j.title.includes('技术管培生')));
 }
 if(num==='101'){
  assert(p.jobs.every(j=>j.recruitmentSubject&&j.recruitmentSubject!=='云天化集团有限责任公司'));
  assert(p.jobs.some(j=>j.title.includes('化肥产品开发')));
  assert(p.jobs.some(j=>j.title.includes('数智化技术')));
  assert(p.recruitment.note.includes('2026-10-31'));
 }
 all.push(p);
 console.log('HHBA_099_101_COMPANY_SEARCH_PASS',num,p.name,p.jobs.length,audit.sourcedImages||0);
}
const majors=['软件工程','机械工程','电气工程及其自动化','化学工程与工艺','人工智能'];
for(const major of majors){
 const r=searchEmployersByIndividualRoles(all,major,{knownMajors:majors});
 assert(r.every(e=>e.jobs.every(j=>matchesJobMajor(j,major))),'Unrelated roles exposed for '+major);
}
assert(searchEmployersByIndividualRoles(all,'软件工程',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-100'),'Neusoft software results missing');
assert(searchEmployersByIndividualRoles(all,'电气工程及其自动化',{knownMajors:majors}).some(x=>x.profile.id==='cn-autumn-101'),'Yuntianhua electrical results missing');
assert(read('src/services/employerProfiles.ts').includes('import.meta.glob'));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'));
console.log('HHBA_EMPLOYERS_099_101_BATCH_PASS',JSON.stringify({companies:3,jobRecords:49,perCompany:counts,liveOpenVerified:0,search:true,roleMajorFilter:true,historyProvenance:true}));
