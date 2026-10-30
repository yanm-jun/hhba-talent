import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import rolesData from '../data/domesticHuayuVisionRoles20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';

const majors=['全部专业','光电信息科学与工程','机械设计制造及其自动化','车辆工程','电子信息工程',
 '电气工程及其自动化','自动化','计算机科学与技术','软件工程','材料科学与工程','工业工程','机械电子工程'];
const services=[
 {name:'智能汽车照明系统',intro:'面向汽车前照灯、尾灯、车身灯具等领域开展照明系统设计和制造。',tags:'LED车灯 · 信号灯 · 整车配套',topics:['乘用车与商用车照明产品','汽车灯具光学与电子集成','主机厂项目交付']},
 {name:'光学与电子研发',intro:'以光学设计、控制电路、硬件软件以及模组验证支持汽车智能照明。',tags:'光学模组 · 电路开发 · 嵌入式软件',topics:['汽车照明配光和模组设计','电子电路与PCB硬件','车灯电子控制软件']},
 {name:'机械结构与模具',intro:'开展车灯机械结构、3D模型、注塑模具设计及产品装配工程。',tags:'结构设计 · 3D建模 · 模具',topics:['结构与可靠性设计','注塑工装和模具开发','零件设计变更和BOM维护']},
 {name:'智能制造与自动化',intro:'围绕多地灯具生产基地开展生产装备、自动化、注塑和装配工艺。',tags:'工艺技术 · 自动化 · 设备维护',topics:['自动化装备与生产线','注塑、SMT和装配工艺','设备调试与制造技术']},
 {name:'质量管理与产品验证',intro:'覆盖工程产品的客户质量、量产质量、检测认证以及持续改进。',tags:'IATF 16949 · 质量验证',topics:['汽车主机厂客户质量','工艺质量数据和PPAP','可靠性及内部审核']},
 {name:'汽车电子与系统集成',intro:'跨光学、电子、结构和软件团队协同，推动智能车灯系统量产应用。',tags:'电子控制 · 系统集成',topics:['硬件与软件协同验证','汽车电子模块集成','研发到量产的技术协同']}
];
export function HuayuVisionCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 const roles=rolesData.jobs.filter(job=>major==='全部专业'||job.majors.includes(major));
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-huayu-compact" data-company-template="openai" data-employer-id="rel-huayu-004" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业 Logo、办公环境与建筑">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><AutumnCompanyBrand name="华域视觉科技（上海）有限公司" large/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>华域视觉 <span>HASCO VISION</span></h1>
      <p>智能汽车照明 · 汽车电子 · 光学与制造</p>
     </div>
     <a href="https://hascovision.zhiye.com/campus/jobs" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer" className="hhba-kpmg-quick-link">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/e58d8ee59f9fe8a786e8a789e7a791e68a80efbc88e4b88ae6b5b7efbc89e69c89e99990e585ace58fb8-photo-0.webp'} alt="华域视觉公司官网展示的常熟工厂外景" loading="eager"/>
      <figcaption><span>常熟生产基地</span><small>企业官网公开照片</small></figcaption></figure>
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-4f0e78c7cb648df8a4cd2fed.webp'} alt="以前保存的企业建筑场景素材，企业归属尚未最终核验" loading="eager"/>
      <figcaption><span>原有建筑场景素材</span><small>归属待核验</small></figcaption></figure>
    </div>
    <p style={{fontSize:11,color:'#809286',margin:'10px 0 0'}}>Logo 沿用旧版已上传素材，品牌归属仍待最终核验；两张照片均为旧素材，未重新生成。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/domestic/rel-huayu-004"/>

   <section className="hhba-kpmg-section" aria-labelledby="huayu-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="huayu-services-title">主要业务与专业服务</h2><p>精简业务卡片，可按需查看详细信息。</p></div></div>
    <div className="hhba-kpmg-service-grid">
     {services.slice(0,expanded?6:4).map((s,i)=><article className="hhba-kpmg-service" key={s.name}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{s.name}</h3><p>{s.intro}</p><span className="hhba-kpmg-service-tags">{s.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail"><strong>主要工作</strong><ul>{s.topics.map(x=><li key={x}>{x}</li>)}</ul></div></details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起其余业务':'查看全部 6 项业务'} <ChevronDown className={expanded?'is-up':''} size={15}/></button>
   </section>
  </article>
 </Shell>;
}
