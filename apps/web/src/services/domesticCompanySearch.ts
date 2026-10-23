import curated from '../data/aiCompanyCatalog.json';
import editorial from '../data/domesticCompanyEditorial.json';
export type DomesticCompany={id:string;name:string;legalName?:string;industry:string;overview:string;province?:string;city?:string;website?:string;careers?:string;sourceUrl:string;lastReviewed:string;tags:string[];stockCode?:string;route:string;status:'industry_reviewed'|'official_entry_only'|'listed_identity_only'};
type Listed={id:string;name:string;legalName?:string;industry?:string;province?:string;city?:string;website?:string;code:string;exchange:string};
type Roster={companies:Listed[];sourceDate:string;sourceUrls:Record<string,string>};
type Editorial={industry:string;overview:string;tags:string[];website?:string;sourceUrl?:string;careers?:string};
const details=editorial as Record<string,Editorial>;
let cache:Promise<DomesticCompany[]>|undefined;
const normalize=(value:string)=>value.toLocaleLowerCase().replace(/[\s·・（）()\-—_]/g,'');
const field=(s?:string)=>s?.trim()||'';
export function loadDomesticCompanies():Promise<DomesticCompany[]>{
 if(cache)return cache;
 cache=(async()=>{
  const url=import.meta.env.BASE_URL+'data/domestic-listed-companies.json';
  const response=await fetch(url,{credentials:'omit'});
  if(!response.ok)throw Error('国内企业名录暂不可用');
  const roster=await response.json() as Roster;
  if(!Array.isArray(roster.companies)||roster.companies.length<5500)throw Error('企业名录不完整');
  const existing=(curated.companies as Array<{id:string;name:string;industry:string;overview:string;careers:string|null;evidenceUrl?:string;lastReviewed:string;provenance:string}>)
   .filter(c=>c.provenance==='official_recruitment_entry_only');
  const byName=new Map(existing.map(c=>[normalize(c.name),c]));
  const included=new Set<string>();
  const map=roster.companies.map(r=>{
   const prior=byName.get(normalize(r.name))||byName.get(normalize(r.legalName||''));if(prior)included.add(prior.id);
   const e=details[r.name]||details[prior?.name||''];
   const name=prior?.name||r.name;
   const status=e?'industry_reviewed':prior?'official_entry_only':'listed_identity_only';
   return {id:r.id,name,legalName:r.legalName,industry:e?.industry||r.industry||'行业待细分',
     overview:e?.overview|| (r.industry?'交易所历史名录行业分类：'+r.industry+'。具体主营业务有待核验。':'交易所上市企业名录记录，主营业务尚待核验。'),
     province:r.province,city:r.city,website:e?.website||r.website,careers:e?.careers||prior?.careers||undefined,
     sourceUrl:e?.sourceUrl||roster.sourceUrls[r.exchange]||'',lastReviewed:e?'2026-10-23':prior?.lastReviewed||roster.sourceDate,
     tags:e?.tags||[],stockCode:r.code,route:'/companies/domestic/'+r.id,status} as DomesticCompany;
  });
  for(const c of existing){
   if(included.has(c.id))continue;
   const e=details[c.name];map.push({id:c.id,name:c.name,industry:e?.industry||c.industry,overview:e?.overview||c.overview,
    website:e?.website,careers:e?.careers||c.careers||undefined,sourceUrl:e?.sourceUrl||c.evidenceUrl||'',
    lastReviewed:e?'2026-10-23':c.lastReviewed,tags:e?.tags||[],route:'/companies/domestic/'+c.id,
    status:e?'industry_reviewed':'official_entry_only'});
  }
  for(const [name,e] of Object.entries(details)){
   if(map.some(c=>normalize(c.name)===normalize(name)))continue;
   const id='spot-'+normalize(name);
   map.push({id,name,industry:e.industry,overview:e.overview,website:e.website,careers:e.careers,
    sourceUrl:e.sourceUrl||e.website||'',lastReviewed:'2026-10-23',tags:e.tags,
    route:'/companies/domestic/'+id,status:'industry_reviewed'});
  }
  return map;
 })().catch(e=>{cache=undefined;throw e});
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
  const name=normalize(c.name+' '+(c.legalName||'')+' '+(c.stockCode||''));
  const industry=normalize(c.industry),tag=normalize(c.tags.join(' ')),description=normalize(c.overview);
  const address=normalize((c.province||'')+(c.city||''));
  let score=0;
  for(const word of words){if(name.includes(word))score+=100;else if(tag.includes(word))score+=55;else if(industry.includes(word))score+=28;else if(description.includes(word))score+=12;else if(address.includes(word))score+=3;}
  for(const word of expansions.map(normalize)){if(tag.includes(word))score+=9;else if(industry.includes(word))score+=4;else if(name.includes(word))score+=3;}
  if(score&&c.status==='industry_reviewed')score+=18;
  return {company:c,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.company.name.localeCompare(b.company.name,'zh-CN')).slice(0,limit).map(x=>x.company);
}
export function companyById(all:DomesticCompany[],id:string){return all.find(c=>c.id===id)||null}
