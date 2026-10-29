import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const data=JSON.parse(readFileSync('src/data/domesticSchneiderDetailedDossier20261029.json','utf8'));
const registry=JSON.parse(readFileSync('src/data/domesticAutumnAiScenes.json','utf8')).entries;
const companies=JSON.parse(readFileSync('src/data/domesticAutumnScreenshot20261028.json','utf8')).entries;
const page=readFileSync('src/pages/SchneiderCompactProfilePage.tsx','utf8');
const main=readFileSync('src/main.tsx','utf8');
const logo=JSON.parse(readFileSync('src/data/domesticAutumnBrandMediaRegistry.json','utf8')).entries['施耐德电气'];
assert.equal(companies.length,156);
assert.equal(companies.find(x=>x.id==='cn-autumn-002')?.name,'施耐德电气');
assert.equal(data.id,'cn-autumn-002');
assert.equal(data.jobs.length,12,'12 separate official concrete vacancies');
assert.equal(data.services.length,8);
assert.equal(data.imagePaths.length,2);
assert.equal(new Set(data.imagePaths).size,2);
assert.equal(registry['cn-autumn-002'].length,2);
assert.equal(logo.path,'images/autumn-real-logos/cn-autumn-002.svg');
assert(logo.source.includes('Schneider_Electric_2007.svg'));
assert.equal(logo.sourceType,'wikimedia_build_import');
for(const p of data.imagePaths){
 assert(p.startsWith('images/autumn-ai-scenes/cn-autumn-002-'));
 assert(existsSync('public/'+p),'Independent AVIF must exist in GitHub source');
 assert(statSync('public/'+p).size>15000,'No tiny placeholders or collage slicing');
}
const jobIDs=new Set(),cities=new Set();
for(const job of data.jobs){
 assert(/^\d{6}$/.test(job.id));
 assert(!jobIDs.has(job.id),'No duplicate jobs');
 jobIDs.add(job.id);
 cities.add(job.city);
 const u=new URL(job.url);
 assert.equal(u.host,'careers.se.com');
 assert.equal(u.pathname,'/jobs/'+job.id);
 assert(job.summary.length>12);
 assert(job.majorSlugs.length>=1);
}
assert(cities.size>=3,'Jobs should show distinct grounded cities');
assert(data.majors.length>=12);
assert(main.includes("if(route==='/companies/autumn/cn-autumn-002')return <SchneiderCompactProfilePage user={user}/>"));
const heads=['适合哪些专业背景？','招聘岗位与职业机会','主要业务与专业服务'];
assert(heads.map(s=>page.indexOf(s)).every((pos,i,arr)=>pos>0&&(i===0||pos>arr[i-1])),'Only 4 blocks in exact user order');
for(const forbidden of ['信息来源','发展与重要节点','关于企业','官网来源']) assert(!page.includes(forbidden));
assert(page.indexOf('<AutumnCompanyBrand name="施耐德电气" large/>')<page.indexOf('<div className="hhba-kpmg-photo-grid">'));
assert(page.includes('setMajor(item.name)')&&page.includes('filtered=selected.id')&&page.includes('filter(job=>job.majorSlugs.includes(selected.id))'),'Professional selection actually filters job links');
assert(page.includes('data-hhba-recruitment-outbound="true"'),'Retain login protection on outgoing careers');
assert(page.includes('showAllServices?schneider.services.length:4')&&page.includes('<details>'),'Compact expandable services');
assert(page.includes('AI 场景示意'));
console.log('SCHNEIDER_4_BLOCKS_12_OFFICIAL_JOB_DETAILS_2_INDEPENDENT_AI_IMAGES_AND_LOGO_OK');
