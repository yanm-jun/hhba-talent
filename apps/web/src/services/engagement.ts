import {getRealAuthToken} from './realAuth';
export type EngagementEvent='page_view'|'job_view'|'job_search'|'official_apply_click';
const KEY='hhba.analytics.consent.v1';
const API='/api/engagement/event';
const ACCOUNT_API='/api/engagement/account';
const metricsSupported=import.meta.env.BASE_URL!=='/hhba-talent/';
export function analyticsChoice():boolean|null{
 try{const v=localStorage.getItem(KEY);return v==='yes'?true:v==='no'?false:null}catch{return null}
}
export function chooseAnalytics(enabled:boolean){
 if(!enabled && metricsSupported)deleteAccountAnalytics();
 try{localStorage.setItem(KEY,enabled?'yes':'no')}catch{}
 dispatchEvent(new Event('hhba:analytics-consent'));
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
// Best-effort deletion of consented account activity when analytics is switched off.
function deleteAccountAnalytics():void{
 const token=getRealAuthToken();
 if(!token)return;
 void fetch(ACCOUNT_API,{method:'DELETE',credentials:'same-origin',keepalive:true,
  headers:{'Authorization':'Bearer '+token}}).catch(()=>undefined);
}
