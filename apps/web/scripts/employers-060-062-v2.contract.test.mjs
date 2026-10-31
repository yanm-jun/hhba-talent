import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const ids=['060','061','062'];
const names=['云尖信息','美迈科技','厦门国资运'];
const counts=[10,8,2];
const page=read('src/pages/UnifiedV2CompanyPage.tsx');
const routeSource=page.split('const batch3756=/')[1]?.split('/.test(id)')[0];
assert(routeSource,'Missing V2 employer route regex');
const routePattern=new RegExp(routeSource);
assert((routePattern.test('cn-autumn-060')&&routePattern.test('cn-autumn-062')&&routePattern.test('cn-autumn-077')), 'New employer IDs must use existing four-panel renderer');
assert(page.includes('hhba-kpmg-photo-grid')&&page.includes('hhba-kpmg-service-grid'),'Original four-panel layout changed');
assert(page.includes('if(batch3756)return job.category===major'),'Category filtering missing');
assert(page.includes('站内岗位详情')&&page.includes('data-hhba-recruitment-outbound="true"'),'Job details and existing link gating missing');
for(let i=0;i<3;i++){
 const id='cn-autumn-'+ids[i],p=JSON.parse(read('src/data/employerProfiles/'+id+'.json'));
 assert.equal(p.id,id);assert.equal(p.name,names[i]);assert.equal(p.jobs.length,counts[i]);assert.equal(p.business.length,6);
 assert.equal(p.media.photos.length,2);assert.equal(new Set(p.jobs.map(j=>j.id)).size,counts[i]);
 assert(p.business.every(b=>b.title&&b.description.length>=20&&b.details.length===3));
 assert(p.jobs.every(j=>j.title&&j.summary.length>=20&&j.requirements.length>=50&&j.city&&j.category&&j.majorNames.length>=2));
 assert(p.jobs.every(j=>j.recruitmentType==='CAMPUS'&&j.currentOpenVerified===false));
 assert(p.jobs.every(j=>j.url===p.recruitment.url&&j.evidenceUrl.startsWith('https://')));
 const images=[p.media.logo,...p.media.photos.map(x=>x.path)];
 assert.equal(new Set(images).size,3);
 for(const image of images){
  assert(image.startsWith('images/employer-profiles/'+id+'/'));
  assert(existsSync('public/'+image),'Missing local visual '+image);
  const svg=read('public/'+image);
  assert(svg.includes('<svg')&&svg.length>500,'Invalid/empty independent SVG '+image);
  assert(svg.includes('非官方')||svg.includes('非公司官方'),'Unlabeled editorial image: '+image);
 }
 const audit=JSON.parse(read('public/images/employer-profiles/'+id+'/media-audit.json'));
 assert.equal(audit.company,p.name);assert.equal(audit.officialLogo,false);assert.equal(audit.realPhotos,false);
 assert.equal(audit.files.length,3);assert.equal(new Set(audit.files.map(a=>a.filename)).size,3);
 assert(p.photoNote.includes('非官方'),'Disclosure required');
 console.log('HHBA_060_062_OK',id,p.name,p.jobs.length,'roles, 6 business sections, 3 local SVG assets');
}
const cloud=JSON.parse(read('src/data/employerProfiles/cn-autumn-060.json'));
assert(cloud.jobs.some(j=>j.title.includes('AI大模型工程师')&&j.educationLabel.includes('硕士')));
const meimai=JSON.parse(read('src/data/employerProfiles/cn-autumn-061.json'));
assert(meimai.jobs.some(j=>j.title.includes('TikTok')||j.title.includes('Tiktok')));
assert(meimai.jobs.some(j=>j.majorUnrestricted),'Unrestricted-major roles must remain unrestricted');
const xiamen=JSON.parse(read('src/data/employerProfiles/cn-autumn-062.json'));
assert.equal(xiamen.recruitment.status,'archived_source');
assert(xiamen.recruitment.label.includes('非网申'),'Archived university source must not impersonate official application');
assert(xiamen.jobs.every(j=>j.requirements.includes('冲突')),'Conflicting degree reports must be disclosed');
console.log('HHBA_060_062_ALL_PASS: 20 sourced recruitment records, 18 business cards, 9 independent editorial SVG assets');
