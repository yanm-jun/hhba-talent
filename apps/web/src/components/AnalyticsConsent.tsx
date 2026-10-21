import {useEffect,useState} from 'react';
import {useRoute} from '../router';
import {analyticsChoice,chooseAnalytics,trackEvent} from '../services/engagement';
import {demoModeEnabled} from '../services/demoAccount';
import '../styles/analytics-consent.css';
export function AnalyticsConsent(){
 const route=useRoute();
 const [choice,setChoice]=useState<boolean|null>(()=>analyticsChoice());
 useEffect(()=>{
  if(choice===true && !(demoModeEnabled && (/^\/candidate\/(?:account(?:\/.*)?|saved|login|register)$/.test(route)||route==='/auth'))){
   trackEvent('page_view',route);
   if(/^\/candidate\/jobs\/[A-Za-z0-9_-]{1,180}$/.test(route))trackEvent('job_view',route);
  }
 },[route,choice]);
 useEffect(()=>{
  const update=()=>setChoice(analyticsChoice());
  addEventListener('hhba:analytics-consent',update);
  return()=>removeEventListener('hhba:analytics-consent',update);
 },[]);
 if(import.meta.env.BASE_URL==='/hhba-talent/'||choice!==null)return null;
 return <aside className="hhba-consent" aria-label="访问统计隐私选择">
  <div><strong>匿名访问统计</strong><p>帮助 HHBA 了解页面访问和岗位使用情况；不采集搜索词、邮箱、简历或完整职位链接。可随时在个人中心修改。</p></div>
  <div><button type="button" onClick={()=>{chooseAnalytics(false);setChoice(false)}}>暂不同意</button>
  <button type="button" onClick={()=>{chooseAnalytics(true);setChoice(true)}}>同意匿名统计</button></div>
 </aside>;
}
