import {useEffect} from 'react';
import {ArrowRight,ArrowUpRight,FileText,FolderOpen,Landmark,Scale,ShieldCheck,WalletCards} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import {WORKER_ARCHIVE_DEMO_MODE,WORKER_ARCHIVE_DEMO_NOTICE,workerDemoTotals,workerDemoCurrency} from './transparencyDemoData';
import '../styles/aidArchiveDemo.css';
import '../styles/transparency-v5.css';
const legacyTargets:Record<string,string>={
 '#public-case-register':'/transparency/cases','#public-fund-register':'/transparency/funds',
 '#fin-latest-title':'/transparency/reports#fin-latest-title',
 '#hhba-fin-history-title':'/transparency/reports#hhba-fin-history-title',
 '#fin-subscribe-title':'/transparency/reports#fin-subscribe-title',
 '#responsibility-support':'/transparency/rules#responsibility-support',
 '#financial-allocation':'/transparency/rules#financial-allocation',
 '#public-policy-monitor':'/transparency/rules#public-policy-monitor'
};
export function TransparencyPage({user}:{user:User|null}){
 useEffect(()=>{const target=legacyTargets[window.location.hash]||(new URLSearchParams(window.location.search).has('period')?'/transparency/reports':null);
  if(target){const withPeriod=target.startsWith('/transparency/reports')?target.split('#')[0]+window.location.search+(target.includes('#')?'#'+target.split('#')[1]:''):target;navigate(withPeriod);}
 },[]);
 return <Shell user={user}><div className="hhba-aidarchive hhba-a2 hhba-v6-home" id="financial-disclosure-content">
  <div className="hhba-a2-wrap">
   {WORKER_ARCHIVE_DEMO_MODE&&<div className="hhba-a2-demo" role="note"><ShieldCheck size={16}/><span>{WORKER_ARCHIVE_DEMO_NOTICE}</span></div>}
   <header className="hhba-a2-hero"><div className="hhba-a2-hero-main">
    <span className="hhba-a2-eyebrow">HHBA / WORKER RIGHTS TRANSPARENCY</span>
    <h1>让每一份权益支持，<em>都有迹可循。</em></h1>
    <p>公开劳动者权益帮扶资金的流向、支持案例与处理进展。公司经营订单、营业收入和利润表不属于本中心的公开范围。</p>
   </div></header>
   <div className="hhba-a2-brandline" aria-hidden="true"><span/><span/></div>
   {WORKER_ARCHIVE_DEMO_MODE?
   <><section className="hhba-a2-fund" aria-label="劳动者权益帮扶池资金总览">
    <div className="hhba-a2-fundbalance"><div className="hhba-a2-fundheading">劳动者权益帮扶池</div>
     <p>当前资金结余</p><strong>{workerDemoCurrency(workerDemoTotals.balance)}</strong>
     <small>统计截止：2026 年 11 月 17 日</small></div>
    <div className="hhba-a2-fundstats">
     <div><small>累计入池</small><strong>{workerDemoCurrency(workerDemoTotals.received)}</strong></div>
     <div><small>累计支出</small><strong>{workerDemoCurrency(workerDemoTotals.spent)}</strong></div>
     <Link className="hhba-v6-fund-link" to="/transparency/funds">查看资金明细 <ArrowRight size={16}/></Link>
    </div>
   </section>
   <section className="hhba-a2-stats" aria-label="劳动者权益支持案例概况">
    <div><small>累计受理案例</small><strong>{workerDemoTotals.cases}<em>件</em></strong><p>各类劳动争议及权益咨询</p></div>
    <div><small>已完成</small><strong>{workerDemoTotals.completed}<em>件</em></strong><p>完成对应支持流程</p></div>
    <div><small>处理中</small><strong>{workerDemoTotals.inProgress}<em>件</em></strong><p>支持事项正在推进</p></div>
   </section></>:
   <section className="hhba-v6-official-summary"><ShieldCheck size={21}/><strong>正式资金与案例按审核结果公开</strong><p>尚未公开的数据不会以零或推测金额替代。</p><Link to="/transparency/funds">查阅资金记录 <ArrowRight size={16}/></Link></section>}
   <section className="hhba-a2-archives hhba-v6-archives" aria-labelledby="v6-archives-title">
    <div className="hhba-a2-sectiontitle"><div><span className="hhba-a2-eyebrow">PUBLIC RECORDS / 公开档案</span>
     <h2 id="v6-archives-title">公开档案中心</h2><p>选择目录，按类别、时间和关联编号查阅具体资料。</p></div></div>
    <div className="hhba-v6-archive-rows">
     <Link to="/transparency/cases"><span>01</span><span><strong>帮扶案例公开档案</strong><small>案件检索、处理过程与阶段结果</small></span><FolderOpen size={20}/><ArrowUpRight size={17}/></Link>
     <Link to="/transparency/funds"><span>02</span><span><strong>帮扶资金收支档案</strong><small>资金入池、支出明细与案例关联</small></span><WalletCards size={20}/><ArrowUpRight size={17}/></Link>
     <Link to="/transparency/reports"><span>03</span><span><strong>月度帮扶资金报告</strong><small>资金变化、月度归档及修订</small></span><FileText size={20}/><ArrowUpRight size={17}/></Link>
     <Link to="/transparency/rules"><span>04</span><span><strong>公开制度与监督</strong><small>分配原则、资金审核及隐私保护</small></span><Scale size={20}/><ArrowUpRight size={17}/></Link>
    </div>
   </section>
   <div className="hhba-v6-principle-note"><Landmark size={20}/><p><strong>企业发展 60% · 劳动者权益帮扶池 40%</strong><span>以依法核算后的可分配利润为基础；实际资金往来独立记录。</span></p>
    <Link to="/transparency/rules#financial-allocation">查看规则 <ArrowRight size={15}/></Link></div>
   <footer className="hhba-v6-footer"><ShieldCheck size={17}/><span>公开资料须遵守必要授权和隐私保护；帮扶池数据不等于公司的营业收入或利润。</span></footer>
  </div>
 </div></Shell>;
}