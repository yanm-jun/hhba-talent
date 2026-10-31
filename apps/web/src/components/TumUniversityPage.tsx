import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CalendarDays,ChevronLeft,ChevronRight,ExternalLink,GraduationCap,Info,MapPin,ShieldAlert,ShieldCheck,School,Lightbulb} from 'lucide-react';
import type {User} from '../services/api';
import {Link} from '../router';
import {Shell} from './Shell';
import {tumSources,tumStats,tumPhotos,tumOverview,tumThemes,tumLanguage,tumApplication,tumWindows,tumFees,tumFaq} from '../data/studyTum';
import '../styles/study-minot-state.css';
import '../styles/study-tum.css';
const local=(file:string)=>import.meta.env.BASE_URL+'images/study/tum/'+file;
function Source({url,children}:{url:string;children:React.ReactNode}){return <a className="hhba-minot-source-link" href={url} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13}/></a>;}
function Heading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <div className="hhba-minot-heading"><div><p className="hhba-minot-overline">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>;}
function Frame({user,children}:{user:User|null;children:React.ReactNode}){return <Shell user={user}><main className="hhba-study hhba-minot hhba-tum" data-tum-deep-profile="true"><div className="hhba-study-wrap">{children}</div></main></Shell>;}
function Alert({children}:{children:React.ReactNode}){return <div className="hhba-minot-warning"><ShieldAlert size={19}/><p>{children}</p></div>;}
function Breadcrumb({program}:{program?:boolean}){return <nav className="hhba-minot-breadcrumb" aria-label="页面层级"><Link to="/study-abroad"><ArrowLeft size={15}/> 留学机会</Link><span>/</span>{program?<><Link to="/study-abroad/university/tum">慕尼黑工业大学</Link><span>/</span><span>信息学硕士</span></>:<span>慕尼黑工业大学</span>}</nav>;}
function Gallery(){
 const [selected,setSelected]=useState(0);const [open,setOpen]=useState(false);
 const image=tumPhotos[selected];
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowLeft')setSelected(i=>(i+2)%3);if(e.key==='ArrowRight')setSelected(i=>(i+1)%3);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open]);
 return <section className="hhba-minot-gallery" id="tum-campus" data-tum-gallery>
 <Heading eyebrow="AUTHENTIC CAMPUS · 3 INDEPENDENT SCENES" title="真实 Garching 校园影像" description="分别来自研究园区全景、高等研究院建筑、数学与信息学楼内部。包含拍摄年代、摄影者、许可和原图；不拿慕尼黑市中心或其他德国大学照片冒充。"/>
 <div className="hhba-minot-gallery-grid"><div className="hhba-minot-feature-photo"><button type="button" className="hhba-minot-photo-trigger" onClick={()=>setOpen(true)} aria-label={'放大查看 '+image.name}><img alt={'TUM Garching '+image.name} src={local(image.file)} loading="eager"/><span className="hhba-minot-photo-title">{image.name}<small>{image.date} · 点击放大</small></span></button></div>
 <div className="hhba-minot-gallery-thumbs">{tumPhotos.map((p,i)=><button type="button" className={'hhba-minot-thumb '+(selected===i?'selected':'')} key={p.id} aria-pressed={selected===i} onClick={()=>setSelected(i)}><img alt={p.name} src={local(p.file)} loading="lazy"/><span>{p.name}</span></button>)}</div></div>
 <div className="hhba-minot-photo-credit"><strong>{image.description}</strong><span>摄影者：{image.author} · {image.date} · {image.license} · 网页自适应裁切；未采用 AI 合成图片</span><div><Source url={image.sourceUrl}>查看原图</Source><Source url={image.licenseUrl}>查看许可</Source></div></div>
 {open&&<div className="hhba-minot-lightbox" role="dialog" aria-modal="true" aria-label="TUM 校园照片放大"><div className="hhba-minot-lightbox-toolbar"><span>{selected+1}/3 · {image.name}</span><button type="button" autoFocus aria-label="关闭照片放大" onClick={()=>setOpen(false)}>关闭 ×</button></div><div className="hhba-minot-lightbox-body"><button type="button" aria-label="上一张照片" onClick={()=>setSelected(i=>(i+2)%3)}><ChevronLeft/></button><img alt={image.name} src={local(image.file)}/><button type="button" aria-label="下一张照片" onClick={()=>setSelected(i=>(i+1)%3)}><ChevronRight/></button></div><p>{image.author} · {image.license}</p></div>}
 </section>;
}
function Overview(){return <section id="tum-overview" className="hhba-minot-section"><Heading eyebrow="SCHOOL · RESEARCH · GARChING" title="学校与研究环境：先认清自己在哪里上课" description="TUM 名称带有 Munich，但信息学授课重点在 Garching 研究园区，校区、研究方向和学科背景都需要具体分辨。"/>
 <div className="hhba-minot-narrative-grid">{tumOverview.map((p,i)=><article className="hhba-minot-narrative" key={p.title}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{p.title}</h3><p>{p.body}</p><Source url={p.source}>大学官方说明</Source></div></article>)}</div>
 <div className="hhba-minot-insight"><Lightbulb size={20}/><p><strong>申请判断：</strong>与此前伯明翰、蒙纳士大学已经核实的转换型硕士不同，TUM Informatics MSc 不是非计算机本科无条件可读的专业。申请者应先核对大学要求的计算机本科课程和数学基础，再考虑费用、语言和项目是否适配。</p></div>
 </section>;}
