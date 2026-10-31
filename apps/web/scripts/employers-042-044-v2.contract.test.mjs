import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const all=['042','043','044'].map(id=>JSON.parse(read('src/data/employerProfiles/cn-autumn-'+id+'.json')));
const counts=[7,3,10];
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(page.includes("const batch4244=['cn-autumn-042','cn-autumn-043','cn-autumn-044'].includes(id)"),'Existing four-panel page must be reused');
assert(page.includes('if(minieye||batch4244)return job.category===major'),'Per-category click filters exact job subset');
assert(page.includes('j.category===g.label'),'Chip counts must match role categories');
assert(page.includes('batchGroups'),'Groups must be derived from company jobs');
assert(page.includes('hhba-kpmg-photo-grid'),'Two separate images must render at top');
assert(page.includes('站内岗位详情')&&page.includes('data-hhba-recruitment-outbound="true"'),'Internal JD route and auth intercept');
for(const x of ['适合哪些专业背景？','招聘岗位','主要业务与专业服务'])assert(page.includes(x));
for(let i=0;i<3;i++){
 const p=all[i],id=String(42+i).padStart(3,'0');
 assert.equal(p.id,'cn-autumn-'+id);
 assert.equal(p.jobs.length,counts[i],'Real evidenced job count '+p.name);
 assert.equal(p.business.length,6,'Six concrete business panels '+p.name);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,counts[i]);
 assert(p.jobs.every(j=>j.currentOpenVerified===false),'No unsupported claim of live hiring');
 assert(p.jobs.every(j=>j.title&&j.city&&j.summary.length>=24&&j.requirements.length>=45));
 assert(p.jobs.every(j=>j.majorNames.length>0&&j.evidenceUrl.startsWith('https://')&&j.url.startsWith('https://')));
 assert(new Set(p.jobs.map(j=>j.category)).size>=3);
 const paths=[p.media.logo,...p.media.photos.map(photo=>photo.path)];
 assert.equal(new Set(paths).size,3);
 for(const path of paths){assert(fs.existsSync('public/'+path),'Actual local image missing '+path);assert(fs.statSync('public/'+path).size>1800);}
 const audit=JSON.parse(read('public/images/employer-profiles/cn-autumn-'+id+'/media-audit.json'));
 assert.deepEqual(Object.keys(audit).sort(),['logo.png','photo1.jpg','photo2.jpg']);
 assert(Object.values(audit).every(x=>x.verified&&x.company===p.name&&x.sourceSha256&&x.sha256&&x.source.startsWith('https://')));
 assert.equal(new Set(Object.values(audit).map(x=>x.sourceSha256)).size,3);
 assert(p.media.photos.every(x=>x.caption&&x.note&&x.alt));
 assert(p.media.photos.every(x=>/产品|技术|业务|机器人|视觉|案例|产品家族|平台/.test(x.note)||/产品|技术|案例|机器人|平台/.test(x.caption)));
 console.log('HHBA_FOUR_PANEL_'+id+'_PASS',JSON.stringify({company:p.name,roles:p.jobs.length,categories:new Set(p.jobs.map(x=>x.category)).size,photos:2,business:p.business.length}));
}
assert(all[0].jobs.some(j=>j.title==='智能制造实施顾问'&&j.majorNames.includes('机械工程')),'Mechanics should get only related manufacturing roles');
assert(all[1].jobs.every(j=>j.requirements.includes('官方')||j.requirements.includes('二级')),'3 positions are summaries, never fabricated JDs');
assert(all[1].jobs.every(j=>!j.currentOpenVerified),'Old 2025 career page does not prove realtime');
assert(all[2].jobs.some(j=>j.title==='机械工程师'&&j.majorNames.includes('机械工程')));
console.log('HHBA_042_043_044_TOTAL_OK',all.reduce((n,p)=>n+p.jobs.length,0),'jobs, 18 business cards, 9 authenticated media');
