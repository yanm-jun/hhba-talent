import {useState} from 'react';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CheckCircle2,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {AutumnCompanyBrand} from '../components/AutumnCompanyBrand';
import rolesData from '../data/domesticGuangfaSecuritiesRoles20261029.json';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';

const majors=['全部专业','金融学','经济学','会计学','财务管理','法学','统计学','数学与应用数学',
 '计算机科学与技术','软件工程','人工智能','数据科学与大数据技术','电子信息工程',
 '微电子科学与工程','集成电路设计与集成系统','机械设计制造及其自动化','工商管理','物理学'];
const services=[
 {name:'财富管理与证券经纪',intro:'为个人及机构客户提供证券经纪、投资顾问、金融产品配置和财富服务。',tags:'经纪服务 · 资产配置',topics:['证券交易与账户服务','投资咨询及客户财富管理','金融产品与投顾服务']},
 {name:'投资银行与资本市场',intro:'包括股权债券融资、并购重组、资产证券化及投行资本市场业务。',tags:'投行 · 股权 · 债券',topics:['股权投行和债券承销','并购重组及企业融资','资本市场发行与项目支持']},
 {name:'交易及机构客户服务',intro:'面向专业金融机构开展固定收益、权益、衍生品、机构销售及托管服务。',tags:'FICC · 交易 · 机构客户',topics:['债券及衍生品交易','机构研究销售','专业投资服务与托管']},
 {name:'证券研究与产业分析',intro:'对宏观经济、金融科技、先进制造和各行业上市公司开展研究分析。',tags:'卖方研究 · 产业研究',topics:['行业与公司基本面研究','权益投资与策略分析','科技和先进制造研究']},
 {name:'金融科技与数据应用',intro:'为证券及财富业务提供软件工程、金融数据、人工智能和交易系统技术。',tags:'AI · 金融产品 · 软件研发',topics:['金融平台和数据开发','AI产品与智能技术应用','交易及运营系统建设']},
 {name:'投资管理业务',intro:'涉及证券资产管理、投资产品及各类资管业务；不同业务主体须分别核实资质与职位。',tags:'资产管理 · 投资研究',topics:['资产管理与投资产品','量化研究和策略开发','投资业务运营支持']}
];
export function GuangfaSecuritiesCompactProfilePage({user}:{user:User|null}){
 const back=getCompanyReturnTarget();
 const [major,setMajor]=useState('全部专业');
 const [expanded,setExpanded]=useState(false);
 const roles=rolesData.jobs.filter(job=>major==='全部专业'||job.majors.includes(major));
 return <Shell user={user}>
  <article className="company-profile hhba-kpmg-compact hhba-guangfa-compact" data-company-template="openai" data-employer-id="a-000776" data-domestic-rebuild="v2">
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero" aria-label="企业 Logo、办公环境与建筑">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><AutumnCompanyBrand name="广发证券" large/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>广发证券 <span>GF SECURITIES</span></h1>
      <p>投资银行 · 财富管理 · 交易机构 · 金融科技</p>
     </div>
     <a href="https://job.gf.com.cn/" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer" className="hhba-kpmg-quick-link">招聘官网 <ExternalLink size={14}/></a>
    </header>
    <div className="hhba-kpmg-photo-grid">
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-ee7dc13de9387efbca39caf1.webp'} alt="以前保存的广发证券总部或建筑场景素材，企业归属待最终核验" loading="eager"/>
      <figcaption><span>总部建筑场景</span><small>归属待核验</small></figcaption></figure>
     <figure><img src={import.meta.env.BASE_URL+'domestic-media/user-d1173b668561e62dec056169.webp'} alt="以前保存的广发证券办公场景素材，企业归属尚未最终核验" loading="eager"/>
      <figcaption><span>原有办公场景素材</span><small>归属待核验</small></figcaption></figure>
    </div>
    <p style={{fontSize:11,color:'#809286',margin:'10px 0 0'}}>Logo 和两张企业场景照片均沿用以前保存的素材，品牌及照片归属仍待最终核验。</p>
   </section>
   <section className="hhba-kpmg-section" aria-labelledby="guangfa-major-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="guangfa-major-title">适合哪些专业背景？</h2><p>点击专业，筛选对应专业背景的历史职位；匹配仅供参考。</p></div></div>
    <div className="hhba-kpmg-major-list" role="group" aria-label="专业选择">
     {majors.map(x=><button key={x} type="button" className={'hhba-kpmg-major'+(x===major?' is-selected':'')} aria-pressed={x===major} onClick={()=>setMajor(x)}>{x}{x===major&&<CheckCircle2 size={13}/>}</button>)}
    </div>
   </section>
   <section className="hhba-kpmg-section" aria-labelledby="guangfa-job-title">
    <div className="hhba-kpmg-section-heading">
     <div><h2 id="guangfa-job-title">招聘岗位</h2><p>当前匹配：<strong>{major}</strong> · {roles.length} 个具体职位。本页先整理2027届校园招聘公告中的 10 个具体岗位，原报名截止2026年9月30日，不能视为仍在招聘。</p></div>
     <a className="hhba-kpmg-section-link" href="https://job.gf.com.cn/" data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">官方招聘报名系统 <ExternalLink size={14}/></a>
    </div>
    <div className="hhba-kpmg-role-list">
     {roles.map(job=><article className="hhba-kpmg-role" key={job.id}>
       <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
       <div className="hhba-kpmg-role-main">
        <div className="hhba-kpmg-role-top"><h3>{job.title}</h3><span>{job.city} · 截止 {job.deadline}</span></div>
        <p>{job.summary}</p><small>{job.requirement}</small>
       </div>
       <Link to={'/candidate/jobs/cn-v2-guangfa-'+job.id} aria-label={'查看'+job.title+'站内详情'}>查看详情 <ArrowRight size={14}/></Link>
     </article>)}
    </div>
    <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/> 10 条职位名称、工作地区和专业信息来自南开大学就业中心公布的广发证券2027届招聘公告；报名截止2026年9月30日。官方按钮指向广发证券招聘首页，并非逐岗申请入口。</p>
   </section>
   <section className="hhba-kpmg-section" aria-labelledby="guangfa-services-title">
    <div className="hhba-kpmg-section-heading"><div><h2 id="guangfa-services-title">主要业务与专业服务</h2><p>精简业务卡片，可按需查看详细信息。</p></div></div>
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
