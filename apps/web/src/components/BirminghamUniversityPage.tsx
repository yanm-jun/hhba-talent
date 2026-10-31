import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CalendarDays,ChevronLeft,ChevronRight,ExternalLink,GraduationCap,Info,MapPin,ShieldAlert,ShieldCheck,School,Wallet,Camera,FileCheck2,Lightbulb} from 'lucide-react';
import type {User} from '../services/api';
import {Link} from '../router';
import {Shell} from './Shell';
import {birminghamSources,birminghamFacts,birminghamPhotos,birminghamOverview,birminghamPrograms,birminghamEnglish,birminghamApplication,birminghamDates,birminghamFaqs,type BirminghamProgramId} from '../data/studyBirmingham';
import '../styles/study-minot-state.css';
import '../styles/study-birmingham.css';

const photo=(file:string)=>import.meta.env.BASE_URL+'images/study/birmingham/'+file;
const links=Object.values(birminghamSources);
function External({url,children}:{url:string;children:React.ReactNode}){return <a className="hhba-minot-source-link" href={url} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13}/></a>;}
function Heading({tag,title,subtitle}:{tag:string;title:string;subtitle:string}){return <div className="hhba-minot-heading"><div><p className="hhba-minot-overline">{tag}</p><h2>{title}</h2><p>{subtitle}</p></div></div>;}
function Frame({user,children}:{user:User|null;children:React.ReactNode}){return <Shell user={user}><main className="hhba-study hhba-minot hhba-bham" data-bham-detail="verified-longform"><div className="hhba-study-wrap">{children}</div></main></Shell>;}
function Alert({children}:{children:React.ReactNode}){return <div className="hhba-minot-warning"><ShieldAlert size={18}/><p>{children}</p></div>;}
function Crumbs({degree}:{degree?:boolean}){return <nav className="hhba-minot-breadcrumb" aria-label="页面位置"><Link to="/study-abroad"><ArrowLeft size={15}/> 留学机会</Link><span>/</span>{degree?<><Link to="/study-abroad/university/birmingham">伯明翰大学</Link><span>/</span><span>转换型硕士详情</span></>:<span>伯明翰大学</span>}</nav>;}
function Gallery(){
 const [index,setIndex]=useState(0);
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowLeft')setIndex(i=>(i+2)%3);if(e.key==='ArrowRight')setIndex(i=>(i+1)%3);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open]);
 const p=birminghamPhotos[index];
 return <section className="hhba-minot-gallery" id="bham-photos" data-bham-gallery>
  <Heading tag="REAL CAMPUS · 3 PHOTOS · CREDITS" title="真实校园：三处不同建筑" subtitle="Aston Webb 历史教学楼、主图书馆以及 2026 年 Old Joe 钟楼。照片均来自可追溯的摄影作品，绝非 AI 冒充实景。"/>
  <div className="hhba-minot-gallery-grid"><div className="hhba-minot-feature-photo"><button type="button" className="hhba-minot-photo-trigger" aria-label={'放大查看 '+p.label} onClick={()=>setOpen(true)}><img src={photo(p.file)} alt={p.label} loading="eager"/><span className="hhba-minot-photo-title">{p.label}<small>{p.date} · 点击放大查看</small></span></button></div>
   <div className="hhba-minot-gallery-thumbs">{birminghamPhotos.map((v,i)=><button key={v.id} type="button" className={'hhba-minot-thumb '+(index===i?'selected':'')} aria-pressed={index===i} onClick={()=>setIndex(i)}><img src={photo(v.file)} alt={v.label} loading="lazy"/><span>{v.label}</span></button>)}</div>
  </div>
  <div className="hhba-minot-photo-credit"><strong>{p.description}</strong><span>摄影者：{p.author} · {p.date} · {p.license} · {p.editNote}</span><div><External url={p.sourceUrl}>原始照片</External><External url={p.licenseUrl}>查看许可</External></div></div>
  {open&&<div className="hhba-minot-lightbox" role="dialog" aria-modal="true" aria-label="伯明翰大学真实照片放大"><div className="hhba-minot-lightbox-toolbar"><span>{index+1} / 3 · {p.label}</span><button type="button" aria-label="关闭放大照片" autoFocus onClick={()=>setOpen(false)}>关闭 ×</button></div>
   <div className="hhba-minot-lightbox-body"><button type="button" aria-label="上一张真实照片" onClick={()=>setIndex(i=>(i+2)%3)}><ChevronLeft/></button><img src={photo(p.file)} alt={p.label}/><button type="button" aria-label="下一张真实照片" onClick={()=>setIndex(i=>(i+1)%3)}><ChevronRight/></button></div><p>{p.author} · {p.license}</p></div>}
 </section>;
}
function Intro(){return <section id="bham-intro" className="hhba-minot-section">
 <Heading tag="UNIVERSITY · HISTORY · CONVERSION STUDY" title="了解学校，也了解为什么它适合跨专业研究" subtitle="与传统计算机进阶硕士不同，伯明翰提供面向非 computing 本科毕业生的两项转换课程。"/>
 <div className="hhba-minot-narrative-grid">{birminghamOverview.map((v,i)=><article className="hhba-minot-narrative" key={v.title}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{v.title}</h3><p>{v.body}</p><External url={v.source}>学校官方说明</External></div></article>)}</div>
 <div className="hhba-minot-insight"><Lightbulb size={20}/><p><strong>申请者可以研究什么？</strong>跨专业资格是真实的项目制度，而不是招生保证。课程要求英国 2:1 等同学历、雅思 6.5 且单项至少 6.0，还必须承担一年内完成 180 学分的学习密度。应结合预算、编程基础、语言成绩与个人发展方向审查适配性。</p></div>
 </section>;}
