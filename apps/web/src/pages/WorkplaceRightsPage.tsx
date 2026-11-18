import {ArrowRight,BookOpen,Building2,CalendarCheck2,CheckCircle2,ClipboardCheck,FileText,FolderOpen,ShieldCheck,GraduationCap,Info,LockKeyhole} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/career-refresh.css';
import '../styles/rights-editorial.css';

/** This is a product introduction, not a subscription, report, verification or case intake screen. */
const monthlyServices=[
 {icon:Building2,title:'任职企业公开信息月报',description:'以企业可核验的公开记录为依据，说明检查范围、来源、时间及重要变化。未检索到记录不等于企业没有违法。'},
 {icon:ClipboardCheck,title:'个人劳动权益核对',description:'根据本人主动提供的信息，协助核对合同、工资、工时和社保。未提供资料的项目仅展示待核对，不生成虚假结果。'},
 {icon:FolderOpen,title:'职业成长档案',description:'记录个人职业经历、工作成果与档案更新建议，支持未来跳槽时继续使用原有 HHBA 简历服务。'}
] as const;
const stages=[
 {num:'01—06',label:'基础服务阶段',description:'每月职业成长与劳动权益信息服务；人工法律支持资格尚未开放。'},
 {num:'07—36',label:'进阶支持阶段',description:'持续获得月度服务；满足正式合同条件的用户可申请约定范围内的人工权益协作。'},
 {num:'36',label:'周期届满',description:'最长36个月，服务依照正式合同到期；不默认自动扣费。'}
] as const;

