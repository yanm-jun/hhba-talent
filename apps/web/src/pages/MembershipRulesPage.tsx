import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,ChevronDown,FileCheck2,Info,Printer,ShieldAlert,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import {chapters,faq,legalSources,RULE_STATUS,RULE_UPDATED,RULE_VERSION} from '../data/membershipRulesContent';
import {complianceAreas,launchChecks,membershipLaunchState} from '../data/membershipCompliance';
import '../styles/membership-rules.css';

const padNumber=(index:number)=>String(index+1).padStart(2,'0');

/** A single source of truth for sidebar labels, chapter anchors and scroll tracking. */
const navigation=[
 {id:'rules-compliance',title:'合规与重要提示',number:'重点'},
 ...chapters.map((chapter,index)=>({id:'rules-'+chapter.id,title:chapter.title,number:padNumber(index)})),
 {id:'rules-launch',title:'开售前核验清单',number:'附 A'},
 {id:'rules-faq',title:'常见问题',number:'附 B'},
 {id:'rules-sources',title:'法规依据',number:'附 C'},
 {id:'rules-versions',title:'版本与适用说明',number:'附 D'},
];
const navigationIds=navigation.map(item=>item.id);

export function MembershipRulesPage({user}:{user:User|null}){
 const [activeSection,setActiveSection]=useState(navigationIds[0]);
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 const navRef=useRef<HTMLElement|null>(null);
 const linkRefs=useRef<Record<string,HTMLAnchorElement|null>>({});
 const activeTitle=navigation.find(item=>item.id===activeSection)?.title||'合规与重要提示';

 useEffect(()=>{
  // Only the page scrolls; the desktop sidebar independently scrolls to keep
  // the current heading visible. This also supports deep links and browser back.
  let frame=0;
  const syncFromScroll=()=>{
   frame=0;
   const marker=Math.min(190,Math.max(115,window.innerHeight*.2));
   let next=navigationIds[0];
   for(const id of navigationIds){
    const element=document.getElementById(id);
    if(!element)continue;
    if(element.getBoundingClientRect().top<=marker)next=id;
    else break;
   }
   if(window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-5){
    next=navigationIds[navigationIds.length-1];
   }
   setActiveSection(previous=>previous===next?previous:next);
  };
  const scheduleSync=()=>{
   if(frame===0)frame=window.requestAnimationFrame(syncFromScroll);
  };
  const onHashChange=()=>scheduleSync();
  window.addEventListener('scroll',scheduleSync,{passive:true});
  window.addEventListener('resize',scheduleSync);
  window.addEventListener('hashchange',onHashChange);

  // Pages are lazy-loaded: direct links to a chapter may arrive before its
  // target exists. Resolve that one initial deep link after the page mounts.
  const initialHash=decodeURIComponent(window.location.hash.slice(1));
  frame=window.requestAnimationFrame(()=>{
   frame=0;
   if(navigationIds.includes(initialHash)){
    document.getElementById(initialHash)?.scrollIntoView({block:'start',behavior:'instant'});
    setActiveSection(initialHash);
   }else syncFromScroll();
  });
  return ()=>{
   window.removeEventListener('scroll',scheduleSync);
   window.removeEventListener('resize',scheduleSync);
   window.removeEventListener('hashchange',onHashChange);
   if(frame)window.cancelAnimationFrame(frame);
  };
 },[]);

 useEffect(()=>{
  // Keep long desktop TOC in sync without calling scrollIntoView, which can
  // accidentally scroll the entire page and fight the reader.
  if(window.matchMedia('(max-width:720px)').matches)return;
  const nav=navRef.current;
  const link=linkRefs.current[activeSection];
  if(!nav||!link)return;
  const navRect=nav.getBoundingClientRect();
  const itemRect=link.getBoundingClientRect();
  const upper=navRect.top+52;
  const lower=navRect.bottom-28;
  if(itemRect.top<upper)nav.scrollTop+=itemRect.top-upper;
  if(itemRect.bottom>lower)nav.scrollTop+=itemRect.bottom-lower;
 },[activeSection]);

 const onNavigate=(id:string)=>{
  setActiveSection(id);
  setMobileMenuOpen(false);
 };
 const chapterNavigation=(index:number)=>{
  const previous=index>0?chapters[index-1]:null;
  const next=index<chapters.length-1?chapters[index+1]:null;
  return <nav className="hhba-rules-chapter-switch" aria-label={'第'+(index+1)+'章章节导航'}>
   {previous?<a href={'#rules-'+previous.id} onClick={()=>onNavigate('rules-'+previous.id)}>
    <ArrowLeft size={15} aria-hidden="true"/><span>上一章 <b>{previous.title}</b></span>
   </a>:<a href="#rules-compliance" onClick={()=>onNavigate('rules-compliance')}>
    <ArrowLeft size={15} aria-hidden="true"/><span>合规与重要提示</span>
   </a>}
   {next?<a href={'#rules-'+next.id} onClick={()=>onNavigate('rules-'+next.id)}>
    <span>下一章 <b>{next.title}</b></span><ArrowRight size={15} aria-hidden="true"/>
   </a>:<a href="#rules-launch" onClick={()=>onNavigate('rules-launch')}>
    <span>开售前核验清单</span><ArrowRight size={15} aria-hidden="true"/>
   </a>}
  </nav>;
 };

 return <Shell user={user}>
  <div className="hhba-rules" id="main-content">
   <div className="hhba-rules-topline">
    <Link to="/" className="hhba-rules-back"><ArrowLeft size={15} aria-hidden="true"/>返回 HHBA 首页</Link>
    <span>HHBA · 公开规则中心</span>
   </div>
   <header className="hhba-rules-hero">
    <div className="hhba-rules-eyebrow"><BookOpen size={17} aria-hidden="true"/> PUBLIC SERVICE RULES / 公开规则</div>
    <h1>会员服务与劳动权益支持规则</h1>
    <p className="hhba-rules-subtitle">从月度职业服务到劳动权益支持，完整公开收费、资格、申请范围及双方责任。</p>
    <div className="hhba-rules-meta">
     <span className="hhba-rules-draft">{RULE_STATUS}</span>
     <span>版本 v{RULE_VERSION}</span>
     <span>更新于 {RULE_UPDATED}</span>
     <span>16章 · {faq.length}项常见问题</span>
    </div>
    <div className="hhba-rules-hero-actions">
     <a href="#rules-compliance" className="hhba-rules-primary-link" onClick={()=>onNavigate('rules-compliance')}>阅读完整规则 <ArrowUpRight size={16} aria-hidden="true"/></a>
     <button type="button" onClick={()=>window.print()} className="hhba-rules-print"><Printer size={16} aria-hidden="true"/>打印或保存为PDF</button>
    </div>
   </header>
   <div className="hhba-rules-inline-notice" role="note">
    <ShieldAlert size={17} aria-hidden="true"/>
    <p><strong>重要提示：</strong>当前为公开说明草案，会员收费、律师委托及案件受理尚未开放。详细限制及未完成事项请查阅完整规则。</p>
   </div>

   <div className="hhba-rules-layout">
    <aside className="hhba-rules-sidebar" aria-label="文档目录">
     <button className="hhba-rules-mobile-toggle" type="button"
      aria-expanded={mobileMenuOpen} aria-controls="rules-contents"
      onClick={()=>setMobileMenuOpen(open=>!open)}>
      <span><small>当前阅读</small><strong>{activeTitle}</strong></span>
      <ChevronDown size={19} className={mobileMenuOpen?'is-open':''} aria-hidden="true"/>
     </button>
     <nav ref={navRef} className={'hhba-rules-nav'+(mobileMenuOpen?' is-open':'')} id="rules-contents" aria-label="规则章节目录">
      <p className="hhba-rules-nav-title">规则目录 · 16 CHAPTERS</p>
      <ol>
       {navigation.map(item=><li key={item.id}>
        <a href={'#'+item.id}
         ref={element=>{linkRefs.current[item.id]=element;}}
         onClick={()=>onNavigate(item.id)}
         className={activeSection===item.id?'is-active':undefined}
         aria-current={activeSection===item.id?'location':undefined}>
         <span className="hhba-rules-nav-index">{item.number}</span><span>{item.title}</span>
        </a>
       </li>)}
      </ol>
      <p className="hhba-rules-nav-foot">当前为公开说明草案，尚未开放会员购买。</p>
     </nav>
    </aside>
    <article className="hhba-rules-document" aria-label="会员服务与劳动权益支持完整规则">
     <section className="hhba-rules-compliance" id="rules-compliance" aria-labelledby="rules-compliance-title">
      <div className="hhba-rules-chapter-heading">
       <span>IMPORTANT INFORMATION</span>
       <h2 id="rules-compliance-title">合规与重要提示</h2>
       <p>正式开售前的四项关键保护及当前尚未满足的条件。</p>
      </div>
      <div className="hhba-rules-critical">
       <ShieldAlert size={18} aria-hidden="true"/>
       <div>
        <h3>请在购买前充分了解</h3>
        <p><strong>当前是公开说明草案，不是生效合同。</strong>会员购买、连续扣费、法律案件申请及律所委托均未开放。19.90元/月、连续缴费六期、最长36个月是规划方向；服务次数、律师费用、退款细则及适用争议范围仍需在正式开售前确定。</p>
        <p><strong>不得把列出的服务直接理解为已获得的权益。</strong>浏览本页不会产生付款、律师委托或对法定权利的放弃。正式销售必须提供依法有效的协议、重大条款提示及必要授权。</p>
       </div>
      </div>
      <div className="hhba-rules-compliance-list">
       {complianceAreas.map((area,index)=><section className="hhba-rules-compliance-item" key={area.id} aria-labelledby={'compliance-'+area.id}>
        <span className="hhba-rules-control-num">{padNumber(index)}</span>
        <div>
         <h3 id={'compliance-'+area.id}>{area.title}</h3>
         <p><strong>当前限制：</strong>{area.now}</p>
         <p><strong>开售前要求：</strong>{area.required}</p>
         <small>{area.basis}</small>
        </div>
       </section>)}
      </div>
      <p className="hhba-rules-blocked-status"><ShieldCheck size={16} aria-hidden="true"/>会员开售状态：{membershipLaunchState.status==='blocked'?'禁止收款 · 未通过上线核验':'待确认'}。自动续费、预存套餐和案件证据接收均未开放。</p>
     </section>

     <div className="hhba-rules-document-overview" aria-label="公开规划摘要">
      <span>规划月费：<b>¥19.90</b></span>
      <span>进阶资格方向：<b>连续6期</b></span>
      <span>最长服务周期：<b>36个月</b></span>
      <span>可分配利润原则：<b>60 / 40</b></span>
     </div>

     {chapters.map((chapter,index)=><section key={chapter.id} id={'rules-'+chapter.id} className="hhba-rules-chapter" aria-labelledby={'heading-'+chapter.id}>
      <div className="hhba-rules-chapter-heading">
       <span>CHAPTER {padNumber(index)} / {chapters.length}</span>
       <h2 id={'heading-'+chapter.id}>{chapter.title}</h2>
       <p>{chapter.summary}</p>
      </div>
      {chapter.clauses.map((clause,clauseIndex)=><div className={'hhba-rules-clause'+(clause.attention?' hhba-rules-clause--'+clause.attention:'')} key={clauseIndex}>
       <h3>{clause.heading}{clause.attention==='pending'&&<span className="hhba-rules-pending">正式开售前必须明确</span>}{clause.attention==='critical'&&<span className="hhba-rules-important">重要权益提示</span>}</h3>
       {clause.paragraphs.map((paragraph,j)=><p key={j}>{paragraph}</p>)}
      </div>)}
      {chapterNavigation(index)}
     </section>)}

     <section className="hhba-rules-chapter" id="rules-launch" aria-labelledby="rules-launch-heading">
      <div className="hhba-rules-chapter-heading">
       <span>LAUNCH READINESS · 12 REQUIRED CHECKS</span>
       <h2 id="rules-launch-heading">开售前核验清单</h2>
       <p>没有可验证的经营、履约、数据保护与律所审核证据之前，会员购买和案件资料上传必须保持关闭。</p>
      </div>
      <ol className="hhba-rules-launch-checks">
       {launchChecks.map((check,index)=><li key={check.id}>
        <div className="hhba-rules-check-index">{padNumber(index)}</div>
        <div><h3>{check.label}</h3><p>{check.detail}</p><small>需提供核验证据的责任方：{check.owner}</small></div>
        <span className="hhba-rules-unverified">待核验</span>
       </li>)}
      </ol>
     </section>
     <section className="hhba-rules-chapter" id="rules-faq" aria-labelledby="rules-faq-heading">
      <div className="hhba-rules-chapter-heading">
       <span>QUESTIONS & ANSWERS</span><h2 id="rules-faq-heading">常见问题与具体情形</h2>
       <p>结合真实使用场景解释规则，帮助用户在付款前理解重要边界。</p>
      </div>
      <div className="hhba-rules-faq-list">
       {faq.map((item,index)=><details key={index} className="hhba-rules-faq">
        <summary><span>{padNumber(index)}</span>{item.q}</summary>
        <p>{item.a}</p>
       </details>)}
      </div>
     </section>
     <section className="hhba-rules-chapter" id="rules-sources" aria-labelledby="rules-sources-heading">
      <div className="hhba-rules-chapter-heading">
       <span>LEGAL REFERENCES</span><h2 id="rules-sources-heading">主要法律法规依据</h2>
       <p>以下链接供读者核对。具体适用仍以现行有效法律及真实业务结构为准。</p>
      </div>
      <ul className="hhba-rules-source-list">
       {legalSources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={14} aria-hidden="true"/></a></li>)}
      </ul>
      <div className="hhba-rules-safe-note"><Info size={18} aria-hidden="true"/><p>本页法规概括不构成对任何个案的正式法律意见，也不能代替实际商业模式的监管审查、执业律师判断或必要的行政许可。</p></div>
     </section>
     <footer className="hhba-rules-document-footer" id="rules-versions">
      <h2>版本与适用说明</h2>
      <p><ShieldCheck size={17} aria-hidden="true"/>当前公开说明：v{RULE_VERSION} · {RULE_UPDATED} · {RULE_STATUS}</p>
      <p>正式开售前应明确合同主体、完整服务清单与额度、退款算法、服务资格规则、受理争议范围、隐私处理主体、专业律所和投诉渠道。正式合同将另行发布；不会因为浏览本页而默认用户已同意。</p>
      <p>如发现信息错误，或有待公开的事项，HHBA应在正式开售前完成核对和说明。尚未有可用的专项会员购买及案件投诉入口，本页面不假装已经具备相应后台功能。</p>
      <Link to="/" className="hhba-rules-bottom-link">返回首页 <ArrowUpRight size={15} aria-hidden="true"/></Link>
     </footer>
    </article>
   </div>
  </div>
 </Shell>;
}