function Degree(){return <section className="hhba-minot-section" id="tum-degree"><Heading eyebrow="ONE VERIFIED MASTER · 120 ECTS" title="信息学硕士：从本科计算机基础继续研究" description="只开发官方真实存在的 Informatics MSc，不凭相近的 AI、机器人或信息系统名称虚构新的学位。"/>
 <article className="hhba-tum-degree"><div><p className="hhba-minot-overline"><GraduationCap size={16}/> TECHNICAL UNIVERSITY OF MUNICH · GARCHING</p><h3>信息学理学硕士</h3><p>Master of Science in Informatics · 4 学期 · 120 ECTS</p><p>研究导向的进阶计算机硕士：高级算法、软件系统、数据库、人工智能、视觉、机器人与网络安全等方向提供多种组合选择；课程录取通过本科背景对照及两阶段专业能力审查。</p></div><Link className="hhba-study-btn" to="/study-abroad/program/tum-informatics-ms">进入完整硕士详情 <ArrowRight size={16}/></Link></article>
 <div className="hhba-minot-narrative-grid">{tumThemes.map((v,i)=><article className="hhba-minot-narrative" key={v.name}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{v.name}</h3><p>{v.detail}</p></div></article>)}</div>
 <div className="hhba-minot-small-links"><Source url={tumSources.program.url}>官方专业及研究方向</Source><Source url={tumSources.curriculum.url}>实时培养方案</Source></div>
 </section>;}
function Admissions(){return <section className="hhba-minot-section" id="tum-admission"><Heading eyebrow="UNI-ASSIST VPD · TUMONLINE · APTITUDE" title="入学审核不仅是英语成绩：11 步申请清单" description="从计算机基础匹配、uni-assist VPD 到 TUMonline 和课程分析文件，逐项列出官方可验证的实际流程。"/>
 <div className="hhba-minot-compare"><article><h3><BookOpen size={18}/> 英语成绩与德语条件的区别</h3><ul>{tumLanguage.map(x=><li key={x}>{x}</li>)}</ul><Source url={tumSources.english.url}>校方英语证书目录</Source></article>
 <article><h3><GraduationCap size={18}/> 两阶段专业能力审查</h3><p>申请需具备认可的本科学历、计算机科学课程与数学基础。TUM 明确通过 Curricular Analysis、Module Catalog、成绩与动机信进行能力审核，有些人还需要参加面试。材料齐全与语言达标不等于最终录取。</p><p>德国境外取得本科文凭的学生一般应提前办理 uni-assist VPD，不能把 VPD 当成专业录取通知书。</p><Source url={tumSources.cit.url}>CIT 官方申请要求</Source></article></div>
 <h3 className="hhba-minot-subtitle">真实材料与申请行动（逐条可核实）</h3><div className="hhba-minot-steps">{tumApplication.map((x,i)=><div className="hhba-minot-step" key={x}><span>{i+1}</span><p>{x}</p></div>)}</div>
 <Alert>学术专业背景是独立审核条件，不可将该项目宣传为「舞蹈、艺术、人文专业零基础转计算机」；本科课程分析、必要面试及语言成绩均以学校实际要求为准。</Alert>
 <div className="hhba-minot-small-links"><Source url={tumSources.admission.url}>CIT 申请入口</Source><Source url={tumSources.international.url}>uni-assist / VPD 信息</Source></div>
 </section>;}
