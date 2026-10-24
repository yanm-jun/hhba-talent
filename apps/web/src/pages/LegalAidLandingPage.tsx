import {ArrowLeft,FileWarning,LockKeyhole,Scale,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/legal-aid-landing.css';

// Legal-aid navigation placeholder only. No file uploads, sensitive evidence,
// case intake, legal outcome promises, persistence, or transfer to employers.
export function LegalAidLandingPage({user}:{user:User|null}){
 return <Shell user={user}>
  <div className="hhba-legal-page">
   <Link className="hhba-legal-back" to="/candidate/account"><ArrowLeft size={16}/>返回个人中心</Link>
   <section className="hhba-legal-hero">
    <span className="hhba-legal-kicker"><Scale size={16}/>HHBA · 求职者权益保障</span>
    <h1>法律援助</h1>
    <p>未来将结合适用的中国劳动法律制度，为劳动者提供按争议类型组织的证据准备指引，并探索对接具备资质的法律服务与援助资源。</p>
    <span className="hhba-legal-stage"><ShieldCheck size={15}/>服务筹备中 · 暂未开放案件受理</span>
   </section>
   <section className="hhba-legal-notice" aria-labelledby="hhba-legal-notice-title">
    <LockKeyhole size={22} aria-hidden="true"/>
    <div>
     <h2 id="hhba-legal-notice-title">目前不收集任何劳动争议证据</h2>
     <p>请勿在 HHBA 静态测试站提交劳动合同、身份证、工资流水、聊天记录等材料。本页面没有证据上传、投诉受理或律师委托功能，也不会向用人单位发送信息。</p>
    </div>
   </section>
   <section className="hhba-legal-next">
    <h2>未来规划的服务流程</h2>
    <div className="hhba-legal-steps">
     <article><span>01</span><strong>选择劳动争议类型</strong><p>区分拖欠工资、解除劳动合同、加班费、社保等问题。</p></article>
     <article><span>02</span><strong>分析需要证明的事实</strong><p>根据适用法律和举证规则，引导劳动者理解需要哪些证据。</p></article>
     <article><span>03</span><strong>明确合法维权路径</strong><p>提示适用期限、可能的处理机构以及律师或法律援助资源。</p></article>
    </div>
   </section>
   <p className="hhba-legal-note"><FileWarning size={16}/>这是产品规划说明，不构成法律意见。如存在紧迫的劳动争议处理期限，请及时咨询有资质的法律专业人员或当地劳动争议处理机构。</p>
  </div>
 </Shell>;
}
