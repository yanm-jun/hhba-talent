import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from '../router';
import { hhbaLogoUrl } from '../components/BrandMark';
import type { User } from '../services/api';
import '../styles/home-finance-v1.css';

const asset=(filename:string)=>`${import.meta.env.BASE_URL}images/home-finance-v1/${filename}`;

export function HomePage({user}:{user:User|null}){
 const signedIn=!!user?.account_types?.includes('candidate');
 const accountLink=signedIn?'/candidate/account/resume':'/auth';
 return <div className="hhba-rebrand-home" id="top">
  <header className="hh-home-nav">
   <div className="hh-home-container hh-home-nav-inner">
    <Link className="hh-home-mark" to="/" aria-label="HHBA 汇方职场首页">
     <img src={hhbaLogoUrl} width="37" height="37" alt="" aria-hidden="true" />
     <span><span className="hh-home-markword">HHB<span>A</span></span><span className="hh-home-marksub">汇 方 职 场</span></span>
    </Link>
    <nav className="hh-home-navlinks" aria-label="主要导航">
     <Link to="/candidate/jobs">找工作</Link>
     <Link to="/rights/knowledge">职场知识</Link>
     <Link to="/vision">关于我们</Link>
    </nav>
    <Link className="hh-home-login" to={accountLink}>{signedIn?'我的工作台':'登录 / 开始使用'} <ArrowUpRight size={15}/></Link>
   </div>
  </header>

  <main>
   <section className="hh-home-hero">
    <div className="hh-home-container hh-home-hero-inner">
     <div className="hh-home-hero-copy">
      <div className="hh-home-overline hh-home-eyebrow">HHBA / CAREER WITH CLARITY</div>
      <h1 className="hh-home-title"><span>走到今天，</span><span>更知道明天</span><span>想去哪里。</span></h1>
      <p className="hh-home-lead">找工作，不止于找到工作。</p>
      <p className="hh-home-intro">从发现真实岗位、完善简历，到高效申请与入职前核查。让每一个重要的职业选择，都有更清晰的依据。</p>
      <div className="hh-home-actions">
       <Link to={accountLink} className="hh-home-action">开始寻找机会 <ArrowUpRight size={16}/></Link>
       <a href="#services" className="hh-home-textlink">了解我们的服务 <ArrowRight size={15}/></a>
      </div>
      <div className="hh-home-mini"><span>优先官方招聘入口</span><span>按次使用</span><span>免费职场知识</span></div>
     </div>
     <figure className="hh-home-hero-media">
      <img src={asset('hero-city.webp')} alt="城市建筑向远方敞开，阳光照耀城市与步行者" fetchPriority="high" width="920" height="755" />
      <figcaption>THE NEXT CHAPTER BEGINS</figcaption>
     </figure>
    </div>
   </section>

   <section className="hh-home-manifesto" aria-label="品牌理念">
    <div className="hh-home-container hh-home-manifesto-inner">
     <strong>我们相信 / OUR BELIEF</strong>
     <p>机会不是一张岗位列表。它始于发现自己的能力，也来自对每一次选择的认真判断。</p>
    </div>
   </section>

   <section className="hh-home-section" id="services" aria-labelledby="home-services-title">
    <div className="hh-home-container">
     <div className="hh-home-sectionhead">
      <div><p className="hh-home-kicker">01 / OUR SERVICES</p><h2 id="home-services-title">为下一步，做好准备。</h2></div>
      <p>不增加不必要的流程。根据你当前真正需要解决的问题，选择相应工具。</p>
     </div>
     <article className="hh-home-feature">
      <div className="hh-home-feature-copy">
       <span className="hh-home-num">01 / DISCOVER & PREPARE</span>
       <h3>把你的本事，<br/>用在合适的地方。</h3>
       <p>分析你已有的真实经历，寻找对应的招聘机会；针对不同岗位调整简历表达，让优势更加清晰，而不是虚构经历。</p>
       <div className="hh-home-tagline"><span>AI 岗位匹配</span><span>定向简历优化</span><span>企业官方投递入口</span></div>
       <Link className="hh-home-inline-link" to="/candidate/match">探索岗位匹配 <ArrowUpRight size={15}/></Link>
      </div>
      <figure className="hh-home-feature-photo"><img src={asset('orange-craft.webp')} alt="橙色布料和工匠缝制的工作细节" loading="lazy" width="900" height="430" /></figure>
     </article>
     <div className="hh-home-service-grid">
      <article className="hh-home-service">
       <span className="hh-home-num">02 / APPLY SMARTER</span>
       <h3>申请工作，不必从头来过。</h3>
       <p>复用已确认的职业资料，辅助准备申请材料和填写网申表单。重要信息由你核对，申请由你确认提交。</p>
       <div className="hh-home-report-lines"><span>材料复用</span><span>减少重复填写</span><span>用户确认</span></div>
       <Link className="hh-home-inline-link" to="/candidate/account/apply-assistant">了解智能网申 <ArrowUpRight size={15}/></Link>
      </article>
      <article className="hh-home-service">
       <span className="hh-home-num">03 / MAKE AN INFORMED CHOICE</span>
       <h3>选择之前，多一份了解。</h3>
       <p>企业公开信息核验、Offer 条款检查，是我们正在规划的职业决策工具。以可追溯的依据提示风险，不代替你的最终判断。</p>
       <div className="hh-home-report-lines"><span>企业信息</span><span>Offer 条款</span><span>筹备中</span></div>
       <Link className="hh-home-inline-link" to="/rights/knowledge">先阅读免费职场知识 <ArrowUpRight size={15}/></Link>
      </article>
     </div>
    </div>
   </section>

   <section className="hh-home-process" aria-labelledby="home-process-title">
    <div className="hh-home-container">
     <div className="hh-home-process-header">
      <div><p className="hh-home-kicker">02 / HOW IT WORKS</p><h2 id="home-process-title">从一份简历，开始下一程。</h2></div>
      <p>一个账号，按自己的节奏使用不同服务。</p>
     </div>
     <div className="hh-home-steps">
      <div className="hh-home-step"><span className="hh-home-step-n">01</span><h3>认识你的能力</h3><p>上传并核对真实简历，整理经历与技能。</p></div>
      <div className="hh-home-step"><span className="hh-home-step-n">02</span><h3>找到适合的岗位</h3><p>阅读岗位要求，分析你的匹配优势与不足。</p></div>
      <div className="hh-home-step"><span className="hh-home-step-n">03</span><h3>准备并完成申请</h3><p>定向优化简历，辅助填写和提交申请。</p></div>
      <div className="hh-home-step"><span className="hh-home-step-n">04</span><h3>认真做出决定</h3><p>核查工作条件，了解重要条款和问题。</p></div>
     </div>
    </div>
   </section>

   <section className="hh-home-knowledge" id="knowledge" aria-labelledby="home-knowledge-title">
    <div className="hh-home-container hh-home-knowledge-inner">
     <div className="hh-home-knowledge-media"><img src={asset('knowledge-growth.webp')} alt="老树桩的年轮间长出一株绿色新芽" loading="lazy" width="790" height="647"/></div>
     <div className="hh-home-knowledge-content">
      <p className="hh-home-kicker">03 / OPEN KNOWLEDGE</p>
      <h2 id="home-knowledge-title">有些职场问题，<br/>不该靠猜。</h2>
      <p className="hh-home-knowledge-lead">从简历、面试到劳动合同。我们希望用清楚的解释和能够核验的来源，让重要的职场知识免费可读。</p>
      <div className="hh-home-knowledge-topics"><span>求职避坑</span><span>简历与面试</span><span>薪酬与合同</span><span>职业发展</span></div>
      <div className="hh-home-knowledge-links">
       <Link to="/rights/knowledge">面试前，需要核实哪些事情？ <ArrowUpRight size={15}/></Link>
       <Link to="/rights/knowledge">一份 Offer，哪些条款值得关注？ <ArrowUpRight size={15}/></Link>
       <Link to="/rights/knowledge">准备换工作之前，可以先做什么？ <ArrowUpRight size={15}/></Link>
      </div>
      <Link className="hh-home-knowledge-cta" to="/rights/knowledge">走进免费职场知识馆 <ArrowUpRight size={16}/></Link>
     </div>
    </div>
   </section>

   <section className="hh-home-trust" aria-labelledby="home-trust-title">
    <div className="hh-home-container">
     <div className="hh-home-trust-head"><div><p className="hh-home-kicker">04 / OUR PRINCIPLES</p><h2 id="home-trust-title">认真做事，也清楚说明边界。</h2></div></div>
     <div className="hh-home-trust-items">
      <div className="hh-home-trust-item"><h3>尽可能核实信息</h3><p>优先提供企业官方招聘来源。无法确认的信息会明确标注，不把推测当成事实。</p></div>
      <div className="hh-home-trust-item"><h3>尊重真实的经历</h3><p>AI 协助整理和优化表达，不捏造学历、任职经历或无法证明的成果。</p></div>
      <div className="hh-home-trust-item"><h3>按服务范围交付</h3><p>服务价格、功能和使用限制在购买前说明。不承诺录用结果或法律结论。</p></div>
     </div>
    </div>
   </section>

   <section className="hh-home-finale" aria-labelledby="home-finale-title">
    <div className="hh-home-container hh-home-finale-inner">
     <div className="hh-home-finale-copy">
      <p className="hh-home-kicker">THE NEXT CHAPTER</p>
      <h2 id="home-finale-title">下一程，<br/>仍有更多可能。</h2>
      <p>新的机会，不一定要从零开始。带上你已经积累的经验，认真走好下一步。</p>
      <Link className="hh-home-action" to={accountLink}>从这里开始 <ArrowUpRight size={16}/></Link>
     </div>
     <div className="hh-home-finale-photo"><img src={asset('closing-bridge.webp')} alt="夕阳下的跨海大桥延伸向远方" loading="lazy" width="870" height="810"/></div>
    </div>
   </section>
  </main>

  <footer className="hh-home-footer">
   <div className="hh-home-container">
    <div className="hh-home-footer-main">
     <div className="hh-home-footer-brand"><div className="hh-home-footer-mark">HHB<span>A</span> · 汇方职场</div><p>让机会与人才，找到彼此。</p></div>
     <nav aria-label="底部导航" className="hh-home-footer-links"><Link to="/candidate/jobs">找工作</Link><Link to="/rights/knowledge">职场知识</Link><Link to="/vision">关于我们</Link><Link to="/data-use">数据使用说明</Link><Link to="/search">全站搜索</Link></nav>
    </div>
    <div className="hh-home-footer-bottom"><span>© {new Date().getFullYear()} HHBA 汇方职场</span><span>让机会与人才，找到彼此。</span></div>
   </div>
  </footer>
 </div>;
}
