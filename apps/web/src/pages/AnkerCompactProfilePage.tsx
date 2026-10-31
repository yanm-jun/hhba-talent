import {useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';

const gallery=import.meta.env.BASE_URL+'images/anker-user/';
const services=[
 {name:'Anker 智能充电与供电',intro:'面向移动办公与日常使用场景的智能充电、快充和供电产品。',tags:'智能充电 · 氮化镓',topics:['移动电源及充电器产品','PowerIQ 智能快充相关技术','多场景桌面与便携供电']},
 {name:'Anker SOLIX 家庭与便携储能',intro:'家庭储能、阳台光储及新能源管理产品。',tags:'能源管理 · 储能系统',topics:['家庭与便携储能设备','光伏逆变及电池管理','家庭能源管理系统与智能控制']},
 {name:'eufy 智能家居与安防',intro:'家庭安防、清洁机器人与智能家居体验。',tags:'智能家居 · 本地AI',topics:['智能安防摄像与本地存储','清洁机器人与家庭设备','家庭感知与本地智能技术']},
 {name:'soundcore 智能影音',intro:'耳机、音箱和音频娱乐方向的产品创新与研发。',tags:'音频技术 · 影音体验',topics:['真无线耳机与音频产品','主动降噪与声学技术','消费级智能影音体验']},
 {name:'eufyMake 创意工具',intro:'面向个人与家庭的创意制作和数字制造工具。',tags:'创意工具 · 数字制造',topics:['消费级打印与创作设备','数字化制作流程','创作者工具与用户体验']},
 {name:'全球化产品与供应链',intro:'支持全球市场、供应链管理、制造交付与品牌运营。',tags:'全球业务 · 运营管理',topics:['多地区产品上市与市场运营','全球采购及供应链协同','质量控制、制造与交付体系']}
];
export function AnkerCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [expanded,setExpanded]=useState(false);
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-anker-compact" data-company-template="openai" data-four-block-contract="hero,majors,jobs,business" data-domestic-rebuild="v2" data-employer-id="cn-autumn-008">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="安克创新品牌标识与企业资料图片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={gallery+'anker-logo.png'} alt="用户提供的 ANKER 品牌标识原始 PNG" loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>安克创新 <span>ANKER INNOVATIONS</span></h1>
      <p>智能充电 · 家庭储能 · 智能家居 · 影音与创意工具</p>
     </div>
     <a className="hhba-kpmg-quick-link" href="https://career.anker.com.cn/universities/recruitment/" target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={gallery+'anker-brand-vision.png'} alt="用户提供的安克创新全球化智能硬件品牌介绍截图原始 PNG" loading="eager"/><figcaption><span>品牌理念与全球业务展示</span><small>上传原始 PNG · 未重新编码</small></figcaption></figure>
     <figure><img src={gallery+'anker-building.png'} alt="用户提供的安克创新办公建筑介绍截图原始 PNG" loading="eager"/><figcaption><span>企业建筑资料展示</span><small>上传原始 PNG · 未重新编码</small></figcaption></figure>
    </div>
    <p className="hhba-hypergryph-photo-note">三张素材均为你提供的原始 PNG；以上品牌和建筑资料展示图保留原图内容，建筑地点、拍摄日期与图中文字未由 HHBA 独立核验。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-008"
    majorIntro="2027届校招涉及算法、软硬件开发、市场与运营、供应链及职能等方向。点击专业标签，下方会显示与之关联的安克创新具体岗位；选择「全部专业」可以浏览全部收录职位。"
    quickMajorNames={['电子信息工程','计算机科学与技术','软件工程','人工智能','自动化','电气工程及其自动化','机械设计制造及其自动化','光电信息科学与工程','产品设计','市场营销','国际经济与贸易','金融学']}/>
   <section className="hhba-kpmg-section" aria-labelledby="anker-services-title">
    <div className="hhba-kpmg-section-heading"><div>
      <h2 id="anker-services-title">主要业务与专业服务</h2>
      <p>根据安克创新官方公开的产品与业务体系整理；此处为 HHBA 编辑归类，并非独立子公司的法律主体清单。</p>
    </div></div>
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
