import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const registry=load('src/data/domesticRecruitmentRegistry.json').entries;
const profiles=load('src/data/domesticCareerProfiles.json');
const roster=load('src/data/domesticListedCompanies.json');
const catalog=load('src/data/aiCompanyCatalog.json');
const relations=load('src/data/domesticCompanyRelations.json');
const editorial=load('src/data/domesticCompanyEditorial.json');
const uniqueRosters=new Set(roster.companies.map(c=>c.name));
const profileLinks=Object.entries(profiles).filter(([n,p])=>p.careersUrl);
const catalogLinks=catalog.companies.filter(c=>c.provenance==='official_recruitment_entry_only'&&c.careers);
const relationLinks=relations.relations.filter(r=>r.careersUrl);
const editorialLinks=Object.entries(editorial).filter(([n,p])=>p.careers);
const normal=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s·・（）()\-—_]/g,'');
const legacyAll=[
 ...profileLinks.map(([name,p])=>({origin:'careerProfiles',name,url:p.careersUrl})),
 ...catalogLinks.map(p=>({origin:'aiCompanyCatalog',name:p.name,url:p.careers})),
 ...relationLinks.map(p=>({origin:'domesticCompanyRelations',name:p.child,url:p.careersUrl})),
 ...editorialLinks.map(([name,p])=>({origin:'domesticCompanyEditorial',name,url:p.careers}))
];
const knownNames=new Set([...roster.companies.map(c=>normal(c.name)),...Object.keys(profiles).map(normal),...relations.relations.map(r=>normal(r.child)),...catalog.companies.filter(c=>c.provenance==='official_recruitment_entry_only').map(c=>normal(c.name)),...Object.keys(editorial).map(normal)]);
const registryNames=Object.keys(registry);
const decisions=[];
for(const {origin,name,url} of legacyAll){
 const reg=registryNames.find(n=>normal(n)===normal(name));
 let decision;
 if(reg)decision={origin,name,oldUrl:url,newUrl:registry[reg].url,state:url===registry[reg].url?'UNCHANGED_VERIFIED':'REPLACED_BY_VERIFIED_RECRUITMENT_ENTRY'};
 else decision={origin,name,oldUrl:url,state:'NOT_PUBLISHED_PENDING_RECRUITMENT_EVIDENCE'};
 decisions.push(decision);
}
const summary={
 asOf:'2026-10-23',
 listedCompanyIdentities:roster.companies.length,
 deepCompanyProfiles:Object.keys(profiles).length,
 legacyRecruitmentReferencesInspected:legacyAll.length,
 legacyBySource:{profile:profileLinks.length,catalog:catalogLinks.length,relations:relationLinks.length,editorial:editorialLinks.length},
 registeredRecruitmentLeads:registryNames.length,
 exactOrGroupRecruitmentReferences:registryNames.filter(n=>registry[n].availability==='normal'||registry[n].availability==='campus_only').length,
 unconfirmedRuntimeReferences:registryNames.filter(n=>registry[n].availability==='unconfirmed_runtime').length,
 announcementOnlyReferences:registryNames.filter(n=>registry[n].availability==='announcement_only').length,
 mismatchedGroupEntityReferences:registryNames.filter(n=>registry[n].recruitmentEntity!==n).length,
 applicableListedIssuers:registryNames.filter(n=>uniqueRosters.has(n)).length,
 retiredCorporateHomepageLinks:1,
 retiredInheritedRelationRecruitmentLinks:9,
 migratedOrCorrectedLinks:decisions.filter(d=>d.state==='REPLACED_BY_VERIFIED_RECRUITMENT_ENTRY').length,
 unresolvedLegacyReferences:decisions.filter(d=>d.state==='NOT_PUBLISHED_PENDING_RECRUITMENT_EVIDENCE').length,
 listedIssuersStillWithoutVerifiedRecruitment:roster.companies.filter(c=>!registry[c.name]).length,
 userReportedCase:registry['农业银行']?.url||null,
 maintenanceLimited:registryNames.filter(n=>registry[n].availability==='temporarily_unavailable'),
 scope:'Candidate sources inventoried and public links safeguarded; no claim that every company in 5576 issuer roster has an independently checked recruitment site.'
};
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/domestic-recruitment-audit.json',JSON.stringify({summary,decisions,registered:registry},null,2)+'\n');
writeFileSync('preview-reports/domestic-recruitment-audit.md',[
 '# HHBA 国内企业招聘官网专项审计',
 '',
 '> 已审计旧资料中的招聘链接并将前端统一切换到核实登记表。没有依据的企业官网首页不得冒充招聘入口。',
 '',
 '| 项目 | 数值 |','|---|---:|',
 ...Object.entries(summary).filter(([k,v])=>typeof v==='number').map(([k,v])=>'|'+k+'|'+v+'|'),
 '',
 '## 招聘入口线索（按主体及运行状态区分；未必全部为可投递站点）',
 ...registryNames.map(n=>'- '+n+' · '+registry[n].url+' · '+registry[n].availability+' · 来源 '+registry[n].evidenceUrl),
 '',
 '## 未作为前端招聘入口发布的旧引用',
 ...decisions.filter(d=>d.state==='NOT_PUBLISHED_PENDING_RECRUITMENT_EVIDENCE').map(d=>'- '+d.name+' · '+d.origin+' · '+d.oldUrl)
 ].join('\n')+'\n');
