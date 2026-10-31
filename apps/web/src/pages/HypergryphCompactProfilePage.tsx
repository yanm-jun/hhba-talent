import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';

const gallery=import.meta.env.BASE_URL+'images/hypergryph-user/';
const services=[
 {name:'游戏研发与制作',intro:'围绕原创游戏产品开展玩法研发、游戏程序开发和内容制作。',tags:'程序技术 · 产品策划',topics:['原创世界观下的游戏玩法和系统研发','游戏客户端、服务端与引擎研发','游戏制作流程与跨部门协作']},
 {name:'游戏美术与艺术设计',intro:'制作游戏角色、场景、界面、动画、特效等视觉内容。',tags:'美术表现 · 互动设计',topics:['角色与场景美术创作','游戏UI和动画设计','视觉特效与美术品质控制']},
 {name:'互动娱乐与内容创作',intro:'以原创世界观和互动叙事为核心，打造拥有艺术价值的游戏体验。',tags:'原创叙事 · 世界观',topics:['明日方舟等自主研发作品','叙事、音乐和世界观协同创作','跨媒介内容表达']},
 {name:'游戏发行与玩家运营',intro:'参与游戏发行、版本运营、市场传播及玩家互动服务。',tags:'发行市场 · 玩家服务',topics:['国内和海外市场运营','玩家反馈与内容社区','游戏产品上线和版本运营']},
 {name:'游戏技术与工程能力',intro:'探索图形渲染、游戏引擎、技术美术与业务技术工具等工程能力。',tags:'图形技术 · 研发',topics:['游戏引擎和图形渲染','研发效能与自动化工具','技术美术及品质优化']},
 {name:'产品质量与体验管理',intro:'通过游戏测试、质量保障与用户研究支持体验改进。',tags:'质量管理 · 用户研究',topics:['游戏功能与品质测试','玩家体验反馈分析','测试开发和质量管理']}
];
export function HypergryphCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [expanded,setExpanded]=useState(false);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-hypergryph-compact" data-company-template="unified-v2" data-four-block-contract="hero,majors,jobs,business" data-domestic-rebuild="v2" data-employer-id="cn-autumn-007">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="鹰角网络Logo与企业照片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={gallery+'hypergryph-logo.png'} alt="鹰角网络 Hypergryph 品牌标识原图" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>鹰角网络 <span>HYPERGRYPH</span></h1>
      <p>游戏研发 · 互动娱乐 · 原创世界观 · 数字艺术</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://career.hypergryph.com/" target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={gallery+'hypergryph-reception.png'} alt="用户提供的鹰角网络接待前台场景照片，原始PNG" loading="eager"/><figcaption><span>企业办公前台场景</span><small>上传原始 PNG · 未重新编码</small></figcaption></figure>
     <figure><img src={gallery+'hypergryph-recruitment-art.png'} alt="用户提供的鹰角网络校招相关视觉海报，原始PNG" loading="eager"/><figcaption><span>招聘主题视觉物料</span><small>上传原始 PNG · 非办公实景</small></figcaption></figure>
    </div>
    <p className="hhba-hypergryph-photo-note">图片均为单独上传的原始 PNG，未压缩或生成；场景拍摄时间与海报所属招聘批次未独立核验。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-007"
    majorIntro="鹰角网络的招聘方向涵盖游戏程序、策划、美术表现、发行运营与测试。点击上方专业标签，下方自动显示对应岗位；点击「全部专业」可以查看全部已收录岗位。"
    quickMajorNames={['数字媒体艺术','动画','视觉传达设计','计算机科学与技术','软件工程','数字媒体技术','人工智能','汉语言文学','市场营销','人力资源管理']}/>
   <section className="hhba-kpmg-section" aria-labelledby="hypergryph-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="hypergryph-services-title">主要业务与专业服务</h2><p>围绕原创游戏研发与发行的业务方向；以下为 HHBA 内容归类，不代表鹰角官网正式组织架构。</p></div></div>
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
