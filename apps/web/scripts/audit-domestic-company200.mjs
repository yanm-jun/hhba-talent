import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve('src/data');
const get=name=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
const base=get('domesticComplete100Target.json');
const expansion=get('domesticComplete200Target.json');
const oldProfiles=get('domesticCareerProfiles.json');
const extra=get('domesticCompanyExpansion200Profiles.json');
const reviewed=get('domesticCompany200VerifiedEditorial.json').entries;
const oldRecruit=get('domesticRecruitmentRegistry.json').entries;
const newRecruit=get('domesticRecruitment200Registry.json').entries;
const oldMedia=get('domesticMediaBundle.json').companies;
const newMedia=get('domesticMedia200Bundle.json').companies;
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[\s（）()・·_—-]/g,'');
assert.equal(base.companyNames.length,100,'Do not alter original 100 target count');
assert.equal(expansion.companyNames.length,200,'Exactly 200 target companies');
assert.deepEqual(expansion.companyNames.slice(0,100),base.companyNames,'Original 100 order must survive unchanged');
assert.equal(expansion.thirdCohortNames.length,50);
assert.equal(expansion.fourthCohortNames.length,50);
const names=expansion.companyNames;
assert.deepEqual([...expansion.thirdCohortNames,...expansion.fourthCohortNames],names.slice(100));
assert.equal(new Set(names.map(norm)).size,200,'Normalized employer identity cannot repeat');
assert.equal(Object.keys(extra).length,100);
const validHttps=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password}catch{return false}};
const rows=[];
for(const [offset,name] of names.entries()){
 const original=offset<100,profile=(original?oldProfiles:extra)[name];
 assert(profile,'Missing profile '+name);
 if(original)continue;
 assert(validHttps(profile.officialSource),'Invalid candidate corporate origin '+name);
 assert.equal(profile.contentReview,'first_pass_industry_explanation_not_official_company_detail_audited','Do not falsely mark company profile as audited');
 assert(Array.isArray(profile.description)&&profile.description.length>=3,'Profile sections absent '+name);
 assert(profile.description.join('').length>=280,'Profile narrative too short '+name);
 assert(Array.isArray(profile.business)&&profile.business.length>=3,'Business categories absent '+name);
 assert(Array.isArray(profile.majorSlugs)&&profile.majorSlugs.length>=4,'Professional majors absent '+name);
 assert(profile.summary.includes(name),'Wrong subject in summary '+name);
 const verifiedEditorial=reviewed[name];
 if(verifiedEditorial){
  assert.equal(verifiedEditorial.contentReview,'company_specific_official_page_verified','Editorial verified status invalid '+name);
  assert(Array.isArray(verifiedEditorial.reviewEvidenceUrls)&&verifiedEditorial.reviewEvidenceUrls.length>0,'Reviewed editorial evidence missing '+name);
  assert(verifiedEditorial.reviewEvidenceUrls.every(validHttps)&&validHttps(verifiedEditorial.officialSource),'Reviewed editorial URL invalid '+name);
  assert(verifiedEditorial.description.length>=3&&verifiedEditorial.description.join('').length>=280,'Source-backed narrative incomplete '+name);
  assert(verifiedEditorial.business.length>=3,'Source-backed business description incomplete '+name);
  assert(verifiedEditorial.summary.includes(name),'Source-backed summary subject mismatch '+name);
 }
 if(profile.brandLocalPath)assert(['candidate','ready'].includes(newMedia[name]?.brand?.state),'Candidate logo must have a manifest classification '+name);
 const media=newMedia[name]||{};
 if(media.brand?.state==='candidate'){
  assert(profile.brandAssetStatus==='official_website_logo_candidate','Header logo candidate must remain unverified '+name);
  assert(existsSync(path.join('public',media.brand.path)),'Header logo candidate binary missing '+name);
 }
 if(media.brand?.state==='ready'){
  assert(profile.brandLocalPath===media.brand.path,'Logo identity/path mismatch '+name);
  assert(existsSync(path.join('public',media.brand.path)),'Logo missing file '+name);
  assert(['official_logo_visually_verified','user_provided_logo_confirmed'].includes(profile.brandAssetStatus),'Logo unverified '+name);
 }
 for(const [i,asset] of (media.photos||[]).entries()){
  if(asset.state!=='ready')continue;
  assert(profile.photos?.[i]?.localPath===asset.path,'Photo mismatch '+name+'#'+i);
  assert(existsSync(path.join('public',asset.path)),'Photo missing binary '+name+'#'+i);
  assert(profile.photos?.[i]?.source&&profile.photos?.[i]?.label,'Photo has no source label '+name+'#'+i);
 }
 const recruit=newRecruit[name];
 if(recruit){
  assert(validHttps(recruit.url)&&validHttps(recruit.evidenceUrl),'Recruitment URL requires evidence '+name);
  assert(recruit.url!==profile.website,'Corporate homepage must not be recruitment portal '+name);
  assert.equal(recruit.recruitmentEntity,name,'Parent recruitment portal not silently inherited by child');
  assert(['official_recruitment_portal','official_recruitment_announcements','group_recruitment_portal'].includes(recruit.kind),'Recruitment type invalid '+name);
 }
 rows.push({number:offset+1,name,industry:profile.primaryIndustry,
  editorialCharacters:profile.description.join('').length,majorCount:profile.majorSlugs.length,
  evidenceLevel:verifiedEditorial?.evidenceLevel||profile.evidenceLevel,siteCandidate:verifiedEditorial?.officialSource||profile.officialSource,
  editorialCompanySpecificReviewed:Boolean(verifiedEditorial),
  recruitmentKind:recruit?.kind||null,recruitmentEvidence:recruit?.evidenceUrl||null,
  logoReady:media.brand?.state==='ready',photoOrScreenshotReady:(media.photos||[]).some(x=>x?.state==='ready'),
  verifiedComplete:false});
}
for(const name of Object.keys(reviewed))assert(Object.hasOwn(extra,name),'Orphan reviewed editorial entry '+name);
for(const name of Object.keys(newRecruit))assert(Object.hasOwn(extra,name),'Orphan recruitment entry '+name);
for(const name of Object.keys(newMedia))assert(Object.hasOwn(extra,name),'Orphan image entry '+name);
const result={reviewedAt:new Date().toISOString(),target:200,existing:100,newRecords:rows.length,
 verifiedRecruitmentEntries:Object.keys(newRecruit).length,
 newLogoReady:rows.filter(x=>x.logoReady).length,newPhotoOrScreenshotReady:rows.filter(x=>x.photoOrScreenshotReady).length,
 officialLongformVerified:Object.keys(reviewed).length,reason:'Only individually source-reviewed editorial overlays count as verified longform; other new companies remain explicitly first-pass',
 rows};
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/company200-quality.json',JSON.stringify(result,null,2)+'\n');
console.log('HHBA_COMPANY200_QUALITY',JSON.stringify({...result,rows:undefined}));
