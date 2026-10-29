import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import rolesData from '../data/domesticHuaanSecuritiesRoles20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';

const majors=['全部专业','金融学','经济学','会计学','财务管理','统计学',
 '计算机科学与技术','软件工程','人工智能','数据科学与大数据技术',
 '信息管理与信息系统','数学与应用数学','工商管理','市场营销','工业设计'];
const services=[
 {name:'财富管理与证券经纪',intro:'面向个人及高净值客户提供证券交易、财富配置、投资顾问和金融产品服务。',tags:'财富管理 · 证券经纪 · 投顾',topics:['证券交易与投资顾问','客户资产配置服务','经纪业务与客户运营']},
 {name:'投资银行与企业融资',intro:'为企业提供股票、债券融资、资本市场方案、并购重组和资产证券化相关服务。',tags:'股债融资 · 投行 · 并购',topics:['股票和债券承销','企业融资与财务顾问','资产证券化与项目执行']},
 {name:'金融市场与投资交易',intro:'围绕债券、衍生品和其他证券投资开展研究、交易执行和投资策略建设。',tags:'固定收益 · 衍生品 · 量化',topics:['债券市场研究和交易','高频量化策略开发','衍生产品结构与风险分析']},
 {name:'机构服务与证券研究',intro:'为公募、保险、私募等机构投资者提供投研、交易支持与专业研究服务。',tags:'机构销售 · 行业研究 · PB',topics:['上市公司及行业研究','机构客户与交易服务','专业化交易系统支持']},
 {name:'金融科技与信息系统',intro:'建设券商交易、机构运营、金融数据与智能化产品，支持数字化金融服务。',tags:'AI · 软件开发 · 信息安全',topics:['AI和知识库业务应用','互联网金融前端与测试','金融基础系统和技术运营']},
 {name:'资产管理与综合金融服务',intro:'依托资产管理、基金、期货及其他业务主体提供投资管理和金融产品服务。',tags:'资产管理 · 合规 · 风险',topics:['资产管理和投资服务','产品运营与合规管理','各业务主体协同服务']}
];
export function HuaanSecuritiesCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 const roles=rolesData.jobs.filter(job=>major==='全部专业'||job.majors.includes(major));
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-huaan-compact" data-company-template="openai" data-employer-id="a-600909" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业 Logo、办公环境与建筑">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><AutumnCompanyBrand name="华安证券" large/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>华安证券 <span>HUAAN SECURITIES</span></h1>
      <p>财富管理 · 投资银行 · 证券研究 · 金融科技</p>
     </div>
     <a href="https://hahr.hazq.com:8083/eip4ha-hyapp/recruitment" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer" className="hhba-kpmg-quick-link">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-628c0cb2972a0ee5c3ef77b7.webp'} alt="以前保存的华安证券总部或建筑场景素材，企业归属待最终核验" loading="eager"/>
      <figcaption><span>总部建筑场景</span><small>归属待核验</small></figcaption></figure>
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-0c1364cd23938f72c131e011.webp'} alt="以前保存的华安证券办公场景素材，企业归属尚未最终核验" loading="eager"/>
      <figcaption><span>原有办公场景素材</span><small>归属待核验</small></figcaption></figure>
    </div>
    <p style={{fontSize:11,color:'#809286',margin:'10px 0 0'}}>Logo 和两张企业场景照片均沿用以前保存的素材，品牌及照片归属仍待最终核验。</p>
   </section>
   <section className="hhba-kpmg-section" aria-labelledby="huaan-major-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="huaan-major-title">适合哪些专业背景？</h2><p>点击专业，筛选对应专业背景的历史职位；匹配仅供参考。</p></div></div>
    <div className="hhba-kpmg-major-list" role="group" aria-label="专业选择">
     {majors.map(x=><button key={x} type="button" className={'hhba-kpmg-major'+(x===major?' is-selected':'')} aria-pressed={x===major} onClick={()=>setMajor(x)}>{x}{x===major&&<CheckCircle2 size={13}/>}</button>)}
    </div>
   </section>
   <section className="hhba-kpmg-section" aria-labelledby="huaan-job-title">
    <div className="hhba-kpmg-section-heading">
     <div><h2 id="huaan-job-title">招聘岗位</h2><p>当前匹配：<strong>{major}</strong> · {roles.length} 个具体职位。以下为2026年7月招聘公告中的 10 个具体历史职位，原报名期限均已过去，不代表目前开放。</p></div>
     <a className="hhba-kpmg-section-link" href="https://hahr.hazq.com:8083/eip4ha-hyapp/recruitment" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">官方招聘报名系统 <ExternalLink size={14}/></a>
    </div>
    <div className="hhba-kpmg-role-list">
     {roles.map(job=><article className="hhba-kpmg-role" key={job.id}>
       <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
       <div className="hhba-kpmg-role-main">
        <div className="hhba-kpmg-role-top"><h3>{job.title}</h3><span>{job.city} · 截止 {job.deadline}</span></div>
        <p>{job.summary}</p><small>{job.requirement}</small>
       </div>
       <Link to={'/candidate/jobs/cn-v2-huaan-'+job.id} aria-label={'查看'+job.title+'站内详情'}>查看详情 <ArrowRight size={14}/></Link>
     </article>)}
    </div>
    <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/> 具体职位资料来自2026年7月的公开招聘公告转载；原报名期限为7月至9月，已过期。未获取可靠逐岗官网直达链接，官网入口仅用于核实新一轮职位。</p>
   </section>
   <section className="hhba-kpmg-section" aria-labelledby="huaan-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="huaan-services-title">主要业务与专业服务</h2><p>精简业务卡片，可按需查看详细信息。</p></div></div>
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
