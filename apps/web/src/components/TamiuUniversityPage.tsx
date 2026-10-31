import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,ExternalLink,GraduationCap,Info,MapPin,ShieldAlert,ShieldCheck,School,Wallet,Camera,Building2,FileCheck2,Lightbulb} from 'lucide-react';
import type {User} from '../services/api';
import {Link} from '../router';
import {Shell} from './Shell';
import {tamiuSources,tamiuPhotos,tamiuFacts,tamiuOverview,tamiuMbaCurriculum,tamiuMbaConcentrations,tamiuAdmission,tamiuCost,tamiuFunding,tamiuFaq} from '../data/studyTamiu';
import '../styles/study-minot-state.css';
import '../styles/study-tamiu.css';

const localPhoto=(file:string)=>import.meta.env.BASE_URL+'images/study/tamiu/'+file;
function Source({url,children}:{url:string;children:React.ReactNode}){return <a href={url} target="_blank" rel="noopener noreferrer" className="hhba-minot-source-link">{children}<ExternalLink size={13}/></a>;}
function Title({eyebrow,heading,detail}:{eyebrow:string;heading:string;detail:string}){return <div className="hhba-minot-heading"><div><p className="hhba-minot-overline">{eyebrow}</p><h2>{heading}</h2><p>{detail}</p></div></div>;}
function Frame({user,children}:{user:User|null;children:React.ReactNode}){return <Shell user={user}><main className="hhba-study hhba-minot hhba-tamiu" data-tamiu="longform"><div className="hhba-study-wrap">{children}</div></main></Shell>;}
function Caution({children}:{children:React.ReactNode}){return <div className="hhba-minot-warning"><ShieldAlert size={19}/><p>{children}</p></div>;}
function Gallery(){
 const [selected,setSelected]=useState(0),[open,setOpen]=useState(false);
 const item=tamiuPhotos[selected];
 useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowLeft')setSelected(i=>(i+2)%3);if(e.key==='ArrowRight')setSelected(i=>(i+1)%3);};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[open]);
 return <section className="hhba-minot-gallery" id="tamiu-campus" data-tamiu-gallery>
  <Title eyebrow="THREE REAL CAMPUS LOCATIONS" heading="真实校园：三座不同建筑" detail="Canseco Hall、Killam Library 和 Western Hemispheric Trade Center。照片均为学校真实历史影像，提供摄影者、日期、许可与原始来源。"/>
  <div className="hhba-minot-gallery-grid">
   <div className="hhba-minot-feature-photo"><button className="hhba-minot-photo-trigger" aria-label={'放大查看 '+item.title} type="button" onClick={()=>setOpen(true)}>
    <img src={localPhoto(item.file)} alt={'Texas A&M International University '+item.title} loading="eager"/>
    <span className="hhba-minot-photo-title">{item.title}<small>{item.date} · 点击放大</small></span>
   </button></div>
   <div className="hhba-minot-gallery-thumbs">{tamiuPhotos.map((p,i)=><button key={p.id} className={'hhba-minot-thumb '+(selected===i?'selected':'')} type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)}><img src={localPhoto(p.file)} alt={p.title} loading="lazy"/><span>{p.title}</span></button>)}</div>
  </div>
  <div className="hhba-minot-photo-credit"><strong>{item.description}</strong><span>摄影：{item.creator} · {item.date} · {item.license}；{item.note}</span><div><Source url={item.sourceUrl}>原始照片出处</Source><Source url={item.licenseUrl}>授权条款</Source></div></div>
  {open&&<div className="hhba-minot-lightbox" role="dialog" aria-modal="true" aria-label="TAMIU 校园照片放大">
   <div className="hhba-minot-lightbox-toolbar"><span>{selected+1}/3 · {item.title}</span><button autoFocus type="button" onClick={()=>setOpen(false)} aria-label="关闭校园照片">关闭 ×</button></div>
   <div className="hhba-minot-lightbox-body"><button type="button" aria-label="上一张校园照片" onClick={()=>setSelected(i=>(i+2)%3)}><ChevronLeft/></button><img src={localPhoto(item.file)} alt={item.title}/><button type="button" aria-label="下一张校园照片" onClick={()=>setSelected(i=>(i+1)%3)}><ChevronRight/></button></div>
   <p>{item.creator} · {item.license} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">原始出处</a></p>
  </div>}
 </section>;
}
function Overview(){return <section className="hhba-minot-section" id="tamiu-overview">
 <Title eyebrow="TAMIU · THE UNIVERSITY AND ITS CITY" heading="学校、商学院与边境城市的真实特点" detail="不堆砌大学宣传词，分开说明学校背景、学术实力、校园环境，以及申请线下 MBA 真正需要考虑的问题。"/>
 <div className="hhba-minot-narrative-grid">{tamiuOverview.map((v,i)=><article className="hhba-minot-narrative" key={v.heading}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{v.heading}</h3><p>{v.body}</p><Source url={v.source}>查看学校官方依据</Source></div></article>)}</div>
 <div className="hhba-minot-insight"><Lightbulb size={20}/><p><strong>申请重点：</strong>如果目标是赴美国线下完成硕士，先确认具体 MBA 路径是否有合规校内课程和 I-20，而不是只看“大学提供 MBA”或线上项目页面。申请者需独立比较个人背景、费用、授课方式、工作经历及长期计划。</p></div>
 </section>;}