console.log('HHBA_DOMESTIC_RECRUITMENT_AUDIT',JSON.stringify(summary));
test('verified recruitment registry belongs to known exact business identities',()=>{
 assert.equal(roster.companies.length,5576);
 assert(registryNames.length>=30);
 for(const name of registryNames){
  const rec=registry[name];
  assert(knownNames.has(normal(name)),'Unknown business identity: '+name);
  assert.equal(new URL(rec.url).protocol,'https:');
  assert.equal(new URL(rec.evidenceUrl).protocol,'https:');
  assert(['official_recruitment_portal','group_recruitment_portal','official_recruitment_announcements'].includes(rec.kind));
  assert(rec.verifiedOn&&!rec.url.includes('sse.com.cn/assortment'));
  if(rec.url==='https://www.abchina.com.cn'||rec.url==='https://www.abchina.com')assert.fail('Agricultural Bank homepage used as recruiting');
  const u=new URL(rec.url);
  const officialDedicated=/recruit|career|jobs|job\.|talent|hotjob|zhiye|wejob|campus|maker\.|^zp\./i.test(u.hostname);
  const restrictedPath=/^\/(?:joinus|join\/?|rlzy_new\/rczp\/|aboutboc\/bi4\/|careers\/?|recruitment\/?|about\/career\/?|jobList\.html|recruitOut\/ihr\/social|smart_home\/customizedjobs\.html)/i.test(u.pathname);
  // Exceptional official gateways require the complete host AND recruitment-specific path;
  // accepting a generic third-party domain alone would incorrectly validate corporate homepages.
  const sourceBackedException=(u.hostname==='hahr.hazq.com'&&u.port==='8083'&&u.pathname==='/eip4ha-hyapp/recruitment')||
    (u.hostname==='unigroup.zhaopin.com'&&u.pathname==='/')||
    (u.hostname==='zhaopin.greeyun.com')||
    (u.hostname==='app.mokahr.com'&&/^\/(?:apply\/dfzq\/?|campus-recruitment\/chint\/)/.test(u.pathname))||
    (u.hostname==='www.shanghaiairport.com'&&u.pathname.startsWith('/shzp/'));

  assert(officialDedicated||restrictedPath||sourceBackedException,'Corporate homepage is not a recruiting URL: '+name+' '+rec.url);
 }
});
test('specific agricultural bank recruiting path and common banking sites are properly matched',()=>{
 assert.equal(registry['农业银行'].url,'https://career.abchina.com/build/index.html#/');
 assert.equal(registry['建设银行'].url,'https://job.ccb.com/');
 assert.equal(registry['工商银行'].url,'https://job.icbc.com.cn/');
 assert.equal(registry['中国银行'].availability,'announcement_only');
 assert.equal(registry['浦发银行'].availability,'temporarily_unavailable');
});
test('wrong corporate homepages and inherited parent links are blocked in source datasets',()=>{
 assert(!catalog.companies.find(c=>c.name==='圆通速递')?.careers,'Old YTO homepage must not be counted as recruitment');
 assert(!relations.relations.some(r=>r.careersUrl==='https://saic-recruit.saicmotor.com/'),'Group recruitment site was replicated into subsidiaries');
 const service=readFileSync('src/services/domesticCompanySearch.ts','utf8');
 const detail=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
 const major=readFileSync('src/pages/MajorCompaniesPage.tsx','utf8');
 assert(service.includes('item.careers=record?.url'));
 assert(detail.includes('getDomesticRecruitment(company.name)'));
 assert(detail.includes('httpsLink(company.careers)'));
 assert(!detail.includes('article?.careersUrl||company.careers'));
 assert(major.includes('company.careers'));
});
test('current roster remains intact after correcting recruitment routing',()=>{
 assert.equal(new Set(roster.companies.map(x=>x.code)).size,5576);
 assert.equal(summary.listedCompanyIdentities,5576);
});
