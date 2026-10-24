import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const data='src/data/';
const target=JSON.parse(readFileSync(data+'domesticComplete100Target.json','utf8'));
const profiles=JSON.parse(readFileSync(data+'domesticCareerProfiles.json','utf8'));
const registry=JSON.parse(readFileSync(data+'domesticRecruitmentRegistry.json','utf8')).entries;
const media=JSON.parse(readFileSync(data+'domesticMediaBundle.json','utf8')).companies;
const names=target.companyNames;
assert.equal(names.length,100,'100 unique target companies');
assert.equal(new Set(names).size,100,'No duplicate enterprise names');
assert.equal(target.firstCohortNames.length,50);
assert.equal(target.secondCohortNames.length,50);
assert.deepEqual(names,[...target.firstCohortNames,...target.secondCohortNames]);
const mediaExists=rel=>typeof rel==='string'&&/^domestic-media\/[a-zA-Z0-9_.-]+$/.test(rel)&&existsSync(path.join('public',rel));
const rows=names.map((name,i)=>{
 const p=profiles[name]||{},r=registry[name],m=media[name];
 const descChars=Array.isArray(p.description)?p.description.join('').length:0;
 const logoReady=m?.brand?.state==='ready'&&mediaExists(m.brand.path);
 const logoIdentityChecked=logoReady&&['official_logo_visually_verified','user_provided_logo_confirmed'].includes(p.brandAssetStatus);
 const photoAlignment=(m?.photos||[]).every((asset,i)=>asset?.state!=='ready'||(p.photos?.[i]?.localPath===asset.path&&mediaExists(asset.path)));
 const physicalPhotoReady=(m?.photos||[]).some((asset,i)=>asset?.state==='ready'&&mediaExists(asset.path)&&['headquarters','office','factory'].includes(p.photos?.[i]?.kind)&&p.photos?.[i]?.kind!=='screenshot'&&['official_site_caption_and_visual_inspection','reviewed_named_corporate_building_image_with_source','visually_attributed_to_exact_company_official_site_pending_reuse_clearance'].includes(p.photos?.[i]?.verification));
 const imageReady=(m?.photos||[]).some(z=>z?.state==='ready'&&mediaExists(z.path));
 const majors=Array.isArray(p.majorSlugs)?p.majorSlugs:[];
 return {
  number:i+1,cohort:i<50?1:2,name,profile:!!profiles[name],descriptionChars:descChars,
  industry:!!(p.primaryIndustry||p.industry||p.subtitle),majors:majors.length,
  logoReady:!!logoReady,logoIdentityChecked:!!logoIdentityChecked,imageReady:!!imageReady,physicalPhotoReady:!!physicalPhotoReady,photoAlignment,
  logoConfirmed:['official_logo_visually_verified','user_provided_logo_confirmed'].includes(p.brandAssetStatus),
  exactRecruitment:!!r&&r.recruitmentEntity===name&&r.kind==='official_recruitment_portal'&&r.availability!=='unconfirmed_runtime',
  recruitmentRegistered:!!r,recruitmentStatus:r?.availability||'missing',
  recruitmentEntity:r?.recruitmentEntity||null,
  complete:descChars>=280&&majors.length>=4&&logoReady&&imageReady&&
    !!r&&r.recruitmentEntity===name&&r.availability!=='unconfirmed_runtime'&&
    ['official_recruitment_portal','official_recruitment_announcements'].includes(r.kind)
 };
});
for(const row of rows){
 assert(row.profile,'Missing profile '+row.name);
 assert(row.descriptionChars>=280,'Insufficient source narrative '+row.name);
 assert(row.majors>=4,'Insufficient linked majors '+row.name);
 assert(row.industry,'Industry absent '+row.name);
 assert(row.photoAlignment,'Media/photo path mismatch '+row.name);
 if(row.logoReady)assert(media[row.name].brand.path===p.brandLocalPath,'Brand path mismatch '+row.name);
 if(p.brandAssetStatus==='official_logo_rejected_mismatch')assert(!row.logoReady,'Rejected logo must not display '+row.name);
 const p=profiles[row.name];
 const manifest=media[row.name]||{};
 for(const asset of [manifest.brand,...(manifest.photos||[])])
  if(asset?.state==='ready')assert(mediaExists(asset.path),'Missing image binary '+row.name+':'+(asset.path||'unknown'));
 assert(/^https:\/\//.test(p.officialSource),'Non-HTTPS enterprise source '+row.name);
 const r=registry[row.name];
 if(r){
  assert(/^https:\/\//.test(r.url),'Non-HTTPS recruitment URL '+row.name);
  assert(/^https:\/\//.test(r.evidenceUrl),'Recruitment evidence URL invalid '+row.name);
  assert(r.kind!=='group_recruitment_portal'||!!r.notes,'Group recruiting requires disclosure '+row.name);
  if(r.kind==='official_recruitment_announcements')assert(r.availability!=='normal','An announcement is not a live job portal '+row.name);
 }
}
const metrics={
 target:rows.length,profiles:rows.filter(x=>x.profile).length,
 longform:rows.filter(x=>x.descriptionChars>=280).length,majors:rows.filter(x=>x.majors>=4).length,
 recruitmentRegistered:rows.filter(x=>x.recruitmentRegistered).length,
 recruitmentMissing:rows.filter(x=>!x.recruitmentRegistered).map(x=>x.name),
 logoReady:rows.filter(x=>x.logoReady).length,
 logoIdentityChecked:rows.filter(x=>x.logoIdentityChecked).length,
 missingLogo:rows.filter(x=>!x.logoReady).map(x=>x.name),
 missingSceneOrScreenshot:rows.filter(x=>!x.imageReady).map(x=>x.name),
 physicalOfficeFactoryPhotos:rows.filter(x=>x.physicalPhotoReady).length,
 photosOrScreenshotsReady:rows.filter(x=>x.imageReady).length,
 completeWithAllSixChecks:rows.filter(x=>x.complete&&x.logoConfirmed).length,
 firstCohort:{size:50,logoReady:rows.slice(0,50).filter(x=>x.logoReady).length,photoReady:rows.slice(0,50).filter(x=>x.imageReady).length},
 secondCohort:{size:50,logoReady:rows.slice(50).filter(x=>x.logoReady).length,photoReady:rows.slice(50).filter(x=>x.imageReady).length}
};
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/company100-quality.json',JSON.stringify({reviewedAt:new Date().toISOString(),metrics,rows},null,2)+'\n');
console.log('HHBA_COMPANY100_QUALITY',JSON.stringify(metrics));
