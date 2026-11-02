export type EngagementEvent='page_view'|'job_view'|'job_search'|'official_apply_click';
const KEY='hhba.analytics.consent.v1';
const API='/api/engagement/event';
const metricsSupported=import.meta.env.BASE_URL!=='/hhba-talent/';
export function analyticsChoice():boolean|null{
 try{const v=localStorage.getItem(KEY);return v==='yes'?true:v==='no'?false:null}catch{return null}
}
export function chooseAnalytics(enabled:boolean){
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
