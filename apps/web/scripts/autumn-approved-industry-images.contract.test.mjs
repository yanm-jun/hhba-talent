import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const data=JSON.parse(read('public/data/domestic-autumn-industry-photos.json'));
const employers=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const site=read('src/pages/AutumnCompanyProfilePage.tsx');
const gallery=read('src/components/AutumnIndustryReferenceGallery.tsx');
assert.equal(employers.length,156);
assert.equal(data.approvedCompanies,11);
assert.equal(data.approvedPhotos,19);
assert.equal(Object.keys(data.entries).length,11);
const exactNames=new Map(employers.map(e=>[e.id,e.name]));
const hashes=new Set();let count=0;
for(const [companyId,photos] of Object.entries(data.entries)){
 assert(exactNames.has(companyId),'No screenshot employer for '+companyId);
 assert(photos.length>0&&photos.length<=2,'At most two individually-reviewed pictures per company');
 for(const photo of photos){
  assert(photo.companyName===exactNames.get(companyId),'Company picture assignment differs');
  assert(photo.companyId===companyId);
  assert(photo.imageType==='licensed_industry_reference_not_actual_employer');
  assert(photo.label.includes('非该企业实景'));
  assert(photo.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert(photo.licenseUrl.startsWith('https://creativecommons.org/'));
  assert(photo.author&&photo.changes);
  assert(new RegExp('^images/autumn-industry-references/'+companyId+'-[0-9]{2}\\.jpg$').test(photo.file));
  assert(existsSync('public/'+photo.file),'Missing photo: '+photo.file);
  const b=readFileSync('public/'+photo.file);
  assert(b[0]===0xff&&b[1]===0xd8,'Not a standalone JPEG '+photo.file);
  assert.equal(createHash('sha256').update(b).digest('hex'),photo.sha256);
  assert(!hashes.has(photo.sha256),'Duplicate image source');
  hashes.add(photo.sha256);count++;
 }
}
assert.equal(count,19);
assert(!site.includes('AutumnIndustryReferenceGallery'),'Keep the 19-image research archive offline, never render it in employer pages');
assert(!site.includes('industry-photos.json')&&!site.includes('photo-research'),'No Wikimedia photo references should appear in the OpenAI-format employer page');
assert(!site.includes('创始人与核心创办团队'),'Founders block should not appear in domestic profiles');
assert(site.includes('主要业务与代表产品')&&site.includes('发展与重要节点'));
assert(gallery.includes('不是 {companyName} 的真实办公楼')&&gallery.includes('licenseUrl'));
assert(gallery.includes('该企业暂无通过场景匹配审核的参考照片'));
console.log('HHBA_19_SOURCE_ATTRIBUTED_RESEARCH_IMAGES_ARCHIVED_NOT_PUBLISHED_IN_PROFILES_OK');