function Dates(){return <section className="hhba-minot-section" id="tum-dates"><Heading eyebrow="WINTER / SUMMER · APPLICATION WINDOWS" title="可选择冬、夏学期，但一定要按官方窗口提交" description="学校公布的是每年常规申请区间；具体年份是否已开放、名额与例外文件截止要在 TUMonline 核实。"/>
 <div className="hhba-minot-deadlines">{tumWindows.map(x=><div key={x.name}><CalendarDays size={20}/><div><strong>{x.name}</strong><b>{x.range}</b><small>{x.detail}</small></div></div>)}</div><Source url={tumSources.program.url}>TUM 项目最新申请时间</Source>
 </section>;}
function Costs(){return <section className="hhba-minot-section" id="tum-costs"><Heading eyebrow="2026 CURRENT OFFICIAL TUITION · NO FREE-MASTER MYTH" title="非欧盟学费、学期杂费与实际总预算必须分开" description="TUM 官方对新入学非欧盟学生收取按专业确定的学费；信息学 MSc 全日制按每学期计算，而非仅交德国大学学期杂费。"/>
 <div className="hhba-minot-fee-wrap"><table><thead><tr><th>费用与学习项目</th><th>校方当前金额</th><th>来源和使用边界</th></tr></thead><tbody>{tumFees.map(x=><tr key={x.name}><th scope="row">{x.name}</th><td>{x.value}</td><td>{x.desc}</td></tr>)}</tbody></table></div>
 <div className="hhba-minot-budget-note"><Info size={20}/><p>学费为 €6,000/学期、学期杂费目前约 €97。按常规四个学期计算的 €24,000 仅为**未获得豁免且不超学制时的基础学费参考**，并非学校对任何个人承诺的最终毕业总开销；生活费、保险、签证和住宿需独立规划。</p></div>
 <div className="hhba-minot-small-links"><Source url={tumSources.program.url}>专业逐学期收费</Source><Source url={tumSources.tuition.url}>学费豁免及资助资格</Source><Source url={tumSources.fee.url}>学期杂费</Source></div>
 </section>;}
function Faq(){const [open,setOpen]=useState(0);return <section className="hhba-minot-section" id="tum-faq"><Heading eyebrow="FAQ · COMMON MISUNDERSTANDINGS" title="关于德国学费、跨专业、语言和 VPD 的八个关键疑问" description="提供明确的风险说明，避免“德国公立免学费”或“英语合格就可零基础跨计算机”等误导。"/>
 <div className="hhba-minot-faq">{tumFaq.map((q,i)=><div className="hhba-minot-faq-item" key={q.q}><button type="button" aria-expanded={open===i} onClick={()=>setOpen(open===i?-1:i)}><span>{q.q}</span><span>{open===i?'−':'+'}</span></button>{open===i&&<div><p>{q.a}</p><Source url={q.source}>官方资料</Source></div>}</div>)}</div></section>;}
function Sources(){return <section className="hhba-minot-panel" id="tum-sources"><Heading eyebrow="OFFICIAL FIRST-PARTY EVIDENCE" title="大学真实来源与三张照片授权" description="课程、申请和费用以 TUM 大学及 TUM CIT 为主；图片均有可打开的 Commons 授权原文件。"/>
 <div className="hhba-minot-source-grid">{Object.entries(tumSources).map(([key,s])=><a href={s.url} key={key} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>{s.name}<ExternalLink size={13}/></a>)}</div>
 <div className="hhba-minot-license"><h3>真实摄影作品逐一署名</h3>{tumPhotos.map(p=><p key={p.id}>{p.name} — 摄影：{p.author}（{p.date}），{p.license}。<a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">原始图片</a> · <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">许可文本</a>。网页可能按比例裁切，未做 AI 场景生成。</p>)}</div>
 </section>;}
