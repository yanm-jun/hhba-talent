import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronRight, FileCheck2, FileText, Maximize2, Search, ShieldCheck, X } from 'lucide-react';
import { Link } from '../router';
import { hhbaLogoUrl } from '../components/BrandMark';
import type { User } from '../services/api';
import '../styles/home-finance-v2.css';

const asset = (name:string) => `${import.meta.env.BASE_URL}images/home-finance-v2/${name}.webp`;

const gallery = {
 city: {src:asset('city'),alt:'HHBA 品牌摄影：建筑通道面向远方的城市，原稿文字“走到今天，更知道明天想去哪里。”及 HHBA 标志完整保留。',width:1672,height:941},
 craft: {src:asset('craft'),alt:'HHBA 品牌摄影：橙色布料与缝纫工艺，原稿文字“把本事，放大。”和 HHBA 标志完整保留。',width:1672,height:941},
 wind: {src:asset('wind'),alt:'HHBA 品牌摄影：海边风力发电机与劳动者，原稿文字“让下一份工作，接得住你的成长。”完整保留。',width:1672,height:941},
 industry: {src:asset('industry'),alt:'HHBA 品牌摄影：工业建筑工人与橙色材料，原稿文字“把每一份认真，做成风景。”完整保留。',width:1672,height:941},
 growth: {src:asset('growth'),alt:'HHBA 品牌摄影：老树桩间长出的新芽，原稿文字“机会，从这里开始”和底部 HHBA 标志完整保留。',width:1086,height:1448},
 bridge: {src:asset('bridge'),alt:'HHBA 品牌摄影：跨海大桥延伸向远方，原稿文字“在更远的未来，我们依然同行”与 HHBA 标志完整保留。',width:1774,height:887},
} as const;
type PhotoName = keyof typeof gallery;

const applySteps = [
 {number:'01',title:'选择目标岗位',detail:'从你确认的岗位开始，阅读真实岗位要求。',screenLabel:'目标岗位',screenTitle:'区域运营督导 · 示例',screenInfo:'核对企业、地区与招聘要求'},
 {number:'02',title:'整理申请信息',detail:'复用已确认的经历、教育背景和技能，减少重复填写。',screenLabel:'申请资料',screenTitle:'基本资料已整理',screenInfo:'工作经历 · 教育背景 · 相关技能'},
 {number:'03',title:'检查并确认',detail:'重要字段由本人核对，是否提交始终由用户决定。',screenLabel:'提交前检查',screenTitle:'资料等待你确认',screenInfo:'网申能否完成取决于目标系统支持情况'},
] as const;

function ease(value:number){return Math.max(0,Math.min(1,value));}

