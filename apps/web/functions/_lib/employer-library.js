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
 return {id:employerKey(name),name,industry_id,parent_name,relation:clean(raw.relation,60)||null,
  aliases,portals,source_datasets:['admin_import'],updated_at:new Date().toISOString()};
}
function overlay(base,custom){
 const map=new Map(base.map(x=>[employerKey(x.name),x]));
 for(const item of custom){
  const former=map.get(item.id);
  if(!former){map.set(item.id,item);continue;}
  const portals=[...former.portals||[]];
  for(const portal of item.portals||[]){
   if(!portals.some(p=>p.url===portal.url))portals.push(portal);
  }
  map.set(item.id,{...former,...item,
   parent_name:item.parent_name||former.parent_name||null,
   relation:item.relation||former.relation||null,
   aliases:[...new Set([...(former.aliases||[]),...(item.aliases||[])])],
   portals,source_datasets:[...new Set([...(former.source_datasets||[]),...(item.source_datasets||[])])]});
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
 return {halls:seed.halls,items:overlay(seed.items,custom),editable,seed_count:seed.items.length};
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
export function employerSearchHints(library,resume,roleHint='',max=2){
 if(!Array.isArray(library)||!library.length)return [];
 const context=clean(roleHint,90)+' '+clean(resume,1800);
 const explicit=library.filter(x=>[x.name,...(x.aliases||[])].some(n=>n.length>=3&&context.includes(n)))
  .filter(x=>x.portals?.some(p=>p.scope==='employer_portal'));
 const hall=roleHalls.find(([,pattern])=>pattern.test(clean(roleHint,90)))?.[0]||
  roleHalls.find(([,pattern])=>pattern.test(clean(resume,700)))?.[0];
 const sector=hall?library.filter(x=>x.industry_id===hall&&x.portals?.some(p=>p.scope==='employer_portal')):[];
 const candidates=[...explicit,...sector];
 const result=[],seen=new Set();
 for(const item of candidates){
  const p=item.portals.find(x=>x.scope==='employer_portal'&&portalUrl(x.url));
  if(!p||seen.has(item.id))continue;
  seen.add(item.id);
  const hostname=new URL(p.url).hostname;
  // Use only publicly supplied recruitment hosts. The provider must still search and verify actual job pages.
  result.push((clean(roleHint,50)||'招聘岗位')+' '+item.name+' site:'+hostname+' 岗位 职位 中国大陆');
  if(result.length>=max)break;
 }
 return result;
}
