import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import rolesData from '../data/domesticCiticsSecuritiesRoles20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';

/** CITIC Securities (600030), not CITIC Securities (Shandong) LLC and not CSC Financial.
 * All five job instances are separately sourced listings for different named branches.
 * Official campus application status was not checked in real time.
 */
const majors=['全部专业','不限专业','金融学','经济学','会计学','财务管理','法学','工商管理','市场营销','计算机科学与技术','其他专业'];
const services=[
 {name:'财富管理与证券经纪',intro:'面向个人与机构客户开展证券经纪、投资顾问、客户服务及金融产品配置。',tags:'证券经纪 · 客户服务 · 财富管理',topics:['证券交易及投资者服务','客户关系与金融产品服务','投资顾问及资产配置']},
 {name:'投资银行与企业融资',intro:'面向企业客户开展股权融资、债券承销、并购重组及资本市场服务。',tags:'投资银行 · 股债融资',topics:['上市与资本市场服务','债券融资与结构化融资','并购重组及财务顾问']},
 {name:'机构投资与交易服务',intro:'支持机构投资者在股票、债券、衍生品及其他资本市场产品中的交易和投资活动。',tags:'机构服务 · 投资交易',topics:['机构客户与交易执行','证券研究与投资策略','交易与风险管理']},
 {name:'金融市场与证券研究',intro:'围绕宏观、行业和上市公司进行研究分析，为投资及资本市场业务提供专业支持。',tags:'研究 · 数据 · 策略',topics:['行业与上市公司研究','金融市场与资产定价','风险和政策变化分析']},
 {name:'金融科技与运营',intro:'以信息技术、数据系统及合规运营支持交易、客户服务与资本市场业务。',tags:'IT · 数字化 · 运营',topics:['证券业务系统与平台','信息安全与数据支持','风控和业务运营']},
 {name:'国际业务与专业投资服务',intro:'集团范围内的境外业务、基金、期货和资管等由不同法律主体经营；具体岗位归属须单独核实。',tags:'国际金融 · 资产管理',topics:['跨境资本市场服务','专业投资与资管业务','不同子公司独立招聘主体']}
];
export function CiticsSecuritiesCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 // All five evidenced listings explicitly allow any major; choosing a subject should NOT hide eligible roles.
 const jobs=rolesData.jobs;
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-citics-compact" data-company-template="openai" data-employer-id="a-600030" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业标识、总部和办公照片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><AutumnCompanyBrand name="中信证券" large/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>中信证券 <span>CITIC SECURITIES</span></h1>
      <p>投资银行 · 财富管理 · 机构投资 · 金融科技</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://careers.citics.com/" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-f330eee0347f310e7c9fcb2d.webp'} alt="以前保存的中信证券总部或建筑场景素材，企业归属待最终核验" loading="eager"/><figcaption><span>原有总部建筑素材</span><small>归属待核验</small></figcaption></figure>
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-f9608fde8808381f0d17894b.webp'} alt="以前保存的中信证券办公场景素材，企业归属待最终核验" loading="eager"/><figcaption><span>原有办公场景素材</span><small>归属待核验</small></figcaption></figure>
    </div>
    <p style={{fontSize:11,color:'#809286',margin:'10px 0 0'}}>Logo 和两张图片直接复用旧版素材，没有重新生成；图片及品牌归属尚待逐张核验。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/domestic/a-600030"/>

   <section className="hhba-kpmg-section" aria-labelledby="citics-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="citics-services-title">主要业务与专业服务</h2><p>核心业务摘要，可展开详细信息。</p></div></div>
    <div className="hhba-kpmg-service-grid">
     {services.slice(0,expanded?6:4).map((service,i)=><article className="hhba-kpmg-service" key={service.name}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{service.name}</h3><p>{service.intro}</p><span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail"><strong>主要服务</strong><ul>{service.topics.map(x=><li key={x}>{x}</li>)}</ul></div></details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起其他业务':'查看更多专业服务（共 6 项）'} <ChevronDown className={expanded?'is-up':''} size={15}/></button>
   </section>
  </article>
 </Shell>;
}
