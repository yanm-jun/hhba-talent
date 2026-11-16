import {useEffect,useState} from 'react';
import {
  ArrowRight,BriefcaseBusiness,CheckCircle2,FileText,Scale,ShieldCheck,Wallet
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

function ServiceList({items}:{items:string[]}){
 return <ul className="hhba-home-service-list">
  {items.map(item=><li key={item}><CheckCircle2 size={15} aria-hidden="true"/><span>{item}</span></li>)}
 </ul>;
}

export function HomeWorkplacePromise(){
 const [config,setConfig]=useState<PublicHomepageConfig>(publicConfigFallback);
 useEffect(()=>{
  let active=true;
  const endpoint=`${import.meta.env.BASE_URL}api/public/homepage`;
  fetch(endpoint,{headers:{Accept:'application/json'},cache:'no-store'})
   .then(response=>{if(!response.ok)throw new Error('PUBLIC_HOMEPAGE_CONFIG_UNAVAILABLE');return response.json() as Promise<unknown>;})
   .then(value=>{if(active&&isPublicHomepageConfig(value))setConfig(value);})
   .catch(()=>{/* Static preview remains usable with the reviewed fallback configuration. */});
  return ()=>{active=false;};
 },[]);
 const membership=config.membership;
 const distribution=config.distribution;
 const price=(membership.priceCents/100).toFixed(2);
 return <section className="hhba-home-workplace" aria-labelledby="hhba-home-workplace-title">
  <header className="hhba-home-workplace-heading">
   <span className="hhba-home-workplace-kicker">HHBA · CAREER & WORKPLACE SUPPORT</span>
   <h2 id="hhba-home-workplace-title">不只帮你发现机会，也关注你进入职场之后。</h2>
   <p>把求职、职业成长与劳动权益支持连接起来，让一次求职不只是一次性的服务。</p>
  </header>

  <div className="hhba-home-pillars">
   <article className="hhba-home-pillar">
    <span className="hhba-home-pillar-icon"><BriefcaseBusiness size={21}/></span>
    <h3>发现真实机会</h3>
    <p>理解简历中的经历与能力，帮助你寻找企业官方招聘渠道和适合的岗位。</p>
   </article>
   <article className="hhba-home-pillar">
    <span className="hhba-home-pillar-icon"><FileText size={21}/></span>
    <h3>持续职业成长</h3>
    <p>围绕职业目标维护简历与职业档案，让每一次经历都能沉淀为下一次机会。</p>
   </article>
   <article className="hhba-home-pillar">
    <span className="hhba-home-pillar-icon"><ShieldCheck size={21}/></span>
    <h3>关注劳动权益</h3>
    <p>通过公开知识、专业咨询与依法承接的法律服务，帮助劳动者了解可行的处理路径。</p>
   </article>
  </div>

  <div className="hhba-home-business-grid">
   <article className="hhba-home-membership-card" aria-labelledby="hhba-home-membership-title">
    <div className="hhba-home-card-topline">
     <span className="hhba-home-card-kicker">CAREER SERVICE MEMBERSHIP</span>
     <span className="hhba-home-status">{membership.status==='planning'?'服务方案规划中':'会员服务'}</span>
    </div>
    <h3 id="hhba-home-membership-title">持续职业服务方案</h3>
    <div className="hhba-home-price"><strong>¥{price}</strong><span>/ 月</span></div>
    <p className="hhba-home-membership-lead">前六个月，先把简历和职业档案服务做好；达到连续缴费条件后，再按协议申请劳动权益支持。</p>
    <div className="hhba-home-stage">
     <div className="hhba-home-stage-heading"><span>01</span><div><strong>前 {membership.introductoryMonths} 个月</strong><small>职业服务阶段</small></div></div>
     <ServiceList items={membership.firstStageServices}/>
    </div>
    <div className="hhba-home-stage hhba-home-stage-rights">
     <div className="hhba-home-stage-heading"><span>02</span><div><strong>连续缴费满 {membership.introductoryMonths} 期后</strong><small>劳动权益支持阶段</small></div></div>
     <ServiceList items={membership.rightsStageServices}/>
     <p className="hhba-home-qualification">{membership.qualificationNotice}</p>
    </div>
    <div className="hhba-home-membership-bottom">
     <span><Wallet size={15}/>最长服务周期规划：{membership.maxServiceMonths}个月</span>
     <span className="hhba-home-plan-status">{membership.purchaseEnabled?'会员服务开放中':'暂未开放购买'}</span>
    </div>
    <p className="hhba-home-disclaimer">{membership.serviceNotice}</p>
    <Link className="hhba-home-text-link" to="/candidate/account/legal-aid">了解劳动权益支持说明 <ArrowRight size={15}/></Link>
   </article>

   <article className="hhba-home-distribution-card" aria-labelledby="hhba-home-distribution-title">
    <div className="hhba-home-card-topline">
     <span className="hhba-home-card-kicker">TRANSPARENT PROFIT ALLOCATION</span>
     <span className="hhba-home-status">公开制度</span>
    </div>
    <h3 id="hhba-home-distribution-title">让商业创造的价值，也能回到劳动者身边。</h3>
    <p className="hhba-home-distribution-intro">HHBA 已确定以依法核算后的可分配利润为基础，建立 60/40 公开分配制度。</p>
    <div className="hhba-home-distribution-bar" role="img" aria-label={`企业发展 ${distribution.companyPercent}%，劳动者权益帮扶池 ${distribution.workerSupportPercent}%`}>
     <span className="hhba-home-distribution-company" style={{width:`${distribution.companyPercent}%`}}/>
     <span className="hhba-home-distribution-workers" style={{width:`${distribution.workerSupportPercent}%`}}/>
    </div>
    <div className="hhba-home-distribution-values">
     <div><strong>{distribution.companyPercent}%</strong><b>企业发展</b><small>经营发展、团队激励及创始人收益</small></div>
     <div><strong>{distribution.workerSupportPercent}%</strong><b>劳动者权益帮扶池</b><small>专款用于劳动者权益帮扶</small></div>
    </div>
    <div className="hhba-home-report-note">
     <Scale size={18} aria-hidden="true"/>
     <div><strong>{distribution.reportStatus==='not_published'?'首期财务公开报告尚未发布':'财务公开报告'}</strong><p>{distribution.reportNotice}</p></div>
    </div>
    <p className="hhba-home-distribution-basis">分配基数：{distribution.basis}。不按营业流水直接分配。</p>
   </article>
  </div>
 </section>;
}
