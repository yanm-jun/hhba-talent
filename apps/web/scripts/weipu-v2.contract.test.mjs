import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const p=JSON.parse(read('src/data/employerProfiles/cn-autumn-032.json'));
assert.equal(p.id,'cn-autumn-032');
assert.equal(p.name,'微谱');
assert.equal(p.displayName,'微谱集团');
assert.equal(p.jobs.length,10);
assert.equal(p.business.length,6);
assert.equal(p.media.photos.length,2);
assert(p.aliases.includes('上海微谱检测科技集团股份有限公司'));
assert(p.recruitment.url==='https://weipugroup.zhiye.com/campus/jobs');
const imagePaths=[p.media.logo,...p.media.photos.map(photo=>photo.path)];
assert.equal(new Set(imagePaths).size,3);
for(const image of imagePaths)assert(existsSync('public/'+image),'Missing local WEIPU media: '+image);
const page=read('src/pages/UnifiedV2CompanyPage.tsx'),css=read('src/styles/unified-v2-company.css');
assert(page.includes("weipu=id==='cn-autumn-032'"));
assert(page.includes('weipuGroups')&&page.includes('showcase?6:'));
assert(page.includes('适合哪些专业背景？')&&page.includes('招聘岗位'));
assert(page.includes('data-hhba-recruitment-outbound="true"'));
assert(css.includes('.hhba-v2-showcase .hhba-kpmg-service-grid{grid-template-columns:repeat(3'));
assert(css.includes('.hhba-v2-showcase .hhba-v2-company-role-grid{grid-template-columns:repeat(2'));
const byTitle=t=>p.jobs.find(j=>j.title.includes(t));
for(const pair of [['技术管培生',['机械工程','车辆工程']],['AIBP',['人工智能','计算机科学与技术']],['质量管培生',['质量管理工程']],['财务管培生',['会计学']]]){
 const job=byTitle(pair[0]);assert(job,'Missing sourced role '+pair[0]);
 for(const major of pair[1])assert(job.editorialRelatedMajors.includes(major));
}
assert(!byTitle('AIBP').editorialRelatedMajors.includes('机械工程'),'AI cannot be marked mechanical');
assert(!byTitle('技术管培生').editorialRelatedMajors.includes('会计学'),'Mechanical cannot match accounting');
assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.url===p.recruitment.url&&j.evidenceUrl.startsWith('https://')));
const auditPath='public/images/employer-profiles/cn-autumn-032/media-audit.json';
const audit=JSON.parse(read(auditPath));
assert.deepEqual(Object.keys(audit).sort(),['logo.webp','photo1.jpg','photo2.jpg']);
assert(audit['logo.webp'].verified,'User-approved Logo lost');
assert(audit['photo1.jpg'].verified&&audit['photo2.jpg'].verified,'WEIPU requires 2 real verified source photos, not placeholders');
assert.notEqual(audit['photo1.jpg'].sha256,audit['photo2.jpg'].sha256);
console.log('WEIPU_032_V2_CONTRACT_OK',JSON.stringify({jobs:p.jobs.length,services:p.business.length,photos:2,template:'screenshot-approved',majorFilter:true}));

/* Screenshot regression: enough descriptive content, no browser-default link row */
assert(page.includes('hhba-v2-weipu-education'));
assert(page.includes('hhba-v2-weipu-description'));
assert(page.includes('hhba-v2-weipu-location'));
assert(page.includes('{showcase&&!detailedCards&&'),'Only compact legacy 031 shows persistent role links');
assert(page.includes('detailedCards=weipu||bodor'),'Both 032 and 033 require links inside expanded requirements');
assert(page.includes('{detailedCards&&<div className="hhba-v2-weipu-detail-links"'),'Only expanded details expose employer links for 032 and 033');
assert(css.includes('.hhba-v2-weipu .hhba-v2-company-role details summary'));
assert(css.includes('.hhba-v2-qizheng-role-actions a{'));
assert(p.jobs.every(j=>j.summary.length>=50),'WEIPU roles need detailed, individual explanations');
