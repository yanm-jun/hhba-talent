import curated from '../data/aiCompanyCatalog.json';
import editorial from '../data/domesticCompanyEditorial.json';

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
const normalize=(value:string)=>value.toLocaleLowerCase().replace(/[\s·・（）()\-—_]/g,'');
let cache:Promise<DomesticCompany[]>|undefined;
function clean(value?:string){return value?.trim()||undefined}
function oneCompanyFromRoster(r:Listed,roster:Roster,prior?:{
 id:string;name:string;industry:string;overview:string;careers:string|null;evidenceUrl?:string;lastReviewed:string;
}):DomesticCompany{
 const e=details[r.name]||details[prior?.name||''];
 return {
 id:r.id,name:prior?.name||r.name,legalName:clean(r.legalName),
 industry:e?.industry||r.industry||'行业待细分',
 overview:e?.overview||(r.industry?'交易所历史名录行业分类：'+r.industry+'。具体主营业务有待核验。':'交易所上市企业名录记录，主营业务尚待核验。'),
 province:clean(r.province),city:clean(r.city),website:clean(e?.website||r.website),
 careers:clean(e?.careers||prior?.careers||undefined),
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
 if(r.careersUrl&&!c.careers){c.careers=r.careersUrl;c.careersShared=true;}
}
export function loadDomesticCompanies():Promise<DomesticCompany[]>{
 if(cache)return cache;
 cache=(async()=>{
  const base=import.meta.env.BASE_URL+'data/';
  const [rosterResponse,relationResponse]=await Promise.all([
   fetch(base+'domestic-listed-companies.json',{credentials:'omit'}),
   fetch(base+'domestic-company-relations.json',{credentials:'omit'})
  ]);
  if(!rosterResponse.ok||!relationResponse.ok)throw Error('国内企业资料暂不可用');
  const roster=await rosterResponse.json() as Roster;
  const relationships=await relationResponse.json() as RelationFeed;
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
    website:clean(e?.website),careers:clean(e?.careers||c.careers||undefined),sourceUrl:e?.sourceUrl||c.evidenceUrl||'',
    lastReviewed:e?'2026-10-23':c.lastReviewed,tags:e?.tags||[],route:'/companies/domestic/'+c.id,
    status:e?'industry_reviewed':'official_entry_only',entityKind:'company'});
  }
  const index=createCompanyIndex(map);
  for(const [name,e] of Object.entries(details)){
   if(index.has(normalize(name)))continue;
   const c:DomesticCompany={id:'spot-'+normalize(name),name,industry:e.industry,overview:e.overview,
    website:clean(e.website),careers:clean(e.careers),sourceUrl:e.sourceUrl||e.website||'',
    lastReviewed:'2026-10-23',tags:e.tags,route:'/companies/domestic/spot-'+normalize(name),
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
  return map;
 })().catch(error=>{cache=undefined;throw error});
 return cache;
}
const synonyms:Record<string,string[]>={
 '电气自动化':['电气','自动化','电力','工业控制','控制系统','PLC','伺服','变频','机电','智能制造','电网','输配电','机器人'],
 '机械制造':['机械','机床','工业装备','智能制造','工程机械','机器人','制造'],
 '人工智能':['人工智能','智能','软件','算力','计算机','大模型'],
 '计算机':['计算机','软件','信息技术','网络','互联网','云计算','半导体'],
 '新能源':['新能源','储能','光伏','电池','风电','电力'],
 '舞蹈学':['舞蹈','艺术','教育','演艺','文旅','传媒']
};
export function searchDomesticCompanies(all:DomesticCompany[],raw:string,limit=36){
 const query=normalize(raw);if(query.length<2)return [];
 const parts=raw.split(/[\s,，、；;]+/).map(normalize).filter(x=>x.length>1);
 const words=parts.length>1?parts:[query];
 const expansions=[...new Set(Object.entries(synonyms).filter(([k])=>query.includes(normalize(k))||normalize(k).includes(query)).flatMap(([,v])=>v))];
 return all.map(c=>{
  const name=normalize(aliasesFor(c).join(' ')+(c.stockCode||''));
  const industry=normalize(c.industry),tag=normalize(c.tags.join(' ')),description=normalize(c.overview);
  const address=normalize((c.province||'')+(c.city||''));
  const parent=normalize(c.parentName||'');
  let score=0;
  for(const word of words){
   if(name.includes(word))score+=100;
   else if(tag.includes(word))score+=55;
   else if(industry.includes(word))score+=28;
   else if(description.includes(word))score+=12;
   else if(address.includes(word))score+=3;
   else if(parent.includes(word))score+=8;
  }
  for(const word of expansions.map(normalize)){
   if(tag.includes(word))score+=9;
   else if(industry.includes(word))score+=4;
   else if(name.includes(word))score+=3;
  }
  if(score&&c.status==='industry_reviewed')score+=18;
  return {company:c,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.company.name.localeCompare(b.company.name,'zh-CN'))
  .slice(0,limit).map(x=>x.company);
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
