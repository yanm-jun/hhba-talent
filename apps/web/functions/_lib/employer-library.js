import {recruitmentSourceKind} from './match-employer-source.js';
// Public employer source index + authenticated D1 changes.
// Recruitment portals are search hints, NEVER a substitute for a real vacancy URL.
const HALL_IDS=new Set([
 'automotive','semiconductor','internet-ai','energy','manufacturing','finance',
 'telecom','biomed','aerospace','logistics','construction','consumer-hardware',
 'chem-materials','retail','agri-food','culture-media','education-research'
]);
export const employerKey=value=>String(value||'').normalize('NFKC').replace(/[\s·•]/g,'').toLowerCase();
const clean=(s,n=100)=>String(s||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function portalUrl(raw){
 if(typeof raw!=='string'||raw.length>900)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))return null;
  // Ordinary third-party job boards are not official enterprise search entrances.
  if(recruitmentSourceKind(url.href)==='THIRD_PARTY_BOARD')return null;
  if(/^(?:localhost|127\.|10\.|192\.168\.|0\.)/i.test(url.hostname))return null;
  return url.href;
 }catch{return null;}
}
export function normalizeEmployerInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_EMPLOYER');
 const name=clean(raw.name,90),industry_id=String(raw.industry_id||'');
 if(name.length<2||!HALL_IDS.has(industry_id))throw Error('INVALID_EMPLOYER_CATEGORY');
 const parent_name=clean(raw.parent_name,90)||null;
 if(parent_name&&employerKey(parent_name)===employerKey(name))throw Error('INVALID_EMPLOYER_PARENT');
 const aliases=Array.isArray(raw.aliases)?[...new Set(raw.aliases.map(x=>clean(x,90)).filter(Boolean))].slice(0,10):[];
 if(raw.aliases!==undefined&&!Array.isArray(raw.aliases))throw Error('INVALID_EMPLOYER_ALIASES');
 const related_hall_ids=raw.related_hall_ids===undefined?[]:raw.related_hall_ids;
 if(!Array.isArray(related_hall_ids)||related_hall_ids.length>16||
    related_hall_ids.some(id=>typeof id!=='string'||!HALL_IDS.has(id)))
  throw Error('INVALID_RELATED_HALLS');
 const portals=[];
 const sources=Array.isArray(raw.portals)?raw.portals:[];
 if(!Array.isArray(raw.portals)&&raw.portals!==undefined)throw Error('INVALID_EMPLOYER_PORTALS');
 if(sources.length>8)throw Error('TOO_MANY_EMPLOYER_PORTALS');
 for(const p of sources){
  const url=portalUrl(typeof p==='string'?p:p?.url);
  if(!url)throw Error('INVALID_EMPLOYER_PORTAL_URL');
  if(!portals.some(v=>v.url===url))portals.push({
   url,label:clean(p?.label||'待复核招聘入口',90),
   scope:'employer_portal',status:'collected_unverified',reviewed_on:null
  });
 }
 return {id:employerKey(name),name,industry_id,
  related_hall_ids:[...new Set(related_hall_ids)].filter(id=>id!==industry_id),
  parent_name,relation:clean(raw.relation,60)||null,
  aliases,portals,source_datasets:['admin_import'],updated_at:new Date().toISOString()};
}
// Importing a company again under another hall ADDS a classification; it must
// never destroy its original hall, previously audited URLs or prior import batch.
// Primary-hall reassignment is a separate audited operation, not an implicit upsert.
export function mergeEmployerRecord(former,item){
 if(!former)return item;
 if(employerKey(former.name)!==item.id)throw Error('EMPLOYER_ID_MISMATCH');
 const primary=HALL_IDS.has(former.industry_id)?former.industry_id:item.industry_id;
 const related=[former.industry_id,item.industry_id,...(former.related_hall_ids||[]),...(item.related_hall_ids||[])]
  .filter(id=>id!==primary&&HALL_IDS.has(id));
 const portals=[...(former.portals||[])];
 for(const portal of item.portals||[]){
  // Preserve verified review and exact source evidence on URL collisions.
  if(!portals.some(p=>p.url===portal.url))portals.push(portal);
 }
 return {...former,...item,id:former.id||item.id,name:former.name,
  industry_id:primary,related_hall_ids:[...new Set(related)],
  parent_name:item.parent_name||former.parent_name||null,
  relation:item.relation||former.relation||null,
  aliases:[...new Set([...(former.aliases||[]),...(item.aliases||[])])],
  portals,source_datasets:[...new Set([...(former.source_datasets||[]),...(item.source_datasets||[])])] };
}
function overlay(base,custom){
 const map=new Map(base.map(x=>[employerKey(x.name),x]));
 for(const item of custom){
  map.set(item.id,mergeEmployerRecord(map.get(item.id),item));
 }
 return [...map.values()].filter(x=>!x.archived).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
}
export async function readEmployerLibrary(env,request){
 if(!env?.ASSETS?.fetch)throw Error('LIBRARY_ASSETS_MISSING');
 const origin=new URL(request.url).origin;
 const res=await env.ASSETS.fetch(new Request(origin+'/data/employer-library.json'));
 if(!res.ok)throw Error('LIBRARY_ASSET_NOT_READY');
 const seed=await res.json();
 if(seed?.schema_version!==1||!Array.isArray(seed.items)||seed.halls?.length!==17)
  throw Error('LIBRARY_ASSET_INVALID');
 const db=env.HHBA_METRICS_DB;
 let custom=[],editable=false;
 if(db?.prepare&&typeof env.HHBA_METRICS_SECRET==='string'&&env.HHBA_METRICS_SECRET.length>=32){
  try{
   const entries=await db.prepare('SELECT data_json FROM hhba_employer_library ORDER BY updated_at DESC LIMIT 5000').all();
   custom=(entries.results||[]).map(r=>JSON.parse(r.data_json));
   editable=true;
  }catch{/* Migration not applied: keep read-only seed, do not silently accept writes. */}
 }
 return {halls:seed.halls,items:overlay(seed.items,custom),editable,seed_count:seed.items.length,
  collection_coverage:seed.collection_coverage||null,
  brand_index:seed.research_brand_index||[]};
}
const roleHalls=[
 ['automotive',/汽车|新能源车|整车|车载|智能驾驶|4S店|DCC|销售督导|经销商/i],
 ['semiconductor',/半导体|芯片|集成电路|封装|IC设计/i],
 ['internet-ai',/人工智能|大模型|互联网|AI产品|软件研发|云计算|程序员|产品经理/i],
 ['energy',/电力|能源|光伏|储能|电池|石油/i],
 ['manufacturing',/机械|工业自动化|制造|机器人|PLC/i],
 ['finance',/金融|银行|证券|基金|保险/i],
 ['telecom',/通信|5G|网络工程|无线网络/i],
 ['biomed',/医药|医疗|制药|生物科技/i],
 ['aerospace',/航空航天|无人机|飞行器/i],
 ['logistics',/物流|铁路|航空运输|货运|供应链/i],
 ['construction',/建筑|土木|工程设计/i],
 ['consumer-hardware',/家电|智能硬件|消费电子/i],
 ['chem-materials',/化学|材料|化工|冶金/i],
 ['retail',/零售|电商|商贸/i],
 ['agri-food',/食品|农业|农学|养殖/i],
 ['culture-media',/传媒|影视|文化娱乐/i],
 ['education-research',/培训|教育机构|教育科技|教研/i]
];
export function employerSearchHints(library,resume,roleHint='',max=2,brandIndex=[]){
 if(!Array.isArray(library)||!library.length||!Number.isInteger(max)||max<1)return [];
 const wanted=clean(roleHint,90).toLowerCase(),experience=clean(resume,1800).toLowerCase();
 const hall=roleHalls.find(([,re])=>re.test(wanted))?.[0]||
  roleHalls.find(([,re])=>re.test(experience))?.[0];
 const usable=p=>(p.scope==='employer_portal'||p.scope==='search_candidate')&&portalUrl(p.url);
 const lookup=new Map(library.filter(x=>x?.name).map(x=>[employerKey(x.name),x]));
 const brandMatches=new Map();
 const context=wanted+' '+experience;
 if(Array.isArray(brandIndex))for(const brand of brandIndex){
  const name=String(brand?.name||'').trim();
  if(name.length<2||!context.includes(name.toLowerCase()))continue;
  const parent=lookup.get(employerKey(brand.parent_name))||
   lookup.get(employerKey(brand.group_name));
  if(parent&&!brandMatches.has(parent.id))brandMatches.set(parent.id,name);
 }
 const ranked=[];
 for(const item of library){
  if(!item?.name||!Array.isArray(item.portals))continue;
  const names=[item.name,...(item.aliases||[])].map(x=>String(x).toLowerCase());
  const inHint=names.some(n=>n.length>=2&&wanted.includes(n));
  const inResume=names.some(n=>n.length>=3&&experience.includes(n));
  const inBrand=brandMatches.has(item.id);
  const inHall=hall&&(item.industry_id===hall||item.related_hall_ids?.includes(hall));
  if(!inHint&&!inResume&&!inHall&&!inBrand)continue;
  const options=item.portals.filter(usable).sort((a,b)=>
   Number(b.status==='legacy_reviewed')-Number(a.status==='legacy_reviewed'));
  // A shared group portal helps find a named subsidiary only when the user's
  // resume or request actually names that company. It is NOT the child's own ATS.
  const explicitlyNamed=inHint||inResume||inBrand;
  const shared=(!options.length&&explicitlyNamed)?
   item.portals.find(p=>p.scope==='group_shared_candidate'&&portalUrl(p.url)):null;
  // Source-backed subsidiary research can point DeepSeek at the group's known
  // recruitment portal, even when the child has no individual recruitment URL.
  // This is a SEARCH HINT only; the job's actual employer must be checked later.
  let inherited=null,groupName='';
  if(!options.length&&!shared&&explicitlyNamed&&item.parent_name){
   const groups=[item.parent_name,
    ...(item.research_relationships||[]).flatMap(x=>[x.parent_name,x.group_name])];
   for(const name of [...new Set(groups.filter(Boolean))]){
    const group=lookup.get(employerKey(name));
    if(!group||group.id===item.id)continue;
    const portal=group.portals?.find(usable);
    if(!portal)continue;
    inherited=portal;groupName=group.name;break;
   }
  }
  const portal=options[0]||shared||inherited;
  if(!portal)continue;
  ranked.push({item,portal,brandName:inBrand?brandMatches.get(item.id):null,
   groupName:inherited?groupName:shared?(item.parent_name||'集团'):'',
   score:(inHint?200:0)+(inResume?80:0)+(inBrand?100:0)+(inHall?40:0)+
    (portal.status==='legacy_reviewed'?20:0)-(shared||inherited?15:0)});
 }
 ranked.sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name,'zh-CN'));
 const hints=[],domains=new Set();
 for(const {item,portal,groupName,brandName} of ranked){
  const hostname=new URL(portal.url).hostname;
  if(domains.has(hostname))continue;
  domains.add(hostname);
  // Search hint only: Search and subsequent JD checking establish the vacancy.
  // Never output this portal as a job link or a verified job opening.
  const groupNote=groupName?' '+groupName+' 集团招聘平台范围（需核实子公司主体）':'';
  hints.push(((clean(roleHint,50)||'招聘岗位')+' '+item.name+
   (brandName?' 品牌'+brandName+'（用人主体待核）':'')+groupNote+
   ' site:'+hostname+' 岗位 职位 中国大陆').slice(0,180));
  if(hints.length>=max)break;
 }
 return hints;
}
