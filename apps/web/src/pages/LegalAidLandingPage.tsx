import {
 ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ClipboardList,
 Clock3, FileText, Landmark, LockKeyhole, Scale, ShieldCheck,
 UsersRound, Wallet
} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/legal-aid-landing.css';

// Public-facing concept page only. No case intake, evidence uploads, legal assessment,
// lawyer booking, persistence or transmission to a company is enabled.
const issueAreas=[
 {
  number:'01',
  title:'工资与劳动报酬',
  description:'工资迟发、欠发、约定报酬未兑现。',
  focus:'未来将围绕劳动关系、工资标准与支付情况提供证据准备指引。',
  icon:Wallet
 },
 {
  number:'02',
  title:'离职与解除合同',
  description:'解除劳动关系、经济补偿与赔偿争议。',
  focus:'未来将引导梳理解除通知、相关经过与劳动关系材料。',
  icon:FileText
 },
 {
  number:'03',
  title:'工时与加班',
  description:'考勤记录、加班报酬、休息休假。',
  focus:'未来将帮助区分争议事实与可能涉及的证明材料。',
  icon:Clock3
 },
 {
  number:'04',
  title:'社会保险权益',
  description:'参保、缴费记录及相关权益问题。',
  focus:'未来将根据问题性质说明可咨询的主管部门与办理渠道。',
  icon:Landmark
 }
] as const;

const futureSteps=[
 {
  number:'01',
  title:'说清遇到的问题',
  description:'选择争议类型，说明何时、何地、与哪家实际用人单位发生了什么。'
 },
 {
  number:'02',
  title:'识别应证明的事实',
  description:'结合适用法律，区分已经掌握的信息、仍有争议的事实与关键时间节点。'
 },
 {
  number:'03',
  title:'准备真正相关的证据',
  description:'按照事实要件提供材料清单和合法取证提醒，不以单一文件缺失否定维权可能。'
 },
 {
  number:'04',
  title:'寻找合适的解决路径',
  description:'根据不同事项，提供依法维权的信息和合格律师、法律援助资源的转介方向。'
 }
] as const;

