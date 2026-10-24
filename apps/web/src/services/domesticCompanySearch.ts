import curated from '../data/aiCompanyCatalog.json';
import editorial from '../data/domesticCompanyEditorial.json';
import careerProfiles from '../data/domesticCareerProfiles.json';
import {domestic200Profiles as careerProfiles200} from './domesticCompany200Data';
import recruitmentRegistry from '../data/domesticRecruitmentRegistry.json';
import recruitmentRegistry200 from '../data/domesticRecruitment200Registry.json';
import rosterSnapshot from '../data/domesticListedCompanies.json';
import relationsSnapshot from '../data/domesticCompanyRelations.json';

export type DomesticCompany={
 id:string;name:string;legalName?:string;industry:string;overview:string;
 province?:string;city?:string;website?:string;careers?:string;
 sourceUrl:string;lastReviewed:string;tags:string[];stockCode?:string;route:string;
 status:'industry_reviewed'|'official_entry_only'|'listed_identity_only';
 aliases?:string[];entityKind?:'company'|'branch'|'business';
 parentName?:string;relationLabel?:string;relationSourceUrl?:string;careersShared?:boolean;
};
type Listed={id:string;name:string;legalName?:string;industry?:string;province?:string;city?:string;website?:string;code:string;exchange:string};
type Roster={companies:Listed[];sourceDate:string;sourceUrls:Record<string,string>};
type Editorial={industry:string;overview:string;tags:string[];website?:string;sourceUrl?:string;careers?:string};
export type CompanyRelation={
 id:string;parent:string;child:string;relation:string;kind:'company'|'branch'|'business';
 industry:string;tags:string[];sourceUrl:string;reviewedAt:string;
 aliases?:string[];website?:string;careersUrl?:string;careersEvidenceUrl?:string;city?:string;
};
type RelationFeed={schemaVersion:number;relations:CompanyRelation[]};
const details=editorial as Record<string,Editorial>;
export type DomesticRecruitmentRecord={
 url:string;evidenceUrl:string;kind:'official_recruitment_portal'|'group_recruitment_portal'|'official_recruitment_announcements';
 availability:'normal'|'campus_only'|'announcement_only'|'temporarily_unavailable'|'unconfirmed_runtime';
 label:string;recruitmentEntity:string;verifiedOn:string;aliases?:string[];notes?:string;
};
const recruitmentEntries={...(recruitmentRegistry as {entries:Record<string,DomesticRecruitmentRecord>}).entries,...(recruitmentRegistry200 as {entries:Record<string,DomesticRecruitmentRecord>}).entries};
export function getDomesticRecruitment(name:string):DomesticRecruitmentRecord|undefined{
 return recruitmentEntries[name];
}
const verifiedCareerProfiles={...careerProfiles,...careerProfiles200} as Record<string,{careersUrl?:string;officialSource?:string;summary?:string;officeLocations?:{type:string;address:string;source:string}[];parentName?:string;industry?:string;primaryIndustry?:string;website?:string;majorSlugs?:string[];brandImage?:string;contentReview?:string;}>;
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/[\s·・（）()\-—_]/g,'');
let cache:DomesticCompany[]|undefined;
function clean(value?:string){return value?.trim()||undefined}
function oneCompanyFromRoster(r:Listed,roster:Roster,prior?:{
 id:string;name:string;industry:string;overview:string;careers:string|null;evidenceUrl?:string;lastReviewed:string;
}):DomesticCompany{
 const e=details[r.name]||details[prior?.name||''];
 return {
 id:r.id,name:r.name,legalName:clean(r.legalName),
 aliases:prior?.name&&normalize(prior.name)!==normalize(r.name)?[prior.name]:undefined,
 industry:e?.industry||r.industry||'行业待细分',
 overview:e?.overview||(r.industry?'交易所历史名录行业分类：'+r.industry+'。具体主营业务有待核验。':'交易所上市企业名录记录，主营业务尚待核验。'),
 province:clean(r.province),city:clean(r.city),website:clean(e?.website||r.website),
 careers:undefined,
 sourceUrl:e?.sourceUrl||roster.sourceUrls[r.exchange]||'',lastReviewed:e?'2026-10-23':prior?.lastReviewed||roster.sourceDate,
 tags:e?.tags||[],stockCode:r.code,route:'/companies/domestic/'+r.id,
 status:e?'industry_reviewed':prior?'official_entry_only':'listed_identity_only',entityKind:'company'
 };
}
function aliasesFor(c:DomesticCompany):string[]{return [c.name,c.legalName||'',...(c.aliases||[])].filter(Boolean)}
function createCompanyIndex(items:DomesticCompany[]){
 const index=new Map<string,DomesticCompany>();
 for(const c of items)for(const s of aliasesFor(c))if(!index.has(normalize(s)))index.set(normalize(s),c);
 return index;
}
function mergeRelation(c:DomesticCompany,r:CompanyRelation){
 c.aliases=[...new Set([...(c.aliases||[]),r.child,...(r.aliases||[])])].filter(s=>normalize(s)!==normalize(c.name));
 c.parentName=r.parent;
 c.relationLabel=r.relation;
 c.relationSourceUrl=r.sourceUrl;
 c.entityKind=r.kind;
 c.tags=[...new Set([...c.tags,...r.tags])];
 if(c.status!=='industry_reviewed'||!c.overview||c.overview.startsWith('已登记')){
  c.industry=r.industry;c.overview=r.kind==='business'?
   '该业务板块隶属'+r.parent+'的公开业务布局。这里展示的是业务方向，不代表独立法人或单独开放招聘。':
   r.child+'出现在'+r.parent+'公开披露的企业及业务体系中，主要与'+r.industry+'有关。具体持股比例、岗位及招聘状态请以官方最新披露为准。';
 }
 c.status='industry_reviewed';
 c.lastReviewed=r.reviewedAt;
 if(r.website&&!c.website)c.website=r.website;
 if(r.city&&!c.city)c.city=r.city;
 // Relationship evidence is not recruitment evidence. NEVER assign a parent's group ATS to its children.
}
export function getDomesticCompanies():DomesticCompany[]{
 if(cache)return cache;
 const roster=rosterSnapshot as Roster;
 const relationships=relationsSnapshot as RelationFeed;
  if(!Array.isArray(roster.companies)||roster.companies.length<5500||
   !Array.isArray(relationships.relations)||relationships.relations.length<40)throw Error('企业名录不完整');
  const existing=(curated.companies as Array<{
   id:string;name:string;industry:string;overview:string;careers:string|null;evidenceUrl?:string;lastReviewed:string;provenance:string
  }>).filter(c=>c.provenance==='official_recruitment_entry_only');
  const byName=new Map(existing.map(c=>[normalize(c.name),c]));
  const included=new Set<string>();
  const map=roster.companies.map(r=>{
   const prior=byName.get(normalize(r.name))||byName.get(normalize(r.legalName||''));
   if(prior)included.add(prior.id);
   return oneCompanyFromRoster(r,roster,prior);
  });
  for(const c of existing)if(!included.has(c.id)){
   const e=details[c.name];
   map.push({id:c.id,name:c.name,industry:e?.industry||c.industry,overview:e?.overview||c.overview,
    website:clean(e?.website),careers:undefined,sourceUrl:e?.sourceUrl||c.evidenceUrl||'',
    lastReviewed:e?'2026-10-23':c.lastReviewed,tags:e?.tags||[],route:'/companies/domestic/'+c.id,
    status:e?'industry_reviewed':'official_entry_only',entityKind:'company'});
  }
  const index=createCompanyIndex(map);
  for(const [name,e] of Object.entries(details)){
   if(index.has(normalize(name)))continue;
   const id='spot-'+Array.from(name).map(char=>char.codePointAt(0)!.toString(36)).join('-');
   const c:DomesticCompany={id,name,industry:e.industry,overview:e.overview,
    website:clean(e.website),careers:undefined,sourceUrl:e.sourceUrl||e.website||'',
    lastReviewed:'2026-10-23',tags:e.tags,route:'/companies/domestic/'+id,
    status:'industry_reviewed',entityKind:'company'};
   map.push(c);index.set(normalize(name),c);
  }
  // A group can be unlisted; it must still be searchable and have an HHBA profile.
  const groupSeeds:Record<string,{industry:string;overview:string;source:string}>={
   '浙江吉利控股集团':{industry:'汽车及产业投资集团',overview:'覆盖整车、关键零部件、移动出行等产业的汽车集团；品牌与经营主体之间的区别需要按官方披露核验。',source:'https://zgh.com/our-business/'}
  };
  for(const r of relationships.relations){
   if(index.has(normalize(r.parent)))continue;
   const seed=groupSeeds[r.parent];if(!seed)continue;
   const c:DomesticCompany={id:'group-geely',name:r.parent,industry:seed.industry,overview:seed.overview,
    sourceUrl:seed.source,lastReviewed:'2026-10-23',status:'industry_reviewed',
    tags:['汽车制造','新能源汽车'],route:'/companies/domestic/group-geely',entityKind:'company'};
   map.push(c);index.set(normalize(c.name),c);
  }
  for(const r of relationships.relations){
   if(!r.id||!r.child||!r.parent||!r.sourceUrl)continue;
   const keys=[r.child,...r.aliases||[]].map(normalize);
   let company=keys.map(k=>index.get(k)).find(Boolean);
   if(!company){
    company={id:r.id,name:r.child,industry:r.industry,overview:'',city:clean(r.city),
     website:clean(r.website),careers:undefined,sourceUrl:r.sourceUrl,lastReviewed:r.reviewedAt,
     tags:[],route:'/companies/domestic/'+r.id,status:'listed_identity_only',entityKind:r.kind};
    map.push(company);
   }
   mergeRelation(company,r);
   for(const a of aliasesFor(company))if(!index.has(normalize(a)))index.set(normalize(a),company);
  }
  // Seed verified standalone companies absent from the historical A-share and ATS roster.
  // Use the source-backed employer profile itself; do not synthesize a stock identifier.
  const indexed=createCompanyIndex(map);
  for(const [companyName,profile] of Object.entries(verifiedCareerProfiles)){
   if(indexed.has(normalize(companyName)))continue;
   if(!profile.officialSource||!profile.summary)continue;
   const id='profile-'+Array.from(companyName).map(ch=>ch.codePointAt(0)!.toString(36)).join('-');
   const entry:DomesticCompany={
    id,name:companyName,industry:profile.industry||profile.primaryIndustry||'行业待细分',overview:profile.summary,
    sourceUrl:profile.officialSource,website:clean(profile.website),
    lastReviewed:'2026-10-23',status:profile.contentReview==='first_pass_industry_explanation_not_official_company_detail_audited'?'official_entry_only':'industry_reviewed',
    tags:[],route:'/companies/domestic/'+id,entityKind:'company',
    ...(profile.parentName?{parentName:profile.parentName,relationLabel:'业务关联（请查阅来源核实主体关系）'}:{})
   };
   map.push(entry);
   indexed.set(normalize(companyName),entry);
  }
  // Recruitment links must be verified for the *exact* employer; no inherited group portal.
  for(const item of map){
   const exact=verifiedCareerProfiles[item.name];
   if(exact){
    item.careers=undefined; // Only the independently audited registry can publish a recruitment link.
    item.careersShared=false;
    if(exact.summary){item.overview=exact.summary;item.status=exact.contentReview==='first_pass_industry_explanation_not_official_company_detail_audited'?'official_entry_only':'industry_reviewed';}
    if(exact.industry||exact.primaryIndustry)item.industry=exact.industry||exact.primaryIndustry||item.industry;
    if(exact.website&&!item.website)item.website=clean(exact.website);
    if(exact.parentName&&!item.parentName){item.parentName=exact.parentName;item.relationLabel='业务关联（不等于直接控股）';}
    if(exact.officialSource)item.sourceUrl=exact.officialSource;
    if(exact.officeLocations?.length){
     const address=exact.officeLocations[0].address;
     for(const c of ['北京','上海','深圳','广州','杭州','南京','苏州','合肥','济南','潍坊','青岛','惠州','许昌','东莞','西安','宁德','福州','福清','厦门','长沙','宁波','武汉','温州']){
      if(address.includes(c)){item.city=c;break;}
     }
    }
   }
  }
  // Final and only source of clickable recruiting destinations.
  // A verified group portal is explicitly labelled and may never be silently inherited by children.
  for(const item of map){
   const record=getDomesticRecruitment(item.name);
   item.careers=record?.url;
   if(record?.aliases?.length){
    item.aliases=[...new Set([...(item.aliases||[]),...record.aliases])];
   }
  }
  cache=map;
  return map;
}
export function loadDomesticCompanies():Promise<DomesticCompany[]>{return Promise.resolve(getDomesticCompanies());}
const synonyms:Record<string,string[]>={
 '电气自动化':['电气','自动化','电力','工业控制','控制系统','PLC','伺服','变频','机电','智能制造','电网','输配电','机器人'],
 '机械制造':['机械','机床','工业装备','智能制造','工程机械','机器人','制造'],
 '人工智能':['人工智能','智能','软件','算力','计算机','大模型'],
 '计算机':['计算机','软件','信息技术','网络','互联网','云计算','半导体'],
 '新能源':['新能源','储能','光伏','电池','风电','电力'],
 '舞蹈学':['舞蹈','艺术','教育','演艺','文旅','传媒']
};
export function searchDomesticCompanies(all:DomesticCompany[],raw:string,limit=36){
 const query=normalize(raw.trim());
 if(!query)return [];
 const oneCharacter=Array.from(query).length===1;
 const take=oneCharacter?Math.min(limit,16):limit;
 const parts=raw.trim().split(/[\s,，、；;]+/).map(normalize).filter(Boolean);
 const words=parts.length>1?parts:[query];
 const expansions=oneCharacter?[]:[...new Set(Object.entries(synonyms).filter(([k])=>query.includes(normalize(k))||normalize(k).includes(query))
 .flatMap(([,values])=>values.map(normalize)))];
 return all.map(company=>{
  const labels=aliasesFor(company).map(normalize).filter(Boolean);
  const code=normalize(company.stockCode||'');
  const tags=company.tags.map(normalize);
  const overview=normalize(company.overview);
  const industry=normalize(company.industry);
  const city=normalize((company.province||'')+(company.city||''));
  let score=0;
  const named=labels.some(n=>n.includes(query));
  for(const term of words){
   const nameScore=labels.reduce((best,n)=>Math.max(best,
    n===term?2800:n.startsWith(term)?1900:n.includes(term)?1000:0),0);
   if(nameScore){score+=nameScore;continue;}
   if(code===term&&code)score+=2100;
   else if(!oneCharacter){
    if(tags.some(t=>t.includes(term)))score+=340;
    else if(industry.includes(term))score+=110;
    else if(overview.includes(term))score+=20;
    else if(city.includes(term))score+=12;
    else if(normalize(company.parentName||'').includes(term))score+=8;
   }
  }
  if(!oneCharacter)for(const word of expansions){
   if(tags.some(t=>t.includes(word)))score+=30;
   else if(industry.includes(word))score+=10;
  }
  // One-character Chinese queries ONLY search names; avoid 5,000 unrelated industry matches.
  if(oneCharacter&&!named)score=0;
  if(score>0&&company.status==='industry_reviewed')score+=95;
  if(score>0&&verifiedCareerProfiles[company.name]?.summary)score+=170;
  return {company,score};
 }).filter(v=>v.score>0)
 .sort((a,b)=>b.score-a.score||a.company.name.localeCompare(b.company.name,'zh-CN'))
 .slice(0,take).map(v=>v.company);
}
export function companyById(all:DomesticCompany[],id:string){return all.find(c=>c.id===id)||null}
export function findRelatedCompanies(all:DomesticCompany[],company:DomesticCompany){
 const descendants:DomesticCompany[]=[];const checked=new Set<string>([company.id]);
 const queue:[string,number][]=[[company.name,0]];
 while(queue.length){
  const [name,depth]=queue.shift()!;
  if(depth>=2)continue;
  for(const child of all){
   if(checked.has(child.id)||!child.parentName||normalize(child.parentName)!==normalize(name))continue;
   checked.add(child.id);descendants.push(child);
   if(child.entityKind!=='business')queue.push([child.name,depth+1]);
  }
 }
 return descendants;
}
export function findParentCompany(all:DomesticCompany[],company:DomesticCompany){
 return company.parentName?all.find(c=>aliasesFor(c).some(name=>normalize(name)===normalize(company.parentName!)))||null:null;
}
