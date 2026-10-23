import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const raw=(p)=>JSON.parse(readFileSync(p,'utf8'));
const profiles=raw('src/data/domesticCareerProfiles.json');
const roster=raw('src/data/domesticListedCompanies.json');
const relationships=raw('src/data/domesticCompanyRelations.json');
const normalize=(s)=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s·・（）()\-—_]/g,'');
const rawNames=new Set([
 ...roster.companies.flatMap(x=>[x.name,x.legalName].filter(Boolean)),
 ...relationships.relations.flatMap(x=>[x.child,...x.aliases||[]]),
 '浙江吉利控股集团'
].map(normalize));
const selected=Object.entries(profiles);
const outcomes=selected.map(([name,p])=>{
 const hasLogoCandidate=Boolean(p.brandImage);
 const faviconOnly=p.brandAssetStatus==='official_domain_favicon_unverified_visual';
 const officialLogoVerified=p.brandAssetStatus==='official_logo_visually_verified';
 const photoCount=(p.photos||[]).filter(x=>x.url&&x.label&&x.source).length;
 return {name,listedOrGroup:rawNames.has(normalize(name)),brandUrl:hasLogoCandidate,brandAssetStatus:p.brandAssetStatus||'unspecified',
  officialLogoVerified,siteIconUnverified:faviconOnly,photoCount,photoSourcePage:Boolean(p.photoSourcePage),
  detailRouteRequired:true,majorCount:p.majorSlugs?.length||0,officialCareers:Boolean(p.careersUrl),officeCount:p.officeLocations?.length||0,
  warnings:[
   !officialLogoVerified?'formal_logo_not_verified':null,
   photoCount===0?'no_embedded_real_photo':null,
   !p.officialSource?'no_official_source':null,
   !p.majorSlugs?.length?'no_major_tags':null
  ].filter(Boolean)};
});
const summary={
  generated:'2026-10-23',scope:'40 deep employer profiles; 5576+ company directory identities are separate',
  deepProfiles:outcomes.length,listedOrKnown:outcomes.filter(x=>x.listedOrGroup).length,
  imageUrls:outcomes.filter(x=>x.brandUrl).length,officialLogosVerified:outcomes.filter(x=>x.officialLogoVerified).length,
  candidateSiteIcons:outcomes.filter(x=>x.siteIconUnverified).length,
  photoCompanies:outcomes.filter(x=>x.photoCount>0).length,photoAssets:outcomes.reduce((a,x)=>a+x.photoCount,0),
  offices:outcomes.filter(x=>x.officeCount>0).length,
  exactRecruitmentUrls:outcomes.filter(x=>x.officialCareers).length,
  photoSourcePages:outcomes.filter(x=>x.photoSourcePage).length,
  namesWithoutPhotos:outcomes.filter(x=>!x.photoCount).map(x=>x.name)
};
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/company-media-audit.json',JSON.stringify({summary,companies:outcomes},null,2));
writeFileSync('preview-reports/README.md',[
 '# HHBA 企业品牌图片与搜索关联审计',
 '',
 '> 本报告区分完整企业档案、企业名录身份记录、网站图标、已视觉核验的正式品牌 Logo 和真实企业照片。图片URL存在不代表能加载或品牌使用正确。',
 '',
 '| 指标 | 数量 |','|---|---:|',
 ...Object.entries(summary).filter(([_,v])=>typeof v==='number').map(([k,v])=>'| '+k+' | '+v+' |'),
 '',
 '## 尚无已核对真实照片的企业',
 ...summary.namesWithoutPhotos.map(name=>'- '+name)
].join('\n')+'\n');
console.log('HHBA_COMPANY_MEDIA_AUDIT '+JSON.stringify({...summary,namesWithoutPhotos:undefined}));
test('Every deep profile is a unique search identity with honest media evidence',()=>{
 assert(selected.length>=40);
 assert.equal(new Set(selected.map(([name])=>normalize(name))).size,selected.length,'duplicate normalized employer name');
 for(const [name,p] of selected){
  assert(p.displayName&&p.description?.length>=3&&p.majorSlugs?.length>=4,name+' profile incomplete');
  assert(p.officialSource?.startsWith('https://'),name+' official source missing');
  if(p.careersUrl)assert(new URL(p.careersUrl).protocol==='https:',name+' recruitment site protocol');
  for(const photo of p.photos||[]){
   assert(photo.url.startsWith('https://')&&photo.source.startsWith('https://'),name+' photo source');
  }
  if(p.brandAssetStatus==='official_domain_favicon_unverified_visual')
   assert(p.brandImageSource?.startsWith('https://'),name+' favicon source missing');
 }
});
test('Media shortfall is explicitly visible instead of misreported as complete',()=>{
 assert(summary.imageUrls<=summary.deepProfiles);
 assert(summary.deepProfiles===40);
 assert(summary.photoCompanies<summary.deepProfiles,
   'When this reaches full coverage, replace this safeguard with a verification requirement');
 assert(summary.candidateSiteIcons>0,'Missing verification status on site icons');
});
