import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,BriefcaseBusiness,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import '../styles/home-workplace-promise.css';

// Two real, publicly readable HHBA resources. Keep the finance-report state
// transparent without presenting hypothetical funding as an accomplished result.
const resources=[
 {
  href:'/rights/knowledge',
  index:'01 / RIGHTS',
  title:'劳动权益知识库',
  summary:'从劳动合同、工资和社保，到加班、辞退与争议处理。',
  detail:'20 个专题 · 法律依据、证据准备与处理步骤',
  action:'了解劳动权益',
  Icon:BookOpen
 },
 {
  href:'/rights/guide',
  index:'02 / CAREER GUIDE',
  title:'高性价比职场指南',
  summary:'从准备求职到入职、在职、离职，让每一步更有依据。',
  detail:'200 条原创建议 · 覆盖 8 个职业阶段',
  action:'阅读职场指南',
  Icon:BriefcaseBusiness
 }
];

export function HomeWorkplacePromise(){
 const [financeReportPeriod,setFinanceReportPeriod]=useState<string|null>(null);
 const [financeStatusLoaded,setFinanceStatusLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  fetch(import.meta.env.BASE_URL+'api/transparency/reports',{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('REPORTS_UNAVAILABLE');return r.json() as Promise<{reports?:Array<{period:string}>}>;})
   .then(data=>{if(!active)return;setFinanceReportPeriod(data.reports?.[0]?.period||null);setFinanceStatusLoaded(true);})
   .catch(()=>{if(active)setFinanceStatusLoaded(false);});
  return()=>{active=false;};
 },[]);
 return <section className="hhba-home-workplace" aria-labelledby="hhba-home-workplace-title">
  <header className="hhba-home-workplace-heading">
   <span className="hhba-home-workplace-kicker">HHBA · CAREER RESOURCES</span>
   <h2 id="hhba-home-workplace-title">让职业选择更有依据。</h2>
   <p>从职场准备到劳动权益，找到真正有用的信息。</p>
  </header>

  <div className="hhba-home-membership-card hhba-home-resources-panel" aria-label="HHBA 免费职场知识产品">
   <div className="hhba-home-resources-header">
    <div>
     <span className="hhba-home-card-kicker">KNOWLEDGE · MADE PRACTICAL</span>
     <h3>从理解问题，到找到下一步。</h3>
    </div>
    <span className="hhba-home-resources-access">免费开放</span>
   </div>
   <div className="hhba-home-resource-grid">
    {resources.map(({href,index,title,summary,detail,action,Icon})=><Link className="hhba-home-resource-card" to={href} key={href}>
     <div className="hhba-home-resource-top">
      <span className="hhba-home-resource-icon"><Icon size={21} strokeWidth={1.75} aria-hidden="true"/></span>
      <span className="hhba-home-resource-index">{index}</span>
     </div>
     <h4>{title}</h4>
     <p>{summary}</p>
     <span className="hhba-home-resource-detail">{detail}</span>
     <span className="hhba-home-resource-action">{action}<ArrowUpRight size={17} aria-hidden="true"/></span>
    </Link>)}
   </div>
   <div className="hhba-home-resources-note"><ShieldCheck size={16} aria-hidden="true"/><span>免费阅读 · 法律信息仅供一般参考，具体问题以官方规定及实际情况为准。</span></div>
  </div>

  <aside className="hhba-home-pledge" aria-labelledby="hhba-home-distribution-title">
   <div className="hhba-home-pledge-intro">
    <span className="hhba-home-card-kicker">OUR COMMITMENT · 责任与透明</span>
    <h3 id="hhba-home-distribution-title">透明，是我们做事的方式。</h3>
    <p>HHBA 计划每月根据实际经营情况，安排一部分资金帮助有需要的劳动者。</p>
    <p className="hhba-home-pledge-meta">不承诺固定金额或分配比例 · <span className="hhba-home-report-status">{financeReportPeriod?'已公开 '+financeReportPeriod+' 月度报告':financeStatusLoaded?'首期资金报告尚未发布':'资金报告状态以透明中心为准'}</span></p>
   </div>
   <Link className="hhba-home-transparency-link" to="/transparency">
    了解我们的责任与透明 <ArrowRight size={17} aria-hidden="true"/>
   </Link>
  </aside>
 </section>;
}