function Curriculum(){return <section className="hhba-minot-section" id="tamiu-mba">
 <Title eyebrow="ONE VERIFIED MBA · SEVERAL CONCENTRATIONS" heading="MBA 是一个学位，不把方向冒充新学位" detail="2026–27 学术目录列出的核心课程与专项方向，均有对应官方证据；具体如何分配学分取决于本科专业和方向。"/>
 <div className="hhba-tamiu-primary-program"><div><span className="hhba-minot-overline"><GraduationCap size={16}/> AACSB-ACCREDITED BUSINESS SCHOOL</span><h3>工商管理硕士 · MBA</h3><p>Master of Business Administration</p><p>商学院列出多项 MBA concentration，包括国际商务、国际金融、贸易物流和管理学等。这些方向不意味着每一项都能以相同的方式在 Laredo 主校区上课。2026–27 学术目录的 MBA CIP 为 52.0201.00；该编号本身不构成 STEM OPT 或 F-1 资格保证。</p></div><Link className="hhba-study-btn" to="/study-abroad/program/tamiu-mba">进入 MBA 全部详情 <ArrowRight size={16}/></Link></div>
 <h3 className="hhba-minot-subtitle">四组课程领域（依据学术目录，不伪造完整课表）</h3>
 <div className="hhba-minot-narrative-grid">{tamiuMbaCurriculum.map((v,i)=><article className="hhba-minot-narrative" key={v.name}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{v.name}</h3><p className="hhba-tamiu-course">{v.course}</p><p>{v.detail}</p></div></article>)}</div>
 <h3 className="hhba-minot-subtitle">官方存在的 MBA 方向</h3>
 <div className="hhba-tamiu-concentrations">{tamiuMbaConcentrations.map(v=><article key={v.name}><h3>{v.name}</h3><small>{v.en}</small><p>{v.note}</p></article>)}</div>
 <div className="hhba-minot-small-links"><Source url={tamiuSources.degree.url}>核实 MBA 学术目录</Source><Source url={tamiuSources.business.url}>核实不同方向与教学方式</Source></div>
 </section>;}
