import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import rolesData from '../data/domesticSfTechCampusRoles20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';

const majors=['全部专业','计算机科学与技术','软件工程','人工智能','数学与统计','工商管理','设计学','其他专业'];
const services=[
 {name:'快递与速运服务',intro:'围绕时效快递和经济快递提供综合寄递及末端配送服务。',tags:'快递网络 · 寄递服务',topics:['时效及经济型寄递','收派网络与服务运营','履约过程和客户体验']},
 {name:'供应链与综合物流',intro:'依托仓储、运输、配送网络向不同产业客户提供供应链解决方案。',tags:'供应链 · 仓配一体',topics:['仓储与物流网络运营','供应链解决方案','行业客户物流服务']},
 {name:'国际物流与货运',intro:'开展跨境运输、国际货运及相关物流解决方案。',tags:'国际物流 · 跨境运输',topics:['国际物流网络','跨境货运与运营服务','多式联运相关业务']},
 {name:'数字科技与智能运营',intro:'顺丰科技探索 AI、大数据、运筹优化和物流科技应用，支持集团数智化运营。',tags:'AI · 大数据 · 运筹优化',topics:['丰语大模型与智能技术探索','物流业务算法及数据研究','智能运营和科技研发']},
 {name:'供应链科技',intro:'探索数字化工具、决策分析与业务系统的物流行业应用。',tags:'信息技术 · 数据产品',topics:['物流业务信息系统','数据分析及产品研发','业务流程数字化']},
 {name:'客户与行业解决方案',intro:'针对不同客户的物流需求提供专业服务与运营配套。',tags:'行业服务 · 客户体验',topics:['客户服务和需求分析','行业运营解决方案','服务质量与业务协作']}
];
const assetRoot=import.meta.env.BASE_URL+'images/sf-user/';
export function SfExpressCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 // This is only an editorial navigation filter. No source provided hard per-position major constraints.
 const jobs=rolesData.jobs.filter(j=>major==='全部专业'||j.editorialRelatedMajors.includes(major));
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-sf-compact" data-company-template="openai" data-four-block-contract="hero,majors,jobs,business" data-employer-id="cn-autumn-005" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业 Logo 与两张场景照片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={assetRoot+'sf-logo.webp'} alt="顺丰 SF 用户提供品牌标识" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>顺丰 <span>SF EXPRESS</span></h1>
      <p>快递物流 · 供应链 · 国际货运 · 数字科技</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://campus.sf-express.com/#/homePage" target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={assetRoot+'sf-building.webp'} alt="用户提供的带有顺丰 SF 标识的企业建筑照片" loading="eager"/><figcaption><span>顺丰品牌建筑场景</span><small>用户提供照片</small></figcaption></figure>
     <figure><img src={assetRoot+'sf-logistics.webp'} alt="用户提供的顺丰速运货车及物流设施场景照片" loading="eager"/><figcaption><span>快递运输与物流园区</span><small>用户提供照片</small></figcaption></figure>
    </div>
    <p className="hhba-sf-photo-note">Logo 与两张照片来自你上传的独立素材，图片不跳转第三方；建筑具体位置与拍摄日期未独立核验。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-005"/>

   <section className="hhba-kpmg-section" aria-labelledby="sf-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="sf-services-title">主要业务与专业服务</h2><p>顺丰集团主要业务领域；科技岗位的招聘主体已在上方单独注明。</p></div></div>
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
