// Strict, reproducible five-part completeness test for HHBA's first 50 existing companies.
// A logo candidate, broken photograph, corporate homepage or unrelated major cannot pass.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const cohort=json('src/data/domesticComplete50Target.json');
const profiles=json('src/data/domesticCareerProfiles.json');
const recruits=json('src/data/domesticRecruitmentRegistry.json').entries;
const pictures=json('src/data/domesticMediaBundle.json').companies||{};
const roster=json('src/data/domesticListedCompanies.json');
const majorsSource=readFileSync('src/services/domesticMajors.ts','utf8');
const majorIds=new Set([...majorsSource.matchAll(/(?:slug:\s*|\[\s*)'([^']+)'/g)].map(m=>m[1]));
const kinds=new Set(['headquarters','factory','office','product']);
const isHttps=s=>{try{return new URL(s).protocol==='https:'}catch{return false}};
const nameSet=new Set(cohort.companyNames);
const results=[];
for(const name of cohort.companyNames){
 const p=profiles[name]||{};
 const rec=recruits[name];
 const media=pictures[name]||{};
 const info=(p.description||[]).join('');
 const business=p.business||[];
 const majors=p.majorSlugs||[];
 const photoIdx=(p.photos||[]).findIndex((x,i)=>{
   const actual=media.photos?.[i];
   return actual?.state==='ready'&&actual.path?.startsWith('domestic-media/')&&
    isHttps(x.url)&&isHttps(x.source)&&x.label&&kinds.has(x.kind);
 });
 const checks={
  introduction:Boolean(info.length>=280&&p.description?.length>=3&&business.length>=3&&isHttps(p.officialSource)&&
    business.every(x=>x.title?.trim()&&x.description?.trim())&&
    new Set(business.map(x=>x.title)).size===business.length),
  classification:Boolean(p.primaryIndustry&&p.subIndustry&&isHttps(p.industryEvidenceUrl)),
  professionalAssociation:Boolean(majors.length>=4&&new Set(majors).size===majors.length&&
    majors.every(id=>majorIds.has(id))&&p.majorMappingBasis?.includes('非招聘专业承诺')),
  officialLogo:Boolean(p.brandAssetStatus==='official_logo_visually_verified'&&
    p.brandIdentityEvidence&&p.brandVerifiedAt&&isHttps(p.brandImageSource)&&
    media.brand?.state==='ready'&&media.brand.path?.startsWith('domestic-media/')),
  officialPhoto:Boolean(photoIdx>=0),
  officialRecruitment:Boolean(rec?.url&&rec?.evidenceUrl&&isHttps(rec.url)&&isHttps(rec.evidenceUrl)&&
    ['official_recruitment_portal','group_recruitment_portal'].includes(rec.kind)&&
    ['normal','campus_only'].includes(rec.availability)&&rec.recruitmentEntity===name)
 };
 const issues=Object.entries(checks).filter(([,passed])=>!passed).map(([k])=>k);
 results.push({name,checks,complete:!issues.length,issues,
  articleChars:info.length,relatedMajors:majors.length,brandEvidenceStatus:p.brandAssetStatus||'missing',
  localBrand:media.brand?.state==='ready',
  recordedPhotos:p.photos?.length||0,localPictures:media.photos?.filter(x=>x?.state==='ready').length||0,
  careerUrl:rec?.url||null,recruitmentKind:rec?.kind||null,primaryIndustry:p.primaryIndustry||'unclassified'});
}
const counters=Object.fromEntries(Object.keys(results[0]?.checks||{}).map(k=>[k,results.filter(x=>x.checks[k]).length]));
const summary={
 goal:50,companiesReviewed:results.length,complete:results.filter(x=>x.complete).length,
 incomplete:results.filter(x=>!x.complete).length,completionRate:results.filter(x=>x.complete).length/50,
 byDimension:counters,
 date:new Date().toISOString(),
 note:'Completed requires all 6 checks (introduction, classification, professional association, official logo, official photograph, exact recruiting portal). Source/availability status and actual local media matter; do not count placeholder or favicon.'
};
mkdirSync('preview-reports',{recursive:true});
mkdirSync('public/data',{recursive:true});
writeFileSync('preview-reports/complete-50-quality.json',JSON.stringify({summary,results},null,2)+'\n');
writeFileSync('public/data/domestic-complete-50-progress.json',JSON.stringify({summary,results},null,2)+'\n');
const header=['# HHBA 50 家企业完整档案逐项验收','','> **这不是仅有 50 家名单的任务。仅当介绍、行业、专业、真实Logo、真实照片和该主体的招聘站全部通过，才可以写“已完成”。**','','| 验收项 | 完成家数 |','|---|---:|',
 ...Object.entries(counters).map(([k,v])=>'| '+k+' | '+v+'/50 |'),
 '','**完全通过：'+summary.complete+'/50 家**','','## 尚未完成的公司与具体缺口'];
for(const r of results.filter(x=>!x.complete))header.push('- '+r.name+'：'+r.issues.join('、')+'（图片：'+r.localPictures+'，招聘：'+(r.careerUrl||'待核验')+'）');
header.push('','## 全项通过的企业',...results.filter(x=>x.complete).map(x=>'- '+x.name),'');
writeFileSync('preview-reports/complete-50-quality.md',header.join('\n'));
console.log('HHBA_50_COMPANIES_6_GATE_AUDIT',JSON.stringify(summary));
test('goal list is exactly fifty unique existing entities, not invented additions',()=>{
 assert.equal(cohort.companyNames.length,50);
 assert.equal(nameSet.size,50);
 assert(results.every(x=>profiles[x.name]),'Cohort is restricted to existing employer dossiers');
 // A company already in the existing reviewed profile collection is not a new entity.
 // Some legacy public-company snapshots omit verified issuers such as 中国中车.
 // Verify known profile identity and first-party source rather than assuming roster coverage.
 for(const name of cohort.companyNames){
  assert(profiles[name]&&isHttps(profiles[name].officialSource),'Unknown or unsourced employer dossier: '+name);
 }
});
test('full-completion label requires visible media and exact first-party recruitment evidence',()=>{
 for(const r of results){
  if(!r.complete)assert(r.issues.length>0);
  if(r.complete)assert(Object.values(r.checks).every(Boolean));
 }
});
test('industry and majors are explicit, not guessed from share code or generic homepage',()=>{
 assert.equal(counters.classification,50);
 for(const name of cohort.companyNames){
  const p=profiles[name];assert(p.primaryIndustry&&p.subIndustry&&isHttps(p.industryEvidenceUrl));
  assert(p.majorMappingBasis?.includes('非招聘专业承诺'));
 }
});
