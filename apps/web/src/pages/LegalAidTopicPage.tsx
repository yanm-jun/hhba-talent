import {ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,ClipboardList,ExternalLink,FileCheck2,Info,Landmark,Scale,ShieldAlert} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import laborRights from '../data/laborRightsTopics.json';
import '../styles/legal-aid-landing.css';

type LaborTopic = (typeof laborRights.topics)[number];
const topics = laborRights.topics as LaborTopic[];
export const supportedLaborTopicSlugs=topics.map(t=>t.slug);
export function LegalAidTopicPage({user,slug}:{user:User|null;slug:string}){
 const topic=topics.find(t=>t.slug===slug);
 if(!topic)return <Shell user={user}><main className="hhba-law hhba-law-detail"><div className="hhba-law-panel"><div className="hhba-law-missing"><h1>没有找到这个劳动权益专题</h1><Link to="/candidate/account/legal-aid">返回法律援助首页</Link></div></div></main></Shell>;
 const index=topics.indexOf(topic);
 return <Shell user={user}>
   <main className="hhba-law hhba-law-detail" id="main-content">
    <div className="hhba-law-panel">
     <header className="hhba-law-header">
      <div className="hhba-law-brand">
       <Link className="hhba-law-brand-logo hhba-law-identity-link" to="/candidate/account/legal-aid">HHBA.</Link>
       <span className="hhba-law-brand-divider" aria-hidden="true"/>
       <span className="hhba-law-brand-name">法律援助 · 知识专题</span>
      </div>
      <Link className="hhba-law-back" to="/candidate/account/legal-aid"><ArrowLeft size={13} aria-hidden="true"/>返回八类问题</Link>
     </header>
     <article className="hhba-law-article">
      <div className="hhba-law-article-heading">
       <span className="hhba-law-article-index">劳动权益专题 {String(index+1).padStart(2,'0')} / 08</span>
       <h1>{topic.title}</h1>
       <p>{topic.short}</p>
      </div>
      <div className="hhba-law-online-info" role="note">
       <BookOpen size={17} aria-hidden="true"/>
       <span>法律知识和官方案例现已可查询；案件咨询、个案判断、证据上传与律师对接仍未开放。资料核对日期：{laborRights.reviewedOn}。</span>
      </div>
      <section className="hhba-law-article-section" aria-labelledby="legal-situations">
       <div className="hhba-law-article-section-head"><span>01</span><h2 id="legal-situations">先判断是否属于这类问题</h2></div>
       <ul className="hhba-law-bullet-list">{topic.situations.map(v=><li key={v}>{v}</li>)}</ul>
       <p className="hhba-law-article-note">以上仅供问题分类，不代表用人单位已违法或劳动者的请求必然成立。</p>
      </section>
      <section className="hhba-law-article-section" aria-labelledby="legal-statutes">
       <div className="hhba-law-article-section-head"><span>02</span><h2 id="legal-statutes">适用法律与权威出处</h2></div>
       <div className="hhba-law-law-list">{topic.laws.map(law=><div key={law.name+law.articles} className="hhba-law-law">
        <div className="hhba-law-law-title"><div><strong>{law.name}</strong><span>{law.articles}</span></div><a href={law.url} target="_blank" rel="noopener noreferrer">核对法规原文 <ExternalLink size={12}/></a></div>
        <p>{law.summary}</p>
       </div>)}</div>
       <p className="hhba-law-article-note">仅概括与该类问题有关的部分条款；法律法规修订、司法解释和地方规定应以权威现行文本为准。</p>
      </section>
      <section className="hhba-law-article-section" aria-labelledby="legal-evidence">
       <div className="hhba-law-article-section-head"><span>03</span><h2 id="legal-evidence">需要证明什么，以及如何准备证据</h2></div>
       <p className="hhba-law-section-sub">先看需要证明的事实，再找可以合法保存的材料；没有某一项资料不代表一定不能维权。</p>
       <div className="hhba-law-proof-list">{topic.proof.map(p=><div key={p.fact} className="hhba-law-proof">
        <div className="hhba-law-proof-title"><FileCheck2 size={17} aria-hidden="true"/><strong>{p.fact}</strong></div>
        <span className="hhba-law-proof-label">可参考的材料</span>
        <ul>{p.materials.map(item=><li key={item}>{item}</li>)}</ul>
        <div className="hhba-law-proof-note"><Info size={13} aria-hidden="true"/><p>{p.note}</p></div>
       </div>)}</div>
       <p className="hhba-law-article-note">请通过合法方式保留真实原件、完整上下文和时间信息；不要伪造、篡改证据，不要未经授权访问他人账户或企业系统。本网站不接收材料。</p>
      </section>
      <section className="hhba-law-article-section" aria-labelledby="legal-path">
       <div className="hhba-law-article-section-head"><span>04</span><h2 id="legal-path">通常可以怎样依法处理</h2></div>
       <div className="hhba-law-paths">{topic.paths.map((p,i)=><div className="hhba-law-path" key={p.title}>
        <div className="hhba-law-path-number">{String(i+1).padStart(2,'0')}</div>
        <div><h3>{p.title}</h3><p>{p.description}</p></div>
       </div>)}</div>
       <div className="hhba-law-procedure-note"><Landmark size={17} aria-hidden="true"/><span>{laborRights.commonProcedureNotice}</span></div>
      </section>
      <section className="hhba-law-article-section" aria-labelledby="legal-case">
       <div className="hhba-law-article-section-head"><span>05</span><h2 id="legal-case">已公开的真实典型案例</h2></div>
       <div className="hhba-law-case">
        <span className="hhba-law-case-source">官方公开案例 · 非模拟案件</span>
        <h3>{topic.case.title}</h3>
        <p className="hhba-law-case-authority">{topic.case.source}</p>
        <dl>
         <div><dt>案件情况</dt><dd>{topic.case.facts}</dd></div>
         <div><dt>处理结果</dt><dd>{topic.case.outcome}</dd></div>
         <div><dt>参考意义</dt><dd>{topic.case.lesson}</dd></div>
        </dl>
        <a href={topic.case.url} target="_blank" rel="noopener noreferrer" className="hhba-law-case-link">查看法院或人社部门发布的原始案例 <ArrowUpRight size={15}/></a>
       </div>
       <p className="hhba-law-article-note">典型案例说明的是特定事实及处理结果，并非所有类似争议都会获得相同裁判。</p>
      </section>
      <section className="hhba-law-article-section hhba-law-last" aria-labelledby="legal-next">
       <div className="hhba-law-article-section-head"><span>06</span><h2 id="legal-next">行动前需要注意</h2></div>
       <div className="hhba-law-last-note"><ShieldAlert size={18} aria-hidden="true"/><p>{topic.special}</p></div>
       <div className="hhba-law-self-check"><ClipboardList size={16} aria-hidden="true"/><p>建议先整理事实时间线、法律主体、争议金额及相关证据；接下来可依据上述官方来源咨询劳动保障部门、劳动仲裁机构或具备资质的律师。</p></div>
      </section>
      <div className="hhba-law-article-bottom">
       <Link to="/candidate/account/legal-aid"><ArrowLeft size={15}/> 返回八类劳动权益问题</Link>
       {index<topics.length-1&&<Link to={'/candidate/account/legal-aid/'+topics[index+1].slug}>下一个专题：{topics[index+1].title}<ChevronRight size={14}/></Link>}
      </div>
     </article>
     <footer className="hhba-law-footer">
      仅提供中国大陆劳动权益一般信息，不构成个案法律意见或结果承诺 · 暂不受理案件及证据材料
     </footer>
    </div>
   </main>
  </Shell>;
}