export function LegalAidLandingPage({user}:{user:User|null}){
 return <Shell user={user}>
  <main className="hhba-law" id="main-content">
   <div className="hhba-law-topline">
    <Link to="/candidate/account" className="hhba-law-back">
     <ArrowLeft size={15} aria-hidden="true"/>返回个人中心
    </Link>
    <span className="hhba-law-topline-meta">HHBA <span aria-hidden="true">/</span> 求职者服务</span>
   </div>

   <section className="hhba-law-hero" aria-labelledby="hhba-law-title">
    <div className="hhba-law-hero-main">
     <div className="hhba-law-hero-kicker"><Scale size={16} aria-hidden="true"/><span>LABOUR RIGHTS · 劳动权益</span></div>
     <h1 id="hhba-law-title">每一份劳动，<span>都值得被认真对待。</span></h1>
     <p className="hhba-law-hero-description">找工作，是人生新的开始。权益保障，不应该在入职那一刻结束。HHBA 希望让劳动者面对问题时，能够更清楚地理解事实、准备证据，并找到依法解决问题的路径。</p>
     <div className="hhba-law-hero-signature"><span className="hhba-law-signature-line" aria-hidden="true"/><span>HHBA · 守护真实的劳动价值</span></div>
    </div>
    <aside className="hhba-law-status" aria-label="法律援助服务状态">
     <div className="hhba-law-status-top"><span className="hhba-law-status-symbol"><ShieldCheck size={22} strokeWidth={1.5} aria-hidden="true"/></span><span className="hhba-law-status-eyebrow">SERVICE STATUS</span></div>
     <span className="hhba-law-status-caption">当前进展</span>
     <strong>服务筹备中</strong>
     <p>正在规划按争议类型梳理证据、解释处理路径以及对接专业法律资源的服务。</p>
     <div className="hhba-law-status-rule"/>
     <div className="hhba-law-status-current"><span className="hhba-law-pulse" aria-hidden="true"/>暂不接受案件申请或材料提交</div>
    </aside>
   </section>

   <section className="hhba-law-privacy-strip" aria-label="当前服务限制">
    <span className="hhba-law-lock"><LockKeyhole size={19} strokeWidth={1.7} aria-hidden="true"/></span>
    <div>
     <strong>你的资料值得谨慎保护。</strong>
     <p>目前本站未开放证据上传、投诉受理、律师预约或委托服务。请勿在静态测试页面提交身份证、劳动合同、工资流水或私人聊天记录。</p>
    </div>
   </section>

   <section className="hhba-law-issues" aria-labelledby="hhba-law-issues-title">
    <div className="hhba-law-section-heading">
     <div>
      <span className="hhba-law-eyebrow">01 / 常见劳动权益问题</span>
      <h2 id="hhba-law-issues-title">你遇到的问题，值得被具体看见。</h2>
     </div>
     <p>不同劳动争议，需要证明的事实并不相同。以下是未来计划重点覆盖的服务场景，尚不能在本站发起申请。</p>
    </div>
    <div className="hhba-law-issue-grid">
     {issueAreas.map(({number,title,description,focus,icon:Icon})=>
      <article key={number} className="hhba-law-issue-card">
       <div className="hhba-law-issue-top"><span className="hhba-law-issue-number">{number}</span><span className="hhba-law-issue-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true"/></span></div>
       <h3>{title}</h3>
       <p className="hhba-law-issue-summary">{description}</p>
       <div className="hhba-law-issue-focus"><span>未来证据指引方向</span><p>{focus}</p></div>
      </article>
     )}
    </div>
   </section>

   <section className="hhba-law-method" aria-labelledby="hhba-law-method-title">
    <div className="hhba-law-method-heading">
     <div>
      <span className="hhba-law-eyebrow">02 / 未来服务逻辑</span>
      <h2 id="hhba-law-method-title">不只是告诉你法律条文，<span>而是帮助你理清下一步。</span></h2>
     </div>
     <span className="hhba-law-method-mark"><ClipboardList size={26} strokeWidth={1.4} aria-hidden="true"/></span>
    </div>
    <div className="hhba-law-steps">
     {futureSteps.map((step,index)=><article className="hhba-law-step" key={step.number}>
      <div className="hhba-law-step-index"><span>{step.number}</span>{index<futureSteps.length-1&&<span className="hhba-law-step-rule" aria-hidden="true"/>}</div>
      <div className="hhba-law-step-content"><h3>{step.title}</h3><p>{step.description}</p></div>
     </article>)}
    </div>
    <div className="hhba-law-method-foot"><CheckCircle2 size={18} strokeWidth={1.7} aria-hidden="true"/><p>一个重要原则：没有劳动合同，并不意味着一定无法主张合法权益；如何证明相关事实，应结合具体争议和适用规则判断。</p></div>
   </section>

   <section className="hhba-law-bottom" aria-label="服务原则">
    <div className="hhba-law-bottom-title">
     <span className="hhba-law-eyebrow">OUR COMMITMENT</span>
     <h2>站在事实和法律的一边。</h2>
     <p>我们希望建立一项审慎、专业、尊重隐私的劳动者权益支持服务。</p>
    </div>
    <div className="hhba-law-bottom-items">
     <div><UsersRound size={21} aria-hidden="true"/><strong>面向劳动者</strong><span>以个人权益需求为出发点</span></div>
     <div><ShieldCheck size={21} aria-hidden="true"/><strong>重视证据与隐私</strong><span>未经授权不向企业共享材料</span></div>
     <div><CalendarClock size={21} aria-hidden="true"/><strong>尊重法定程序</strong><span>关注维权期限与处理渠道</span></div>
    </div>
   </section>
   <footer className="hhba-law-disclaimer">
    <Scale size={17} aria-hidden="true"/>
    <p>本页面为 HHBA 法律援助业务规划展示，不构成具体法律意见，不提供胜诉或追回款项保证。若你正在面临劳动争议或临近法定期限，请及时联系当地劳动保障部门、劳动争议处理机构或具备资质的法律专业人员。</p>
    <Link to="/candidate/account">返回工作台 <ArrowRight size={14} aria-hidden="true"/></Link>
   </footer>
  </main>
 </Shell>;
}
