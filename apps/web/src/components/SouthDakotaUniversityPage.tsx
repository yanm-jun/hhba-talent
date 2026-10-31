import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,ExternalLink,GraduationCap,Info,MapPin,ShieldAlert,ShieldCheck,School,Wallet,Camera,Building2,FileCheck2,Lightbulb} from 'lucide-react';
import type {User} from '../services/api';
import {Link} from '../router';
import {Shell} from './Shell';
import {usdAdmission,usdCost,usdFacts,usdFaqs,usdOverview,usdPhotos,usdProgramDetails,usdSources,type UsdProgramId} from '../data/studySouthDakota';
import '../styles/study-minot-state.css';
import '../styles/study-south-dakota.css';

const imagePath=(file:string)=>import.meta.env.BASE_URL+'images/study/south-dakota/'+file;
function Source({url,children}:{url:string;children:React.ReactNode}){return <a className="hhba-minot-source-link" href={url} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13}/></a>;}
function Heading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <div className="hhba-minot-heading"><div><p className="hhba-minot-overline">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>;}
function Wrap({user,children}:{user:User|null;children:React.ReactNode}){return <Shell user={user}><main className="hhba-study hhba-minot hhba-usd" data-usd="longform"><div className="hhba-study-wrap">{children}</div></main></Shell>;}
function Gallery(){
 const [selected,setSelected]=useState(0);
 const [open,setOpen]=useState(false);
 const item=usdPhotos[selected];
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowLeft')setSelected(i=>(i+2)%3);if(e.key==='ArrowRight')setSelected(i=>(i+1)%3);};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[open]);
 return <section id="usd-campus" className="hhba-minot-gallery" data-usd-gallery>
  <Heading eyebrow="ACTUAL PHOTOGRAPHY · CREATIVE COMMONS" title="真实校园照片：三处不同场景" description="现代主校区航拍、Old Main 历史影像和 Belbas Center 实景。每张独立拍摄，不拼图、不 AI 生成；标明摄影者、年份与许可。"/>
  <div className="hhba-minot-gallery-grid">
   <div className="hhba-minot-feature-photo"><button type="button" className="hhba-minot-photo-trigger" onClick={()=>setOpen(true)} aria-label={'放大查看'+item.title}><img alt={item.title} src={imagePath(item.file)} loading="eager"/><span className="hhba-minot-photo-title">{item.title}<small>{item.year} · 点击放大</small></span></button></div>
   <div className="hhba-minot-gallery-thumbs">{usdPhotos.map((p,i)=><button type="button" className={'hhba-minot-thumb '+(selected===i?'selected':'')} key={p.id} aria-pressed={selected===i} onClick={()=>setSelected(i)}><img src={imagePath(p.file)} alt={p.title} loading="lazy"/><span>{p.title}</span></button>)}</div>
  </div>
  <div className="hhba-minot-photo-credit"><strong>{item.description}</strong><span>摄影者：{item.creator} · {item.year} · {item.license} · {item.changes}</span><div><Source url={item.sourceUrl}>图片原始出处</Source><Source url={item.licenseUrl}>使用许可</Source></div></div>
  {open&&<div className="hhba-minot-lightbox" role="dialog" aria-modal="true" aria-label="南达科他大学照片放大">
   <div className="hhba-minot-lightbox-toolbar"><span>{selected+1} / 3 · {item.title}</span><button type="button" autoFocus aria-label="关闭放大照片" onClick={()=>setOpen(false)}>关闭 ×</button></div>
   <div className="hhba-minot-lightbox-body"><button type="button" aria-label="上一张照片" onClick={()=>setSelected(i=>(i+2)%3)}><ChevronLeft/></button><img alt={item.title} src={imagePath(item.file)}/><button type="button" aria-label="下一张照片" onClick={()=>setSelected(i=>(i+1)%3)}><ChevronRight/></button></div>
   <p>{item.creator} · {item.license} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">原始来源</a></p>
  </div>}
 </section>;
}
function Admissions(){
 return <section className="hhba-minot-section" id="usd-admissions">
  <Heading eyebrow="INTERNATIONAL GRADUATE ADMISSIONS" title="国际学生申请与语言标准" description="逐项拆解官方信息，区分学校一般规则与具体专业附加条件，尤其避免将最低语言成绩当作录取保证。"/>
  <div className="hhba-minot-compare">
   <article><h3><BookOpen size={18}/> 学校列出的英语能力门槛</h3><ul>{usdAdmission.languages.map(a=><li key={a}>{a}</li>)}</ul><Source url={usdSources.admissions.url}>官方语言要求</Source></article>
   <article><h3><FileCheck2 size={18}/> 国际申请与资金证明</h3><p>{usdAdmission.feeNote}</p><p>学校研究生院及院系分别审核申请资格；国际办公室在录取后要求提供有效护照及一学年资金能力材料，才考虑签发 I-20 / DS-2019。</p><Source url={usdSources.checklist.url}>国际生手续与财务清单</Source></article>
  </div>
  <h3 className="hhba-minot-subtitle">准备申请的 7 项真实任务</h3>
  <div className="hhba-minot-steps">{usdAdmission.steps.map((a,i)=><div className="hhba-minot-step" key={i}><span>{i+1}</span><p>{a}</p></div>)}</div>
  <div className="hhba-minot-warning"><ShieldAlert size={19}/><p>{usdAdmission.deadlineNote} 国际申请截止日期不得以此页取代学校系统当年的最终状态。</p></div>
 </section>;
}
function Costs(){
 return <section className="hhba-minot-section" id="usd-costs">
  <Heading eyebrow="COSTS · 2026–27 BASE TUITION" title="预算必须分清：学分学费 ≠ 完整留学开销" description="使用南达科他州校董会 2026–27 学年公布的非居民研究生收费作为基础参考，再列出住宿、其他费用和资金证明的限制。"/>
  <div className="hhba-minot-fee-wrap"><table><thead><tr><th>项目</th><th>官方数值 / 状态</th><th>核实与适用范围</th></tr></thead><tbody>{usdCost.map(r=><tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}</td><td>{r.note}</td></tr>)}</tbody></table></div>
  <div className="hhba-minot-budget-note"><Info size={20}/><p>这份信息不能取代国际学生 I-20 所需的大学官方资金证明金额。实际收费因专业、身份、学分、校区、奖助学金、是否有额外课程费用而不同。学校大学预算网页按 18 学分/学年建模；请另外计算住房、食物、保险、交通、签证及个人日常费用。</p></div>
  <div className="hhba-minot-small-links"><Source url={usdSources.rates.url}>2026–27 州校董会完整费率</Source><Source url={usdSources.tuition.url}>USD 官方年度成本模型</Source></div>
 </section>;
}
function Sources(){return <section className="hhba-minot-panel" id="usd-sources"><Heading eyebrow="OPEN EVIDENCE" title="全部官方信息与摄影许可" description="任何你感兴趣的数据都能回到原始资料验证。照片公开来源与许可独立展示，不跳转冒充实际学校网站。"/>
  <div className="hhba-minot-source-grid">{Object.entries(usdSources).map(([k,v])=><a key={k} href={v.url} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>{v.label}<ExternalLink size={13}/></a>)}</div>
  <div className="hhba-minot-license"><h3>真实照片的公开署名</h3>{usdPhotos.map(p=><p key={p.id}>{p.title} — {p.creator}（{p.year}），{p.license}。<a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">原始图像</a> · <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">许可文本</a>。{p.changes}</p>)}</div>
 </section>;}
