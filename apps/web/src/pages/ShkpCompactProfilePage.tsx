import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
const gallery=import.meta.env.BASE_URL+'images/shkp-user/';
const businesses=[
 {name:'住宅地产开发',intro:'香港和内地住宅项目开发、建设与销售。',tags:'住宅 · 项目开发',topics:['项目规划及土地发展','住宅开发与建筑质量','客户交付与售后服务']},
 {name:'商业综合体运营',intro:'商场零售租赁、商业推广与会员体验管理。',tags:'购物中心 · 商业运营',topics:['购物中心租务','品牌合作与市场活动','会员运营与客户研究']},
 {name:'甲级写字楼与租赁',intro:'环球贸易广场等大型写字楼项目的开发及租赁。',tags:'写字楼 · 资产管理',topics:['商业资产与办公楼租赁','客户与租户关系','设施与物业升级']},
 {name:'酒店及服务式套房',intro:'酒店、住宿与相关服务业务。',tags:'酒店 · 服务业',topics:['酒店业务管理','宾客服务与运营','住宿产品与设施管理']},
 {name:'物业管理与建筑工程',intro:'项目工程协调、建筑设备及物业服务。',tags:'建筑工程 · 物业',topics:['楼宇工程与机电系统','项目施工与设施维护','物业质量与安全管理']},
 {name:'科技、物流与其他业务',intro:'集团相关的数字服务、物流基础设施与其他投资。',tags:'数字化 · 物流',topics:['业务信息系统','商业智能与数字分析','物流与基础设施']}
];
export function ShkpCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();const [expanded,setExpanded]=useState(false);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-shkp-compact" data-company-template="unified-v2" data-four-block-contract="hero,majors,jobs,business" data-domestic-rebuild="v2" data-employer-id="cn-autumn-010">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="新鸿基地产品牌及独立企业图片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={gallery+'shkp-logo.webp'} alt="用户提供的新鸿基地产 SHKP 中英文品牌标识" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>新鸿基地产 <span>SUN HUNG KAI PROPERTIES</span></h1>
      <p>住宅开发 · 商业运营 · 写字楼 · 物业与建筑工程</p>
     </div>
     <a className="hhba-kpmg-quick-link" data-hhba-recruitment-outbound="true" href="https://www.shkp.com/zh-CN/work-with-us/job-vacancies" rel="noopener noreferrer" target="_blank">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={gallery+'shkp-icc.webp'} alt="用户提供的香港西九龙环球贸易广场ICC建筑照片" loading="eager"/><figcaption><span>香港环球贸易广场（ICC）</span><small>用户上传 · 建筑项目资料图片</small></figcaption></figure>
     <figure><img src={gallery+'shkp-mall.webp'} alt="用户提供的新城市广场 New Town Plaza 室内照片" loading="eager"/><figcaption><span>新城市广场商业空间</span><small>用户上传 · 商业运营展示</small></figcaption></figure>
    </div>
    <p className="hhba-hypergryph-photo-note">三张图片均为用户提供的独立素材，网页展示不附加外链；建筑及商业空间图片拍摄时间未独立核实。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-010"
    majorIntro="已收录8条来自集团官方独立职位详情页的具体职位（地点：香港，是否仍开放投递待官网核对）。选择专业后筛选HHBA整理的相关岗位，不代表该专业必然满足企业官方录用条件。2027届内地管理培训生项目另有官方报名信息，截止2026年11月22日，不将它拆成假岗位。"
    quickMajorNames={['土木工程','建筑学','工程管理','电气工程及其自动化','建筑电气与智能化','市场营销','工商管理','传播学','法学','房地产开发与管理']}/>
   <section className="hhba-kpmg-section" aria-labelledby="shkp-business-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="shkp-business-title">主要业务与专业服务</h2>
     <p>基于集团公开业务介绍整理，业务类别不等于独立招聘法人。</p>
    </div></div>
    <div className="hhba-kpmg-service-grid">
     {businesses.slice(0,expanded?6:4).map((s,i)=><article className="hhba-kpmg-service" key={s.name}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{s.name}</h3><p>{s.intro}</p><span className="hhba-kpmg-service-tags">{s.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail"><strong>主要业务</strong><ul>{s.topics.map(t=><li key={t}>{t}</li>)}</ul></div></details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起其他业务':'查看更多专业服务（共 6 项）'} <ChevronDown className={expanded?'is-up':''} size={15}/></button>
   </section>
  </article>
 </Shell>;
}
