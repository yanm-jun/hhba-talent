import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8');
const profiles=['048','049','050'].map(id=>JSON.parse(read('src/data/employerProfiles/cn-autumn-'+id+'.json')));
const expected=[['元力股份',1],['红谱科技',4],['汇蓉国科',6]];
const ui=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(ui.includes("const batch4850=['cn-autumn-048','cn-autumn-049','cn-autumn-050'].includes(id)"),'No new layout: reuse original V2');
assert(ui.includes('if(minieye||batch4850)return job.category===major'),'Exact category matching');
assert(ui.includes('j.category===g.label'),'Category counts');
assert(ui.includes('hhba-kpmg-photo-grid'),'Header contains two separate company images');
assert(ui.includes('站内岗位详情')&&ui.includes('data-hhba-recruitment-outbound="true"'));
for(const title of ['适合哪些专业背景？','招聘岗位','主要业务与专业服务'])assert(ui.includes(title),'Required standard section: '+title);
for (const [i,p] of profiles.entries()){
 const id=String(48+i).padStart(3,'0');
 assert.equal(p.id,'cn-autumn-'+id);
 assert.equal(p.name,expected[i][0]);
 assert.equal(p.jobs.length,expected[i][1]);
 assert.equal(p.business.length,6);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,expected[i][1]);
 assert(p.jobs.every(j=>j.currentOpenVerified===false));
 assert(p.jobs.every(j=>j.title&&j.city&&j.summary.length>=28&&j.requirements.length>=55),'Meaningful evidenced role text without padding unpublished job requirements');
 assert(p.jobs.every(j=>j.evidenceUrl.startsWith('https://')&&j.url===p.recruitment.url));
 assert(p.jobs.every(j=>j.majorNames.length>0&&j.educationLabel));
 const paths=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(paths).size,3,'Need logo and two separate images');
 for(const path of paths)assert(fs.existsSync('public/'+path)&&fs.statSync('public/'+path).size>2500,'Missing local media '+path);
 const audit=JSON.parse(read('public/images/employer-profiles/cn-autumn-'+id+'/media-audit.json'));
 assert.deepEqual(Object.keys(audit).sort(),['logo.png','photo1.jpg','photo2.jpg']);
 assert(Object.values(audit).every(x=>x.company===p.name&&x.sha256));
 for(const [n,d] of Object.entries(audit)){
  const payload=fs.readFileSync('public/images/employer-profiles/cn-autumn-'+id+'/'+n);
  assert.equal(crypto.createHash('sha256').update(payload).digest('hex'),d.sha256,'Hash mismatch '+id+'/'+n);
 }
 assert(audit['photo1.jpg'].verified&&audit['photo2.jpg'].verified,'Do not fabricate photos');
 assert.notEqual(audit['photo1.jpg'].sourceSha256,audit['photo2.jpg'].sourceSha256,'Photo must not be duplicated');
 if(audit['logo.png'].editorialFallback)assert(p.photoNote.includes('非企业官方Logo'),'Editorial graphic clearly disclosed to visitors');
 else assert(audit['logo.png'].verified,'Real logo must be sourced');
 console.log('HHBA_'+id+'_V2_FOUR_PANELS_VERIFIED',p.jobs.length,'jobs',p.business.length,'services',paths.length,'images');
}
assert(profiles[0].jobs.length===1,'Yuanli has exactly one evidenced 2027 reserve specialist position');
assert(profiles[1].jobs.length===4,'Hongpu source only describes 4 categories, no fabricated detailed JDs');
const huiMedia=JSON.parse(read('public/images/employer-profiles/cn-autumn-050/media-audit.json'));
assert(huiMedia['photo1.jpg'].width/huiMedia['photo1.jpg'].height<3.6,'No Tianfu chamber website header pretending to be Huirong company photo');
assert(!huiMedia['photo1.jpg'].source.includes('20230726/c0624d61'),'Visually rejected chamber logo must not be reused');
assert(profiles[2].jobs.length===6&&profiles[2].jobs.every(j=>j.evidenceUrl.includes('job.xidian.edu.cn')),'6 university verified radar roles');
assert(profiles[2].jobs.filter(j=>j.educationLabel.includes('本科')).length===2,'Two undergraduate positions must be accurate');
console.log('HHBA_048_049_050_11_ROLES_18_BUSINESS_SECTIONS_9_MEDIA_PASS');