function Cards(){return <section className="hhba-minot-section" id="bham-programs">
 <Heading tag="TWO REAL MSc CONVERSION DEGREES" title="两项转换型硕士分别深入分析" subtitle="具体课程、跨专业申请、不同开学时间和国际生收费全部分开，不能把本地学费套给国际学生。"/>
 <div className="hhba-minot-program-grid">{(Object.keys(birminghamPrograms) as BirminghamProgramId[]).map(id=>{const p=birminghamPrograms[id];return <article className="hhba-minot-program-card" key={id}><div className="hhba-minot-prog-icon"><GraduationCap size={25}/></div><p className="hhba-minot-overline">180 credits · In person · Conversion</p><h3>{p.title}</h3><p className="hhba-minot-program-en">{p.english}</p><p className="hhba-minot-program-summary">{p.intro}</p><div className="hhba-minot-mini-stats"><span>1 年全日制</span><span>非计算机本科路径</span><span>{id==='birmingham-cs-conversion'?'1 月 / 9 月':'9 月入学'}</span></div><Link className="hhba-minot-program-btn" to={'/study-abroad/program/'+id}>查看专业详情、课程及准确学费 <ArrowRight size={15}/></Link></article>})}</div>
 </section>;}
function Requirements(){return <section className="hhba-minot-section" id="bham-admission">
 <Heading tag="ADMISSIONS · REAL DOCUMENT CHECKLIST" title="申请条件：英语、材料与 CAS 办理" subtitle="不仅写“可跨专业”，还要把英国等同学历、具体成绩、推荐人与国际申请流程逐项讲清楚。"/>
 <div className="hhba-minot-compare"><article><h3><BookOpen size={18}/> 两项课程语言要求</h3><ul>{birminghamEnglish.map(v=><li key={v}>{v}</li>)}</ul><External url={birminghamSources.entry.url}>核对官方英语要求</External></article>
 <article><h3><GraduationCap size={18}/> 2:1 学术背景与材料</h3><p>两门课程均接受非 computing 本科，但必须达到英国 2:1 或学校认可的等同学历，不能简单换算为统一的中国百分制分数。需要提交学位/成绩单、按要求提供英文翻译、个人陈述及推荐人信息。</p><p>授课型硕士一般无需支付大学申请费；校方最终审核是否符合学历、语言和专业要求。</p><External url={birminghamSources.documents.url}>申请文档细则</External></article></div>
 <h3 className="hhba-minot-subtitle">真实申请流程 · 10 步清单</h3>
 <div className="hhba-minot-steps">{birminghamApplication.map((v,i)=><div className="hhba-minot-step" key={v}><span>{i+1}</span><p>{v}</p></div>)}</div>
 <Alert>£3,000 为当前学校官网公布的一般国际授课型硕士押金，通常计入学费，不应再加作额外学费。接受录取、缴费和取得 CAS 是不同环节；必须遵循大学 Portal 和英国学生签证正式程序。</Alert>
 <div className="hhba-minot-small-links"><External url={birminghamSources.process.url}>官方申请流程与 2027 截止日</External><External url={birminghamSources.deposit.url}>CAS 与押金规则</External></div>
 </section>;}
function Deadlines(){return <section className="hhba-minot-section" id="bham-deadlines">
 <Heading tag="2027 INTERNATIONAL APPLICANT TIMELINE" title="申请截止日期必须区分海外身份与课程批次" subtitle="学校公布一般海外申请与押金截止节点，具体项目仍可能更早招满、关闭或有特别要求。"/>
 <div className="hhba-minot-deadlines">{birminghamDates.map(d=><div key={d.term}><CalendarDays size={20}/><div><strong>{d.term}</strong><b>{d.overseas}</b><small>常规海外申请截止；押金参考截止 {d.deposit}。{d.note}</small></div></div>)}</div><External url={birminghamSources.process.url}>查看最新版大学官方时间表</External>
 </section>;}