export function WorkplaceRightsPage({user,embedded=false}:{user:User|null;embedded?:boolean}){
 const knowledgeHref=embedded?'/candidate/account/legal-aid':'/rights/knowledge';
 // The marketing /rights page is intentionally separate from the private account
 // workspace. Existing embedded account content remains unchanged below.
 if(!embedded)return <Shell user={user}>
  <main className="hhba-rights-editorial" id="main-content">
   <nav className="hhba-rights-editorial-crumb" aria-label="当前位置">
    <Link to="/">HHBA 首页</Link><span aria-hidden="true">/</span><span>职业与劳动权益支持</span>
   </nav>
   <section className="hhba-rights-editorial-cover" aria-label="让下一份工作，接得住你的成长">
    <img src="/images/hhba-rights-wind-hero.webp" width="1672" height="941"
     alt="HHBA 汇方职场宣传照片：蓝天海岸上的风力发电机，一位穿橙色工作服、手持安全帽的劳动者面向远方。画面文字：让下一份工作，接得住你的成长。找工作，不止于找到工作。"
     fetchPriority="high"/>
   </section>
   <p className="hhba-rights-editorial-mobile-caption">让下一份工作，接得住你的成长。<span>找工作，不止于找到工作。</span></p>
   <div className="hhba-rights-editorial-ribbon">
    <span>HHBA / WORKPLACE RIGHTS</span>
    <span>面向劳动者的长期职业服务 · 方案筹备中</span>
   </div>

   <section className="hhba-rights-editorial-intro" aria-labelledby="rights-editorial-intro-title">
    <div className="hhba-rights-editorial-eyebrow">我们的出发点 <span>01 / WHY WE CARE</span></div>
    <div className="hhba-rights-editorial-intro-copy">
     <h1 id="rights-editorial-intro-title">入职之后，<br/>还有许多事值得认真对待。</h1>
     <p>找到工作，是职业生活的开始。企业的公开信息、合同与工资、日常积累的工作成果，以及可能遇到的劳动争议，都值得被清楚地理解和记录。</p>
     <p>HHBA 正在筹备一项持续职业与劳动权益支持服务，希望让求职者在进入职场之后，仍然能够获得长期、可核验的信息与帮助。</p>
    </div>
   </section>

   <section className="hhba-rights-editorial-services" aria-labelledby="rights-editorial-services-title">
    <header className="hhba-rights-editorial-section-heading">
     <span>02 / WHAT WE PLAN</span>
     <div>
      <h2 id="rights-editorial-services-title">不止找到一份工作。<br/>也关注工作之后。</h2>
      <p>以下是拟建设的月度服务，不代表已经提供。正式上线后，每一项交付都应以实际可核验的记录为准。</p>
     </div>
    </header>
    <div className="hhba-rights-editorial-service-list">
     {monthlyServices.map((item,index)=><article className="hhba-rights-editorial-service-row" key={item.title}>
      <span className="hhba-rights-editorial-service-index">{String(index+1).padStart(2,'0')}</span>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <span className="hhba-rights-editorial-service-status">筹备中</span>
     </article>)}
    </div>
   </section>

   <section className="hhba-rights-editorial-timeline" aria-labelledby="rights-editorial-timeline-title">
    <div className="hhba-rights-editorial-timeline-top">
     <span>03 / HOW IT WORKS</span>
     <h2 id="rights-editorial-timeline-title">一段最长 36 个月的服务计划。</h2>
     <p>一个账号，延续职业档案与服务记录。不同阶段的具体资格、次数和服务内容，以未来正式公开的规则与合同为准。</p>
    </div>
    <div className="hhba-rights-editorial-timeline-grid">
     {stages.map((stage,index)=><article key={stage.num}>
      <span className="hhba-rights-editorial-stage-order">0{index+1}</span>
      <strong>{stage.num}<small>个月</small></strong>
      <h3>{stage.label}</h3>
      <p>{stage.description}</p>
     </article>)}
    </div>
   </section>

   <section className="hhba-rights-editorial-plan" aria-labelledby="rights-editorial-plan-title">
    <div className="hhba-rights-editorial-plan-label"><span>04 / THE PLAN</span><h2 id="rights-editorial-plan-title">清楚的价格，<br/>清楚的边界。</h2></div>
    <div className="hhba-rights-editorial-plan-body">
     <div className="hhba-rights-editorial-plan-price">
      <span>规划中的会员月费</span>
      <strong>¥24.90<small> / 月</small></strong>
      <em>尚未开放购买</em>
     </div>
     <div className="hhba-rights-editorial-plan-description">
      <h3>谁可以申请？</h3>
      <p>计划面向毕业三年内、入职符合企业准入条件的年轻劳动者。正式资格及企业准入标准仍待公布，目前不采集资格证明。</p>
      <h3>遇到劳动争议时呢？</h3>
      <p>未来拟协助整理资料、线上沟通和官方调解申请。若依法受理并确有必要，是否由合作律所出具律师函需专业审核。不包含仲裁和诉讼代理，不承诺结果。</p>
      <div className="hhba-rights-editorial-plan-links">
       <Link to="/membership/rules">阅读完整服务规则 <ArrowRight size={16} aria-hidden="true"/></Link>
       <Link to="/rights/knowledge">浏览免费劳动权益知识 <ArrowRight size={16} aria-hidden="true"/></Link>
      </div>
     </div>
    </div>
   </section>

   <section className="hhba-rights-editorial-disclosure" aria-labelledby="rights-editorial-disclosure-title">
    <div><span>05 / OUR COMMITMENT</span><h2 id="rights-editorial-disclosure-title">关于目前的开放状态</h2></div>
    <div>
     <p><strong>目前可以使用：</strong>公开劳动权益知识、招聘信息浏览以及现有求职和职业账户工具。</p>
     <p><strong>目前尚未开放：</strong>付费会员、企业监测月报、案件受理、材料上传及律所委托。注册账户并不意味着已获得会员权益。</p>
     <p>该产品属于职业与法律支持服务规划，不是保险，也不提供工资损失赔付。请勿向本站公开入口提交身份证明、劳动合同或其他敏感证据。</p>
     <Link to="/rights/support">了解平台权益支持的筹备进展 <ArrowRight size={16} aria-hidden="true"/></Link>
    </div>
   </section>
  </main>
 </Shell>;
 return <Shell user={user} embedded={embedded}>
  <main className="hhba-rights-page" id="main-content">
   <nav className="hhba-rights-breadcrumb" aria-label="位置"><Link to={embedded?"/candidate/account":"/"}>{embedded?"个人工作台":"HHBA 首页"}</Link><span>/</span><strong>职场权益中心</strong></nav>
   <section className="hhba-rights-hero">
    <div className="hhba-rights-hero-copy">
     <span className="hhba-career-kicker"><ShieldCheck size={15}/> HHBA · WORKPLACE RIGHTS</span>
     <h1>从走进职场的第一天，<br/>就开始了解自己的权益。</h1>
     <p>为毕业三年内、符合企业准入条件的年轻劳动者规划的长期职业与劳动权益支持服务。帮助你了解企业公开信息、持续核对职业权益，并在约定条件下获得人工协作支持。</p>
     <div className="hhba-rights-actions">
      <Link className="hhba-career-primary" to="/membership/rules">阅读会员规则 <ArrowRight size={16}/></Link>
      <Link className="hhba-career-text-link" to={knowledgeHref}>先看免费劳动权益知识 <ArrowRight size={15}/></Link>
     </div>
    </div>
    <aside className="hhba-rights-price" aria-label="会员价格与开放状态">
     <span className="hhba-rights-notlive"><LockKeyhole size={14}/> 尚未开放购买</span>
     <span className="hhba-rights-price-label">规划会员月费</span>
     <strong>¥24.90<small> / 月</small></strong>
     <p>单个服务周期最长36个月，前6个月为基础服务阶段；人工法律支持的具体资格、次数与合同条款仍待正式确定。</p>
     <div className="hhba-rights-price-note"><Info size={15}/> 当前无会员支付、案情上传或真实月报功能。注册账号不代表已开通付费权益。</div>
    </aside>
   </section>
   <section className="hhba-rights-section">
    <div className="hhba-rights-section-head"><span>01 / 每月真实交付</span><h2>不是只在发生纠纷时才有用。</h2><p>以下为拟建设的月度交付项目；正式上线后只有后台存在可核验的检查记录才能显示“已完成”。</p></div>
    <div className="hhba-rights-month-grid">
     {monthlyServices.map(item=><article key={item.title} className="hhba-rights-month-card">
      <span className="hhba-rights-icon"><item.icon size={21}/></span>
      <h3>{item.title}</h3><p>{item.description}</p><span className="hhba-rights-pending">计划中的月度服务</span>
     </article>)}
    </div>
   </section>
   <section className="hhba-rights-section hhba-rights-timeline">
    <div className="hhba-rights-section-head"><span>02 / 服务如何衔接</span><h2>同一个账号，长期陪伴。</h2></div>
    <div className="hhba-rights-stage-grid">{stages.map(stage=><article key={stage.num}><span>{stage.num}</span><h3>{stage.label}</h3><p>{stage.description}</p></article>)}</div>
   </section>
   <section className="hhba-rights-section hhba-rights-bottom-grid">
    <article className="hhba-rights-bottom-card">
     <div className="hhba-rights-icon"><GraduationCap size={21}/></div><h3>谁可以申请？</h3>
     <p>计划面向毕业三年内、入职符合企业准入条件的个人用户。毕业时间、任职主体及资格复核机制尚待正式规则确定；当前不采集相关证明。</p>
    </article>
    <article className="hhba-rights-bottom-card">
     <div className="hhba-rights-icon"><CalendarCheck2 size={21}/></div><h3>真正遇到劳动问题时</h3>
     <p>拟提供资料整理、线上协商与官方调解申请辅助；确有必要且依法受理时，由合作律所决定是否出具律师函。不包含仲裁和诉讼代理，不承诺结果。</p>
    </article>
   </section>
   <section className="hhba-rights-disclosure">
    <div><CheckCircle2 size={19}/><strong>现在可以使用什么？</strong></div>
    <p>你可以继续免费浏览劳动权益知识、使用现有求职工具和职业账户。付费会员、真实企业监测、案件受理与律所委托均未上线。产品属于职业与法律支持服务规划，不是保险或工资损失赔付。</p>
    <div className="hhba-rights-actions"><Link to={knowledgeHref}><BookOpen size={16}/> 浏览劳动权益知识 <ArrowRight size={15}/></Link><Link to={embedded?"/candidate/account":"/rights/support"}><FileText size={16}/>{embedded?"返回工作台":"查看服务筹备说明"} <ArrowRight size={15}/></Link></div>
   </section>
  </main>
 </Shell>;
}
