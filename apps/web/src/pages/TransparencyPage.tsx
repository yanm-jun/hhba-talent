import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,FileText,FolderOpen,Scale,ShieldCheck,WalletCards} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import '../styles/transparency-v5.css';

type Latest={period:string;publishedAt:string};
const endpoint=import.meta.env.BASE_URL+'api/transparency/reports';
const legacyTargets:Record<string,string>={
 '#public-case-register':'/transparency/cases',
 '#public-fund-register':'/transparency/funds',
 '#fin-latest-title':'/transparency/reports#fin-latest-title',
 '#hhba-fin-history-title':'/transparency/reports#hhba-fin-history-title',
 '#fin-subscribe-title':'/transparency/reports#fin-subscribe-title',
 '#responsibility-support':'/transparency/rules#responsibility-support',
 '#financial-allocation':'/transparency/rules#financial-allocation',
 '#public-policy-monitor':'/transparency/rules#public-policy-monitor'
};
export function TransparencyPage({user}:{user:User|null}){
 const [latest,setLatest]=useState<Latest|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{
  const hash=window.location.hash;
  const target=legacyTargets[hash]||(new URLSearchParams(window.location.search).has('period')?'/transparency/reports':null);
  if(target){
   const withPeriod=target.startsWith('/transparency/reports')?target.split('#')[0]+window.location.search+(target.includes('#')?'#'+target.split('#')[1]:''):target;
   navigate(withPeriod);return;
  }
  let active=true;
  fetch(endpoint,{cache:'no-store'})
   .then(async res=>{if(!res.ok)throw Error('REPORTS_UNAVAILABLE');return res.json() as Promise<{ok:boolean;reports:Latest[]}>;})
   .then(data=>{if(!active)return;if(data.ok!==true||!Array.isArray(data.reports))throw Error('BAD_REPORTS');
    setLatest(data.reports[0]||null);setStatus('ready');})
   .catch(()=>{if(active)setStatus('error');});
  return()=>{active=false;};
 },[]);
 const latestLabel=latest?latest.period.replace('-','年')+'月':'';
 return <Shell user={user}>
  <div className="hhba-v5-wrap hhba-v5-home">
   <header className="hhba-v5-homehead">
    <span className="hhba-v5-kicker">HHBA / RESPONSIBILITY & TRANSPARENCY</span>
    <h1>责任与透明</h1>
    <p>把承诺、规则与实际公开记录放在一起，让每一项信息都能找到来源。</p>
   </header>
   <section className="hhba-v5-principle" aria-labelledby="v5-principle-title">
    <div className="hhba-v5-principle-label"><span>OUR COMMITMENT</span><h2 id="v5-principle-title">可分配利润使用原则</h2><p>依法核算并履行必要程序后，按照以下比例分配。</p></div>
    <div className="hhba-v5-ratio"><div><strong>60<small>%</small></strong><span>企业发展</span></div><div><strong>40<small>%</small></strong><span>劳动者权益帮扶池</span></div></div>
    <div className="hhba-v5-principle-foot"><span>分配原则不代表已发生计提、划拨或支出；具体金额以正式发布的财务报告为准。</span><Link to="/transparency/rules#financial-allocation">查看计算规则 <ArrowRight size={15}/></Link></div>
   </section>
   <section className="hhba-v5-directory" aria-labelledby="v5-directory-title">
    <div className="hhba-v5-section-label"><span>PUBLIC ARCHIVES</span><h2 id="v5-directory-title">公开档案</h2><p>按需要选择目录，进入独立页面查阅。</p></div>
    <div className="hhba-v5-cardgrid">
     <Link className="hhba-v5-navcard" to="/transparency/cases"><div className="hhba-v5-navcard-top"><span>01 / CASE ARCHIVE</span><FolderOpen size={21}/></div><strong>帮扶案例</strong><p>案件类别、审核后公开的摘要与处理进展</p><span className="hhba-v5-card-bottom">进入档案 <ArrowUpRight size={16}/></span></Link>
     <Link className="hhba-v5-navcard" to="/transparency/funds"><div className="hhba-v5-navcard-top"><span>02 / FUND RECORDS</span><WalletCards size={21}/></div><strong>资金收支</strong><p>月度收支汇总及经审核可公开的明细</p><span className="hhba-v5-card-bottom">进入档案 <ArrowUpRight size={16}/></span></Link>
     <Link className="hhba-v5-navcard" to="/transparency/reports"><div className="hhba-v5-navcard-top"><span>03 / FINANCIAL REPORTS</span><FileText size={21}/></div><strong>财务报告</strong><p>正式月报、历史披露、修订与订阅</p><span className="hhba-v5-card-bottom">进入档案 <ArrowUpRight size={16}/></span></Link>
     <Link className="hhba-v5-navcard" to="/transparency/rules"><div className="hhba-v5-navcard-top"><span>04 / POLICY & OVERSIGHT</span><Scale size={21}/></div><strong>公开制度</strong><p>60/40 分配依据、隐私保护及监督规则</p><span className="hhba-v5-card-bottom">查看制度 <ArrowUpRight size={16}/></span></Link>
    </div>
   </section>
   <section className="hhba-v5-news" aria-labelledby="v5-news-title">
    <div><span className="hhba-v5-kicker">LATEST DISCLOSURE</span><h2 id="v5-news-title">最新公开动态</h2></div>
    <div className="hhba-v5-news-content"><ShieldCheck size={20} aria-hidden="true"/>
     {status==='loading'?<p role="status">正在读取最新已发布报告…</p>:status==='error'?<p role="alert">公开报告暂时无法读取，不展示推测数据。</p>:latest?<p>最新已发布：<strong>{latestLabel}经营与权益帮扶报告</strong><small>公开日期：{latest.publishedAt?.slice(0,10)}</small></p>:<p>暂无已正式发布的月度财务报告。<small>未发布不代表零收入、零支出或零帮扶。</small></p>}
     <Link to="/transparency/reports">查阅月报 <ArrowRight size={15}/></Link>
    </div>
   </section>
   <footer className="hhba-v5-foot"><span>本中心是企业自主披露渠道，不代表独立审计或第三方认证。</span><Link to="/membership/rules">会员与劳动权益服务规则</Link></footer>
  </div>
 </Shell>;
}