import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import rolesData from '../data/domesticNeteaseCampusRoleDirections20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';

const majors=['全部专业','计算机科学与技术','软件工程','人工智能','数学与统计','数字媒体技术','数字媒体艺术','动画','设计学','工商管理','其他专业'];
const services=[
 {name:'游戏研发与制作',intro:'围绕多类型游戏产品开展策划、程序开发、客户端和服务端技术研发。',tags:'游戏研发 · 策划',topics:['游戏系统及玩法策划','客户端与服务端工程研发','游戏制作流程与协作']},
 {name:'游戏发行与运营',intro:'游戏发行、产品运营及长期用户服务，支持不同游戏产品的持续发展。',tags:'发行 · 运营',topics:['游戏产品发行','内容和活动运营','玩家服务及业务运营']},
 {name:'游戏美术与设计',intro:'支持游戏视觉风格、美术资产和交互体验设计。',tags:'角色 · 场景 · 视觉设计',topics:['角色和场景的视觉设计','游戏界面及交互体验','美术制作和技术协同']},
 {name:'游戏技术与人工智能',intro:'探索游戏引擎、图形技术及人工智能在游戏开发中的应用。',tags:'引擎 · 图形 · AI',topics:['游戏引擎及图形技术','AI及自动化开发应用','工程工具与技术支持']},
 {name:'用户体验与研究',intro:'研究玩家反馈、测试产品体验并持续改进游戏服务。',tags:'用户研究 · 游戏测试',topics:['玩家体验研究','游戏品质测试','数据和反馈分析']},
 {name:'品牌与市场',intro:'开展游戏品牌传播、渠道发行、市场推广及项目协作。',tags:'品牌 · 市场渠道',topics:['品牌传播和推广','渠道与市场运营','跨团队项目管理']}
];
const assetRoot=import.meta.env.BASE_URL+'images/netease-user/';
export function NeteaseGamesCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 // Editorial relevance only; publication did not provide role-specific mandatory major requirements.
 const jobs=rolesData.jobs.filter(j=>major==='全部专业'||j.editorialRelatedMajors.includes(major));
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-netease-compact" data-company-template="unified-v2" data-four-block-contract="hero,majors,jobs,business" data-employer-id="cn-autumn-006" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="网易游戏企业 Logo 与照片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo hhba-netease-logo"><img src={assetRoot+'netease-logo.png'} alt="用户提供的网易游戏 Logo 原始 PNG" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>网易游戏 <span>NETEASE GAMES</span></h1>
      <p>游戏研发 · 游戏发行 · 数字娱乐 · 技术创新</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://campus.game.163.com/" target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={assetRoot+'netease-building.png'} alt="用户提供的网易标识办公建筑原始照片" loading="eager"/><figcaption><span>网易企业建筑场景</span><small>用户上传原始 PNG</small></figcaption></figure>
     <figure><img src={assetRoot+'netease-team.png'} alt="用户提供的网易游戏团队活动合影原始照片" loading="eager"/><figcaption><span>团队活动合影场景</span><small>用户上传原始 PNG</small></figcaption></figure>
    </div>
    <p className="hhba-netease-photo-note">Logo 与两张照片均按你上传的原始 PNG 独立存储，未降低画质或拼图。照片人物、具体办公楼与拍摄时间未独立核验。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-006"/>

   <section className="hhba-kpmg-section" aria-labelledby="netease-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="netease-services-title">主要业务与专业服务</h2><p>默认显示四个板块，可展开其余两个方向。</p></div></div>
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
