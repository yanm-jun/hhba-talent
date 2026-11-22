/**
 * Read-only discovery hints from HHBA's 17 mainland industry halls.
 *
 * An employer-library row is NEVER a live job, a verified career-page owner
 * or a recommendation. It may only suggest a company + role Search query.
 * The existing Search->independent JD->resume evidence gates still own results.
 */
import {recruitmentSourceKind,isMainlandEmployerJobUrl} from './match-employer-source.js';
import {normalizeAutonomousQueries} from './autonomous-mainland-search.js';

export const INDUSTRY_HALL_IDS=Object.freeze([
 'automotive','finance','telecom','semiconductor','internet-ai','construction',
 'aerospace','logistics','culture-media','agri-food','biomed','retail',
 'chem-materials','manufacturing','energy','education-research','consumer-hardware'
]);
const validIndustry=new Set(INDUSTRY_HALL_IDS);
const foreignAts=/(?:^|\.)(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workdayjobs\.com|smartrecruiters\.com|icims\.com|taleo\.net|recruitee\.com|oraclecloud\.com|successfactors\.com|jobvite\.com|teamtailor\.com)$/i;
const nameValid=/^[\p{L}\p{N} （）()&·.\-]{2,48}$/u;
const ignoredKinds=new Set([
 'historical_name_only','aggregated_campus_candidate_unverified',
 'external_careers_candidate_unverified','saved_pending_careers'
]);
const identity=raw=>typeof raw==='string'?raw.trim().replace(/\s+/g,' ').slice(0,65):'';

export function selectedIndexIndustries(ids){
 if(!Array.isArray(ids))return [];
 return [...new Set(ids.filter(x=>typeof x==='string'&&validIndustry.has(x)))].slice(0,5);
}
// The AI planner is authoritative for the search strategy. This fallback
// chooses index *shortcuts* only when the planner omits industry IDs; it does
// not exclude any profession or limit the ordinary public Search stage.
export function fallbackIndexIndustries(roles=[]){
 const input=(Array.isArray(roles)?roles:[roles]).filter(x=>typeof x==='string').join(' ').slice(0,350);
 const out=[];
 for(const [pattern,sectors] of [
  [/(?:汽车|经销商|4S|渠道督导|车企|新能源车|零售运营)/i,['automotive','retail','manufacturing']],
  [/(?:互联网|AI|大模型|软件|产品经理|数据|运营|平台)/i,['internet-ai','retail','consumer-hardware']],
  [/(?:商超|店长|门店|销售|市场|客户)/i,['retail','consumer-hardware','logistics']],
  [/(?:物流|仓储|运输|供应链|快递)/i,['logistics','manufacturing','retail']],
  [/(?:银行|证券|保险|理财|金融)/i,['finance','internet-ai']],
  [/(?:半导体|芯片|电子|硬件)/i,['semiconductor','consumer-hardware']],
  [/(?:电力|新能源|储能|光伏)/i,['energy','manufacturing']],
  [/(?:医疗|生物|医药|医院)/i,['biomed','manufacturing']],
  [/(?:农业|食品|养殖)/i,['agri-food','logistics']],
  [/(?:建筑|土木|施工)/i,['construction','manufacturing']],
  [/(?:化工|材料)/i,['chem-materials','manufacturing']],
  [/(?:传媒|影视|设计|内容)/i,['culture-media','internet-ai']],
  [/(?:科研|培训|教学|教育)/i,['education-research','internet-ai']],
  [/(?:航天|航空)/i,['aerospace','manufacturing']],
  [/(?:通信|运营商|5G)/i,['telecom','internet-ai']]
 ])if(pattern.test(input))out.push(...sectors);
 return selectedIndexIndustries(out.length?out:['retail','manufacturing','internet-ai']);
}
function indexHint(row){
 const company=identity(row?.enterprise),raw=row?.recruitment_url,kind=row?.source_kind;
 if(!company||!nameValid.test(company)||/\d{7}|https?:|@|客服热线|招聘平台|招聘网/i.test(company)||
   typeof raw!=='string'||raw.length>900||ignoredKinds.has(kind))return null;
 let site=null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  if(foreignAts.test(u.hostname))return null;
  if(recruitmentSourceKind(u.href)==='THIRD_PARTY_BOARD')return null;
  // Site restriction is useful only for an employer-shaped domain. An
  // independent HR service's tenant page is never treated as employer-owned.
  if(isMainlandEmployerJobUrl(u.href))site=u.hostname.toLowerCase();
 }catch{return null}
 return {company,site,industry_id:row.industry_id};
}
export function buildIndexedEmployerQueries(rows,roles,{limit=8}={}){
 const directions=normalizeAutonomousQueries(
  (Array.isArray(roles)?roles:[roles]).filter(x=>typeof x==='string')
   .map(x=>identity(x).replace(/(?:企业官网|社招|职位|招聘|工作地点).*/g,'').trim())
   .filter(x=>x.length>=2&&x.length<=38),[],{minLength:2}).slice(0,4);
 if(!directions.length)return [];
 const used=new Set(),perHall=new Map(),items=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const hint=indexHint(row);
  if(!hint||used.has(hint.company))continue;
  used.add(hint.company);
  const group=perHall.get(hint.industry_id)||[];
  if(group.length>=6)continue;
  group.push(hint);perHall.set(hint.industry_id,group);
 }
 // Round robin across AI-selected industries so one giant hall cannot
 // monopolize a research batch.
 let any=true;
 while(any&&items.length<Math.min(12,limit)){
  any=false;
  for(const group of perHall.values()){
   if(group.length&&items.length<Math.min(12,limit)){items.push(group.shift());any=true}
  }
 }
 const queries=items.map((hint,i)=>{
  const role=directions[i%directions.length];
  const core=hint.company+' '+role+' 社会招聘 职位详情';
  return hint.site?core+' site:'+hint.site:core+' 企业官方招聘';
 });
 return normalizeAutonomousQueries(queries);
}
export async function indexedEmployerSearchHints(env,roles,industryIds,opts={}){
 const db=env?.HHBA_JOB_JD_DB;
 const sectors=selectedIndexIndustries(industryIds);
 if(typeof db?.prepare!=='function'||!sectors.length)return {queries:[],considered:0,sectors:[],available:false};
 try{
  // Fixed column names/table and validated enum values; no applicant text
  // or role hints go to D1, no vendor URL is fetched and no PII is stored.
  const sql="SELECT enterprise,recruitment_url,source_kind,industry_id "+
   "FROM hhba_industry_employer_links WHERE industry_id IN ("+
   sectors.map(()=>'?').join(',')+") AND recruitment_url LIKE 'https://%' "+
   "ORDER BY CASE source_kind "+
   "WHEN 'official_public_careers_evidence' THEN 0 "+
   "WHEN 'previously_reviewed_official' THEN 1 "+
   "WHEN 'historical_employer_profile_official_portal' THEN 2 "+
   "WHEN 'saved_careers' THEN 3 "+
   "WHEN 'employer_careers_candidate' THEN 4 ELSE 8 END, industry_id, enterprise LIMIT 180";
  const result=await db.prepare(sql).bind(...sectors).all();
  const rows=Array.isArray(result?.results)?result.results:[];
  return {queries:buildIndexedEmployerQueries(rows,roles,opts),
   considered:rows.length,sectors,available:true};
 }catch{return {queries:[],considered:0,sectors,available:false}}
}