function Admissions(){return <section className="hhba-minot-section" id="tamiu-admissions">
 <Title eyebrow="GRADUATE ADMISSION · REAL CHECKLIST" heading="国际研究生申请、考试与材料" detail="对照 Graduate School 和当年学术目录，区分英语成绩、GMAT/GRE 豁免、国际申请费用及资金证明。"/>
 <div className="hhba-minot-compare"><article><h3><BookOpen size={19}/> 英语与考试条件</h3><ul>{tamiuAdmission.exam.map(v=><li key={v}>{v}</li>)}</ul><Source url={tamiuSources.catalogAdmission.url}>查看当年研究生规则</Source></article><article><h3><FileCheck2 size={19}/> 学生签证的关键前提</h3><p>商学院公开列出部分 MBA 在线专业，国际申请人不能把网课学习等同于线下留学。学生身份、I-20 与校内课程负荷的要求，需要由学校国际生办公室在具体项目层面确认。</p><p>研究生院公布的国际学生 preferred deadline：秋季 6 月 1 日，春季 10 月 1 日；某些专业可能有额外要求。</p><Source url={tamiuSources.admission.url}>核实国际研究生招生</Source></article></div>
 <h3 className="hhba-minot-subtitle">按流程核对的八项准备工作</h3><div className="hhba-minot-steps">{tamiuAdmission.tasks.map((v,i)=><div key={i} className="hhba-minot-step"><span>{i+1}</span><p>{v}</p></div>)}</div>
 <Caution>申请年份、是否招收国际生、英语和商科先修、国际学生全日制学习资格必须逐项确认。学校公布项目存在，不等于已经向个人确认录取、I-20 或签证。</Caution>
 </section>;}
function Costs(){return <section className="hhba-minot-section" id="tamiu-costs">
 <Title eyebrow="BUDGET · 2026–27 OFFICIAL COA" heading="真实费用拆分：不要把一年预算当作总学费" detail="以下数据摘自 TAMIU 官方 2026–27 非居民研究生校内住宿 Cost of Attendance，按秋春两学期、每学期 6 学分假设估算。"/>
 <div className="hhba-minot-fee-wrap"><table><thead><tr><th>费用分类</th><th>美元金额</th><th>学校提供的估算范围</th></tr></thead><tbody>{tamiuCost.map(v=><tr key={v.name}><th scope="row">{v.name}</th><td>{v.value}</td><td>{v.note}</td></tr>)}</tbody></table></div>
 <div className="hhba-minot-budget-note"><Info size={19}/><p>研究生国际申请费在学校 2026–27 学术目录中列为 <strong>US$50</strong>，与上面的年度成本表不同。TAMIU 学术目录还列国际/非居民研究生基础学费 <strong>US$497/学分</strong>，但其他杂费可能另计；不能只用 US$497 乘课程学分计算整项学位或 I-20 资金要求。</p></div>
 <div className="hhba-minot-small-links"><Source url={tamiuSources.costs.url}>学校 2026–27 年度预算</Source><Source url={tamiuSources.tuition.url}>当年收费明细</Source></div>
 </section>;}
function Funding(){return <section className="hhba-minot-section" id="tamiu-funding">
 <Title eyebrow="FUNDING · ELIGIBILITY FIRST" heading="真实资助机会和申请限制" detail="能申请的金额不是一定拿到的钱；助教与 Fellowship 还涉及学分、绩点、工作要求及申请时点。"/>
 <div className="hhba-tamiu-concentrations">{tamiuFunding.map(v=><article key={v.name}><h3>{v.name}</h3><strong>{v.amount}</strong><p>{v.note}</p></article>)}</div>
 <div className="hhba-minot-insight"><Wallet size={20}/><p>Graduate Financial Assistance 目前说明常规申请节点为 4 月 1 日，但并非所有资助形式都向每一类国际学生开放。国际学生通常不符合联邦 FAFSA 资助资格。请分别查看学校资助条款，并确认 MBA Business Fellowship 当期国际申请资格。</p></div>
 <div className="hhba-minot-small-links"><Source url={tamiuSources.funding.url}>助教及研究生资助规则</Source><Source url={tamiuSources.intlFunding.url}>国际学生资助限制</Source><Source url={tamiuSources.scholarship.url}>官方奖学金入口</Source></div>
 </section>;}
