import {ArrowLeft,ArrowUpRight,BookOpen,FileCheck2,Info,Printer,ShieldAlert,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import {chapters,faq,legalSources,RULE_STATUS,RULE_UPDATED,RULE_VERSION} from '../data/membershipRulesContent';
import '../styles/membership-rules.css';

const padNumber=(index:number)=>String(index+1).padStart(2,'0');

export function MembershipRulesPage({user}:{user:User|null}){
 return <Shell user={user}>
  <main className="hhba-rules" id="main-content">
   <div className="hhba-rules-topline">
    <Link to="/" className="hhba-rules-back"><ArrowLeft size={15} aria-hidden="true"/>返回 HHBA 首页</Link>
    <span>HHBA · 公开透明 · 职业成长与劳动权益</span>
   </div>
   <header className="hhba-rules-hero">
    <div className="hhba-rules-eyebrow"><BookOpen size={17} aria-hidden="true"/> PUBLIC SERVICE RULES / 公开规则</div>
    <h1>会员服务与劳动权益支持规则</h1>
    <p className="hhba-rules-subtitle">从职业成长、月度收费到劳动法律支持，逐项公开拟议规则、申请限制、合同责任与数据处理边界。</p>
    <div className="hhba-rules-meta">
     <span className="hhba-rules-draft">{RULE_STATUS}</span>
     <span>版本 v{RULE_VERSION}</span>
     <span>更新于 {RULE_UPDATED}</span>
     <span>16章 · {faq.length}项常见问题</span>
    </div>
    <div className="hhba-rules-hero-actions">
     <a href="#rules-contents" className="hhba-rules-primary-link">阅读完整规则 <ArrowUpRight size={16}/></a>
     <button type="button" onClick={()=>window.print()} className="hhba-rules-print"><Printer size={16} aria-hidden="true"/>打印或保存为PDF</button>
    </div>
   </header>

   <section className="hhba-rules-critical" aria-labelledby="rules-critical-title">
    <div className="hhba-rules-critical-icon"><ShieldAlert size={22} aria-hidden="true"/></div>
    <div>
     <h2 id="rules-critical-title">阅读前请先了解</h2>
     <p><strong>当前是公开说明草案，不是生效合同。</strong>会员购买、连续扣费、法律案件申请及律所委托目前均未开放。19.90元/月、连续缴费六期、最长36个月是既定规划方向；服务次数、律师费用、退款细则与适用争议范围仍需在正式开售前明确。</p>
     <p><strong>不得把列出的服务直接理解成已经获得的权益。</strong>本页不会让用户自动产生扣款、律师委托或法定权利放弃；正式开售必须先发布具有实际履约能力的协议，并依法履行重要条款提示和必要授权。</p>
    </div>
   </section>

   <div className="hhba-rules-snapshot" aria-label="已确定的公开规划">
    <div><span>拟议月费</span><strong>¥19.90</strong><small>/ 月 · 尚未收费</small></div>
    <div><span>进阶资格方向</span><strong>连续 6 期</strong><small>具体起算规则待确定</small></div>
    <div><span>最长服务周期</span><strong>36 个月</strong><small>不代表强制预付三年</small></div>
    <div><span>公开利润分配原则</span><strong>60 / 40</strong><small>基于依法核算可分配利润</small></div>
   </div>

   <div className="hhba-rules-layout">
    <aside className="hhba-rules-sidebar" aria-label="章节导航">
     <nav className="hhba-rules-nav" id="rules-contents">
      <p className="hhba-rules-nav-title">目录 · 16 CHAPTERS</p>
      <ol>
       {chapters.map((chapter,index)=><li key={chapter.id}>
        <a href={'#rules-'+chapter.id}><span>{padNumber(index)}</span>{chapter.title}</a>
       </li>)}
      </ol>
      <div className="hhba-rules-nav-extra">
       <a href="#rules-faq">常见问题</a>
       <a href="#rules-sources">法规依据</a>
       <a href="#rules-versions">版本与适用说明</a>
      </div>
     </nav>
    </aside>
    <article className="hhba-rules-document" aria-label="会员服务与劳动权益支持详细规则">
     <div className="hhba-rules-doc-intro">
      <span><FileCheck2 size={16} aria-hidden="true"/> 16章详细说明</span>
      <h2>所有关键条件，都应该在付费之前讲清楚。</h2>
      <p>以下各章涵盖已经确定的制度方向和尚待批准的交付细则。标有「正式开售前必须明确」的事项，现阶段不能作为平台的实际履约承诺。</p>
     </div>
     {chapters.map((chapter,index)=><section key={chapter.id} id={'rules-'+chapter.id} className="hhba-rules-chapter" aria-labelledby={'heading-'+chapter.id}>
      <div className="hhba-rules-chapter-heading">
       <span>CHAPTER {padNumber(index)}</span>
       <h2 id={'heading-'+chapter.id}>{chapter.title}</h2>
       <p>{chapter.summary}</p>
      </div>
      {chapter.clauses.map((clause,clauseIndex)=><div className={'hhba-rules-clause'+(clause.attention?' hhba-rules-clause--'+clause.attention:'')} key={clauseIndex}>
       <h3>{clause.heading}{clause.attention==='pending'&&<span className="hhba-rules-pending">正式开售前必须明确</span>}{clause.attention==='critical'&&<span className="hhba-rules-important">重要权益提示</span>}</h3>
       {clause.paragraphs.map((paragraph,j)=><p key={j}>{paragraph}</p>)}
      </div>)}
     </section>)}
     <section className="hhba-rules-chapter" id="rules-faq" aria-labelledby="rules-faq-heading">
      <div className="hhba-rules-chapter-heading">
       <span>QUESTIONS & ANSWERS</span><h2 id="rules-faq-heading">常见问题与具体情形</h2>
       <p>结合真实使用场景解释规则，帮助用户在付款之前理解重要边界。</p>
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
       <p>法规链接指向公开的官方或政府转载页面，供读者核验；具体适用仍应以现行有效法律和实际业务结构为准。</p>
      </div>
      <ul className="hhba-rules-source-list">
       {legalSources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={14} aria-hidden="true"/></a></li>)}
      </ul>
      <div className="hhba-rules-safe-note"><Info size={18} aria-hidden="true"/><p>本页对法律的概括不构成对任何个案的正式法律意见。不得以本页替代执业律师对具体案件的判断、对会员商业模式的合规审查或行政机关的许可认定。</p></div>
     </section>
     <footer className="hhba-rules-document-footer" id="rules-versions">
      <h2>版本与适用说明</h2>
      <p><ShieldCheck size={17} aria-hidden="true"/>当前公开说明：v{RULE_VERSION} · {RULE_UPDATED} · {RULE_STATUS}</p>
      <p>正式开售前应明确合同主体、完整服务清单与额度、退款算法、服务资格规则、受理争议范围、隐私处理主体、专业律所和投诉渠道。正式合同将另行发布；不会因为浏览本页而默认用户已同意。</p>
      <p>如发现信息错误，或有待公开的事项，HHBA应在正式开售前完成核对和说明。尚未有可用的专项会员购买及案件投诉入口，本页面不假装已经具备相应后台功能。</p>
      <Link to="/" className="hhba-rules-bottom-link">返回首页 <ArrowUpRight size={15}/></Link>
     </footer>
    </article>
   </div>
  </main>
 </Shell>;
}
