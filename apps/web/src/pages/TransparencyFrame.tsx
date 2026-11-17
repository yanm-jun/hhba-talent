import {useEffect,type ReactNode} from 'react';
import {ArrowLeft} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/transparency-v5.css';
import {WORKER_ARCHIVE_DEMO_MODE,WORKER_ARCHIVE_DEMO_NOTICE} from './transparencyDemoData';

export function TransparencyFrame({user,section,title,description,children}:{user:User|null;section:string;title:string;description:string;children:ReactNode}){
 useEffect(()=>{
  const hash=window.location.hash.slice(1);
  if(!hash)return;
  let targetId='';
  try{targetId=decodeURIComponent(hash);}catch{return;}
  const frame=requestAnimationFrame(()=>document.getElementById(targetId)?.scrollIntoView({block:'start'}));
  return()=>cancelAnimationFrame(frame);
 },[]);
 return <Shell user={user}>
  <div className="hhba-v5-wrap">
   <div className="hhba-v5-crumb"><Link to="/transparency"><ArrowLeft size={15} aria-hidden="true"/> 返回责任与透明</Link><span>{section}</span></div>
   <header className="hhba-v5-subhead">
    <span className="hhba-v5-kicker">HHBA / TRANSPARENCY ARCHIVE</span>
    <h1>{title}</h1><p>{description}</p>
   </header>
   {WORKER_ARCHIVE_DEMO_MODE&&<div className="hhba-v6-demo-note" role="note">{WORKER_ARCHIVE_DEMO_NOTICE}</div>}
   {children}
   <footer className="hhba-v5-foot"><span>汇方职场 · HHBA / 企业自主公开资料</span><Link to="/transparency">返回公开中心</Link></footer>
  </div>
 </Shell>;
}