function Fees(){return <section className="hhba-minot-section" id="bham-fees">
 <Heading tag="2027 INTERNATIONAL TUITION · NO HOME FEES MIX-UP" title="真实学费、生活费用与奖学金边界" subtitle="两项课程国际生收费必须分别呈现，英国本地学生价格不准冒充国际学生价格。"/>
 <div className="hhba-minot-fee-wrap"><table><thead><tr><th>项目与入学</th><th>国际生课程学费</th><th>实际口径</th></tr></thead><tbody>
 {birminghamPrograms['birmingham-cs-conversion'].intlTuition.map(t=><tr key={t.term}><th>计算机科学 MSc · {t.term}</th><td>{t.value}</td><td>{t.note}</td></tr>)}
 <tr><th>AI 与计算机科学 MSc · 2027 年 9 月</th><td>待独立核验</td><td>官网展示的 UK/Ireland £12,780 不能作为国际生课程学费；申请时按国际身份及对应入学年份查看。</td></tr>
 <tr><th>国际授课型硕士押金</th><td>£3,000</td><td>通常在满足条件后缴纳并抵扣学费；申请 Portal 实际金额、日期需核对。</td></tr>
 <tr><th>住宿、饮食、交通与签证等</th><td>需个人预算</td><td>不属于以上课程学费；无证据就不填写猜测的生活成本或保底总费用。</td></tr>
 </tbody></table></div>
 <div className="hhba-minot-budget-note"><Info size={18}/><p>英国国际学生的学费与生活费、签证相关支出应分别核算；若获奖学金也要确认是否允许与其他资助叠加。大学奖学金页面仅说明可能提供资助，不能直接在总成本里预先扣除未知的金额。</p></div>
 <div className="hhba-minot-small-links"><External url={birminghamSources.cs.url}>2027 计算机科学硕士国际生学费</External><External url={birminghamSources.scholarships.url}>研究生奖学金</External></div>
 </section>;}
function Faq(){const [open,setOpen]=useState(0);return <section className="hhba-minot-section" id="bham-faq">
 <Heading tag="FAQ · SOURCE-BASED" title="跨专业申请最常见的八个问题" subtitle="辨别转换型学位、具体专业、国际生学费、开学批次、语言和 CAS。"/>
 <div className="hhba-minot-faq">{birminghamFaqs.map((v,i)=><div className="hhba-minot-faq-item" key={v.q}><button type="button" aria-expanded={open===i} onClick={()=>setOpen(open===i?-1:i)}><span>{v.q}</span><span>{open===i?'−':'+'}</span></button>{open===i&&<div><p>{v.a}</p><External url={v.src}>查看学校第一手依据</External></div>}</div>)}</div>
 </section>;}
function Sources(){return <section className="hhba-minot-panel" id="bham-sources"><Heading tag="AUDITABLE SOURCES" title="官方原文与校园图片授权" subtitle="公开课程与招生政策可能变更；点击学校原文核对课程、年份、个人资格与申请状态。"/>
 <div className="hhba-minot-source-grid">{links.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>{s.name}<ExternalLink size={13}/></a>)}</div>
 <div className="hhba-minot-license"><h3>照片逐张署名</h3>{birminghamPhotos.map(p=><p key={p.id}>《{p.label}》 · 摄影：{p.author} · {p.date} · {p.license}。<a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">原始照片</a> · <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">原许可</a>。{p.editNote}</p>)}</div>
 </section>;}
