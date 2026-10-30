import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';

const gallery=import.meta.env.BASE_URL+'images/anker-user/';
const services=[
 {name:'Anker · 智能充电',intro:'面向个人与家庭的快充、移动电源、充电配件及智能供电设备。',tags:'智能充电 · 消费电子',topics:['充电器与多口供电设备','移动电源与无线充电产品','电源管理技术与消费电子产品体验']},
 {name:'Anker SOLIX · 储能科技',intro:'围绕家庭储能、便携能源和户外电力需求提供智能储能产品。',tags:'储能 · 智能能源',topics:['便携储能与家庭能源系统','能源使用效率与产品控制','储能系统的可靠性与安全体验']},
 {name:'eufy · 智能家居',intro:'围绕家庭安防、家居自动化及家用机器人等场景开展硬件创新。',tags:'智能家居 · 物联网',topics:['家庭安防与智能设备','智能清洁及家用机器人','硬件、软件与家庭交互体验']},
 {name:'soundcore · 智能影音',intro:'面向耳机、音箱及多媒体影音体验的声学和产品研发。',tags:'音频技术 · 影音体验',topics:['蓝牙耳机和音箱产品','声学调校与音频产品设计','消费级智能影音系统']},
 {name:'eufyMake · 创意工具',intro:'围绕个人创作者的数字制造与创意表达场景研发产品。',tags:'创意工具 · 数字制造',topics:['消费级创意生产设备','智能硬件与创作工作流','跨设备的数字制造体验']},
 {name:'全球研发、市场与供应链',intro:'整合跨境品牌运营、产品设计、研发、采购、质量与交付能力。',tags:'全球运营 · 产品协作',topics:['全球市场与品牌业务','研发、工业设计与用户体验','供应链和品质保障协同']}
];
export function AnkerCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [expanded,setExpanded]=useState(false);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-anker-compact" data-company-template="openai" data-domestic-rebuild="v2" data-employer-id="cn-autumn-008">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="安克创新品牌Logo与用户提供企业宣传图">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={gallery+'anker-logo.png'} alt="用户提供的 ANKER 品牌标识原图" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>安克创新 <span>ANKER INNOVATIONS</span></h1>
      <p>全球智能硬件 · 充电储能 · 智能家居 · 智能影音</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://career.anker.com.cn/universities/recruitment/" target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">官方校招 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={gallery+'anker-brand-vision.png'} alt="用户提供的安克创新企业使命与全球业务介绍宣传图" loading="eager"/>
      <figcaption><span>全球创新 · 企业愿景宣传</span><small>独立原始 PNG · 宣传物料</small></figcaption></figure>
     <figure><img src={gallery+'anker-building.png'} alt="用户提供的安克创新企业办公建筑宣传图" loading="eager"/>
      <figcaption><span>安克创新 · 办公建筑展示</span><small>独立原始 PNG · 场景年代待核验</small></figcaption></figure>
    </div>
    <p className="hhba-hypergryph-photo-note">三张图片按上传原始字节保存，未缩放、重新编码或压缩；宣传图内的历史数字不视为实时统计。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-008"
    majorIntro="点击你所学的专业，下方只展示相关的安克创新校招岗位；专业与职位对应关系来自官方职位说明及明确标注的 HHBA 辅助关联。点击「全部专业」可查看所有收录岗位。"
    quickMajorNames={['电子信息工程','计算机科学与技术','软件工程','自动化','人工智能','市场营销','产品设计','统计学','通信工程','机械工程','工商管理']}/>
   <section className="hhba-kpmg-section" aria-labelledby="anker-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="anker-services-title">主要业务与专业服务</h2><p>以安克创新公开品牌与业务为依据整理的六个板块，业务卡片并非公司正式组织架构。</p></div></div>
    <div className="hhba-kpmg-service-grid">
     {services.slice(0,expanded?6:4).map((s,i)=><article className="hhba-kpmg-service" key={s.name}>
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
