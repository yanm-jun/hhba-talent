import {getRealAuthToken} from './realAuth';
export type EngagementEvent='page_view'|'job_view'|'job_search'|'official_apply_click';
const METRICS_API='/api/engagement/event';
const ACCOUNT_API='/api/engagement/account';
const LEGACY_OPTOUT='hhba.analytics.consent.v2';
const metricsSupported=import.meta.env.BASE_URL!=='/hhba-talent/';
// No cookies, tokens, client identifiers, page paths, referrers or search text are sent.
// Honor prior explicit refusals and browser-level Do Not Track / GPC preferences.
export function trackEvent(type:EngagementEvent,_legacyRoute?:string):void{
 if(!metricsSupported||typeof navigator==='undefined'||navigator.doNotTrack==='1'||
    (navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true)return;
 try{if(localStorage.getItem(LEGACY_OPTOUT)==='no')return;}catch{return;}
 try{
  void fetch(METRICS_API,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,
    headers:{'Content-Type':'application/json'},body:JSON.stringify({type})}).catch(()=>undefined);
 }catch{}
}
// Legacy opt-in account analytics has been retired, not silently changed to opt-out.
// Keep authenticated self-check and verifiable deletion only for historic rows.
export type AccountArea='general'|'jobs'|'companies'|'policies'|'tools'|'job_save';
export type AnalyticsErasureResult='cleared'|'no-session'|'unavailable';
export async function eraseAccountAnalytics():Promise<AnalyticsErasureResult>{
 if(!metricsSupported)return 'unavailable';
 const token=getRealAuthToken();
 if(!token)return 'no-session';
 try{
  const response=await fetch(ACCOUNT_API,{method:'DELETE',credentials:'same-origin',cache:'no-store',
   headers:{'Authorization':'Bearer '+token}});
  if(response.status===401)return 'no-session';
  if(!response.ok)return 'unavailable';
  const body=await response.json().catch(()=>null) as {ok?:boolean;deleted?:boolean}|null;
  return body?.ok===true&&body.deleted===true?'cleared':'unavailable';
 }catch{return 'unavailable'}
}

// A read-only check of this signed-in candidate's actual D1 activity rows.
// Never returns a user identity, job ID, search term, or resume content.
export type MyActivityCheck={kind:'HHBA_ACCOUNT_ACTIVITY_SELF_CHECK_V1';ok:true;day:string;recorded:boolean;historicalRecorded:boolean;areas:AccountArea[]};
export async function getMyActivityCheck():Promise<MyActivityCheck>{
 if(!metricsSupported)throw Error('该预览环境未启用账号统计。');
 const token=getRealAuthToken();
 if(!token)throw Error('登录会话不可用，请重新登录后查询。');
 let response:Response;
 try{
  response=await fetch('/api/engagement/self-check',{method:'GET',credentials:'same-origin',cache:'no-store',
   headers:{Authorization:'Bearer '+token}});
 }catch{throw Error('统计接口连接失败，请检查网络后重试。');}
 if(response.status===401)throw Error('登录会话已失效，请重新登录。');
 if(response.status===403)throw Error('当前账号无权读取统计记录。');
 if(!response.ok)throw Error('统计数据库暂时不可用，不能将此错误算作零记录。');
 const value=await response.json().catch(()=>null) as Partial<MyActivityCheck>|null;
 if(value?.kind!=='HHBA_ACCOUNT_ACTIVITY_SELF_CHECK_V1'||value.ok!==true||
    typeof value.day!=='string'||typeof value.recorded!=='boolean'||typeof value.historicalRecorded!=='boolean'||!Array.isArray(value.areas))
  throw Error('统计服务响应异常，请重试。');
 return value as MyActivityCheck;
}
