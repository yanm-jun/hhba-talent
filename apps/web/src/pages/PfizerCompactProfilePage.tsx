import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import rolesData from '../data/domesticPfizerOfficialJobs20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';

/** HHBA Pfizer: four-block format is intentionally identical to the approved CITIC Securities compact page.
 * The three visual assets are supplied by the user. The pictured building bears a historical Pfizer sign;
 * neither photo proves a current headquarters or a particular office location.
 * Official vacancy details are editorial summaries with independently recorded Pfizer job URLs.
 */
const majors=['全部专业','医学','药学','生命科学','化学','生物工程','工商管理','其他专业'];
const services=[
 {name:'创新药物研发',intro:'围绕创新药物发现、临床开发及相关疾病治疗领域开展研发工作。',tags:'药物发现 · 临床研发',topics:['研发项目及治疗方向研究','临床开发与试验协作','科学证据及产品开发']},
 {name:'疫苗与疾病预防',intro:'开展疫苗相关的研究、开发、生产质量与疾病预防科学工作。',tags:'疫苗 · 疾病预防',topics:['疫苗研发和临床评价','疫苗生产与质量保障','疾病预防相关的科学沟通']},
 {name:'生产及供应质量',intro:'在药品生产及供应过程中执行质量保证、文件审查和合规管理。',tags:'GMP · 质量保证 · 供应链',topics:['质量文件和批次记录审查','偏差、变更及持续改进','供应体系和跨团队协同']},
 {name:'医学信息与商业运营',intro:'向医药专业人士进行合规医学信息沟通，并开展客户及业务运营。',tags:'医学沟通 · 合规运营',topics:['医学信息的合规交流','医药专业客户沟通','业务和渠道协作']},
 {name:'临床研究与医学事务',intro:'支持临床证据形成、医学事务和医药科学交流等跨职能工作。',tags:'临床研究 · 医学事务',topics:['临床项目支持','医学信息质量与科学交流','研究数据和多团队协作']},
 {name:'疾病领域与患者需求',intro:'围绕治疗领域的临床需求开展产品研究与相关信息支持。',tags:'疾病领域 · 患者需求',topics:['不同疾病领域的临床需求','治疗信息及教育支持','产品证据和安全性要求']}
];
const base=import.meta.env.BASE_URL+'images/pfizer-user/';
export function PfizerCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 const jobs=rolesData.jobs.filter(job=>{
  if(major==='全部专业')return true;
  // No published major restriction: include unknowns without asserting they're unrestricted.
  if(!job.majors.length)return true;
  if(major==='其他专业')return false;
  return job.majors.includes(major);
 });
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-pfizer-compact" data-company-template="openai" data-four-block-contract="hero,majors,jobs,business" data-employer-id="cn-autumn-003" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业 Logo、办公建筑和研发照片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={base+'pfizer-logo.webp'} alt="辉瑞 Pfizer 用户提供的品牌 Logo" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>辉瑞 <span>PFIZER</span></h1>
      <p>创新药物 · 疫苗 · 生物制药 · 供应质量</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://www.pfizer.com/about/careers/search-results" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={base+'pfizer-building.webp'} alt="用户提供的辉瑞标识建筑外观照片" loading="eager"/><figcaption><span>辉瑞标识建筑外观</span><small>用户提供素材</small></figcaption></figure>
     <figure><img src={base+'pfizer-laboratory.webp'} alt="用户提供的制药研发实验室照片" loading="eager"/><figcaption><span>制药研发实验室场景</span><small>用户提供素材</small></figcaption></figure>
    </div>
    <p className="hhba-pfizer-photo-note">三张素材均来自本次上传，未拼接或 AI 重绘。图片所示地点及研发人员身份未独立核验，不将建筑照片标为“现总部”。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-003"/>

   <section className="hhba-kpmg-section" aria-labelledby="pfizer-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="pfizer-services-title">主要业务与专业服务</h2><p>核心业务摘要，点击卡片可展开详细内容。</p></div></div>
    <div className="hhba-kpmg-service-grid">
     {services.slice(0,expanded?6:4).map((service,i)=><article className="hhba-kpmg-service" key={service.name}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{service.name}</h3><p>{service.intro}</p><span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail"><strong>主要工作</strong><ul>{service.topics.map(x=><li key={x}>{x}</li>)}</ul></div></details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起其他业务':'查看更多专业服务（共 6 项）'} <ChevronDown className={expanded?'is-up':''} size={15}/></button>
   </section>
  </article>
 </Shell>;
}
