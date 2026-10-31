import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=x=>readFileSync(x,'utf8');
const ids=['051','052','053'],names=['金中新材','宏川集团','兰石集团'],expected=[9,5,4];
const ui=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(ui.includes("const batch3753=/^cn-autumn-(?:03[7-9]|04[0-9]|05[0-3])$/.test(id)"),'Keep the SAME shared V2 template');
assert(ui.includes('if(batch3753)return job.category===major'),'Filter jobs by selected company category');
assert(ui.includes('j.category===g.label'),'Category count must reflect actual jobs');
assert(ui.includes('hhba-kpmg-photo-grid'),'Logo and 2 pictures panel retained');
assert(ui.includes('站内岗位详情')&&ui.includes('data-hhba-recruitment-outbound="true"'),'Job detail and official apply login gate retained');
for(const title of ['适合哪些专业背景？','招聘岗位','主要业务与专业服务'])assert(ui.includes(title),'Required fixed company section '+title);
let total=0;
for(let i=0;i<3;i++){
 const n=ids[i],p=JSON.parse(read('src/data/employerProfiles/cn-autumn-'+n+'.json'));
 assert.equal(p.name,names[i]);assert.equal(p.id,'cn-autumn-'+n);
 assert.equal(p.jobs.length,expected[i]);assert.equal(p.business.length,6);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,expected[i]);
 assert(p.jobs.every(j=>j.title&&j.city&&j.summary&&j.requirements&&j.educationLabel));
 assert(p.jobs.every(j=>j.majorNames.length>=1&&j.currentOpenVerified===false),'No invented live application');
 assert(p.jobs.every(j=>j.recruitmentType==='CAMPUS'),'Do not merge 2025 social posts into 2027 campuses');
 const portal=new URL(p.recruitment.url);
 for(const j of p.jobs){
  const u=new URL(j.url),e=new URL(j.evidenceUrl);
  assert.equal(u.protocol,'https:');assert.equal(e.protocol,'https:');
  assert.equal(portal.hostname,u.hostname,'Source URL same as approved recruitment portal');
  assert(!u.hash&&!u.port&&!u.username,'Unapproved ATS fragments/ports blocked');
 }
 const media=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(media.length,3);assert.equal(new Set(media).size,3);
 for(const file of media)assert(existsSync('public/'+file)&&statSync('public/'+file).size>2300,'Missing local image '+file);
 const audit=JSON.parse(read('public/images/employer-profiles/cn-autumn-'+n+'/media-audit.json'));
 assert.deepEqual(Object.keys(audit).sort(),['logo.png','photo1.jpg','photo2.jpg']);
 const images=Object.values(audit);assert.equal(new Set(images.map(v=>v.sourceSha256)).size,3);
 for(const [filename,v] of Object.entries(audit)){
  const bytes=readFileSync('public/images/employer-profiles/cn-autumn-'+n+'/'+filename);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 }
 assert(audit['photo1.jpg'].verified&&audit['photo2.jpg'].verified,'Both photos from known associated entities');
 if(audit['logo.png'].editorialFallback)assert(p.photoNote.includes('非企业官方')||p.photoNote.includes('禁止以'),'Text logo not official, disclosure required');
 if(n==='051'){
  assert(p.overview.includes('水泥')&&!p.overview.includes('高性能合金'),'Jinzhong is Jidong/Tianshan cement-backed, not fake metal-alloy enterprise');
  assert(p.recruitment.status==='unconfirmed','No official online ATS found');
 }
 if(n==='052')assert(p.jobs.every(j=>j.title.includes('方向')),'Only 5 confirmed direction categories, no fake specific JD');
 if(n==='053')assert(p.jobs.every(j=>j.title.includes('类')),'4 official recruitment groups, no invented individual positions');
 total+=p.jobs.length;
 console.log('HHBA_V2_0'+n+'_OK',p.name,'jobs',p.jobs.length,'images',3);
}
assert.equal(total,18);
console.log('HHBA_051_053_ALL_FOUR_PANEL_18_ROLE_DIRECTIONS_18_BUSINESS_9_MEDIA_VERIFIED');
