import {useState} from 'react';
import {
  ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronRight,ClipboardList,
  FileCheck2,HandHeart,LockKeyhole,ShieldCheck,ShieldAlert,
  UsersRound,Wallet
} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import laborRights from '../data/laborRightsTopics.json';
import '../styles/legal-aid-intervention.css';

/**
 * Rights-support project presentation and public legal evidence PREPARATION only.
 * No case submission, applicant details, file upload, storage, network request,
 * attorney assignment, funding approval or case tracking is implemented.
 */
const categories=laborRights.topics;
const steps=[
  {heading:'选择问题与实际用人单位',detail:'未来将核对纠纷类别、真实劳动关系主体及发生时间，避免把集团品牌误当成法律主体。'},
  {heading:'说明事实与主张',detail:'未来将了解劳动者的任职情况、事件经过、诉求及是否已启动仲裁或其他程序。'},
  {heading:'依法准备对应证据',detail:'按争议所需证明的事实提供材料指引，遵循合法取证与最小必要原则。'},
  {heading:'人工评估与资助决定',detail:'由平台按公开的支持规则审核；符合条件时再与具备资质的律师明确服务及费用范围。'}
] as const;

export function LegalAidInterventionPage({user}:{user:User|null}){
 const [topicSlug,setTopicSlug]=useState<string|null>(null);
 const topic=categories.find(item=>item.slug===topicSlug);
 return <Shell user={user}>
  <main className="hhba-intervention" id="main-content">
   <section className="hhba-intervention-panel" aria-labelledby="hhba-intervention-title">
    <header className="hhba-intervention-header">
     <div className="hhba-intervention-brand">
      <Link to="/candidate/account/legal-aid" className="hhba-intervention-logo">HHBA.</Link>
      <span className="hhba-intervention-divider" aria-hidden="true"/>
      <span>平台权益支持</span>
     </div>
     <Link to="/candidate/account/legal-aid" className="hhba-intervention-back">
      <ArrowLeft size={13} aria-hidden="true"/>返回法律援助
     </Link>
    </header>
    <div className="hhba-intervention-content">
     <div className="hhba-intervention-intro">
      <span className="hhba-intervention-symbol"><HandHeart size={27} strokeWidth={1.75} aria-hidden="true"/></span>
      <div className="hhba-intervention-status"><span className="hhba-intervention-status-dot" aria-hidden="true"/>服务筹备中 · 暂不接受申请</div>
      <h1 id="hhba-intervention-title">请求 HHBA 平台介入</h1>
      <p>当劳动权益遭遇争议，我们希望帮助劳动者理清事实、准备证据，找到依法解决问题的途径。</p>
     </div>

     <section className="hhba-intervention-funded" aria-labelledby="hhba-intervention-funded">
      <div className="hhba-intervention-funded-icon"><Wallet size={22} aria-hidden="true"/></div>
      <div className="hhba-intervention-funded-copy">
       <span className="hhba-intervention-kicker">HHBA RIGHTS SUPPORT</span>
       <h2 id="hhba-intervention-funded">符合资助条件的案件，律师服务费用由 HHBA 承担</h2>
       <p>未来经平台审核通过并正式纳入支持范围的案件，约定的律师咨询或代理服务费由 HHBA 支付，劳动者无需承担该部分费用。具体支持范围、服务内容及双方权利义务，以正式公布的资助规则与书面协议为准。</p>
       <div className="hhba-intervention-funded-note"><ShieldAlert size={14} aria-hidden="true"/>当前尚未启动资助或律师委托；仲裁、诉讼、鉴定等第三方费用是否覆盖，须另行明确，不能视为已承诺支付。</div>
      </div>
     </section>

     <section className="hhba-intervention-section" aria-labelledby="hhba-intervention-flow">
      <div className="hhba-intervention-section-head">
       <span className="hhba-intervention-section-no">01 / 未来处理流程</span>
       <h2 id="hhba-intervention-flow">从提出问题，到获得专业支持</h2>
       <p>每一步都需要真实材料、明确授权和符合规定的处理程序。</p>
      </div>
      <div className="hhba-intervention-flow">
       {steps.map((step,i)=><div className="hhba-intervention-step" key={step.heading}>
        <div className="hhba-intervention-step-index">{String(i+1).padStart(2,'0')}</div>
        <div><h3>{step.heading}</h3><p>{step.detail}</p></div>
       </div>)}
      </div>
     </section>

     <section className="hhba-intervention-section" aria-labelledby="hhba-intervention-problem">
      <div className="hhba-intervention-section-head">
       <span className="hhba-intervention-section-no">02 / 现在可以先做的准备</span>
       <h2 id="hhba-intervention-problem">先选择你遇到的劳动权益问题</h2>
       <p>选择只在当前页面展示公开的证据准备指引，不记录身份信息、不创建申请，也不会发送给任何企业。</p>
      </div>
      <div className="hhba-intervention-topics" role="group" aria-label="劳动权益问题类型">
       {categories.map(item=><button type="button" className={'hhba-intervention-topic'+(topicSlug===item.slug?' hhba-intervention-topic-selected':'')}
        key={item.slug} aria-pressed={topicSlug===item.slug} onClick={()=>setTopicSlug(item.slug)}>
        <span>{item.title}</span>
        {topicSlug===item.slug?<CheckCircle2 size={15} aria-hidden="true"/>:<ChevronRight size={14} aria-hidden="true"/>}
       </button>)}
      </div>
      {topic?<div className="hhba-intervention-evidence" aria-live="polite" aria-label="证据准备参考">
       <div className="hhba-intervention-evidence-head">
        <FileCheck2 size={19} aria-hidden="true"/>
        <div><h3>{topic.title} · 先了解需要证明哪些事实</h3><p>以下是公开的材料准备提示，并不是案件受理清单或证据充分性判定。</p></div>
       </div>
       <div className="hhba-intervention-evidence-list">
        {topic.proof.map(item=><div className="hhba-intervention-evidence-item" key={item.fact}>
         <strong>{item.fact}</strong>
         <ul>{item.materials.map(m=><li key={m}>{m}</li>)}</ul>
         <p>{item.note}</p>
        </div>)}
       </div>
       <Link className="hhba-intervention-evidence-link" to={'/candidate/account/legal-aid/'+topic.slug}>
        查看适用法律、处理办法和真实案例 <ArrowRight size={14} aria-hidden="true"/>
       </Link>
      </div>:<div className="hhba-intervention-pick-hint">
       <BookOpen size={16} aria-hidden="true"/>
       <span>选中上面的一个问题，即可查看对应的公开证据准备建议。</span>
      </div>}
     </section>

     <section className="hhba-intervention-submit" aria-labelledby="hhba-intervention-submit-title">
      <div className="hhba-intervention-submit-head">
       <LockKeyhole size={22} aria-hidden="true"/>
       <div><h2 id="hhba-intervention-submit-title">提交平台介入申请</h2><p>案件受理、实际任职企业填写、事实陈述、证据上传和资助审批系统正在筹建。</p></div>
      </div>
      <button type="button" disabled aria-disabled="true" className="hhba-intervention-disabled">
       提交申请 · 尚未开放 <LockKeyhole size={14} aria-hidden="true"/>
      </button>
      <p className="hhba-intervention-submit-caption">本站当前不会接收个人资料或证明文件，也不会生成申请编号。请不要通过其他公开入口发送身份证、劳动合同、工资流水等敏感材料。</p>
     </section>

     <section className="hhba-intervention-tracker" aria-labelledby="hhba-intervention-my-cases">
      <div className="hhba-intervention-tracker-title"><ClipboardList size={17} aria-hidden="true"/><h2 id="hhba-intervention-my-cases">我的权益支持申请</h2><span>规划功能</span></div>
      <div className="hhba-intervention-empty">
       <UsersRound size={22} aria-hidden="true"/>
       <div><strong>申请查询尚未开放</strong><p>未来正式启用后，申请人可查看受理、补充材料、人工评估、资助审批与处理进度。目前没有申请数据，也没有演示的虚构案件。</p></div>
      </div>
     </section>
     <div className="hhba-intervention-final-notice">
      <ShieldCheck size={17} aria-hidden="true"/>
      <p>HHBA 计划在合法授权与专业律师独立履职的前提下协助劳动者，不保证维权结果，也不能替代法定劳动争议处理机关。<strong>如果你的仲裁、工伤认定等期限临近，请立即向当地主管机关或执业律师咨询，不要等待本站功能开放。</strong></p>
     </div>
    </div>
    <footer className="hhba-intervention-footer">HHBA · 平台权益支持计划 · 当前仅开放公开法律知识与证据准备参考</footer>
   </section>
  </main>
 </Shell>;
}
