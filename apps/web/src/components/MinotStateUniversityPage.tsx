import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,ExternalLink,GraduationCap,Info,MapPin,ShieldAlert,ShieldCheck,School,Wallet,Camera,Building2,FileCheck2,Mail,Lightbulb} from 'lucide-react';
import type {User} from '../services/api';
import {Link} from '../router';
import {Shell} from './Shell';
import {minotAdmissions,minotCampusSections,minotFacts,minotFAQs,minotPhotos,minotPrograms,minotSources,minotTuitionRows} from '../data/studyMinotState';
import {findProgram} from '../data/studyUniversities';
import '../styles/study-minot-state.css';

const imagePath=(file:string)=>import.meta.env.BASE_URL+'images/study/minot-state/'+file;
const src=(s:{label:string;url:string})=><a href={s.url} target="_blank" rel="noopener noreferrer" className="hhba-minot-source-link">{s.label}<ExternalLink size={13}/></a>;

function LocalGallery(){
 const [index,setIndex]=useState(0);
 const [lightbox,setLightbox]=useState(false);
 const item=minotPhotos[index];
 useEffect(()=>{
  if(!lightbox)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setLightbox(false);if(e.key==='ArrowLeft')setIndex(i=>(i+minotPhotos.length-1)%minotPhotos.length);if(e.key==='ArrowRight')setIndex(i=>(i+1)%minotPhotos.length);};
  window.addEventListener('keydown',onKey);
  return ()=>window.removeEventListener('keydown',onKey);
 },[lightbox]);
 return <section className="hhba-minot-gallery" aria-label="迈诺特州立大学真实校园照片" data-minot-gallery>
  <div className="hhba-minot-heading"><div><p className="hhba-minot-overline"><Camera size={15}/> 真实校园影像 · 来源与授权可追溯</p><h2>走进迈诺特州立大学校园</h2><p>3 张独立拍摄的历史建筑实景，均为该校 Old Main；不冒充不同教学楼、图书馆或课堂照片。</p></div><span>01 / 03 · 真实照片</span></div>
  <div className="hhba-minot-gallery-grid">
   <div className="hhba-minot-feature-photo">
    <button type="button" className="hhba-minot-photo-trigger" aria-label={'放大查看 '+item.title} onClick={()=>setLightbox(true)}>
     <img src={imagePath(item.file)} alt={'Minot State University · '+item.title} loading="eager"/>
     <span className="hhba-minot-photo-title">{item.title}<small>{item.captured} · 点击放大</small></span>
    </button>
   </div>
   <div className="hhba-minot-gallery-thumbs">
    {minotPhotos.map((p,i)=><button className={'hhba-minot-thumb '+(index===i?'selected':'')} type="button" key={p.id} aria-pressed={index===i} onClick={()=>setIndex(i)}>
     <img src={imagePath(p.file)} alt={p.title} loading="lazy"/><span>{p.title}</span>
    </button>)}
   </div>
  </div>
  <div className="hhba-minot-photo-credit"><strong>当前照片：</strong>{item.summary}<span>摄影：{item.creator} · {item.license}</span>
   <div><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看图片来源 <ExternalLink size={13}/></a><a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">查看使用许可 <ExternalLink size={13}/></a></div>
  </div>
  {lightbox&&<div className="hhba-minot-lightbox" role="dialog" aria-modal="true" aria-label="校园照片放大查看">
   <div className="hhba-minot-lightbox-toolbar"><span>{index+1}/{minotPhotos.length} · {item.title}</span><button autoFocus type="button" onClick={()=>setLightbox(false)} aria-label="关闭图片放大">关闭 ×</button></div>
   <div className="hhba-minot-lightbox-body">
    <button type="button" aria-label="上一张校园照片" onClick={()=>setIndex(i=>(i+minotPhotos.length-1)%minotPhotos.length)}><ChevronLeft/></button>
    <img src={imagePath(item.file)} alt={item.title}/>
    <button type="button" aria-label="下一张校园照片" onClick={()=>setIndex(i=>(i+1)%minotPhotos.length)}><ChevronRight/></button>
   </div>
   <p>{item.creator} · {item.credit} · {item.license}</p>
  </div>}
 </section>;
}
function SectionTitle({eyebrow,title,summary}:{eyebrow:string;title:string;summary:string}){
 return <div className="hhba-minot-heading"><div><p className="hhba-minot-overline">{eyebrow}</p><h2>{title}</h2><p>{summary}</p></div></div>;
}
function SourceIndex(){
 return <section className="hhba-minot-panel hhba-minot-sources" id="minot-sources">
  <SectionTitle eyebrow="REFERENCE · SOURCE TRANSPARENCY" title="官方资料与图片授权" summary="每项政策及数据都有独立来源。不同年份、申请身份与项目可能改变，正式申请前应复核。"/>
  <div className="hhba-minot-source-grid">{Object.entries(minotSources).map(([key,v])=><a key={key} href={v.url} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>{v.label}<ExternalLink size={13}/></a>)}</div>
  <div className="hhba-minot-license"><h3>校园照片授权说明</h3>
   {minotPhotos.map(p=><p key={p.id}>《{p.title}》——摄影：{p.creator}；{p.license}；<a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.credit}</a>；<a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">许可原文</a>。照片未进行 AI 场景合成，仅在页面中按比例裁切显示。</p>)}
  </div>
 </section>;
}
function MinotFrame({children}:{children:React.ReactNode}){
 return <div className="hhba-study hhba-minot" data-minot-detail="official-longform"><div className="hhba-study-wrap">{children}</div></div>;
}
function Advisory({children}:{children:React.ReactNode}){return <div className="hhba-minot-warning"><ShieldAlert size={20}/><p>{children}</p></div>;}
function FeeTable(){return <div className="hhba-minot-fee-wrap"><table><thead><tr><th>费用项目</th><th>美元参考金额</th><th>口径说明</th></tr></thead><tbody>{minotTuitionRows.map(r=><tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}</td><td>{r.tip}</td></tr>)}</tbody></table></div>;}
function ProgramCards(){const cards=['minot-management-ms','minot-cyber-ms'] as const;return <section className="hhba-minot-section" id="minot-programs">
 <SectionTitle eyebrow="ACADEMICS · 2 VERIFIED PROGRAMS" title="真正开设的研究生专业" summary="我们先把两项官方确认的硕士项目研究透，再逐校增加。以下既有亮点，也有必须面对的申请限制。"/>
 <div className="hhba-minot-program-grid">
 {cards.map(id=>{const p=findProgram(id)!,info=minotPrograms[id];return <article key={id} className={'hhba-minot-program-card '+(id==='minot-cyber-ms'?'caution':'')}>
  <div className="hhba-minot-prog-icon"><GraduationCap size={25}/></div>
  <p className="hhba-minot-overline">{p.field==='business'?'跨专业友好 · 管理方向':'技术背景相关 · 国际签证需特别核实'}</p>
  <h3>{p.chinese}</h3><p className="hhba-minot-program-en">{p.english}</p><p className="hhba-minot-program-summary">{info.suitability}</p>
  <div className="hhba-minot-mini-stats"><span>30 学分</span><span>校园课程选项</span><span>{id==='minot-cyber-ms'?'I-20 风险提示':'可查看国际生路径'}</span></div>
  {id==='minot-cyber-ms'&&<p className="hhba-minot-caution"><ShieldAlert size={16}/> 不在当前学校公开的 I-20/F-1 适用专业清单中</p>}
  <Link className="hhba-minot-program-btn" to={'/study-abroad/program/'+id}>查看完整专业、要求与申请流程 <ArrowRight size={16}/></Link>
 </article>;})}
 </div>
 </section>;}