function Sources(){return <section className="hhba-minot-panel" id="tamiu-sources"><Title eyebrow="AUDITABLE SOURCES · NO FICTITIOUS CLAIMS" heading="来源与照片使用许可" detail="学校资料优先使用官方招生、学术目录和财务办公室；照片保留真实出处、摄影者、日期及授权链接。"/>
 <div className="hhba-minot-source-grid">{Object.entries(tamiuSources).map(([id,v])=><a key={id} href={v.url} rel="noopener noreferrer" target="_blank"><BookOpen size={16}/>{v.label}<ExternalLink size={13}/></a>)}</div>
 <div className="hhba-minot-license"><h3>照片逐张署名（真实校园；非 AI）</h3>{tamiuPhotos.map(p=><p key={p.id}>《{p.title}》 · 摄影 {p.creator} · {p.date} · {p.license} · <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">原图出处</a> · <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">许可原文</a>。{p.note}</p>)}</div>
 </section>;}
const nav=[['#tamiu-overview','学校介绍'],['#tamiu-campus','真实照片'],['#tamiu-mba','MBA 课程'],['#tamiu-admissions','申请条件'],['#tamiu-costs','真实费用'],['#tamiu-funding','资助机会'],['#tamiu-faq','常见疑问'],['#tamiu-sources','来源证据']];
function Breadcrumb({degree}:{degree?:boolean}){return <nav className="hhba-minot-breadcrumb" aria-label="页面层级"><Link to="/study-abroad"><ArrowLeft size={15}/> 留学机会</Link><span>/</span>{degree?<><Link to="/study-abroad/university/tamiu">德州农工国际大学</Link><span>/</span><span>MBA</span></>:<span>德州农工国际大学</span>}</nav>;}
export function TamiuUniversityPage({user}:{user:User|null}){
 const [faq,setFaq]=useState(0);
 return <Frame user={user}><Breadcrumb/><header className="hhba-minot-hero">
 <p className="hhba-minot-overline"><School size={16}/> HHBA UNIVERSITY DEEP PROFILE · 03</p><h1>德州农工国际大学</h1><p className="hhba-minot-hero-en">Texas A&M International University · TAMIU</p>
 <p className="hhba-minot-hero-copy">一所位于美国得克萨斯州拉雷多（Laredo）的公立大学，隶属 Texas A&M University System。我们将 MBA 官方课程、国际申请要求、跨专业限制、学习方式、2026–27 费用与学校资助分开核实，并通过真实校园影像呈现实际的大学环境。</p>
 <p className="hhba-minot-location"><MapPin size={16}/> 5201 University Boulevard · Laredo, Texas 78041, USA</p>
 <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href={tamiuSources.university.url} target="_blank" rel="noopener noreferrer">访问大学官网 <ExternalLink size={15}/></a><Source url={tamiuSources.admission.url}>研究生招生条件</Source></div>
 <p className="hhba-minot-verify"><ShieldCheck size={15}/> 官方材料核验于 2026-10-31 · 仅为信息参考，不承诺录取、签证和资助</p>
 </header>
 <nav className="hhba-minot-jump" aria-label="大学详情导航">{nav.map(([id,label])=><a key={id} href={id}>{label}</a>)}</nav>
 <div className="hhba-minot-facts">{tamiuFacts.map(v=><div key={v.label}><span>{v.label}</span><strong>{v.value}</strong></div>)}</div>
 <Overview/><Gallery/><Curriculum/><Admissions/><Costs/><Funding/>
 <section className="hhba-minot-section" id="tamiu-faq"><Title eyebrow="FAQ · PRACTICAL QUESTIONS" heading="申请前最容易误解的七件事" detail="涵盖校名、MBA 线上与线下、跨专业、GRE/GMAT、费用、资助及 I-20。"/><div className="hhba-minot-faq">{tamiuFaq.map((v,i)=><div key={v.q} className="hhba-minot-faq-item"><button type="button" aria-expanded={faq===i} onClick={()=>setFaq(faq===i?-1:i)}><span>{v.q}</span><span>{faq===i?'−':'+'}</span></button>{faq===i&&<div><p>{v.a}</p><Source url={v.url}>阅读官方依据</Source></div>}</div>)}</div></section>
 <Sources/><div className="hhba-minot-end-actions"><span>TAMIU 深度院校档案 · HHBA 留学机会</span><Link to="/study-abroad"><ArrowLeft size={14}/> 返回留学机会</Link></div>
 </Frame>;
}
export function TamiuMbaPage({user}:{user:User|null}){
 return <Frame user={user}><Breadcrumb degree/><header className="hhba-minot-hero hhba-minot-degree-hero"><p className="hhba-minot-overline"><GraduationCap size={16}/> A.R. SANCHEZ JR. BUSINESS SCHOOL · PROGRAM DETAIL</p><h1>工商管理硕士（MBA）</h1><p className="hhba-minot-hero-en">Master of Business Administration · TAMIU</p><p className="hhba-minot-hero-copy">一项真实的硕士学位，包含多个由大学正式目录确认的方向。重点帮助申请者了解课程、商科背景条件、GMAT/GRE 规定、国际招生流程、授课形式及真实预算，而不是机械堆叠硕士名称。</p>
 <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href={tamiuSources.degree.url} rel="noopener noreferrer" target="_blank">MBA 2026–27 官方课程目录 <ExternalLink size={15}/></a><Link className="hhba-minot-alt-btn" to="/study-abroad/university/tamiu">查看大学实景与校史 <ArrowRight size={15}/></Link></div>
 <p className="hhba-minot-verify"><ShieldCheck size={15}/> CIP 52.0201.00 · 是否校内招生、学制及签证资格须按具体方向核实</p></header>
 <div className="hhba-minot-metadata"><div><span>学位类型</span><strong>MBA 硕士</strong></div><div><span>专业来源</span><strong>2026–27 官方学术目录</strong></div><div><span>课程基础</span><strong>随本科背景调整</strong></div><div><span>申请身份</span><strong>F-1/I-20 须专项确认</strong></div></div>
 <Caution>注意：TAMIU 官网列有多个线上 MBA 方向。在线项目存在不等于能凭该项目获发 I-20 或以 F-1 身份全日在校学习。必须在付费或申请签证前由大学国际办公室核实。</Caution>
 <Curriculum/><Admissions/><Costs/><Funding/>
 <section className="hhba-minot-section"><Title eyebrow="PREFERRED INTERNATIONAL DEADLINES" heading="学校列出的国际申请节点" detail="月份与日期为研究生院 Preferred Admission Deadlines，不代表具体入学年及 MBA 方向已开放招生。"/>
 <div className="hhba-minot-deadlines">{tamiuAdmission.deadlines.map(v=><div key={v.name}><CalendarDays size={20}/><div><strong>{v.name}</strong><b>{v.month}</b><small>{v.note}</small></div></div>)}</div>
 <Source url={tamiuSources.admission.url}>研究生院最新招生时间</Source></section>
 <div className="hhba-minot-cta-panel"><div><h2>下一步：确认具体方向和授课形式</h2><p>请在学校 MBA 目录确认课程与先修，并向研究生院核实国际生实际入学及资金证明要求。</p></div><a className="hhba-study-btn" href={tamiuSources.degree.url} rel="noopener noreferrer" target="_blank">打开 MBA 官方目录 <ExternalLink size={15}/></a></div>
 <div className="hhba-minot-end-actions"><Link to="/study-abroad/university/tamiu"><ArrowLeft size={14}/> 返回大学详情和真实照片</Link><Source url={tamiuSources.admission.url}>查看研究生官方申请</Source></div>
 </Frame>;
}