export function BirminghamUniversityPage({user}:{user:User|null}){
 return <Frame user={user}><Crumbs/>
 <header className="hhba-minot-hero"><p className="hhba-minot-overline"><School size={16}/> HHBA UNIVERSITY DEEP PROFILE · 04</p><h1>伯明翰大学</h1><p className="hhba-minot-hero-en">University of Birmingham · Edgbaston, United Kingdom</p>
 <p className="hhba-minot-hero-copy">1900 年成立的英国公立研究型大学。我们重点分析两项真正接受非计算机本科学习背景的转换型硕士：计算机科学 MSc，以及人工智能与计算机科学 MSc。大学校史、真实校园照片、180 学分课程内容、国际入学条件、2027 年学费、CAS 和奖学金，均从学校正式网页和可授权图片来源整理。</p>
 <p className="hhba-minot-location"><MapPin size={16}/> Edgbaston · Birmingham B15 2TT · England</p>
 <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href="https://www.birmingham.ac.uk/" target="_blank" rel="noopener noreferrer">大学官方网站 <ExternalLink size={15}/></a><External url={birminghamSources.process.url}>官方授课型硕士申请</External></div><p className="hhba-minot-verify"><ShieldCheck size={15}/> 官方资料与照片许可核验：2026-10-31 · 不保证录取、签证或就业</p></header>
 <nav className="hhba-minot-jump" aria-label="伯明翰大学详情导航">{[['#bham-intro','学校概况'],['#bham-photos','真实照片'],['#bham-programs','转换专业'],['#bham-admission','申请材料'],['#bham-deadlines','2027 时间'],['#bham-fees','国际学费'],['#bham-faq','常见问题'],['#bham-sources','官方来源']].map(([id,label])=><a key={id} href={id}>{label}</a>)}</nav>
 <div className="hhba-minot-facts">{birminghamFacts.map(f=><div key={f.label}><span>{f.label}</span><strong>{f.value}</strong></div>)}</div>
 <Intro/><Gallery/><Cards/><Requirements/><Deadlines/><Fees/><Faq/><Sources/>
 <div className="hhba-minot-end-actions"><span>HHBA · 伯明翰大学深度档案</span><Link to="/study-abroad"><ArrowLeft size={15}/> 返回留学机会</Link></div>
 </Frame>;
}
export function BirminghamProgramPage({user,id}:{user:User|null;id:BirminghamProgramId}){
 const p=birminghamPrograms[id];return <Frame user={user}><Crumbs degree/>
 <header className="hhba-minot-hero hhba-minot-degree-hero"><p className="hhba-minot-overline"><GraduationCap size={16}/> CONVERSION MSC · VERIFIED 2026-27 HANDBOOK</p><h1>{p.title}</h1><p className="hhba-minot-hero-en">{p.english}</p><p className="hhba-minot-hero-copy">{p.intro}</p><div className="hhba-minot-hero-actions"><a href={p.courseUrl} className="hhba-study-btn" target="_blank" rel="noopener noreferrer">专业官方课程与 Apply Now <ExternalLink size={15}/></a><Link className="hhba-minot-alt-btn" to="/study-abroad/university/birmingham">查看学校与真实校园 <ArrowRight size={15}/></Link></div>
 <p className="hhba-minot-verify"><ShieldCheck size={15}/> 国际申请材料需逐人审核 · 课程不是保录项目</p></header>
 <div className="hhba-minot-metadata"><div><span>授课形式</span><strong>In person · 校内</strong></div><div><span>标准学制</span><strong>1 年全日制</strong></div><div><span>总学分</span><strong>180 credits</strong></div><div><span>背景要求</span><strong>非 computing 本科 + 2:1 同等学历</strong></div></div>
 <section id="bham-curriculum" className="hhba-minot-section"><Heading tag="REAL 2026–27 DEGREE MODULES" title="具体课程与学分——逐项展开" subtitle="列出学校官方模块名称和学分。开课、课程考核与结构可能变化，最终以新学年课程目录和选课系统为准。"/>
 <p className="hhba-bham-description">{p.admission}</p><div className="hhba-minot-narrative-grid">{p.modules.map((m,i)=><article className="hhba-minot-narrative" key={m.name}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{m.name} · {m.credit} 学分</h3><p>{m.content}</p></div></article>)}</div>
 <div className="hhba-minot-insight"><Lightbulb size={18}/><p><strong>开学日期：</strong>{p.intakes}。大学官方给出本学位的总学分为 180。{p.note}</p></div>
 <External url={p.courseUrl}>打开课程官网核对当年模块</External></section>
 <Requirements/><Deadlines/><Fees/>
 <Alert>录取条件、海外学历同等转换、申请期限、国际生收费均由学校最新官方要求决定。即使课程写明接受跨专业，也不代表无需准备英语与编程基础，更不代表毕业就业或学生签证自动获批。</Alert>
 <div className="hhba-minot-cta-panel"><div><h2>下一步从大学的官方专业页面开始</h2><p>选择具体入学年月与国际生身份核对课程、费用及申请条件；不收取非官方申请代办费用。</p></div><a href={p.courseUrl} className="hhba-study-btn" target="_blank" rel="noopener noreferrer">查看官方课程并申请 <ExternalLink size={15}/></a></div>
 <div className="hhba-minot-end-actions"><Link to="/study-abroad/university/birmingham"><ArrowLeft size={14}/> 返回伯明翰大学</Link><External url={birminghamSources.process.url}>查看官方申请指南</External></div>
 </Frame>;
}