export function TumUniversityPage({user}:{user:User|null}){return <Frame user={user}><Breadcrumb/>
 <header className="hhba-minot-hero"><p className="hhba-minot-overline"><School size={16}/> HHBA UNIVERSITY DEEP PROFILE · 06</p><h1>慕尼黑工业大学</h1><p className="hhba-minot-hero-en">Technical University of Munich · TUM</p><p className="hhba-minot-hero-copy">德国公立研究型大学；信息学硕士主授课地是 Garching。我们不仅展示有来源的三张校园实景，更核实硕士的四学期 120 ECTS、计算机本科先修、英语要求、两次申请窗口，以及非欧盟第三国学生每学期 €6,000 的真实学费和减免边界。</p><p className="hhba-minot-location"><MapPin size={16}/> Campus Garching · 85748 Garching bei München · Germany</p>
 <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href="https://www.tum.de/en/" target="_blank" rel="noopener noreferrer">大学官方网站 <ExternalLink size={15}/></a><Source url={tumSources.program.url}>信息学硕士官方招生</Source></div>
 <p className="hhba-minot-verify"><ShieldCheck size={15}/> 核验 2026-10-31 · 学费与申请政策仍须按实际年份确认</p></header>
 <nav className="hhba-minot-jump" aria-label="TUM 大学详情导航">{[['#tum-overview','学校校区'],['#tum-campus','真实照片'],['#tum-degree','信息学硕士'],['#tum-admission','入学材料'],['#tum-dates','申请时间'],['#tum-costs','学费资助'],['#tum-faq','常见问题'],['#tum-sources','官方依据']].map(([id,name])=><a key={id} href={id}>{name}</a>)}</nav>
 <div className="hhba-minot-facts">{tumStats.map(x=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}</div>
 <Overview/><Gallery/><Degree/><Admissions/><Dates/><Costs/><Faq/><Sources/>
 <div className="hhba-minot-end-actions"><span>HHBA · 第 06 所大学深入开发</span><Link to="/study-abroad"><ArrowLeft size={15}/> 返回留学机会</Link></div>
 </Frame>;}
export function TumInformaticsPage({user}:{user:User|null}){return <Frame user={user}><Breadcrumb program/>
 <header className="hhba-minot-hero hhba-minot-degree-hero"><p className="hhba-minot-overline"><GraduationCap size={16}/> TUM CIT · ADVANCED INFORMATICS</p><h1>信息学理学硕士</h1><p className="hhba-minot-hero-en">Master of Science in Informatics · TUM</p><p className="hhba-minot-hero-copy">这是建立在本科计算机科学知识之上的研究型硕士，不是零基础转换项目。学校为 120 ECTS、通常四学期、主要英语授课、Garching 校区，支持在算法、AI、信息系统与计算机安全等领域定制研究方向。</p>
 <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href={tumSources.program.url} target="_blank" rel="noopener noreferrer">专业官方申请与学费 <ExternalLink size={15}/></a><Link className="hhba-minot-alt-btn" to="/study-abroad/university/tum">学校与真实照片 <ArrowRight size={15}/></Link></div><p className="hhba-minot-verify"><ShieldCheck size={15}/> 2026-10-31 已核对 · 非自动获得录取资格</p></header>
 <div className="hhba-minot-metadata"><div><span>主校区</span><strong>Garching</strong></div><div><span>学分与标准学制</span><strong>120 ECTS · 4 学期</strong></div><div><span>非欧盟全日制学费</span><strong>€6,000 / 学期</strong></div><div><span>授课语言</span><strong>主要英语 · 证明需核验</strong></div></div>
 <Alert>TUM 官网明确规定信息学硕士要求已有本科计算机基础并进行 aptitude assessment，不能把它当作“任何艺术、人文或设计本科都能无先修直接转计算机”的项目。</Alert>
 <Degree/><Admissions/><Dates/><Costs/>
 <div className="hhba-minot-cta-panel"><div><h2>准备申请：对照课程基础并检查官方窗口</h2><p>先通过 CIT 核对本科模块和 VPD 预审材料，再进入 TUMonline；学费豁免和签证须另行核实。</p></div><a className="hhba-study-btn" href={tumSources.program.url} target="_blank" rel="noopener noreferrer">打开官方 Informatics MSc <ExternalLink size={15}/></a></div>
 <div className="hhba-minot-end-actions"><Link to="/study-abroad/university/tum"><ArrowLeft size={14}/> 返回 TUM 大学档案</Link><Source url={tumSources.admission.url}>CIT 研究生申请指南</Source></div>
 </Frame>;}
