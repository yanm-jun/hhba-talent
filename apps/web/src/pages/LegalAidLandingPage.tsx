import {useMemo,useState} from 'react';
import {ArrowUpRight,BadgeAlert,BookmarkX,Clock3,FileText,HeartPulse,Scale,Search,ShieldCheck,Wallet,Waypoints,BookOpen,ArrowRight} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import laborRights from '../data/laborRightsTopics.json';
import subtopics from '../data/laborRightsSubtopics.json';
import {GUIDE_TIPS} from '../data/hhbaWorkValueGuide';
import '../styles/legal-aid-landing.css';
import '../styles/hhba-work-value-guide.css';

const topicIcons=[Wallet,BookmarkX,Clock3,FileText,ShieldCheck,HeartPulse,Waypoints,BadgeAlert];
const topicKeywords:Record<string,string[]>={
 'unpaid-wages':['工资','欠薪','少发','没发工资','不发薪','扣钱','提成','奖金','拖欠'],
 'unlawful-dismissal':['辞退','裁员','补偿','赔偿','逼我离职','被优化','解雇','解除'],
 'overtime-leave':['加班','休假','年假','调休','工时','排班','值班'],
 'labor-contracts':['劳动合同','合同','试用','续签','签约','离职证明','甲方'],
 'social-insurance':['社保','养老','医保','公积金','五险','断缴','缴费'],
 'work-injury':['工伤','受伤','职业病','事故','认定'],
 'transfer-paycuts':['调岗','降薪','异地','调动','转岗','工资降低'],
 'flexible-work':['外包','派遣','兼职','实习','零工','劳动关系']
};
const normal=(s:string)=>s.trim().toLocaleLowerCase();
function topicMatches(topic:(typeof laborRights.topics)[number],raw:string){
 const query=normal(raw);
 if(!query)return true;
 const text=[topic.title,topic.short,...topic.situations,...topic.laws.map(law=>law.name+' '+law.articles),...topic.paths.map(p=>p.title+' '+p.description),topic.case.title].join(' ').toLocaleLowerCase();
 return text.includes(query)||(topicKeywords[topic.slug]||[]).some(tag=>query.includes(tag)||tag.includes(query)&&query.length>=2);
}
function subtopicMatches(topic:(typeof subtopics.topics)[number],raw:string){
 const query=normal(raw);
 if(!query)return true;
 const words=[topic.title,topic.short,...topic.aliases,...topic.situations,...topic.misconceptions,...topic.laws.map(law=>law.name+' '+law.articles)].join(' ').toLocaleLowerCase();
 return words.includes(query)||topic.aliases.some(a=>query.includes(normal(a))||normal(a).includes(query)&&query.length>=2);
}
function tipMatches(tip:(typeof GUIDE_TIPS)[number],raw:string){
 const query=normal(raw);
 if(!query)return false;
 const content=[tip.title,tip.summary,...tip.steps,...tip.keywords].join(' ').toLocaleLowerCase();
 return content.includes(query)||tip.keywords.some(tag=>query.includes(tag)||tag.includes(query)&&query.length>=2);
}
const examples=['公司不发工资','被辞退怎么办','试用期社保','调岗降薪','加班费','离职证明'];
export function LegalAidLandingPage({user,embedded=false}:{user:User|null;embedded?:boolean}){
 const [query,setQuery]=useState('');
 const knowledgeHref=embedded?'/candidate/account/legal-aid':'/rights/knowledge';
 const matches=useMemo(()=>laborRights.topics.filter(topic=>topicMatches(topic,query)),[query]);
 const subMatches=useMemo(()=>subtopics.topics.filter(topic=>subtopicMatches(topic,query)),[query]);
 const guideMatches=useMemo(()=>{
  if(!query.trim())return [GUIDE_TIPS[0],GUIDE_TIPS[10],GUIDE_TIPS[15],GUIDE_TIPS[35]];
  // Relate colloquial questions (e.g. “公司三个月没发工资”) to the corresponding
  // evidence-based topic without pretending that this is an AI legal judgment.
  const q=normal(query);
  const relatedSlugs=new Set(laborRights.topics.filter(topic=>
   (topicKeywords[topic.slug]||[]).some(word=>q.includes(word.toLocaleLowerCase()))
  ).map(topic=>topic.slug));
  return GUIDE_TIPS.filter(tip=>
   tipMatches(tip,query)||(tip.topic!==null&&relatedSlugs.has(tip.topic))
  ).slice(0,6);
 },[query]);
 return <Shell user={user} embedded={embedded}>
  <main className="hhba-law hhba-rights-knowledge" id="main-content">
   <section className="hhba-law-panel" aria-labelledby="hhba-law-title">
    <header className="hhba-law-header">
     <div className="hhba-law-brand">
      <span className="hhba-law-brand-logo">HHBA.</span>
      <span className="hhba-law-brand-divider" aria-hidden="true"/>
      <span className="hhba-law-brand-name">劳动权益知识库</span>
     </div>
     <div className="hhba-law-header-actions">
      <Link to="/rights/guide" className="hhba-law-intervention-link"><BookOpen size={14}/>高性价比职场指南</Link>
      <Link to={embedded?"/candidate/account":"/"} className="hhba-law-back">{embedded?"返回个人中心":"返回官网首页"} <ArrowUpRight size={12}/></Link>
     </div>
    </header>
    <div className="hhba-law-body">
     <section className="hhba-law-intro">
      <span className="hhba-knowledge-kicker">HHBA / KNOW YOUR WORKPLACE RIGHTS</span>
      <Scale size={27} aria-hidden="true"/>
      <h1 id="hhba-law-title">了解劳动权益，从可靠的依据开始。</h1>
      <p>劳动合同、工资、加班、辞退、社保和工伤等问题，分为 8 类深度专题和 12 个细分专题，提供证据清单、处理方法及可核对的官方出处。</p>
     </section>
     <label className="hhba-knowledge-search"><Search size={20}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="描述你的问题，例如：公司三个月没有发工资…" aria-label="搜索劳动权益知识和职场行动建议"/></label>
     <div className="hhba-knowledge-search-help"><span>即时本地检索 · 无需登录 · 不上传你的问题</span><span>资料核对：{laborRights.reviewedOn}</span></div>
     <div className="hhba-knowledge-examples" aria-label="常见问题示例">
      {examples.map(v=><button type="button" onClick={()=>setQuery(v)} key={v}>{v}</button>)}
      {query&&<button type="button" onClick={()=>setQuery('')}>清除搜索</button>}
     </div>
     <Link className="hhba-knowledge-guide" to="/rights/guide">
      <div><strong>高性价比职场指南</strong><p>由 HHBA 独立编写的 {GUIDE_TIPS.length} 条行动建议。按求职、入职、工作和离职等阶段，找到现在就能执行的步骤。</p></div>
      <ArrowRight size={23} aria-hidden="true"/>
     </Link>
     <section className="hhba-law-topics" aria-labelledby="hhba-law-topics-title">
      <h2 id="hhba-law-topics-title">劳动权益深度专题 · {matches.length} / {laborRights.topics.length} 类</h2>
      {matches.length?<div className="hhba-law-topic-grid">
       {matches.map((topic)=>{
        const position=laborRights.topics.indexOf(topic);const Icon=topicIcons[position]||Scale;
        return <Link to={knowledgeHref+'/'+topic.slug} className="hhba-law-topic" key={topic.slug}>
         <Icon className="hhba-law-topic-icon" size={19} strokeWidth={1.7} aria-hidden="true"/>
         <span className="hhba-knowledge-topic-copy"><strong>{topic.title}</strong><small>{topic.short}</small></span>
         <ArrowUpRight className="hhba-law-topic-arrow" size={15} aria-hidden="true"/>
        </Link>;
       })}
      </div>:<div className="hhba-knowledge-no-match">未找到完全对应的法律专题。建议换成「工资」「合同」「加班」「社保」等关键词，或者先浏览全部专题。 <button type="button" onClick={()=>setQuery('')}>查看全部</button></div>}
     </section>
     <section className="hhba-knowledge-subtopics" aria-labelledby="hhba-knowledge-subtopics-title">
      <div className="hhba-knowledge-subtopics-head">
       <h2 id="hhba-knowledge-subtopics-title">劳动权益细分专题 · {subMatches.length} / {subtopics.topics.length} 类</h2>
       <span>原创问题指引 · 不虚构案例</span>
      </div>
      {subMatches.length?<div className="hhba-knowledge-subtopic-grid">{subMatches.map(topic=><Link to={knowledgeHref+'/'+topic.slug} key={topic.slug} className="hhba-knowledge-subtopic-card">
       <strong>{topic.title}</strong><p>{topic.short}</p>
       <span>查看法律、证据与处理步骤 <ArrowUpRight size={14}/></span>
      </Link>)}</div>:<p className="hhba-knowledge-no-match">本次搜索没有匹配的细分专题。可以浏览上方深度专题，或清空搜索。</p>}
     </section>
     <section className="hhba-knowledge-actions" aria-labelledby="hhba-knowledge-actions-title">
      <h2 id="hhba-knowledge-actions-title">{query?'相关职场行动建议':'从这些行动开始'}</h2>
      {guideMatches.length?<div className="hhba-knowledge-action-list">
       {guideMatches.map(tip=><Link to={"/rights/guide?tip="+encodeURIComponent(tip.id)} className="hhba-knowledge-action" key={tip.id}>
        <strong>{tip.title}</strong><small>{tip.summary}</small><span>查看步骤 · {tip.minutes} <ArrowUpRight size={12} style={{verticalAlign:'middle'}}/></span>
       </Link>)}
      </div>:<div className="hhba-knowledge-no-match">暂无匹配的职场建议，可以进入完整指南按阶段查找。</div>}
     </section>
     <p className="hhba-knowledge-notice">收录 8 个深度专题及 12 个细分专题。以上内容限于中国大陆劳动权益一般信息，不是个案法律结论，也不代表已经受理案件。官方法律和案例链接均收录在专题详情中；实际适用应结合当地规定、个案事实及法律更新核对。本页为关键词检索，不是 AI 自动法律判断。</p>
    </div>
   </section>
  </main>
 </Shell>;
}
