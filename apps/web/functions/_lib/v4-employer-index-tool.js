// Model-directed, read-only access to the public employer directory.
// Pagination bounds one hosting request, never the total research.
import {INDUSTRY_HALL_IDS} from './domestic-employer-index.js';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
const industries=new Set(INDUSTRY_HALL_IDS);
export function normalizeEmployerIndexRequest(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const industryIds=[...new Set((Array.isArray(raw.industries)?raw.industries:[]).filter(x=>industries.has(x)))].sort();
 if(!industryIds.length)return null;
 const offset=Number.isSafeInteger(raw.offset)&&raw.offset>=0?raw.offset:0;
 return {industries:industryIds,offset};
}
export async function readV4EmployerIndex(env,raw){
 const request=normalizeEmployerIndexRequest(raw);
 if(!request)return null;
 const db=env?.HHBA_JOB_JD_DB;
 if(typeof db?.prepare!=='function')return {request,status:'UNAVAILABLE',items:[]};
 const pageSize=100;
 try{
  const sql='SELECT enterprise,recruitment_url,industry_id,source_kind FROM hhba_industry_employer_links WHERE industry_id IN ('+request.industries.map(()=>'?').join(',')+") AND recruitment_url LIKE 'https://%' ORDER BY industry_id,enterprise,recruitment_url LIMIT ? OFFSET ?";
  const result=await db.prepare(sql).bind(...request.industries,pageSize+1,request.offset).all();
  const rows=result.results||[];
  const items=rows.slice(0,pageSize).map(row=>({company:row.enterprise,url:v4PublicJobUrl(row.recruitment_url),industry:row.industry_id,source_kind:row.source_kind})).filter(row=>typeof row.company==='string'&&row.url);
  return {request,status:'OK',items,next_offset:rows.length>pageSize?request.offset+pageSize:null,notice:'仅为企业招聘入口目录，不证明职位正在招聘，不是已核验岗位。'};
 }catch{return {request,status:'UNAVAILABLE',items:[]};}
}