export function SouthDakotaUniversityPage({user}:{user:User|null}){
 const [faq,setFaq]=useState(0);
 return <Wrap user={user}>
  <nav className="hhba-minot-breadcrumb" aria-label="页面层级"><Link to="/study-abroad"><ArrowLeft size={15}/> 留学机会</Link><span>/</span><span>南达科他大学</span></nav>
  <header className="hhba-minot-hero"><p className="hhba-minot-overline"><School size={16}/> HHBA UNIVERSITY DEEP PROFILE · 02</p>
   <h1>南达科他大学</h1><p className="hhba-minot-hero-en">University of South Dakota · USD</p>
   <p className="hhba-minot-hero-copy">创办于 1862 年的美国公立大学，主校区位于南达科他州 Vermillion。这里不仅展示校园与学校背景，更逐项整理商业分析、工商管理和计算机科学硕士的真实特点，以及中国留学生应优先核实的申请条件、英语成绩、2027 入学时点、费用和签证信息。</p>
   <p className="hhba-minot-location"><MapPin size={16}/> 414 E. Clark Street, Vermillion, SD 57069 · United States</p>
   <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href="https://www.usd.edu/" target="_blank" rel="noopener noreferrer">大学官方网站 <ExternalLink size={16}/></a><Source url={usdSources.admissions.url}>国际研究生官方申请说明</Source></div>
   <p className="hhba-minot-verify"><ShieldCheck size={15}/> 信息核验于 2026-10-31 · 所有申请政策按学校最新公告执行</p>
  </header>
  <nav className="hhba-minot-jump" aria-label="大学资料目录">{[['#usd-overview','学校背景'],['#usd-campus','真实校园照片'],['#usd-programs','三个硕士专业'],['#usd-admissions','申请条件'],['#usd-costs','真实费用'],['#usd-life','住宿及助教'],['#usd-faq','常见问题'],['#usd-sources','信息来源']].map(([url,title])=><a key={url} href={url}>{title}</a>)}</nav>
  <div className="hhba-minot-facts">{usdFacts.map(f=><div key={f.label}><span>{f.label}</span><strong>{f.value}</strong></div>)}</div>
  <section className="hhba-minot-section" id="usd-overview"><Heading eyebrow="ABOUT THE UNIVERSITY" title="真正认识学校与生活环境" description="在比较学校排名前，先看大学认证、师生规模、城市位置、课程授课地点和个人生活方式是否合适。"/>
   <div className="hhba-minot-narrative-grid">{usdOverview.map((v,i)=><article className="hhba-minot-narrative" key={v.title}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{v.title}</h3><p>{v.body}</p><Source url={v.source}>官方学校说明</Source></div></article>)}</div>
   <div className="hhba-minot-insight"><Lightbulb size={19}/><p><strong>适配判断：</strong>适合愿意认真比较中小城市学习环境、线下专业、课程基础与总费用的申请者。学校是否“值得去”不能只由公立身份或地区物价推断，更不能自动假定跨专业合格、可获得奖学金或一定留美就业。</p></div>
  </section>
  <Gallery/>
  <section id="usd-programs" className="hhba-minot-section"><Heading eyebrow="ACADEMICS · THREE VERIFIED MASTERS" title="三个硕士，分别深入了解" description="卡片点击进入专属、详细的项目说明。校方证明项目存在并不等于某个申请者已达到所有申请条件。"/>
   <div className="hhba-usd-program-grid">{(Object.keys(usdProgramDetails) as UsdProgramId[]).map(id=>{const p=usdProgramDetails[id];return <article key={id} className="hhba-minot-program-card"><div className="hhba-minot-prog-icon"><GraduationCap size={26}/></div><p className="hhba-minot-overline">{p.label}</p><h3>{p.title}</h3><p className="hhba-minot-program-en">{p.english}</p><p className="hhba-minot-program-summary">{p.summary}</p><div className="hhba-minot-mini-stats"><span>具体项目官方来源</span><span>2027 申请时点</span><span>独立课程分析</span></div><Link className="hhba-minot-program-btn" to={'/study-abroad/program/'+id}>进入完整专业详情 <ArrowRight size={16}/></Link></article>;})}</div>
  </section>
  <Admissions/><Costs/>
  <section id="usd-life" className="hhba-minot-section"><Heading eyebrow="LIFE · HOUSING · ASSISTANTSHIPS" title="校园生活、住宿与奖助学金" description="切实关注能否解决住房、如何申请助教、录取之后的财务材料以及校园生活。"/>
   <div className="hhba-minot-life-grid">
    <article><Building2 size={24}/><h3>研究生住宿现实</h3><p>USD 官方说明研究生更建议准备校外住宿方案：校内房源有限，通常优先分配给本科学生。不要看到校园宿舍照片就认为已经能预订到房间，应分别核查房源、合同、押金、交通、冬季出行及实际月租。</p><Source url={usdSources.tuition.url}>官方住宿提醒</Source></article>
    <article><Wallet size={24}/><h3>研究生助教机会</h3><p>大学提供 Graduate Teaching/Research/Administrative Assistantship，部分岗位带有津贴与学费减免；需正式被研究生项目录取、维持 GPA 3.00、满足学分要求，并经过部门选拔。绝不能在预算中预先当成已获得的资助。</p><Source url={usdSources.assistant.url}>助教规则</Source></article>
    <article><FileCheck2 size={24}/><h3>录取之后的国际学生手续</h3><p>如申请 F-1 学生身份，学校要求至少证明一学年可支配的合规资金，并按清单提交 Financial Ability Form、银行证明、有效护照等；学校签发 I-20 并不等于领馆保证批准签证。</p><Source url={usdSources.checklist.url}>国际生录取后清单</Source></article>
   </div>
  </section>
  <section id="usd-faq" className="hhba-minot-section"><Heading eyebrow="FAQ · REAL QUESTIONS" title="别忽略这些常见误区" description="从大学名称混淆到 STEM、跨专业、费用、截止日与助教，逐条给出有来源的判断。"/>
   <div className="hhba-minot-faq">{usdFaqs.map((v,i)=><div className="hhba-minot-faq-item" key={v.q}><button type="button" aria-expanded={faq===i} onClick={()=>setFaq(faq===i?-1:i)}><span>{v.q}</span><span>{faq===i?'−':'+'}</span></button>{faq===i&&<div><p>{v.a}</p><Source url={v.source}>查看依据</Source></div>}</div>)}</div>
  </section>
  <Sources/>
  <div className="hhba-minot-end-actions"><span>HHBA · 第一模块 · 第二所大学深度样板</span><Link to="/study-abroad"><ArrowLeft size={15}/> 返回留学机会</Link></div>
 </Wrap>;
}
export function SouthDakotaProgramPage({user,id}:{user:User|null;id:UsdProgramId}){
 const p=usdProgramDetails[id];
 return <Wrap user={user}>
  <nav className="hhba-minot-breadcrumb" aria-label="页面层级"><Link to="/study-abroad"><ArrowLeft size={14}/> 留学机会</Link><span>/</span><Link to="/study-abroad/university/south-dakota">南达科他大学</Link><span>/</span><span>{p.title}</span></nav>
  <header className="hhba-minot-hero hhba-minot-degree-hero"><p className="hhba-minot-overline"><GraduationCap size={15}/> UNIVERSITY OF SOUTH DAKOTA · PROGRAM DETAIL</p><h1>{p.title}</h1><p className="hhba-minot-hero-en">{p.english}</p><p className="hhba-minot-hero-copy">{p.summary}</p>
   <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href={p.source} target="_blank" rel="noopener noreferrer">专业官方介绍 <ExternalLink size={15}/></a><Link className="hhba-minot-alt-btn" to="/study-abroad/university/south-dakota">查看真实校园照片 <ArrowRight size={15}/></Link></div>
   <p className="hhba-minot-verify"><ShieldCheck size={15}/> 项目官方资料 · 核验日期 2026-10-31 · 不承诺录取或签证</p>
  </header>
  <div className="hhba-minot-metadata"><div><span>学校和校区</span><strong>University of South Dakota</strong></div><div><span>学习方向</span><strong>{p.label}</strong></div><div><span>2027 申请节点</span><strong>官方已列日期</strong></div><div><span>录取与签证</span><strong>必须分别核实</strong></div></div>
  <section className="hhba-minot-section"><Heading eyebrow="CURRICULUM · OVERVIEW" title="具体学什么、需要什么基础？" description="基于官方课程介绍归纳能力方向，并明确这些不是编造的课程编号，也不能取代学校正式学术目录。"/>
   <p className="hhba-minot-long-intro">{p.background}</p>
   <div className="hhba-minot-narrative-grid">{p.chapters.map((c,i)=><article className="hhba-minot-narrative" key={c.name}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{c.name}</h3><p>{c.content}</p></div></article>)}</div>
   <div className="hhba-minot-insight"><Info size={19}/><p><strong>学位和毕业工作：</strong>{p.stem}</p></div>
  </section>
  <section className="hhba-minot-section"><Heading eyebrow="DEADLINES · 2027" title="官方公布的 2027 国际申请日期" description="以下是学校国际申请页明列的项目时间，不代表系统现在正在接受对应批次，也不排除更早的院系截止日。"/>
   <div className="hhba-minot-deadlines">{p.intake.map(d=><div key={d.term}><CalendarDays size={22}/><div><strong>{d.term}</strong><b>{d.deadline}</b><small>日期为学校发布的国际研究生申请参考；务必核实当期专业招生。</small></div></div>)}</div>
   <Source url={usdSources.admissions.url}>打开国际研究生招生页核对</Source>
  </section>
  <Admissions/><Costs/>
  <div className="hhba-minot-warning"><ShieldAlert size={20}/><p>这里确认的是项目存在、教学方向和当前公开申请说明；不能代替院系对先修课程、GPA、外语和资金的个别审查。STEM 指定不保证获得 OPT、工作或移民资格。</p></div>
  <div className="hhba-minot-cta-panel"><div><h2>准备下一步：回到真实的大学项目页面</h2><p>从大学官方专业资料与学校申请系统了解最新课程、截止时间和要求，不提供非官方付费申请渠道。</p></div><a className="hhba-study-btn" href={p.source} target="_blank" rel="noopener noreferrer">项目官网 <ExternalLink size={15}/></a></div>
  <div className="hhba-minot-end-actions"><Link to="/study-abroad/university/south-dakota"><ArrowLeft size={14}/> 返回南达科他大学</Link><Source url={usdSources.admissions.url}>官方申请指南</Source></div>
 </Wrap>;
}
