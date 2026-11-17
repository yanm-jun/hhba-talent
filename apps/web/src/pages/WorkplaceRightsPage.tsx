import {ArrowRight,BookOpen,Building2,CalendarCheck2,CheckCircle2,ClipboardCheck,FileText,FolderOpen,ShieldCheck,GraduationCap,Info,LockKeyhole} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/career-refresh.css';

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

export function WorkplaceRightsPage({user}:{user:User|null}){
 return <Shell user={user}>
  <main className="hhba-rights-page" id="main-content">
   <nav className="hhba-rights-breadcrumb" aria-label="位置"><Link to="/candidate/account">个人工作台</Link><span>/</span><strong>职场权益中心</strong></nav>
   <section className="hhba-rights-hero">
    <div className="hhba-rights-hero-copy">
     <span className="hhba-career-kicker"><ShieldCheck size={15}/> HHBA · WORKPLACE RIGHTS</span>
     <h1>从走进职场的第一天，<br/>就开始了解自己的权益。</h1>
     <p>为毕业三年内、符合企业准入条件的年轻劳动者规划的长期职业与劳动权益支持服务。帮助你了解企业公开信息、持续核对职业权益，并在约定条件下获得人工协作支持。</p>
     <div className="hhba-rights-actions">
      <Link className="hhba-career-primary" to="/membership/rules">阅读会员规则 <ArrowRight size={16}/></Link>
      <Link className="hhba-career-text-link" to="/candidate/account/legal-aid">先看免费劳动权益知识 <ArrowRight size={15}/></Link>
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
    <div className="hhba-rights-actions"><Link to="/candidate/account/legal-aid"><BookOpen size={16}/> 浏览劳动权益知识 <ArrowRight size={15}/></Link><Link to="/candidate/account"><FileText size={16}/> 返回工作台 <ArrowRight size={15}/></Link></div>
   </section>
  </main>
 </Shell>;
}
