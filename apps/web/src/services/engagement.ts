import {getRealAuthToken} from './realAuth';
export type EngagementEvent='page_view'|'job_view'|'job_search'|'official_apply_click';
// V2 requires explicit re-consent: a previous anonymous-only opt-in must not authorize account-level tracking.
const KEY='hhba.analytics.consent.v2';
const API='/api/engagement/event';
const ACCOUNT_API='/api/engagement/account';
const metricsSupported=import.meta.env.BASE_URL!=='/hhba-talent/';
export function analyticsChoice():boolean|null{
 try{const v=localStorage.getItem(KEY);return v==='yes'?true:v==='no'?false:null}catch{return null}
}
export type AnalyticsErasureResult='cleared'|'no-session'|'unavailable'|'not-requested';
export function chooseAnalytics(enabled:boolean):Promise<AnalyticsErasureResult>{
 // Stop all client-side collection before requesting remote erasure.
 try{localStorage.setItem(KEY,enabled?'yes':'no')}catch{}
 dispatchEvent(new Event('hhba:analytics-consent'));
 return enabled?Promise.resolve('not-requested'):eraseAccountAnalytics();
}
export function trackEvent(type:EngagementEvent,path=location.pathname){
 if(!metricsSupported || analyticsChoice()!==true ||navigator.doNotTrack==='1'||(navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl===true)return;
 // No URL query, job title, resume text, user ID, email, or search keywords sent.
 try{
  const body=JSON.stringify({type,path:path.split(/[?#]/,1)[0]});
  void fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-HHBA-Consent':'yes'},
   body,credentials:'same-origin',keepalive:true}).catch(()=>undefined);
 }catch{}
}

// A small, explicit category vocabulary: no paths, query terms, job IDs or resume data.
export type AccountArea='general'|'jobs'|'companies'|'policies'|'tools'|'job_save';
export function activityAreaForRoute(route:string):AccountArea{
 if(route.startsWith('/talent-service')||route.startsWith('/talent/'))return 'policies';
 if(route.startsWith('/companies')||route.startsWith('/employer/public'))return 'companies';
 if(route.startsWith('/candidate/jobs')||route.startsWith('/candidate/employer-jobs')||route.startsWith('/candidate/domestic-autumn'))return 'jobs';
 if(route.startsWith('/candidate/match')||route.startsWith('/candidate/account/resume')||route.startsWith('/study-abroad'))return 'tools';
 return 'general';
}
function canCollectAccount():boolean{
 return metricsSupported && analyticsChoice()===true &&
 navigator.doNotTrack!=='1' &&
 (navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl!==true;
}
export function trackAccountActivity(area:AccountArea):void{
 if(!canCollectAccount())return;
 const token=getRealAuthToken();
 if(!token)return;
 void fetch(ACCOUNT_API,{method:'POST',credentials:'same-origin',keepalive:true,
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'X-HHBA-Consent':'yes'},
  body:JSON.stringify({area})}).catch(()=>undefined);
}
// The signed-in user can confirm or retry erasure without enabling tracking.
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