export function HomePage({user}:{user:User|null}) {
 const signedIn=!!user?.account_types?.includes('candidate');
 const accountLink=signedIn?'/candidate/account/resume':'/auth';
 const root=useRef<HTMLDivElement>(null);
 const hero=useRef<HTMLElement>(null);
 const lightboxDialog=useRef<HTMLDialogElement>(null);
 const [lightbox,setLightbox]=useState<PhotoName|null>(null);
 const [activeApplyStep,setActiveApplyStep]=useState(0);
 const [checkView,setCheckView]=useState<'employer'|'offer'>('offer');

 useEffect(()=>{
  const dialog=lightboxDialog.current;
  if(!dialog)return;
  if(lightbox && !dialog.open)dialog.showModal();
  if(!lightbox && dialog.open)dialog.close();
 },[lightbox]);

 useEffect(()=>{
  const base=root.current;
  if(!base || typeof window==='undefined')return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){base.classList.add('hh-motion-reduced');return;}
  if(!('IntersectionObserver' in window))return;
  const reveals=[...base.querySelectorAll<HTMLElement>('[data-hh-reveal]')];
  // Hide only when an observer exists. Content is fully visible without JS.
  base.classList.add('hh-motion-enabled');
  const revealObserver=new IntersectionObserver((entries)=>{
   entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('hh-inview');revealObserver.unobserve(entry.target);}
   });
  },{threshold:0.08,rootMargin:'0px 0px -5% 0px'});
  reveals.forEach(el=>revealObserver.observe(el));
  let frame=0;
  const update=()=>{
   frame=0;
   if(!root.current)return;
   const range=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
   root.current.style.setProperty('--hh-page-progress',`${(window.scrollY/range)*100}%`);
   root.current.classList.toggle('hh-is-scrolled',window.scrollY>24);
   if(hero.current){
    const rect=hero.current.getBoundingClientRect();
    const progress=ease((window.innerHeight-rect.top)/(window.innerHeight+rect.height));
    hero.current.style.setProperty('--hh-hero-progress',progress.toFixed(4));
    const imageFrame=hero.current.querySelector<HTMLElement>('.hh-home-hero-theatre');
    imageFrame?.style.setProperty('--hh-hero-scale',(0.965+progress*0.035).toFixed(4));
   }
  };
  const onScroll=()=>{if(!frame)frame=window.requestAnimationFrame(update);};
  update();
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll,{passive:true});
  // A small staged demonstration is tied to scroll, but the steps are also clickable.
  const stepObserver=new IntersectionObserver(entries=>{
   const visible=entries.filter(item=>item.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
   if(visible[0]){
    const next=Number((visible[0].target as HTMLElement).dataset.hhStep);
    if(Number.isInteger(next))setActiveApplyStep(next);
   }
  },{threshold:[0.15,0.45,0.7],rootMargin:'-22% 0px -25% 0px'});
  base.querySelectorAll('[data-hh-step]').forEach(el=>stepObserver.observe(el));
  return()=>{revealObserver.disconnect();stepObserver.disconnect();window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);if(frame)window.cancelAnimationFrame(frame);};
 },[]);

 const photo=(name:PhotoName,modifier='',priority=false)=>{
  const picture=gallery[name];
  return <button type="button" className={`hh-photo-button ${modifier}`} onClick={()=>setLightbox(name)} aria-label={`放大查看原始品牌作品：${picture.alt}`}>
   <img src={picture.src} alt={picture.alt} width={picture.width} height={picture.height} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" />
   <span className="hh-photo-zoom"><Maximize2 size={15} aria-hidden="true"/> 查看完整作品</span>
  </button>;
 };
 const step=applySteps[activeApplyStep];

 return <div className="hhba-rebrand-home" ref={root} id="top">
  <div className="hh-page-progress" aria-hidden="true"/>
  <header className="hh-home-nav">
   <div className="hh-home-container hh-home-nav-inner">
    <Link className="hh-home-mark" to="/" aria-label="HHBA 汇方职场首页">
     <img src={hhbaLogoUrl} width="36" height="36" alt="" aria-hidden="true"/>
     <span className="hh-home-mark-text"><strong>HHBA</strong><span>汇 方 职 场</span></span>
    </Link>
    <nav className="hh-home-navlinks" aria-label="首页导航">
     <a href="#services">我们的服务</a>
     <a href="#knowledge">免费知识馆</a>
     <Link to="/candidate/jobs">找工作</Link>
    </nav>
    <Link className="hh-home-login" to={accountLink}>{signedIn?'我的工作台':'开始使用'} <ArrowUpRight size={16} aria-hidden="true"/></Link>
   </div>
  </header>

  <main>
   <section className="hh-home-hero" ref={hero} aria-labelledby="hh-hero-title">
    <div className="hh-home-container hh-home-hero-intro">
     <p className="hh-home-overline hh-home-hero-eyebrow">HHBA / CAREER WITH CLARITY</p>
     <h1 id="hh-hero-title">下一步，走得更清楚。</h1>
     <p>发现合适的岗位，做好申请准备，看清每一次重要选择。</p>
     <div className="hh-home-actions">
      <Link to={accountLink} className="hh-home-primary">开始寻找机会 <ArrowUpRight size={17} aria-hidden="true"/></Link>
      <a className="hh-home-secondary" href="#services">了解 HHBA <ArrowDown size={16} aria-hidden="true"/></a>
     </div>
    </div>
    <div className="hh-home-hero-theatre" data-hh-reveal>
     {photo('city','hh-hero-photo',true)}
     <div className="hh-hero-footnote"><span>01 / A NEW PERSPECTIVE</span><span>原作文字与 Logo 完整保留</span></div>
    </div>
   </section>

   <section className="hh-home-thesis" aria-labelledby="hh-thesis-title">
    <div className="hh-home-container hh-home-thesis-inner" data-hh-reveal>
     <p className="hh-home-overline">WHAT WE BELIEVE</p>
     <h2 id="hh-thesis-title">工作不只有一个答案。<br/><em>我们让选择，更有依据。</em></h2>
     <p>从认识自己的能力，到完成申请，再到核实企业与工作条件。每一步都值得认真对待。</p>
    </div>
   </section>

   <section className="hh-home-services" id="services" aria-labelledby="hh-services-title">
    <div className="hh-home-container">
     <div className="hh-home-section-heading" data-hh-reveal>
      <p className="hh-home-overline">01 / OUR SERVICES</p>
      <h2 id="hh-services-title">把复杂的求职过程，<br/>变成清晰的下一步。</h2>
      <p>按照实际需要选择工具，不绑定长期会员。</p>
     </div>
     <div className="hh-home-craft-layout">
      <div className="hh-home-craft-copy" data-hh-reveal>
       <span className="hh-home-index">01 / MATCH & PREPARE</span>
       <h3>找到合适的工作，<br/>也准备好合适的简历。</h3>
       <p>AI 分析真实经历与岗位要求，提供匹配理由，并针对目标岗位优化已有信息的表达，不虚构履历。</p>
       <div className="hh-home-keywords"><span>真实岗位</span><span>定向简历</span><span>官方招聘入口优先</span></div>
       <Link className="hh-home-text-action" to="/candidate/match">探索岗位匹配 <ArrowUpRight size={17} aria-hidden="true"/></Link>
      </div>
      <figure className="hh-home-craft-art hh-art-reveal" data-hh-reveal>
       {photo('craft')}
       <figcaption>HHBA / KNOW YOUR VALUE</figcaption>
      </figure>
     </div>
    </div>
   </section>

   <section className="hh-home-apply" id="smart-apply" aria-labelledby="hh-apply-title">
    <div className="hh-home-container">
     <div className="hh-home-section-heading hh-home-section-heading-tight" data-hh-reveal>
      <p className="hh-home-overline">02 / APPLY SMARTER</p>
      <h2 id="hh-apply-title">每一次申请，<br/>不必再从头填写。</h2>
      <p>智能网申辅助 · 选择岗位、整理材料、核对提交。</p>
     </div>
     <div className="hh-home-apply-layout">
      <div className="hh-home-step-track">
       {applySteps.map((item,index)=><button type="button" key={item.number} data-hh-step={index} className={`hh-apply-stage ${activeApplyStep===index?'hh-apply-stage-active':''}`} onClick={()=>setActiveApplyStep(index)} aria-pressed={activeApplyStep===index}>
        <span className="hh-apply-number">{item.number}</span><span className="hh-apply-stage-content"><strong>{item.title}</strong><span>{item.detail}</span></span><ChevronRight size={17} aria-hidden="true"/>
       </button>)}
      </div>
      <div className="hh-home-apply-stage-preview" data-hh-reveal>
       <div className="hh-demo-header"><span className="hh-demo-dots"><i/><i/><i/></span><span>HHBA · APPLICATION ASSISTANT</span><span>演示界面</span></div>
       <div className="hh-demo-body">
        <div className="hh-demo-badge"><span className="hh-demo-dot"/> 智能网申辅助</div>
        <p className="hh-demo-kicker">{step.screenLabel}</p>
        <h3 key={step.screenTitle}>{step.screenTitle}</h3>
        <p className="hh-demo-description">{step.screenInfo}</p>
        <div className="hh-demo-fields">
         <div><span>岗位与来源</span><b className={activeApplyStep>=0?'hh-done':''}><Check size={14}/> 已核对</b></div>
         <div><span>申请资料</span><b className={activeApplyStep>=1?'hh-done':''}>{activeApplyStep>=1?<><Check size={14}/> 已整理</>:'待准备'}</b></div>
         <div><span>提交确认</span><b className={activeApplyStep>=2?'hh-done':''}>{activeApplyStep>=2?'等待本人确认':'未提交'}</b></div>
        </div>
        <div className="hh-demo-progress" aria-hidden="true"><span style={{width:`${(activeApplyStep+1)/3*100}%`}}/></div>
        <span className="hh-demo-note">本区域仅演示产品交互，不会进行实际网申。</span>
       </div>
      </div>
     </div>
     <div className="hh-home-apply-footer"><Link className="hh-home-text-action" to="/candidate/account/apply-assistant">了解智能网申 <ArrowUpRight size={17} aria-hidden="true"/></Link></div>
    </div>
   </section>

   <section className="hh-home-check" id="career-check" aria-labelledby="hh-check-title">
    <div className="hh-home-container">
     <div className="hh-home-section-heading" data-hh-reveal>
      <p className="hh-home-overline">03 / CHECK BEFORE YOU CHOOSE</p>
      <h2 id="hh-check-title">在做决定之前，<br/>多了解一点。</h2>
      <p>企业公开信息核验与 Offer 条款检查正在筹备。希望每条提示都能找到出处。</p>
     </div>
     <div className="hh-home-check-visual" data-hh-reveal>
      <div className="hh-home-check-tabs" role="group" aria-label="切换体检示例">
       <button type="button" className={checkView==='employer'?'is-active':''} aria-pressed={checkView==='employer'} onClick={()=>setCheckView('employer')}><ShieldCheck size={16} aria-hidden="true"/> 企业体检</button>
       <button type="button" className={checkView==='offer'?'is-active':''} aria-pressed={checkView==='offer'} onClick={()=>setCheckView('offer')}><FileCheck2 size={16} aria-hidden="true"/> Offer 体检</button>
       <span>筹备中 · 产品界面示意</span>
      </div>
      <div className="hh-check-report" key={checkView}>
       <div className="hh-check-report-top"><div><span className="hh-check-label">HHBA / SAMPLE REPORT</span><h3>{checkView==='offer'?'录用文件检查':'企业公开信息检查'}</h3></div><span className="hh-check-sample">示例内容</span></div>
       {checkView==='offer'?<>
        <div className="hh-check-document"><span>文件片段 / 第 4 条</span><p>“工作地点及岗位职责依据实际业务需要安排，具体执行方式由双方沟通确认。”</p><span className="hh-check-highlight">需要进一步确认具体条件</span></div>
        <div className="hh-check-result"><div className="hh-check-result-icon"><Search size={19}/></div><div><strong>需要向 HR 确认什么？</strong><p>工作地点变更的条件、通知方式与费用安排，可在签署前进一步了解。</p><small>演示分析，不构成实际法律审查结论。</small></div></div>
       </>:<>
        <div className="hh-check-document"><span>示例企业 / 公开信息核验</span><p>某某科技有限公司（虚构示例）</p><span className="hh-check-highlight">招聘主体与签约主体需要核对</span></div>
        <div className="hh-check-result"><div className="hh-check-result-icon"><Search size={19}/></div><div><strong>核验应该关注哪些事实？</strong><p>登记信息、招聘主体、公开记录及查询时间。没有查到信息，不等于不存在风险。</p><small>演示数据，不指向任何真实企业。</small></div></div>
       </>}
      </div>
     </div>
     <p className="hh-home-check-foot">目前仅展示设计概念，服务开放前仍须完成数据来源、准确性及合规验证。</p>
    </div>
   </section>

   <section className="hh-home-editorial" aria-labelledby="hh-editorial-title">
    <div className="hh-home-container">
     <div className="hh-home-editorial-head" data-hh-reveal>
      <p className="hh-home-overline">THE PEOPLE BEHIND EVERY ROLE</p>
      <h2 id="hh-editorial-title">每一份认真，<br/><em>都有它自己的重量。</em></h2>
      <p>技术可以帮助人们发现机会，但职业的价值，始终来自真实的努力与创造。</p>
     </div>
     <div className="hh-home-gallery">
      <figure data-hh-reveal className="hh-gallery-left hh-art-reveal">{photo('wind')}<figcaption>GROWTH / 向下一程出发</figcaption></figure>
      <figure data-hh-reveal className="hh-gallery-right hh-art-reveal">{photo('industry')}<figcaption>CRAFT / 认真值得被看见</figcaption></figure>
     </div>
    </div>
   </section>

   <section className="hh-home-knowledge" id="knowledge" aria-labelledby="hh-knowledge-title">
    <div className="hh-home-container">
     <div className="hh-home-knowledge-heading" data-hh-reveal><span className="hh-home-overline">04 / OPEN KNOWLEDGE</span><h2 id="hh-knowledge-title">知识，应该让选择更自由。</h2><p>免费的职场知识馆。内容有出处，重要规则可查询。</p></div>
     <div className="hh-home-knowledge-grid">
      <figure className="hh-home-growth-art hh-art-reveal" data-hh-reveal>{photo('growth')}<figcaption>OPPORTUNITY / 从这里开始</figcaption></figure>
      <div className="hh-home-knowledge-copy" data-hh-reveal>
       <span className="hh-home-index">LEARN / VERIFY / DECIDE</span>
       <h3>从招聘信息，<br/>到入职前的每一个问题。</h3>
       <p>求职避坑、简历面试、薪酬合同、职业发展。用清楚的语言解释规则，重要内容标明来源与适用条件。</p>
       <div className="hh-home-knowledge-topics"><span>求职避坑</span><span>简历面试</span><span>薪资合同</span><span>职业发展</span></div>
       <div className="hh-home-knowledge-article"><FileText size={20} aria-hidden="true"/><div><strong>面试之前，如何核实招聘信息？</strong><small>企业主体、工作条件与信息安全</small></div><ArrowUpRight size={17} aria-hidden="true"/></div>
       <Link className="hh-home-knowledge-link" to="/rights/knowledge">探索免费职场知识 <ArrowUpRight size={17} aria-hidden="true"/></Link>
      </div>
     </div>
    </div>
   </section>

   <section className="hh-home-values" aria-labelledby="hh-values-title">
    <div className="hh-home-container">
     <div className="hh-home-values-head" data-hh-reveal><p className="hh-home-overline">OUR PRINCIPLES</p><h2 id="hh-values-title">认真做事。清楚说明。</h2></div>
     <div className="hh-home-values-list">
      <article data-hh-reveal><span>01</span><h3>信息有据可查</h3><p>优先提供官方岗位来源，对尚未核实的信息明确标注。</p></article>
      <article data-hh-reveal><span>02</span><h3>经历真实可信</h3><p>优化已有经历的表达，不捏造学历、业绩或工作经验。</p></article>
      <article data-hh-reveal><span>03</span><h3>服务边界清楚</h3><p>购买前说明交付范围，不承诺录用或提供律师代理服务。</p></article>
     </div>
    </div>
   </section>

   <section className="hh-home-finale" aria-labelledby="hh-finale-title">
    <div className="hh-home-container">
     <p className="hh-home-overline" data-hh-reveal>THE NEXT CHAPTER IS YOURS</p>
     <h2 id="hh-finale-title" data-hh-reveal>下一程，仍有更多可能。</h2>
     <div className="hh-home-finale-image hh-art-reveal" data-hh-reveal>{photo('bridge')}</div>
     <div className="hh-home-finale-action" data-hh-reveal><p>让机会与人才，找到彼此。</p><Link className="hh-home-primary" to={accountLink}>开始使用 HHBA <ArrowUpRight size={17} aria-hidden="true"/></Link></div>
    </div>
   </section>
  </main>

  <footer className="hh-home-footer">
   <div className="hh-home-container hh-home-footer-wrap"><div><strong>HHBA / 汇方职场</strong><span>让机会与人才，找到彼此。</span></div><nav aria-label="页脚导航"><Link to="/candidate/jobs">找工作</Link><Link to="/rights/knowledge">职场知识</Link><Link to="/vision">关于我们</Link><Link to="/data-use">数据使用</Link><Link to="/search">全站搜索</Link></nav></div>
   <div className="hh-home-container hh-home-copyright">© {new Date().getFullYear()} HHBA 汇方职场 <span>一次明确的服务，一次清晰的交付。</span></div>
  </footer>

  <dialog ref={lightboxDialog} className="hh-home-photo-dialog" aria-label="查看完整 HHBA 品牌摄影" onClose={()=>setLightbox(null)} onClick={event=>{if(event.target===event.currentTarget)lightboxDialog.current?.close();}}>
   {lightbox && <div className="hh-home-photo-dialog-inner">
    <button type="button" className="hh-photo-dialog-close" onClick={()=>lightboxDialog.current?.close()} aria-label="关闭图片查看"><X size={20}/></button>
    <img src={gallery[lightbox].src} width={gallery[lightbox].width} height={gallery[lightbox].height} alt={gallery[lightbox].alt}/>
    <p>HHBA / ORIGINAL BRAND ARTWORK · 文字与标志均为原稿内容</p>
   </div>}
  </dialog>
 </div>;
}
