import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {searchEmployersByIndividualRoles,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const pattern=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(pattern&&new RegExp(pattern).test('cn-autumn-090')&&new RegExp(pattern).test('cn-autumn-092'),'The existing 4-block V2 route must cover 090–092');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Keep original enterprise media and service layout');
assert(page.includes('if(batch3756)return job.category===major'),'Professional selection must show only matching roles');
const index=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const companies=[];let records=0,sourcePictures=0;
for(const [num,name,count] of [['090','阅文集团',8],['091','虎牙',31],['092','爱奇艺重庆',3]]){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(index.find(x=>x.id===id)?.name,name,'Roster number not preserved');
 assert.equal(p.id,id);assert.equal(p.schemaVersion,1);assert.equal(p.name,name);
 assert.equal(p.jobs.length,count);assert.equal(p.business.length,6);
 assert(p.business.every(x=>x.title&&x.description.length>35&&x.details.length===3));
 assert(p.jobs.every(x=>x.id&&x.title&&x.category&&x.city&&x.summary.length>80&&x.requirements.length>90));
 assert(p.jobs.every(x=>x.url===p.recruitment.url&&x.evidenceUrl.startsWith('https://')&&x.currentOpenVerified===false));
 assert(p.jobs.every(x=>Array.isArray(x.majorNames)&&x.majorNames.length===0&&x.editorialRelatedMajors.length>=2));
 assert.equal(new Set(p.jobs.map(x=>x.id)).size,count);
 assert.equal(p.media.photos.length,2);
 const media=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(media).size,3);
 for(const path of media)assert(existsSync('public/'+path)&&statSync('public/'+path).size>400,'Missing logo or independent photograph '+path);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-sources.json'));
 assert.equal(audit.companyId,num);assert.equal(audit.photos.length,2);assert.equal(audit.commercialRightsVerified,false);
 for(const m of audit.photos){
  assert(m.imageUrl.startsWith('https://')&&m.articleUrl.startsWith('https://'));
  const shown=p.media.photos[m.slot-1];
  if(m.status==='source_picture_verified'){
   assert(m.sha256&&m.dimensions[0]>=350&&m.dimensions[1]>=280);
   assert(shown.path.endsWith(m.filename)&&existsSync('public/images/employer-profiles/'+id+'/'+m.filename));
   sourcePictures++;
  }else assert(shown.path.endsWith('.svg')&&shown.note.includes('非实景'),'Fallback needs non-real disclosure');
 }
 assert(audit.brand.sourceImageUrl.startsWith('https://'));
 const hit=searchEmployersByIndividualRoles([p],name,{knownMajors:['人工智能','新闻学']});
 assert.equal(hit.length,1,'Recruitment marketplace returned zero employers for '+name);
 assert.equal(hit[0].jobs.length,count,'Company name search failed to show all matching company jobs '+name);
 assert.equal(hit[0].profile.id,id);
 if(num==='090'){
   assert(p.jobs.some(j=>j.title.includes('衍生品产品企划')));
   assert(p.jobs.some(j=>j.title.includes('AI内容架构')));
   assert(p.recruitment.note.includes('2026-09-14'));
   assert(p.jobs.some(j=>j.title.includes('非具体JD')),'2027 category cannot be presented as named job');
 }
 if(num==='091'){
   assert(p.jobs.length===31);
   assert(p.jobs.some(j=>j.title.includes('SRE开发工程师')));
   assert(p.jobs.some(j=>j.title.includes('多模态视频生成算法工程师')));
   assert(p.jobs.some(j=>j.title.includes('AI视觉设计师')));
   assert(p.recruitment.note.includes('2026-10-31'));
 }
 if(num==='092'){
   assert.equal(new Set(p.jobs.map(j=>j.city)).size,1);
   assert(p.jobs.every(j=>j.title.includes('非具体JD')),'Chongqing only has published recruitment categories, not confirmed named roles');
   assert(p.jobs.every(j=>j.city.includes('重庆')));
   assert(!p.jobs.some(j=>j.title.includes('Java')));
 }
 companies.push(p);records+=count;
 console.log('HHBA_090_092_COMPANY_SEARCH_PASS',id,name,count,audit.photos.filter(x=>x.status==='source_picture_verified').length);
}
const ai=searchEmployersByIndividualRoles(companies,'人工智能',{knownMajors:['人工智能']});
assert(ai.some(x=>x.profile.id==='cn-autumn-091'&&x.jobs.some(j=>j.title.includes('大模型算法'))),'HUYA AI individual roles must be searchable');
assert(ai.every(x=>x.jobs.every(j=>matchesJobMajor(j,'人工智能'))),'Return only major-family related individual roles, not all company roles');
const news=searchEmployersByIndividualRoles(companies,'新闻学',{knownMajors:['新闻学']});
assert(news.some(x=>x.profile.id==='cn-autumn-092'&&x.jobs.some(j=>j.id==='audit')),'Chongqing content auditing must show for journalism');
assert(news.every(x=>x.jobs.every(j=>matchesJobMajor(j,'新闻学'))));
assert(read('src/services/domesticRebuildJobs.ts').includes('employerProfiles.flatMap'),'Profile JSON must be included in recruitment job records');
assert(read('src/components/UnifiedJobMarket.tsx').includes('<V2EmployerSearchResults'),'Recruitment market must render company results');
console.log('HHBA_090_092_BATCH_PASS',JSON.stringify({companies:3,jobOrDirectionRecords:records,business:18,sourcedImages:sourcePictures,companyNameSearch:true,majorExactFilter:true}));
