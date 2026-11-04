import {useEffect,useState} from 'react';
import {useRoute} from '../router';
import {analyticsChoice,chooseAnalytics,trackEvent,activityAreaForRoute,trackAccountActivity} from '../services/engagement';
import {REAL_AUTH_TOKEN_KEY} from '../services/realAuth';
import '../styles/analytics-consent.css';
export function AnalyticsConsent(){
 const route=useRoute();
 const [choice,setChoice]=useState<boolean|null>(()=>analyticsChoice());
 const [authRevision,setAuthRevision]=useState(0);
 // Account session transitions need a new identity-scoped observation, but must
 // not fabricate a second anonymous page view for the same route.
 useEffect(()=>{
  if(choice===true)trackAccountActivity(activityAreaForRoute(route));
 },[route,choice,authRevision]);
 useEffect(()=>{
  if(choice===true && !(/^\/candidate\/(?:account(?:\/.*)?|saved|login|register)$/.test(route)||route==='/auth')){
   trackEvent('page_view',route);
   if(/^\/candidate\/jobs\/[A-Za-z0-9_-]{1,180}$/.test(route))trackEvent('job_view',route);
  }
 },[route,choice]);
 useEffect(()=>{
  const update=()=>setChoice(analyticsChoice());
  const authChanged=()=>setAuthRevision(n=>n+1);
  const otherTabChanged=(event:StorageEvent)=>{
   if(event.key===REAL_AUTH_TOKEN_KEY)authChanged();
   // Explicit consent changes in another tab should also take effect.
   if(event.key==='hhba.analytics.consent.v2')update();
  };
  addEventListener('hhba:analytics-consent',update);
  addEventListener('hhba:real-auth-changed',authChanged);
  addEventListener('storage',otherTabChanged);
  return()=>{
   removeEventListener('hhba:analytics-consent',update);
   removeEventListener('hhba:real-auth-changed',authChanged);
   removeEventListener('storage',otherTabChanged);
  };
 },[]);
 if(import.meta.env.BASE_URL==='/hhba-talent/'||choice!==null)return null;
 return <aside className="hhba-consent" aria-label="访问统计隐私选择">
  <div><strong>匿名访问与账号使用统计</strong><p>同意后会统计登录账号在不同功能类别的按日使用情况，用于计算活跃与回访；账号仅以受保护的统计标识关联到按日功能类别，用于计算活跃和回访。统计库不保存搜索词、简历正文、手机号或具体页面路径；可在个人中心随时关闭并申请清除相关记录。</p></div>
  <div><button type="button" onClick={()=>{chooseAnalytics(false);setChoice(false)}}>暂不同意</button>
  <button type="button" onClick={()=>{chooseAnalytics(true);setChoice(true)}}>同意使用情况统计</button></div>
 </aside>;
}
