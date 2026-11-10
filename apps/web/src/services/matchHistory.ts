// Private AI recommendation history: account-bound D1, never a job application.
import {getRealAuthToken} from './realAuth';

export type MatchHistorySummary={
 id:string;resume_id:string|null;resume_label:string;role_hint:string;
 created_at:string;job_count:number;best_score:number|null;
 new_job_count:number;improved_job_count:number;
};
export type HistoryMatchedJob={
 id:string;company:string;title:string;location:string;official_url:string;
 match_score:number|null;score_basis:string;recommendation_reason:string;
 availability_status:'OPEN_LISTED'|'UNKNOWN';
 recruitment_source_kind:string;recruitment_source_note:string;
};
export type MatchHistoryDetail=MatchHistorySummary&{matches:HistoryMatchedJob[]};
const api='/api/match-history';
const errorText:Record<string,string>={
 SESSION_INVALID:'登录已失效，请重新登录。',
 FORBIDDEN:'仅限当前已登录的求职者查看匹配历史。',
 MATCH_HISTORY_NOT_FOUND:'记录不存在或你没有访问权限。',
 MATCH_HISTORY_DB_UNAVAILABLE:'匹配历史存储服务尚未配置。',
 MATCH_HISTORY_DB_NOT_READY:'匹配历史数据库尚未完成部署，请稍后重试。',
 RESUME_NOT_OWNED:'所选简历不属于当前登录账号。',
 INVALID_HISTORY_LINK:'保存的简历标识无效，无法关联历史记录。'
};
async function request(path:string,method='GET',data?:unknown){
 const token=getRealAuthToken();
 if(!token)throw Error('请先登录求职者账户。');
 const res=await fetch(api+path,{
  method,credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})
 });
 const json=await res.json().catch(()=>({})) as Record<string,unknown>;
 if(!res.ok)throw Error(errorText[String(json.error||'')]||'匹配历史暂时无法读取，请稍后再试。');
 if(json.ok!==true||json.kind&&json.kind!=='HHBA_ACCOUNT_MATCH_HISTORY_V1')
  throw Error('匹配历史接口返回异常。');
 return json;
}
export async function listMatchHistory():Promise<MatchHistorySummary[]>{
 const res=await request('');
 if(!Array.isArray(res.items))throw Error('匹配历史列表格式异常。');
 return res.items as MatchHistorySummary[];
}
export async function getMatchHistory(id:string):Promise<MatchHistoryDetail>{
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('历史记录标识无效。');
 const res=await request('/'+id);
 if(!res.item||!Array.isArray((res.item as MatchHistoryDetail).matches))
  throw Error('匹配历史详情格式异常。');
 return res.item as MatchHistoryDetail;
}
export async function removeMatchHistory(id:string):Promise<void>{
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('历史记录标识无效。');
 const result=await request('/'+id,'DELETE');
 if(result.deleted!==true)throw Error('删除匹配记录未完成，请重试。');
}
export async function linkMatchHistoryResume(historyId:string,resumeId:string):Promise<void>{
 if(!/^[0-9a-f-]{36}$/i.test(historyId)||!/^[0-9a-f-]{36}$/i.test(resumeId))
  throw Error('简历或历史记录标识无效。');
 await request('/'+historyId+'/link','POST',{resume_id:resumeId});
}
