import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const ids=['054','055','056'],names=['海程邦达','长隆科技','维音'],jobCount=[1,5,2];
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(page.includes("const batch3756=/^cn-autumn-")&&page.includes("06[0-2])$/.test(id)"),"V2 template covers all existing batches");
assert(page.includes('if(batch3756)return job.category===major'),'Exact role category filters');
assert(page.includes('j.category===g.label'),'Job group counts');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'2-photo panel and business panels');
assert(page.includes('站内岗位详情')&&page.includes('data-hhba-recruitment-outbound="true"'),'Job detail and auth gate');
for(const section of ['适合哪些专业背景？','招聘岗位','主要业务与专业服务'])assert(page.includes(section));
for(let i=0;i<3;i++){
 const id='cn-autumn-'+ids[i],p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(p.id,id);assert.equal(p.name,names[i]);
 assert.equal(p.jobs.length,jobCount[i]);assert.equal(p.business.length,6);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,p.jobs.length);
 assert(p.jobs.every(j=>j.title&&j.summary.length>25&&j.requirements.length>=50&&j.city&&j.category&&j.majorNames.length>=2));
 assert(p.jobs.every(j=>j.currentOpenVerified===false&&j.recruitmentType==='CAMPUS'),'No fake real-time openings');
 assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://')&&j.url===p.recruitment.url));
 assert(p.jobs.every(j=>/2027/.test(j.title)),'2027 direction only, not old 2026 standalone listing');
 const images=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(images.length,3);assert.equal(new Set(images).size,3);
 for(const img of images)assert(existsSync('public/'+img)&&statSync('public/'+img).size>1800,'Missing company image: '+img);
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert.deepEqual(Object.keys(audit).sort(),['logo.png','photo1.jpg','photo2.jpg']);
 assert.equal(new Set(Object.values(audit).map(x=>x.sourceSha256)).size,3);
 for(const [filename,e] of Object.entries(audit)){
  const bytes=readFileSync('public/images/employer-profiles/'+id+'/'+filename);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),e.sha256);
  assert.equal(e.company,p.name);
  if(e.editorialFallback)assert(/非企业官方|非官方/.test(p.photoNote),'Do not pass off editorial nameplate as official corporate trademark');
 }
 assert(audit['photo1.jpg'].verified&&audit['photo2.jpg'].verified);
 if(ids[i]==='055'){
   assert(!audit['logo.png'].source.includes('res.gys.cn'),'Do not use supplier website logo');
   assert(!audit['photo1.jpg'].source.includes('1f5e3fc61d084513b684e016ba6b1071.jpg'),'No recruitment QR code as company photo');
 }
 if(ids[i]==='056'){
   assert(!audit['photo1.jpg'].source.includes('CgAGbGXlrn6AXw5fAABm4izI2Vw692.png'),'No WhatsApp/WeChat QR code as company photo');
   assert(audit['photo1.jpg'].sourcePage.includes('vxichina.cn/AboutStd_1070.html'),'Only official Xian operation centre photo');
 }

 if(ids[i]==='054')assert.equal(p.jobs.length,1,'No speculative 2027 overseas officer roles');
 if(ids[i]==='055')assert(p.industry.includes('环保水处理')&&!p.industry.includes('文旅'),'Not Chimelong tourist attractions');
 if(ids[i]==='056')assert(p.jobs.every(x=>x.educationLabel.includes('未披露')),'Do not fabricate a published degree condition');
 console.log('HHBA_054_056_COMPANY_OK',id,p.name,p.jobs.length,'jobs 6 business 3 media');
}
console.log('HHBA_054_056_TOTAL_PASS: 8 sourced 2027 recruitment entries, 18 business blocks, 9 independent media');
