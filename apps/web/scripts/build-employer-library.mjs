#!/usr/bin/env node
// Build a compact, deterministic library from existing reviewed HHBA sources.
// Run: node apps/web/scripts/build-employer-library.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=name=>JSON.parse(readFileSync(join(root,'src/data',name),'utf8'));
const halls=[
 ['automotive','汽车馆'],['semiconductor','电子半导体馆'],
 ['internet-ai','互联网与AI馆'],['energy','能源电力馆'],
 ['manufacturing','智能制造馆'],['finance','金融馆'],
 ['telecom','通信馆'],['biomed','医药生物馆'],
 ['aerospace','航空航天馆'],['logistics','交通物流馆'],
 ['construction','建筑工程馆'],['consumer-hardware','家电与智能硬件馆'],
 ['chem-materials','化工新材料馆'],['retail','商贸零售馆'],
 ['agri-food','农业食品馆'],['culture-media','文化传媒馆'],
 ['education-research','教育科研馆']
];
const named={
 automotive:'比亚迪 德赛西威 华域视觉科技（上海）有限公司 华域汽车 上汽集团 潍柴动力 广汽集团 长安汽车 江淮汽车 宇通客车 赛力斯 长城汽车 吉利汽车 理想汽车 蔚来汽车 零跑汽车 小鹏汽车 极氪 奇瑞汽车 东风汽车集团 福耀玻璃 莲花集团 上海申沃客车有限公司 上汽集团乘用车分公司',
 semiconductor:'京东方Ａ 兆易创新 北方华创 歌尔股份 立讯精密 汇顶科技 海康威视',
 'internet-ai':'腾讯 阿里巴巴 字节跳动 百度 美团 金蝶国际 用友网络 携程集团 科大讯飞 浪潮信息 紫光股份',
 energy:'阳光电源 亿纬锂能 隆基绿能 宁德时代 思源电气 许继电气 正泰电器 国电南瑞 平高电气 晶科能源 欣旺达 阳光电动力 亿纬氢能 中国石油 中国石化 中国海油 中国神华',
 manufacturing:'汇川技术 雷赛智能 英威腾 埃斯顿 海康机器人 中控技术 拓斯达 三一重工 上海电气 美的楼宇科技',
 finance:'农业银行 建设银行 工商银行 中国银行 招商银行 浦发银行 中国平安 广发证券 中信证券 光大证券 华泰证券 东方证券 华安证券 交通银行 兴业银行 中信银行 中国人寿 杭州银行 南京银行 北京银行 上海银行 成都银行 邮储银行',
 telecom:'中国移动 中国电信 中国联通 中兴通讯 华为',
 biomed:'药明康德 爱尔眼科 迈瑞医疗 恒瑞医药 智飞生物 泰格医药 联影医疗',
 aerospace:'大疆创新',
 logistics:'中国中车 顺丰控股 中国邮政 上海机场 中国国航 东方航空 南方航空',
 construction:'中国建筑',
 'consumer-hardware':'美的集团 海尔智家 格力电器 小米集团 联想集团 安克创新 TCL科技 海信视像 石头科技 OPPO 荣耀 vivo',
 'chem-materials':'宝钢股份',
 retail:'京东集团 泡泡玛特',
 'agri-food':'贵州茅台 伊利股份 海天味业 牧原股份 温氏股份 海大集团'
};
const key=value=>String(value).normalize('NFKC').replace(/[\s·•]/g,'').toLowerCase();
function classify(name,industry=''){
 const normalized=key(name);
 for(const [id,entries] of Object.entries(named))
  if(entries.split(' ').some(n=>key(n)===normalized))return id;
 const s=String(industry);
 if(/汽车|乘用车|电动汽车|商用车|客车|车身|车灯|车载|车用|底盘|动力总成|变速器|传动轴|汽车零部件|汽车模具/.test(s))return 'automotive';
 if(/轨道交通|铁路|物流|供应链|运输/.test(s))return 'logistics';
 if(/医疗|医药|生物|制药/.test(s))return 'biomed';
 if(/智能家电|家用电器|消费电子/.test(s))return 'consumer-hardware';
 if(/电网|新能源|储能|能源系统|发电|动力电池|光伏/.test(s))return 'energy';
 if(/机器人|工业自动化|工业驱动|工业设备|机械|核心部件|自动化制造/.test(s))return 'manufacturing';
 if(/电子|芯片|集成电路|半导体|显示面板/.test(s))return 'semiconductor';
 return 'uncategorized'; // Flag uncertain categories instead of forcing an incorrect hall.
}
const files=['domesticRecruitmentRegistry.json','domesticRecruitment200Registry.json'];
const relations=load('domesticCompanyRelations.json');
const entries=new Map();
for(const filename of files){
 const source=load(filename),dataset=filename.slice(0,-5);
 for(const [name,portal] of Object.entries(source.entries)){
  const id=key(name);
  const row=entries.get(id)||{id,name,industry_id:classify(name),parent_name:null,relation:null,aliases:[],portals:[],source_datasets:[]};
  for(const alias of portal.aliases||[])if(alias&&!row.aliases.includes(alias))row.aliases.push(alias);
  if(!row.source_datasets.includes(dataset))row.source_datasets.push(dataset);
  if(typeof portal.url==='string'&&/^https:\/\//.test(portal.url)&&!row.portals.some(x=>x.url===portal.url))
   row.portals.push({url:portal.url,label:portal.label||'官方招聘入口',
    scope:portal.kind==='official_recruitment_announcements'?'official_announcement':'employer_portal',
    status:'legacy_reviewed',reviewed_on:portal.verifiedOn||source.reviewedOn||source.verifiedOn||null});
  entries.set(id,row);
 }
}
for(const rel of relations.relations){
 const id=key(rel.child);
 const row=entries.get(id)||{id,name:rel.child,industry_id:classify(rel.child,rel.industry),
  parent_name:null,relation:null,aliases:[],portals:[],source_datasets:[]};
 if(!row.parent_name){row.parent_name=rel.parent;row.relation=rel.relation||'集团成员';}
 if(row.industry_id==='uncategorized')row.industry_id=classify(rel.child,rel.industry);
 for(const alias of rel.aliases||[])if(alias&&!row.aliases.includes(alias))row.aliases.push(alias);
 if(!row.source_datasets.includes('domesticCompanyRelations'))row.source_datasets.push('domesticCompanyRelations');
 // Never turn an inherited group portal into an independent child-company portal.
 entries.set(id,row);
}
// Merge already-collected draft PR source batches WITHOUT claiming the links are vetted.
const draft=load('employerLibraryCandidateBatches.json');
if(draft.schema_version!==1||!Array.isArray(draft.batches))throw Error('INVALID_DRAFT_CANDIDATES');
// The user's 17-hall collection ledger is the target for recovering previous
// conversations. These are historical collection counts, NOT verified links.
const collectionTargets={
 automotive:200,semiconductor:200,'internet-ai':200,energy:300,
 manufacturing:400,finance:100,telecom:100,biomed:300,
 aerospace:300,logistics:300,construction:200,'consumer-hardware':200,
 'chem-materials':200,retail:200,'agri-food':200,'culture-media':200,
 'education-research':200
};
const baseline={automotive:200,semiconductor:200,energy:300};
const totals=Object.fromEntries(halls.map(([id])=>[id,0]));
for(const batch of draft.batches){
 if(!Object.hasOwn(collectionTargets,batch.hall_id)||!Array.isArray(batch.entries))throw Error('INVALID_DRAFT_HALL');
 totals[batch.hall_id]+=batch.entries.length;
 for(const tuple of batch.entries){
  const [seq,name,url,section,kind=null,parent=null]=tuple;
  if(!Number.isInteger(seq)||!name||typeof url!=='string'||!section)throw Error('INVALID_DRAFT_ROW');
  const id=key(name);
  const row=entries.get(id)||{id,name,industry_id:batch.hall_id,parent_name:null,relation:null,
   aliases:[],portals:[],source_datasets:[]};
  row.related_hall_ids=row.related_hall_ids||[];
  if(row.industry_id!==batch.hall_id&&!row.related_hall_ids.includes(batch.hall_id))
   row.related_hall_ids.push(batch.hall_id);
  row.sections=row.sections||[];
  if(!row.sections.some(x=>x.hall_id===batch.hall_id&&x.code===section))
   row.sections.push({hall_id:batch.hall_id,code:section});
  const sourceName='draft_pr_'+batch.source_pr;
  if(!row.source_datasets.includes(sourceName))row.source_datasets.push(sourceName);
  const parentName=typeof parent==='string'?parent.trim():'';
  if(parentName&&key(parentName)!==id&&!row.parent_name){
   row.parent_name=parentName;row.relation='同集团招聘体系（待核）';
  }
  const shared=/SHARED_ATS|GROUP_CAREERS/.test(String(kind));
  const discovery=/NOTICE|DISCOVERY/.test(String(kind));
  if(!row.portals.some(p=>p.url===url))
   row.portals.push({url,label:shared?'集团共用招聘候选':discovery?'招聘公告/检索线索':'招聘入口候选',
    scope:shared?'group_shared_candidate':discovery?'discovery_candidate':'search_candidate',
    status:'collected_unverified',reviewed_on:null,section_code:section,source_pr:batch.source_pr});
  entries.set(id,row);
 }
}
// Recover historical Preview D1 audit sheets B04/B05/B06.
// These 150 source records are NOT part of the 3,800 chat-batch ledger;
// importing their recorded URLs does not certify current recruitment or jobs.
const prior=load('employerLibraryPriorAudit150.json');
if(prior.schema_version!==1||prior.records?.length!==150)throw Error('INVALID_PRIOR_AUDIT_150');
const auditKeys=new Set();
for(const rec of prior.records){
 if(!['B04','B05','B06'].includes(rec.batch)||!Number.isInteger(rec.sequence)||
    rec.sequence<1||rec.sequence>50||!rec.name||!/^https:\/\//.test(rec.url)||
    !halls.some(([id])=>id===rec.industry_id))throw Error('INVALID_AUDIT_RECORD');
 const reference=rec.batch+'-'+rec.sequence;
 if(auditKeys.has(reference))throw Error('DUPLICATE_AUDIT_RECORD');
 auditKeys.add(reference);
 const id=key(rec.name);
 const row=entries.get(id)||{id,name:rec.name,industry_id:rec.industry_id,
  parent_name:null,relation:null,aliases:[],portals:[],source_datasets:[]};
 if(row.industry_id!==rec.industry_id){
  row.related_hall_ids=row.related_hall_ids||[];
  if(!row.related_hall_ids.includes(rec.industry_id))row.related_hall_ids.push(rec.industry_id);
 }
 if(!row.source_datasets.includes('preview_audit_'+rec.batch))row.source_datasets.push('preview_audit_'+rec.batch);
 row.audit_references=row.audit_references||[];
 if(!row.audit_references.some(a=>a.batch===rec.batch&&a.sequence===rec.sequence))
  row.audit_references.push({batch:rec.batch,sequence:rec.sequence,
   preview_status:rec.status,source:'HHBA_20261111_Preview_D1_audit'});
 // Generic jobs boards can never be treated as employer-owned search scopes.
 const host=new URL(rec.url).hostname.toLowerCase();
 const externalBoard=/(?:^|\.)(?:zhaopin\.com|51job\.com|zhipin\.com|liepin\.com|lagou\.com)$/.test(host);
 if(!row.portals.some(p=>p.url===rec.url)){
  row.portals.push({url:rec.url,label:'历史Preview企业来源记录',
   scope:externalBoard||rec.status==='pending'?'discovery_candidate':'search_candidate',
   status:'collected_unverified',reviewed_on:null,
   historical_preview_status:rec.status,source_batch:rec.batch,
   notes:String(rec.notes||'').slice(0,230)});
 }
 entries.set(id,row);
}
// Supplementary automotive corporate-tree research is NEVER part of the
// 3,800 chat-source count. Company status is a research lead, not legal proof.
const automotiveResearch=load('employerLibraryAutomotiveResearch266.json');
if(automotiveResearch.schema_version!==1||automotiveResearch.nodes?.length!==266)
 throw Error('INVALID_AUTOMOTIVE_RESEARCH');
const researchSequences=new Set();
const researchBrandIndex=[];
let researchNonbrandCount=0;
for(const node of automotiveResearch.nodes){
 if(!Number.isInteger(node.sequence)||node.sequence<1||node.sequence>266||
    !node.name||!node.group||!node.source_url||!/^https:\/\//.test(node.source_url))
  throw Error('INVALID_AUTOMOTIVE_NODE');
 if(researchSequences.has(node.sequence))throw Error('DUPLICATE_AUTOMOTIVE_NODE');
 researchSequences.add(node.sequence);
 if(node.entity_type==='品牌/产品线'){
  researchBrandIndex.push({name:node.name,parent_name:node.parent,
   group_name:node.group,evidence_url:node.source_url,
   status:'research_unverified',is_employer:false});
  continue; // Do not turn vehicle brands into separate hiring/legal entities.
 }
 researchNonbrandCount++;
 const id=key(node.name);
 const row=entries.get(id)||{id,name:node.name,industry_id:'automotive',
  parent_name:node.parent||node.group,relation:'关联研究线索（待核）',
  aliases:[],portals:[],source_datasets:[]};
 if(row.industry_id!=='automotive'){
  row.related_hall_ids=row.related_hall_ids||[];
  if(!row.related_hall_ids.includes('automotive'))row.related_hall_ids.push('automotive');
 }
 if(node.entity_type==='官网列示的海外实体')row.research_scope='overseas_entity_not_mainland_search';
 if(!row.source_datasets.includes('automotive_research_266'))
  row.source_datasets.push('automotive_research_266');
 row.research_relationships=row.research_relationships||[];
 if(!row.research_relationships.some(x=>x.sequence===node.sequence))
  row.research_relationships.push({sequence:node.sequence,
   parent_name:node.parent,group_name:node.group,
   entity_type:node.entity_type,relationship_hint:node.relationship,
   source_url:node.source_url,status:'research_unverified'});
 if(node.career_url&&/^https:\/\//.test(node.career_url)&&
    !row.portals.some(p=>p.url===node.career_url))
  row.portals.push({url:node.career_url,label:'汽车集团研究招聘入口线索',
   scope:'search_candidate',status:'collected_unverified',
   reviewed_on:null,source:'automotive_research_266'});
 entries.set(id,row);
}
if(researchNonbrandCount!==230||researchBrandIndex.length!==36)
 throw Error('INVALID_AUTOMOTIVE_TYPE_TOTALS');
// Restore name-only rows from prior chats. A name-only row MUST NOT invent a
// recruitment portal, nor count a business division as an independent company.
const historicalNames=load('employerLibraryRecoveredChatNames.json');
if(historicalNames.schema_version!==1||!Array.isArray(historicalNames.batches))
 throw Error('INVALID_RECOVERED_CHAT_NAMES');
const historicalNonEmployerIndex=[];
let recoveredNameRows=0;
for(const group of historicalNames.batches){
 const hall=group.hall_id||historicalNames.hall_id;
 if(!Object.hasOwn(totals,hall)||!Array.isArray(group.entries)||!group.batch_key)
  throw Error('INVALID_RECOVERED_CHAT_BATCH');
 const sourceLabel='historic_chat_'+group.batch_key;
 const seenSeq=new Set();
 for(const rec of group.entries){
  if(!Number.isInteger(rec.sequence)||rec.sequence<1||rec.sequence>5000||
   seenSeq.has(rec.sequence)||typeof rec.name!=='string'||rec.name.trim().length<2||
   rec.url!==null||rec.url_status!=='not_recorded'||
   !['company_candidate','business_unit'].includes(rec.record_type))
    throw Error('INVALID_RECOVERED_NAME_ROW');
  seenSeq.add(rec.sequence);
  recoveredNameRows++;
  if(rec.record_type==='business_unit'){
   historicalNonEmployerIndex.push({name:rec.name,hall_id:hall,sequence:rec.sequence,
    batch_key:group.batch_key,record_type:rec.record_type});
   continue;
  }
  // Preserve exact history text, but recognize an existing Chinese company
  // when the old list merely adds its English abbreviation in parentheses.
  const bareName=rec.name.replace(/[（(][A-Za-z0-9 +&.\\-]+[）)]$/,'').trim();
  const exact=key(rec.name),bare=key(bareName);
  const id=entries.has(exact)?exact:entries.has(bare)?bare:exact;
  const row=entries.get(id)||{id,name:rec.name,industry_id:hall,parent_name:null,
   relation:null,aliases:[],portals:[],source_datasets:[]};
  if(row.industry_id!==hall){
   row.related_hall_ids=row.related_hall_ids||[];
   if(!row.related_hall_ids.includes(hall))row.related_hall_ids.push(hall);
  }
  if(!row.source_datasets.includes(sourceLabel))row.source_datasets.push(sourceLabel);
  row.historical_source_records=row.historical_source_records||[];
  if(!row.historical_source_records.some(x=>x.batch_key===group.batch_key&&x.sequence===rec.sequence))
   row.historical_source_records.push({batch_key:group.batch_key,sequence:rec.sequence,
    has_original_url:false,record_type:'company_candidate'});
  entries.set(id,row);
 }
 if(seenSeq.size!==group.entries.length||group.entries.length>100)
  throw Error('INVALID_RECOVERED_CHAT_COUNT');
 totals[hall]+=group.entries.length;
}
// Do not lose the 700 already-recovered candidate records when adding more
// historical batches. New galleries may be imported incrementally.
for(const [sector,requiredCount] of Object.entries(baseline))
 if(totals[sector]<requiredCount)throw Error('INCOMPLETE_DRAFT_HALL_'+sector);
for(const [sector,targetCount] of Object.entries(collectionTargets))
 if(totals[sector]>targetCount)throw Error('COLLECTION_HALL_OVER_TARGET_'+sector);
const targetTotal=Object.values(collectionTargets).reduce((a,b)=>a+b,0);
const importedTotal=Object.values(totals).reduce((a,b)=>a+b,0);
const missingByHall=Object.fromEntries(
 Object.entries(collectionTargets).map(([id,target])=>[id,target-totals[id]]));
// Public first-party careers links found while recovering historical chat names.
// Link ownership is sourced, but individual job availability remains unverified.
const found=load('employerLibraryWebFoundPortals.json');
if(found.schema_version!==1||!Array.isArray(found.records))throw Error('INVALID_WEB_FOUND_PORTALS');
let webFoundCount=0;
for(const source of found.records){
 if(!source.name||!halls.some(([id])=>id===source.hall_id)||
    typeof source.url!=='string'||!/^https:\/\//.test(source.url)||
    typeof source.evidence_url!=='string'||!/^https:\/\//.test(source.evidence_url))
  throw Error('INVALID_WEB_FOUND_PORTAL_ROW');
 const id=key(source.name),row=entries.get(id);
 if(!row)throw Error('WEB_FOUND_UNKNOWN_COMPANY_'+id);
 const label='web_found_careers_2026-11-12';
 if(!row.source_datasets.includes(label))row.source_datasets.push(label);
 if(!row.portals.some(p=>p.url===source.url)){
  row.portals.push({url:source.url,label:'企业官网招聘入口（需持续复核）',
   scope:'search_candidate',status:'collected_unverified',reviewed_on:null,
   evidence_url:source.evidence_url,observed_on:source.observed_on,
   source_kind:source.source_kind});
  webFoundCount++;
 }
 entries.set(id,row);
}
const items=[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
const unknown=items.filter(e=>e.industry_id==='uncategorized').map(e=>e.name);
const output={schema_version:1,
 description:'HHBA 历史已审招聘入口 + 未核验草稿PR批次的企业资源索引；不代表在招岗位，不把集团入口视为子公司独立入口。候选 URL 必须经 DeepSeek 公开网页搜索与职位证据核验。',
 source_revision:'2026-11-12',halls:halls.map(([id,name])=>({id,name})),
 collection_coverage:{
  definition:'历史聊天行业馆收集记录数。不是企业唯一实体数，也不是有效官方招聘链接数。',
  target_total:targetTotal,imported_batch_records:importedTotal,
  unimported_batch_records:targetTotal-importedTotal,
  target_by_hall:collectionTargets,imported_by_hall:totals,unimported_by_hall:missingByHall
 },research_brand_index:researchBrandIndex,historical_non_employer_index:historicalNonEmployerIndex,items,
 statistics:{recovered_name_rows:recoveredNameRows,recovered_business_units:historicalNonEmployerIndex.length,
  web_found_portals:webFoundCount,
  automotive_research_nodes:automotiveResearch.nodes.length,automotive_research_brands:researchBrandIndex.length,
  prior_audit_source_rows:prior.records.length,entities:items.length,
  unique_portal_urls:new Set(items.flatMap(e=>e.portals.map(p=>p.url))).size,legacy_portals:items.reduce((n,e)=>n+e.portals.filter(p=>p.status==='legacy_reviewed').length,0),
  candidate_portals:items.reduce((n,e)=>n+e.portals.filter(p=>p.status!=='legacy_reviewed').length,0),
  group_relations:items.filter(e=>e.parent_name).length,unclassified:unknown.length,
  by_hall:Object.fromEntries(halls.map(([id])=>[id,items.filter(e=>e.industry_id===id).length]))}};
writeFileSync(join(root,'public/data/employer-library.json'),JSON.stringify(output,null,2)+'\n');
console.log('HHBA_EMPLOYER_LIBRARY',JSON.stringify({...output.statistics,unknown}));
