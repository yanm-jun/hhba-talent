import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
const gallery=import.meta.env.BASE_URL+'images/laifen-user/';
const services=[
 {name:'高速吹风与风道工程',intro:'高速吹风机及气流、温度与舒适体验设计。',tags:'高速电机 · 吹风机',topics:['高速无刷电机的应用','气流与温度控制','个护产品工程设计']},
 {name:'扫振口腔护理',intro:'扫振电动牙刷及刷头、交互体验和产品体系。',tags:'口腔护理 · 扫振技术',topics:['扫振电动牙刷','刷头及清洁体验','用户使用场景']},
 {name:'电动剃须与个护新品',intro:'以直线往复式剃须等产品拓展个人护理类别。',tags:'电动剃须 · 个护',topics:['电动剃须产品','产品人体工学','新产品创新设计']},
 {name:'精密电机与电子研发',intro:'围绕电机、电子控制与产品可靠性建立技术能力。',tags:'电机 · 电子硬件',topics:['电机与驱动技术','硬件系统与测试','工程可靠性']},
 {name:'工业设计与产品体验',intro:'关注产品外观、结构、人机交互与量产设计。',tags:'工业设计 · 产品体验',topics:['产品工业设计','结构设计与工艺','材料与触感体验']},
 {name:'制造、供应链与全球市场',intro:'研发制造协同、供应链交付和全球市场运营。',tags:'制造 · 全球业务',topics:['供应链与制造协作','质量管理与交付','海外渠道和品牌运营']}
];
export function LaifenCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [expanded,setExpanded]=useState(false);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-laifen-compact" data-company-template="openai" data-four-block-contract="hero,majors,jobs,business" data-domestic-rebuild="v2" data-employer-id="cn-autumn-009">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="徕芬科技品牌与产品图片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={gallery+'laifen-logo.webp'} alt="用户提供的徕芬 Laifen 黑色品牌标识" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>徕芬科技 <span>LAIFEN</span></h1>
      <p>智能个护 · 高速电机 · 消费电子 · 产品设计</p>
     </div>
     <a className="hhba-kpmg-quick-link" data-hhba-recruitment-outbound="true" href="https://app.mokahr.com/campus-recruitment/laifen/146139?locale=zh-CN" rel="noopener noreferrer" target="_blank">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={gallery+'laifen-dryer.webp'} alt="用户提供的徕芬吹风机产品展示图" loading="eager"/><figcaption><span>高速吹风机产品展示</span><small>用户上传产品图片 · 非企业建筑实景</small></figcaption></figure>
     <figure><img src={gallery+'laifen-toothbrush.webp'} alt="用户提供的徕芬电动牙刷产品组合展示图" loading="eager"/><figcaption><span>扫振电动牙刷与产品体验</span><small>用户上传产品图片 · 非企业建筑实景</small></figcaption></figure>
    </div>
    <p className="hhba-hypergryph-photo-note">三张素材均来自本次上传，并分别保存为独立的网页优化图片。图片仅供站内展示，不链接第三方网站。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-009"
    majorIntro="目前整理6条有公开名称的岗位记录，其中1条为2027届第三方招聘线索、5条为2026年历史职位，均未确认当前可投递。点击专业标签只筛选与对应岗位存在编辑关联的记录，不代表企业官方设置了该专业门槛。"
    quickMajorNames={['机械工程','机械电子工程','电气工程及其自动化','自动化','电子信息工程','计算机科学与技术','工业设计','市场营销','国际经济与贸易']}/>
   <section className="hhba-kpmg-section" aria-labelledby="laifen-business-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="laifen-business-title">主要业务与专业服务</h2>
     <p>根据徕芬官方品牌介绍及已公开的产品方向编辑归类，不代表招聘主体的独立法人清单。</p>
    </div></div>
    <div className="hhba-kpmg-service-grid">
     {services.slice(0,expanded?6:4).map((s,i)=><article className="hhba-kpmg-service" key={s.name}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{s.name}</h3><p>{s.intro}</p><span className="hhba-kpmg-service-tags">{s.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail"><strong>主要业务</strong><ul>{s.topics.map(t=><li key={t}>{t}</li>)}</ul></div></details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起其他业务':'查看更多业务（共 6 项）'} <ChevronDown className={expanded?'is-up':''}/></button>
   </section>
  </article>
 </Shell>;
}