export function MinotStateUniversityPage({user}:{user:User|null}){
 const [openFaq,setOpenFaq]=useState(0);
 return <Shell user={user}><MinotFrame>
  <nav className="hhba-minot-breadcrumb" aria-label="面包屑导航"><Link to="/study-abroad"><ArrowLeft size={15}/> 留学机会</Link><span>/</span><span>迈诺特州立大学</span></nav>
  <header className="hhba-minot-hero">
   <div className="hhba-minot-hero-title"><p className="hhba-minot-overline"><School size={15}/> HHBA VERIFIED CAMPUS PROFILE · 01</p>
    <h1>迈诺特州立大学</h1><p className="hhba-minot-hero-en">Minot State University</p>
    <p className="hhba-minot-hero-copy">一所在美国北达科他州迈诺特市扎根百余年的公立大学。对于希望认真比较校园学习、跨专业可能性与整体经济负担的申请者，我们不只给出学校名字，而是从课程、资格、生活环境到资金准备，把重要问题讲清楚。</p>
    <div className="hhba-minot-location"><MapPin size={16}/> 500 University Ave W · Minot, North Dakota, USA</div>
    <div className="hhba-minot-hero-actions"><a className="hhba-study-btn" href="https://www.minotstateu.edu/" target="_blank" rel="noopener noreferrer">访问学校官网 <ExternalLink size={15}/></a><a className="hhba-minot-alt-btn" href={minotSources.admission.url} target="_blank" rel="noopener noreferrer">研究生官方申请说明 <ArrowUpRight size={16}/></a></div>
    <p className="hhba-minot-verify"><ShieldCheck size={14}/> 信息核对：2026-10-31 · 官方来源 · 不提供保录与签证保证</p>
   </div>
  </header>
  <nav className="hhba-minot-jump" aria-label="大学详情页面目录">
   {[['#minot-overview','学校概况'],['#minot-campus','校园影像'],['#minot-programs','硕士专业'],['#minot-admissions','申请条件'],['#minot-cost','真实费用'],['#minot-life','校园生活'],['#minot-faq','常见问题'],['#minot-sources','资料来源']].map(([to,label])=><a key={to} href={to}>{label}</a>)}
  </nav>
  <div className="hhba-minot-facts" aria-label="大学核心事实">
   {minotFacts.map(f=><div key={f.label}><span>{f.label}</span><strong>{f.value}</strong></div>)}
  </div>
  <section className="hhba-minot-section" id="minot-overview">
   <SectionTitle eyebrow="UNIVERSITY · BACKGROUND" title="先读懂学校，而不只是看排名" summary="学校历史、认证、教学特色和地区生活条件，决定它是不是适合你进一步研究的留学选择。"/>
   <div className="hhba-minot-narrative-grid">
    {minotCampusSections.map((s,i)=><article key={s.title} className="hhba-minot-narrative"><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{s.title}</h3><p>{s.body}</p><a href={s.source} target="_blank" rel="noopener noreferrer">查看学校官方资料 <ExternalLink size={13}/></a></div></article>)}
   </div>
   <div className="hhba-minot-insight"><Lightbulb size={19}/><p><strong>适合什么样的申请者？</strong>预算敏感、接受中小城市生活、愿意仔细研究课程和申请条件的学生，可以把这里作为初步比较对象。它是否真正适合你仍取决于本科背景、英语成绩、专业、线下授课安排和学校签证资格，不能依据学校类别直接做决定。</p></div>
  </section>
  <div id="minot-campus"><LocalGallery/></div>
  <ProgramCards/>
  <section className="hhba-minot-section" id="minot-admissions">
   <SectionTitle eyebrow="ADMISSIONS · REAL CHECKLIST" title="研究生申请条件与准备清单" summary="不只写“本科毕业可申请”，而是把学校公开的成绩门槛、英语考试、材料要求和签证限制整理成可逐项核对的流程。"/>
   <div className="hhba-minot-compare"><div><h3><CheckCircle2 size={19}/> 学术基本门槛</h3><p>{minotAdmissions.general}</p>{src(minotSources.admission)}</div>
    <div><h3><BookOpen size={19}/> 官方语言要求</h3><ul>{minotAdmissions.english.map(t=><li key={t}>{t}</li>)}</ul>{src(minotSources.admission)}</div>
   </div>
   <h3 className="hhba-minot-subtitle">申请资料核对 · 7 个步骤</h3>
   <div className="hhba-minot-steps">{minotAdmissions.documents.map((t,i)=><div className="hhba-minot-step" key={i}><span>{i+1}</span><p>{t}</p></div>)}</div>
   <Advisory>管理学硕士属于学校列出的 I-20/F-1 适用研究生方向，但网络安全硕士不在当前公布清单。**有校园课程≠能取得 F-1 学生签证文件**。规划赴美线下学习前，先检查具体项目的资格，不能混为一谈。</Advisory>
   <div className="hhba-minot-small-links">{src(minotSources.deadlines)}{src(minotSources.admission)}</div>
  </section>
  <section className="hhba-minot-section" id="minot-cost">
   <SectionTitle eyebrow="COST · 2026–27 OFFICIAL ESTIMATE" title="把费用算清楚：学校公开的国际生参考" summary="所有金额均来自学校 2026–27 研究生费用网页，单位为美元。属于特定修课及住宿假设的参考预算，不是整个硕士的固定总费用。"/>
   <FeeTable/>
   <div className="hhba-minot-budget-note"><Info size={18}/><p>学校公布的国际生年度参考合计为 <strong>US$20,641</strong>，含指定口径下的学杂费、校内食宿及健康保险。机票、额外课程费用、签证办理、个人生活消费等可能另行发生。不同专业的 30 学分总费用、奖助学金和实际学制不能简单通过这一参考数直接推算。</p></div>
   <div className="hhba-minot-small-links">{src(minotSources.tuition)}{src(minotSources.scholarship)}</div>
  </section>
  <section className="hhba-minot-section" id="minot-life">
   <SectionTitle eyebrow="LIFE · SUPPORT · PRACTICALITIES" title="住宿、校园生活与奖学金" summary="生活安排和经济支持往往比学校名称更影响留学体验，我们将学校确认的服务与不确定的内容分开展示。"/>
   <div className="hhba-minot-life-grid">
    <article><Building2 size={22}/><h3>住宿与校园设施</h3><p>学校列有 Cook、Crane、Lura Manor 和 McCulloch 等宿舍，并公布 Student Center、Old Main、图书馆、运动设施等地图信息。实际申请宿舍时，应核实房型是否开放、入住日期、价格及餐饮套餐。</p>{src(minotSources.housing)}{src(minotSources.campus)}</article>
    <article><Wallet size={22}/><h3>奖学金与助教</h3><p>学校设有院系奖学金及研究生助教岗位。学校说明助教需正式录取、达到注册学分门槛并通过院系选拔；每学期工资参考按约 5 小时/周 US$1,370、约 10 小时/周 US$2,740 分档，明确不代表学费减免。名额不能保证。</p>{src(minotSources.scholarship)}</article>
    <article><FileCheck2 size={22}/><h3>入学后办理事项</h3><p>国际学生入学通常需要按学校要求提供健康保险、适用免疫材料，确认到校时间、注册状态和住宿信息。学校特别提示，获录取后若需要 I-20，应按要求准备资金证明，签证也需要独立审批。</p>{src(minotSources.admission)}</article>
   </div>
  </section>
  <section className="hhba-minot-section" id="minot-faq">
   <SectionTitle eyebrow="FAQ · QUESTIONS THAT MATTER" title="真正需要搞清楚的常见问题" summary="不仅展示优点，也主动提醒跨专业、国际生资格和资金预算等容易误解的地方。"/>
   <div className="hhba-minot-faq">{minotFAQs.map((f,i)=><div className="hhba-minot-faq-item" key={i}><button type="button" aria-expanded={openFaq===i} onClick={()=>setOpenFaq(openFaq===i?-1:i)}><span>{f.q}</span><span>{openFaq===i?'−':'+'}</span></button>{openFaq===i&&<div><p>{f.a}</p><a href={f.url} target="_blank" rel="noopener noreferrer">核对学校官方说明 <ExternalLink size={13}/></a></div>}</div>)}</div>
  </section>
  <SourceIndex/>
  <div className="hhba-minot-end-actions"><p><Mail size={17}/> 学校研究生院联系邮箱：<a href={'mailto:'+minotAdmissions.contact}>{minotAdmissions.contact}</a></p><Link to="/study-abroad">返回留学机会 <ArrowRight size={15}/></Link></div>
 </MinotFrame></Shell>;
}
export function MinotStateProgramPage({user,id}:{user:User|null;id:'minot-management-ms'|'minot-cyber-ms'}){
 const program=findProgram(id)!;
 const detail=minotPrograms[id];
 const isCyber=id==='minot-cyber-ms';
 return <Shell user={user}><MinotFrame>
  <nav className="hhba-minot-breadcrumb" aria-label="面包屑导航"><Link to="/study-abroad"><ArrowLeft size={15}/> 留学机会</Link><span>/</span><Link to="/study-abroad/university/minot-state">迈诺特州立大学</Link><span>/</span><span>{program.chinese}</span></nav>
  <header className="hhba-minot-hero hhba-minot-degree-hero"><p className="hhba-minot-overline"><GraduationCap size={16}/> MINOT STATE · GRADUATE PROGRAM</p><h1>{program.chinese}</h1><p className="hhba-minot-hero-en">{program.english}</p><p className="hhba-minot-hero-copy">{detail.suitability}</p>
   <div className="hhba-minot-hero-actions"><a href={program.officialProgramUrl} className="hhba-study-btn" target="_blank" rel="noopener noreferrer">打开具体课程官网 <ExternalLink size={15}/></a><Link className="hhba-minot-alt-btn" to="/study-abroad/university/minot-state">查看学校与真实校园照片 <ArrowRight size={16}/></Link></div>
   <p className="hhba-minot-verify"><ShieldCheck size={14}/> 学校官方资料 · 核验日 2026-10-31 · 开放状态需复核</p>
  </header>
  <div className="hhba-minot-metadata"><div><span>课程学分</span><strong>30</strong></div><div><span>课程授课方式</span><strong>校内 / 在线</strong></div><div><span>学制与计划</span><strong>{isCyber?'约 1–2 年':'可选 3 或 4 学期路径'}</strong></div><div><span>跨专业判断</span><strong>{isCyber?'需技术/商科背景或相关经验':'学校明确不要求商科背景'}</strong></div></div>
  {isCyber&&<Advisory>{detail.flag} 这是核对国际学生能否线下就读时必须优先解决的问题。请勿因为网页显示 On Campus 就直接购买机票或作出财务承诺。</Advisory>}
  <section className="hhba-minot-section"><SectionTitle eyebrow="PROGRAM · WHAT YOU STUDY" title="具体会学什么？" summary="按官方课程介绍整理学习方向，下面是内容主题解析，不冒充校方逐门课程清单或完整教学大纲。"/>
   <p className="hhba-minot-long-intro">{detail.duration}</p><div className="hhba-minot-narrative-grid">{detail.curriculum.map((a,i)=><article className="hhba-minot-narrative" key={a.title}><span className="hhba-minot-index">{String(i+1).padStart(2,'0')}</span><div><h3>{a.title}</h3><p>{a.body}</p></div></article>)}</div>
  </section>
  <section className="hhba-minot-section"><SectionTitle eyebrow="ENTRY · EVIDENCE-BASED" title="到底谁可以申请？" summary="先区分专业背景、最低分数和国际学生手续三个层面，避免一句“可跨专业”就掩盖限制。"/>
   <div className="hhba-minot-compare"><div><h3>专业背景与成绩</h3><p>{detail.eligibility}</p>{src(minotSources.deadlines)}</div><div><h3>语言能力</h3><ul>{minotAdmissions.english.map(s=><li key={s}>{s}</li>)}</ul>{src(minotSources.admission)}</div></div>
   <div className="hhba-minot-insight"><Info size={18}/><p><strong>I-20/F-1 核实：</strong>{detail.flag}</p></div>
  </section>
  <section className="hhba-minot-section"><SectionTitle eyebrow="DEADLINE · VERIFY YEAR" title="国际申请截止时间" summary="学校官网招生标准所列的项目时间。以下是原网页的月份与日期，不假设适用于未公布的未来入学年度。"/>
   <div className="hhba-minot-deadlines">{detail.deadlines.map(d=><div key={d.period}><CalendarDays size={20}/><div><strong>{d.period}</strong><b>{d.date}</b><small>{d.note}</small></div></div>)}</div>
   {src(minotSources.deadlines)}
  </section>
  <section className="hhba-minot-section"><SectionTitle eyebrow="CHECKLIST · ACTIONS" title="准备申请材料的实际步骤" summary="学校研究生院的共通标准；具体专业如有附加要求，以官方项目申请页面为准。"/>
   <div className="hhba-minot-steps">{minotAdmissions.documents.map((s,i)=><div className="hhba-minot-step" key={i}><span>{i+1}</span><p>{s}</p></div>)}</div>{src(minotSources.admission)}
  </section>
  <section className="hhba-minot-section"><SectionTitle eyebrow="COST · NOT A GUARANTEE" title="费用和奖助学金" summary="同一所学校的国际生年度预算并不等于具体专业的完整学位总费用。"/>
   <FeeTable/><p className="hhba-minot-budget-note"><Info size={18}/> 学校 2026–27 年国际研究生参考年度合计 US$20,641；具体费用取决于学分与个人情况。此处并未确认这个项目全部 30 学分的精确总账单，也不能保证助教或奖学金。</p>
   <div className="hhba-minot-small-links">{src(minotSources.tuition)}{src(minotSources.scholarship)}</div>
  </section>
  <div className="hhba-minot-cta-panel"><div><h2>最后一步：以大学官方材料为准</h2><p>已经确认的是项目存在与学校公开的相关信息；尚未确认的是你的个人入学资格、名额、签证批准与最终总花费。</p></div><a href={program.officialProgramUrl} target="_blank" rel="noopener noreferrer" className="hhba-study-btn">继续到该专业官方网页 <ExternalLink size={15}/></a></div>
  <div className="hhba-minot-end-actions"><Link to="/study-abroad/university/minot-state"><ArrowLeft size={15}/> 返回学校详情</Link><a href={minotSources.admission.url} target="_blank" rel="noopener noreferrer">核对国际生申请说明 <ExternalLink size={13}/></a></div>
 </MinotFrame></Shell>;
}
