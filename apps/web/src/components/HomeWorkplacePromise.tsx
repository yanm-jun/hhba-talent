import {useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,FileText,Scale,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import '../styles/home-workplace-promise.css';

// The homepage reuses its original card layout, but no longer advertises a paid membership.
const values=[
 {title:'免费知识查询',Icon:FileText},
 {title:'官方来源优先',Icon:Scale},
 {title:'权益自助指引',Icon:ShieldCheck}
];
const knowledgeItems=[
 '劳动合同、工资与加班等常见问题',
 '社保、休假、工伤与其他劳动保障知识',
 '调岗、辞退、离职与证据保留要点'
];
const guidanceItems=[
 '按职场问题分类查找处理方向',
 '了解相关法律依据和官方办理渠道',
 '阅读证据准备建议与一般处理步骤'
];

function ServiceList({items}:{items:string[]}){
 return <ul className="hhba-home-service-list">
  {items.map(item=><li key={item}><CheckCircle2 size={16} aria-hidden="true"/><span>{item}</span></li>)}
 </ul>;
}

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
   <span className="hhba-home-workplace-kicker">HHBA · MORE THAN A JOB</span>
   <h2 id="hhba-home-workplace-title">找到好工作，只是开始。</h2>
   <p>从求职机会，到了解劳动权益，工作中的问题也值得认真对待。</p>
  </header>

  <article className="hhba-home-membership-card" aria-labelledby="hhba-home-rights-title">
   <div className="hhba-home-member-head">
    <div className="hhba-home-member-intro">
     <div className="hhba-home-member-overline">
      <span className="hhba-home-card-kicker">HHBA · WORKPLACE RIGHTS</span>
      <span className="hhba-home-status">免费开放</span>
     </div>
     <h3 id="hhba-home-rights-title">了解你的劳动权益</h3>
     <p>工作中的问题，有据可查，有路可循。免费查阅常见职场权益知识与自助指引。</p>
    </div>
    <div className="hhba-home-price-block" aria-label="劳动权益知识免费阅读">
     <div className="hhba-home-price"><strong>免费</strong></div>
     <p>知识查询 · 自助指引</p>
    </div>
   </div>

   <ul className="hhba-home-member-highlights" aria-label="劳动权益知识特点">
    {values.map(({title,Icon})=><li key={title}><Icon size={16} strokeWidth={1.9} aria-hidden="true"/><span>{title}</span></li>)}
   </ul>
   <div className="hhba-home-phase-grid" aria-label="劳动权益知识与自助服务">
    <section className="hhba-home-stage" aria-labelledby="hhba-home-stage-knowledge-title">
     <div className="hhba-home-stage-heading">
      <span className="hhba-home-stage-index" aria-hidden="true">01</span>
      <div>
       <p>常见职场问题</p>
       <h4 id="hhba-home-stage-knowledge-title">职场权益知识</h4>
      </div>
     </div>
     <ServiceList items={knowledgeItems}/>
    </section>
    <section className="hhba-home-stage hhba-home-stage-rights" aria-labelledby="hhba-home-stage-guidance-title">
     <div className="hhba-home-stage-heading">
      <span className="hhba-home-stage-index" aria-hidden="true">02</span>
      <div>
       <p>有据可查的处理方向</p>
       <h4 id="hhba-home-stage-guidance-title">权益自助指引</h4>
      </div>
     </div>
     <ServiceList items={guidanceItems}/>
    </section>
   </div>

   <div className="hhba-home-member-footer">
    <div className="hhba-home-member-status"><ShieldCheck size={17} aria-hidden="true"/><span>免费阅读 · 适用规则以官方发布和实际情况为准</span></div>
    <Link className="hhba-home-text-link" to="/rights/knowledge">查看劳动权益知识 <ArrowRight size={16} aria-hidden="true"/></Link>
   </div>
   <div className="hhba-home-service-notes"><p>内容仅供一般信息参考，不构成针对个案的律师意见；平台不提供律师委托或案件代理。</p></div>
  </article>

  <aside className="hhba-home-pledge" aria-labelledby="hhba-home-distribution-title">
   <div className="hhba-home-pledge-intro">
    <span className="hhba-home-card-kicker">OUR COMMITMENT · 责任与透明</span>
    <h3 id="hhba-home-distribution-title">让商业创造的价值，也回到劳动者身边。</h3>
    <p>HHBA 计划每月根据实际经营情况，安排一部分资金，帮助有需要的劳动者。</p>
   </div>
   <div className="hhba-home-pledge-visual">
    <div className="hhba-home-distribution-values" aria-label="月度支持与信息公开方向">
     <div><strong>每月</strong><span>根据实际经营情况安排支持资金</span></div>
     <div><strong>透明</strong><span>逐步公开审核规则与资金使用情况</span></div>
    </div>
   </div>
   <div className="hhba-home-pledge-bottom">
    <div><Scale size={15} aria-hidden="true"/><span>根据经营实际安排，不承诺固定金额或分配比例。</span></div>
    <span className="hhba-home-report-status">{financeReportPeriod?'已公开 '+financeReportPeriod+' 月度报告':financeStatusLoaded?'首期资金报告尚未发布':'资金报告状态以透明中心为准'}</span>
   </div>
   <Link className="hhba-home-report-details hhba-home-transparency-link" to="/transparency">
    <span>了解我们的责任与透明</span>
    <ArrowRight size={14} aria-hidden="true"/>
   </Link>
  </aside>
 </section>;
}
