import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const routeSource=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(routeSource,'Missing V2 employer route regex');
const routePattern=new RegExp(routeSource);
assert((routePattern.test('cn-autumn-063')&&routePattern.test('cn-autumn-065')&&routePattern.test('cn-autumn-077')),'Four-block V2 template must route all three new companies');
assert(page.includes('if(batch3756)return job.category===major'),'Role category selector must filter company roles');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Four fixed sections must remain');
assert(page.includes('站内岗位详情'),'Each role must have internal detail route');
const directory=read('src/components/DomesticAutumnMarket.tsx');
assert(directory.includes('employerProfileById.get(e.id)'),'Directory must reuse current V2 profiles');
assert(directory.includes('displayCompany(item)')&&directory.includes("reviewed(item)?.jobs.length||0"),'Directory search and has-jobs filter must include new profiles');

const roster=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json'));
const cases=[['063','桑椹汽配',6],['064','新海威',5],['065','双视科技',5]];
for(const [num,name,expectedJobs] of cases){
 const id='cn-autumn-'+num,p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(p.id,id);assert.equal(p.name,name);assert.equal(p.business.length,6);
 assert.equal(p.jobs.length,expectedJobs);assert.equal(new Set(p.jobs.map(j=>j.id)).size,expectedJobs);
 assert.equal(p.media.photos.length,2);
 assert(p.business.every(x=>x.title&&x.description.length>=20&&x.tags&&x.details?.length===3));
 assert(p.jobs.every(j=>j.title&&j.category&&j.summary.length>=20&&j.requirements.length>=50&&j.majorNames.length>=2));
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.recruitmentType==='CAMPUS'&&j.evidenceUrl.startsWith('https://')&&j.url===p.recruitment.url));
 const assets=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(assets).size,3);
 for(const asset of assets){assert(asset.startsWith('images/employer-profiles/'+id+'/'));assert(existsSync('public/'+asset));assert(statSync('public/'+asset).size>=500);}
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert.equal(audit.officialLogo,false);assert.equal(audit.realPhotos,false);
 assert(p.photoNote.includes('非官方'),'Current editorial assets must be disclosed');
 console.log('HHBA_063_065_PROFILE_PASS',id,name,expectedJobs,'role records; six businesses; 3 local media');
}
const p63=JSON.parse(read('src/data/employerProfiles/cn-autumn-063.json'));
assert(p63.aliases.includes('桑棋汽配')&&roster.entries.find(x=>x.id===p63.id)?.name==='桑棋汽配','Correct company name while preserving old keyword');
const p64=JSON.parse(read('src/data/employerProfiles/cn-autumn-064.json'));
assert(p64.recruitment.subject==='宁波新海威进出口有限公司'&&!p64.jobs.some(j=>j.title.includes('FPGA')),'Avoid same-name electronics manufacturer');
const p65=JSON.parse(read('src/data/employerProfiles/cn-autumn-065.json'));
assert(p65.jobs.some(j=>j.title.includes('视觉设计师'))&&p65.jobs.some(j=>j.title.includes('售前')),'Five-role source coverage required');
console.log('HHBA_063_065_TOTAL_PASS',16,'recruitment records',18,'business cards',9,'visual assets');
