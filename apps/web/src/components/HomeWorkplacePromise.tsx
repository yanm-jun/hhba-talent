import {useEffect,useState} from 'react';
import {
  ArrowRight,BriefcaseBusiness,CheckCircle2,FileText,Scale,ShieldCheck
} from 'lucide-react';
import {Link} from '../router';
import publicConfigFallback from '../data/homepagePublicConfig.json';
import '../styles/home-workplace-promise.css';

type PublicHomepageConfig=typeof publicConfigFallback;

function isPublicHomepageConfig(value:unknown):value is PublicHomepageConfig{
 if(!value||typeof value!=='object')return false;
 const candidate=value as Record<string,unknown>;
 const membership=candidate.membership as Record<string,unknown>|undefined;
 const distribution=candidate.distribution as Record<string,unknown>|undefined;
 if(candidate.schemaVersion!==1||!membership||!distribution)return false;
 const first=membership.firstStageServices,rights=membership.rightsStageServices;
 return typeof membership.priceCents==='number'&&Number.isInteger(membership.priceCents)&&membership.priceCents>=0
  &&membership.currency==='CNY'&&membership.billingPeriod==='month'
  &&typeof membership.introductoryMonths==='number'&&Number.isInteger(membership.introductoryMonths)&&membership.introductoryMonths>0
  &&typeof membership.maxServiceMonths==='number'&&Number.isInteger(membership.maxServiceMonths)&&membership.maxServiceMonths>=membership.introductoryMonths
  &&typeof membership.purchaseEnabled==='boolean'&&typeof membership.caseIntakeEnabled==='boolean'
  &&Array.isArray(first)&&first.every(item=>typeof item==='string')
  &&Array.isArray(rights)&&rights.every(item=>typeof item==='string')
  &&typeof membership.qualificationNotice==='string'&&typeof membership.serviceNotice==='string'
  &&Number.isInteger(distribution.companyPercent)&&Number.isInteger(distribution.workerSupportPercent)
  &&Number(distribution.companyPercent)+Number(distribution.workerSupportPercent)===100
  &&typeof distribution.basis==='string'&&typeof distribution.reportStatus==='string'&&typeof distribution.reportNotice==='string';
}

const values=[
 {title:'官方岗位优先',Icon:BriefcaseBusiness},
 {title:'持续职业成长',Icon:FileText},
 {title:'劳动权益支持',Icon:ShieldCheck}
];

function ServiceList({items}:{items:string[]}){
 return <ul className="hhba-home-service-list">
  {items.map(item=><li key={item}><CheckCircle2 size={16} aria-hidden="true"/><span>{item}</span></li>)}
 </ul>;
}

