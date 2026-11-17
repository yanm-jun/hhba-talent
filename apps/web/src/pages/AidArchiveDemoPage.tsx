import {useEffect} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import {WORKER_ARCHIVE_DEMO_NOTICE} from './transparencyDemoData';
import '../styles/transparency-v5.css';

/** Historical preview links now lead to the corresponding standalone V6 archive.
 * The legacy URL itself remains noindex via the Cloudflare header and SPA meta.
 */
export function AidArchiveDemoPage({user}:{user:User|null}){
 const params=new URLSearchParams(window.location.search);
 const view=params.get('view');
 const caseId=params.get('case');
 const target=view==='funds'?'/transparency/funds':view==='reports'?'/transparency/reports':view==='rules'?'/transparency/rules':'/transparency/cases';
 const destination=target+(caseId&&target==='/transparency/cases'?'?case='+encodeURIComponent(caseId):'');
 useEffect(()=>{
  const existing=document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  const previous=existing?.content;
  const tag=existing||document.createElement('meta');
  tag.setAttribute('name','robots');
  tag.setAttribute('content','noindex, nofollow, noarchive');
  if(!existing)document.head.appendChild(tag);
  navigate(destination);
  return()=>{if(existing&&previous!==undefined)existing.content=previous;else if(!existing)tag.remove();};
 },[destination]);
 return <Shell user={user}>
  <div className="hhba-v5-wrap">
   <header className="hhba-v5-subhead"><h1>公开档案已更新</h1><p>原先的集中式演示页面已迁移为独立档案页。</p></header>
   <div className="hhba-v6-demo-note" role="note"><ShieldCheck size={16}/>{WORKER_ARCHIVE_DEMO_NOTICE}</div>
   <Link className="hhba-v5-text-link" to={destination}>进入对应档案 <ArrowRight size={15}/></Link>
  </div>
 </Shell>;
}