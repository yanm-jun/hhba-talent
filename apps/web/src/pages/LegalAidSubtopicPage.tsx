import {ArrowLeft,ArrowUpRight,BookOpen,ClipboardList,ExternalLink,FileCheck2,Landmark,ShieldAlert} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import subtopics from '../data/laborRightsSubtopics.json';
import base from '../data/laborRightsTopics.json';
import '../styles/legal-aid-landing.css';
import '../styles/hhba-work-value-guide.css';

type Subtopic=(typeof subtopics.topics)[number];
export function LegalAidSubtopicPage({user,topic,embedded=false}:{user:User|null;topic:Subtopic;embedded?:boolean}){
 const knowledgeHref=embedded?'/candidate/account/legal-aid':'/rights/knowledge';
 const parent=base.topics.find(t=>t.slug===topic.parentSlug);
 const position=subtopics.topics.findIndex(t=>t.slug===topic.slug);
 const next=subtopics.topics[position+1];
 return <Shell user={user} embedded={embedded}>
  <main className="hhba-law hhba-law-detail hhba-v2-subtopic" id="main-content">
   <div className="hhba-law-panel">
    <header className="hhba-law-header">
     <div className="hhba-law-brand">
      <Link className="hhba-law-brand-logo hhba-law-identity-link" to={knowledgeHref}>HHBA.</Link>
      <span className="hhba-law-brand-divider" aria-hidden="true"/>
      <span className="hhba-law-brand-name">劳动权益 · 细分问题指引</span>
     </div>
     <Link className="hhba-law-back" to={knowledgeHref}><ArrowLeft size={13}/>返回知识库</Link>
    </header>
    <article className="hhba-law-article">
     <div className="hhba-law-article-heading">
      <span className="hhba-law-article-index">细分专题 {String(position+1).padStart(2,'0')} / {subtopics.topics.length}</span>
      <h1>{topic.title}</h1>
      <p>{topic.short}</p>
     </div>
     <div className="hhba-law-online-info" role="note"><BookOpen size={18}/><span>HHBA 原创整理 · 专题资料核对：{subtopics.reviewedOn}。本站不提供个案法律判断，不接收证据或申请资料。</span></div>
     <section className="hhba-law-article-section">
      <div className="hhba-law-article-section-head"><span>01</span><h2>哪些情形值得进一步核对</h2></div>
      <ul className="hhba-law-bullet-list">{topic.situations.map(s=><li key={s}>{s}</li>)}</ul>
     </section>
     <section className="hhba-law-article-section">
      <div className="hhba-law-article-section-head"><span>02</span><h2>法律依据与官方原文</h2></div>
      <div className="hhba-law-law-list">{topic.laws.map(law=><div className="hhba-law-law" key={law.name+law.articles}>
       <div className="hhba-law-law-title"><div><strong>{law.name}</strong><span>{law.articles}</span></div>
       <a href={law.url} target="_blank" rel="noopener noreferrer">查看官方原文 <ExternalLink size={12}/></a></div>
       <p>{law.summary}</p>
      </div>)}</div>
      <p className="hhba-law-article-note">仅介绍部分相关条文。司法解释修订、地方规定和事实差异可能影响适用，使用前请核实现行版本。</p>
     </section>
     <section className="hhba-law-article-section">
      <div className="hhba-law-article-section-head"><span>03</span><h2>建议先准备哪些资料</h2></div>
      <div className="hhba-v2-checklist">{topic.proof.map(item=><div key={item}><FileCheck2 size={16}/><span>{item}</span></div>)}</div>
      <p className="hhba-law-article-note">只合法保存本人相关资料，不访问无权限系统，不上传企业机密或他人个人信息。本站不收集这些材料。</p>
     </section>
     <section className="hhba-law-article-section">
      <div className="hhba-law-article-section-head"><span>04</span><h2>一般处理步骤</h2></div>
      <div className="hhba-law-paths">{topic.paths.map((step,i)=><div className="hhba-law-path" key={step}>
       <div className="hhba-law-path-number">{String(i+1).padStart(2,'0')}</div><div><p>{step}</p></div>
      </div>)}</div>
      <div className="hhba-law-procedure-note"><Landmark size={17}/><span>{base.commonProcedureNotice}</span></div>
     </section>
     <section className="hhba-law-article-section">
      <div className="hhba-law-article-section-head"><span>05</span><h2>常见误区</h2></div>
      <ul className="hhba-law-bullet-list">{topic.misconceptions.map(s=><li key={s}>{s}</li>)}</ul>
      <div className="hhba-law-last-note" style={{marginTop:18}}><ShieldAlert size={18}/><p>{topic.special}</p></div>
     </section>
     <section className="hhba-law-article-section hhba-law-last">
      <div className="hhba-law-article-section-head"><span>06</span><h2>继续阅读与实际帮助</h2></div>
      {parent&&<div className="hhba-v2-related"><BookOpen size={18}/>
       <div><strong>相关深度专题：{parent.title}</strong><p>查看同一大类的证据分解、官方典型案例和处理流程。案例与本细分问题不一定相同，不能直接类推处理结果。</p>
        <Link to={knowledgeHref+'/'+parent.slug}>查看完整专题 <ArrowUpRight size={14}/></Link>
       </div>
      </div>}
      <p className="hhba-law-article-note">本页没有单独核实的判决案例，因此不使用模拟案例代替真实裁判。法律适用需要结合个案事实、管辖与时效。</p>
     </section>
     <div className="hhba-law-article-bottom">
      <Link to={knowledgeHref}><ArrowLeft size={15}/>返回全部知识专题</Link>
      {next&&<Link to={knowledgeHref+'/'+next.slug}>下一个专题：{next.title}<ArrowUpRight size={14}/></Link>}
     </div>
    </article>
    <footer className="hhba-law-footer">中国大陆劳动权益一般资料 · 非个案法律意见 · 无案件受理或资料上传</footer>
   </div>
  </main>
 </Shell>;
}
