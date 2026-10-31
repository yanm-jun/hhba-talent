import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import rolesData from '../data/domesticCsairVerifiedPositions20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import {CompanyMajorJobs} from '../components/CompanyMajorJobs';

const majors=['全部专业','不限专业','交通运输','航空航天类','机械工程','电子信息','计算机科学与技术','工商管理','英语','其他专业'];
const services=[
 {name:'航空旅客运输',intro:'经营国内及国际航空客运，提供航线网络和旅客航空运输服务。',tags:'客运 · 航线网络',topics:['航空客运及航线网络','旅客运输与服务保障','航线运营及相关管理']},
 {name:'航空货运与物流',intro:'开展航空货运和相关物流运输服务，连接国内外航空运输网络。',tags:'货运 · 航空物流',topics:['航空货物运输','航空货运网络管理','货运流程与服务支持']},
 {name:'飞机维修与运行保障',intro:'围绕航班安全运行开展机务维修、运行支持及相关航空专业技术活动。',tags:'航空安全 · 机务保障',topics:['机务维修及技术保障','航班运行支持','航空安全和运行管理']},
 {name:'数字技术与客户服务',intro:'以数字化、软件技术、客户服务系统支持旅客与航空业务。',tags:'科技 · 运营服务',topics:['航空信息系统','数字化与业务服务支持','客户服务及业务改进']},
 {name:'航空食品与地面服务',intro:'通过航空食品和地面服务相关业务，保障旅客体验及航空运行。',tags:'食品 · 地面保障',topics:['航空餐食及相关业务','地面旅客服务','运营协同与保障']},
 {name:'航空产业链延伸业务',intro:'相关业务主体开展通用航空、培训、装备及航空产业配套服务。',tags:'通用航空 · 专业服务',topics:['通用航空相关服务','航空培训和配套服务','航空产业多元业务']}
];
const photoRoot=import.meta.env.BASE_URL+'images/csair-user/';
export function CsairCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 // Original official list doesn't publish majors for these six specific positions.
 // Retain them across all subject choices; never imply official unrestricted eligibility.
 const jobs=rolesData.jobs.filter(job=>major==='全部专业'||major==='不限专业'||job.majors.length===0||(job.majors as string[]).includes(major));
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-csair-compact" data-company-template="unified-v2" data-four-block-contract="hero,majors,jobs,business" data-employer-id="cn-autumn-004" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业标识、建筑及飞机照片">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={photoRoot+'csair-logo.png'} alt="中国南方航空用户提供的品牌标识"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>中国南方航空 <span>CHINA SOUTHERN AIRLINES</span></h1>
      <p>航空客运 · 航空货运 · 航空技术 · 运行保障</p>
     </div>
     <a href="https://job.csair.cn/global" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer" className="hhba-kpmg-quick-link">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={photoRoot+'csair-building.webp'} alt="用户提供的中国南方航空标识建筑场景照片" loading="eager"/><figcaption><span>南航标识建筑场景</span><small>用户提供照片</small></figcaption></figure>
     <figure><img src={photoRoot+'csair-aircraft.webp'} alt="用户提供的中国南方航空客机机队照片" loading="eager"/><figcaption><span>南航机队及运行场景</span><small>用户提供照片</small></figcaption></figure>
    </div>
    <p className="hhba-csair-photo-note">三张图片由用户提供，分别独立展示。建筑具体楼宇信息和照片拍摄时间尚未独立核验，不标注为当前公司总部。</p>
   </section>
   <CompanyMajorJobs companyRoute="/companies/autumn/cn-autumn-004"/>

   <section className="hhba-kpmg-section" aria-labelledby="csair-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="csair-services-title">主要业务与专业服务</h2><p>核心业务概要，可展开查看详细内容。</p></div></div>
    <div className="hhba-kpmg-service-grid">
     {services.slice(0,expanded?6:4).map((service,i)=><article className="hhba-kpmg-service" key={service.name}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{service.name}</h3><p>{service.intro}</p><span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary><div className="hhba-kpmg-service-detail"><strong>业务介绍</strong><ul>{service.topics.map(x=><li key={x}>{x}</li>)}</ul></div></details>
     </article>)}
    </div>
    <button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起其他业务':'查看更多专业服务（共 6 项）'} <ChevronDown className={expanded?'is-up':''} size={15}/></button>
   </section>
  </article>
 </Shell>;
}
