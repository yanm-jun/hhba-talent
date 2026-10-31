import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root='src/data/employerProfiles/';
const expected=[['057','line plus',4],['058','招商金科',1],['059','中盈优创',3]];
const page=readFileSync('src/pages/UnifiedV2CompanyPage.tsx','utf8');
assert(page.includes("06[0-8])$/.test(id)"),"V2 includes 057-059 and 060-062");
assert(page.includes("if(batch3756)return job.category===major"),'category job filtering missing');
for(const [num,name,count] of expected){
 const id='cn-autumn-'+num,p=JSON.parse(readFileSync(root+id+'.json','utf8'));
 assert.equal(p.name,name);assert.equal(p.jobs.length,count);assert.equal(p.business.length,6);
 assert.equal(p.media.photos.length,2);
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,count);
 for(const a of [p.media.logo,...p.media.photos.map(x=>x.path)])assert(existsSync('public/'+a),'missing independent visual '+a);
 for(const j of p.jobs){assert(j.title&&j.category&&j.requirements&&j.summary&&j.majorNames.length);assert.equal(j.currentOpenVerified,false);assert(j.url.startsWith('https://')&&j.evidenceUrl.startsWith('https://'));assert.equal(j.url,p.recruitment.url);}
 assert(p.photoNote.includes('非官方'),'Must label editorial media');
 console.log('V2_COMPANY_PASS',id,name,count,'roles / 6 businesses / 3 visual assets');
}
console.log('HHBA 057-059 contract passed: 8 recruitment records 18 businesses 9 independent visual SVG files');