export function HomeWorkplacePromise(){
 const [config,setConfig]=useState<PublicHomepageConfig>(publicConfigFallback);
 const [financeReportPeriod,setFinanceReportPeriod]=useState<string|null>(null);
 const [financeStatusLoaded,setFinanceStatusLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  const endpoint=import.meta.env.BASE_URL+'api/public/homepage';
  fetch(endpoint,{headers:{Accept:'application/json'},cache:'no-store'})
   .then(response=>{if(!response.ok)throw new Error('PUBLIC_HOMEPAGE_CONFIG_UNAVAILABLE');return response.json() as Promise<unknown>;})
   .then(value=>{if(active&&isPublicHomepageConfig(value))setConfig(value);})
   .catch(()=>{/* Static preview remains usable with the reviewed fallback configuration. */});
  return ()=>{active=false;};
 },[]);
 useEffect(()=>{
  let active=true;
  fetch(import.meta.env.BASE_URL+'api/transparency/reports',{cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('REPORTS_UNAVAILABLE');return r.json() as Promise<{reports?:Array<{period:string}>}>;})
   .then(data=>{if(!active)return;setFinanceReportPeriod(data.reports?.[0]?.period||null);setFinanceStatusLoaded(true);})
   .catch(()=>{if(active)setFinanceStatusLoaded(false);});
  return()=>{active=false;};
 },[]);
 const membership=config.membership;
 const distribution=config.distribution;
 const price=(membership.priceCents/100).toFixed(2);
 return <section className="hhba-home-workplace" aria-labelledby="hhba-home-workplace-title">
  <header className="hhba-home-workplace-heading">
   <span className="hhba-home-workplace-kicker">HHBA · MORE THAN A JOB</span>
   <h2 id="hhba-home-workplace-title">找到好工作，只是开始。</h2>
   <p>从职业机会，到持续成长，再到劳动权益支持。</p>
  </header>

  <article className="hhba-home-membership-card" aria-labelledby="hhba-home-membership-title">
   <div className="hhba-home-member-head">
    <div className="hhba-home-member-intro">
     <div className="hhba-home-member-overline">
      <span className="hhba-home-card-kicker">HHBA · CAREER MEMBERSHIP</span>
      <span className="hhba-home-status">{membership.status==='planning'?'方案筹备中':'会员服务'}</span>
     </div>
     <h3 id="hhba-home-membership-title">持续职业服务方案</h3>
     <p>每个月都有实在的职业服务；符合资格后，可按约定申请劳动权益支持。</p>
    </div>
    <div className="hhba-home-price-block" aria-label={'会员规划价格每月'+price+'元'}>
     <div className="hhba-home-price"><span>¥</span><strong>{price}</strong><small>/ 月</small></div>
     <p>最长 {membership.maxServiceMonths} 个月 · 固定服务周期规划</p>
    </div>
   </div>

   <ul className="hhba-home-member-highlights" aria-label="HHBA 服务特点">
    {values.map(({title,Icon})=><li key={title}><Icon size={16} strokeWidth={1.9} aria-hidden="true"/><span>{title}</span></li>)}
   </ul>
   <div className="hhba-home-phase-grid" aria-label="会员服务阶段">
    <section className="hhba-home-stage" aria-labelledby="hhba-home-stage-career-title">
     <div className="hhba-home-stage-heading">
      <span className="hhba-home-stage-index" aria-hidden="true">01</span>
      <div>
       <p>第 1 — {membership.introductoryMonths} 个月</p>
       <h4 id="hhba-home-stage-career-title">持续职业服务</h4>
      </div>
     </div>
     <ServiceList items={membership.firstStageServices}/>
    </section>
    <section className="hhba-home-stage hhba-home-stage-rights" aria-labelledby="hhba-home-stage-rights-title">
     <div className="hhba-home-stage-heading">
      <span className="hhba-home-stage-index" aria-hidden="true">02</span>
      <div>
       <p>连续缴费满 {membership.introductoryMonths} 期后</p>
       <h4 id="hhba-home-stage-rights-title">劳动权益支持</h4>
      </div>
     </div>
     <ServiceList items={membership.rightsStageServices}/>
    </section>
   </div>

   <div className="hhba-home-member-footer">
    <div className="hhba-home-member-status"><ShieldCheck size={17} aria-hidden="true"/><span>{membership.purchaseEnabled?'会员服务已开放':'服务规划中 · 暂未开放购买及案件申请'}</span></div>
    <Link className="hhba-home-text-link" to="/candidate/account/legal-aid">了解权益支持 <ArrowRight size={16} aria-hidden="true"/></Link>
   </div>
   <Link className="hhba-home-rules-link" to="/membership/rules">服务资格、范围与开通说明 <ArrowRight size={14} aria-hidden="true"/></Link>
  </article>

  <aside className="hhba-home-pledge" aria-labelledby="hhba-home-distribution-title">
   <div className="hhba-home-pledge-intro">
    <span className="hhba-home-card-kicker">OUR COMMITMENT · 公开分配原则</span>
    <h3 id="hhba-home-distribution-title">让商业创造的价值，也回到劳动者身边。</h3>
    <p>可分配利润的公开分配原则，与会员服务费用单独核算。</p>
   </div>
   <div className="hhba-home-pledge-visual">
    <div className="hhba-home-distribution-values">
     <div><strong>{distribution.companyPercent}%</strong><span>企业发展</span></div>
     <div><strong>{distribution.workerSupportPercent}%</strong><span>劳动者权益帮扶池</span></div>
    </div>
    <div className="hhba-home-distribution-bar" role="img" aria-label={'企业发展 '+distribution.companyPercent+'%，劳动者权益帮扶池 '+distribution.workerSupportPercent+'%'}>
     <span className="hhba-home-distribution-company" style={{width:distribution.companyPercent+'%'}}/>
     <span className="hhba-home-distribution-workers" style={{width:distribution.workerSupportPercent+'%'}}/>
    </div>
   </div>
   <div className="hhba-home-pledge-bottom">
    <div><Scale size={15} aria-hidden="true"/><span>以{distribution.basis}为基数，不按营业流水分配。</span></div>
    <span className="hhba-home-report-status">{financeReportPeriod?'已公开 '+financeReportPeriod+' 月度报告':financeStatusLoaded?'首期财务报告尚未发布':'财务报告状态以透明中心为准'}</span>
   </div>
   <Link className="hhba-home-report-details hhba-home-transparency-link" to="/transparency">
    <span>查看财务透明中心 · 月度报告与帮扶收支</span>
    <ArrowRight size={14} aria-hidden="true"/>
   </Link>
  </aside>
 </section>;
}
