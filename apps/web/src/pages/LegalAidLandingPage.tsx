import {useMemo,useState} from 'react';
import {ArrowUpRight,ArrowRight,BookOpen,BriefcaseBusiness,ChevronRight,Clock3,FileText,Scale,Search,ShieldCheck,Wallet} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import laborRights from '../data/laborRightsTopics.json';
import subtopics from '../data/laborRightsSubtopics.json';
import intentData from '../data/laborRightsSearchIntents.json';
import browseData from '../data/laborRightsBrowseGroups.json';
import {GUIDE_TIPS} from '../data/hhbaWorkValueGuide';
import '../styles/legal-aid-landing.css';
import '../styles/hhba-work-value-guide.css';

const categoryIcons=[Wallet,FileText,BriefcaseBusiness,ShieldCheck,Clock3,Scale];
const browseItems=browseData.groups.flatMap(group=>group.topics.map(item=>{
 const full=laborRights.topics.find(topic=>topic.slug===item.slug);
 const detailed=subtopics.topics.find(topic=>topic.slug===item.slug);
 return {...item,kind:full?'full' as const:'detail' as const,title:full?.title||detailed?.title||item.question};
}));
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
// Treat punctuation and spacing differences as the same local lookup query.
const normal=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,'');
const matchingIntents=(raw:string)=>{
 const q=normal(raw);
 if(!q)return [];
 return intentData.intents.filter(intent=>intent.phrases.some(phrase=>q.includes(normal(phrase))));
};
function topicMatches(topic:(typeof laborRights.topics)[number],raw:string){
 const query=normal(raw);
 if(!query)return true;
 const text=normal([topic.title,topic.short,...topic.situations,...topic.laws.map(law=>law.name+' '+law.articles),...topic.paths.map(p=>p.title+' '+p.description),topic.case.title].join(' '));
 return text.includes(query)||(topicKeywords[topic.slug]||[]).some(tag=>query.includes(tag)||tag.includes(query)&&query.length>=2)||matchingIntents(query).some(intent=>intent.primary===topic.slug);
}
function subtopicMatches(topic:(typeof subtopics.topics)[number],raw:string){
 const query=normal(raw);
 if(!query)return true;
 const words=normal([topic.title,topic.short,...topic.aliases,...topic.situations,...topic.misconceptions,...topic.laws.map(law=>law.name+' '+law.articles)].join(' '));
 return words.includes(query)||topic.aliases.some(a=>query.includes(normal(a))||normal(a).includes(query)&&query.length>=2)||matchingIntents(query).some(intent=>intent.subtopics.includes(topic.slug));
}
function tipMatches(tip:(typeof GUIDE_TIPS)[number],raw:string){
 const query=normal(raw);
 if(!query)return false;
 const content=normal([tip.title,tip.summary,...tip.steps,...tip.keywords].join(' '));
 return content.includes(query)||tip.keywords.some(tag=>query.includes(tag)||tag.includes(query)&&query.length>=2);
}
const examples=['公司不发工资','试用期不交社保','被辞退怎么办'];
export function LegalAidLandingPage({user,embedded=false}:{user:User|null;embedded?:boolean}){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('salary');
 const knowledgeHref=embedded?'/candidate/account/legal-aid':'/rights/knowledge';
 const isSearching=normal(query).length>0;
 const selectedGroup=browseData.groups.find(group=>group.id===category)||browseData.groups[0];
 const matches=useMemo(()=>laborRights.topics.filter(topic=>topicMatches(topic,query)),[query]);
 const subMatches=useMemo(()=>subtopics.topics.filter(topic=>subtopicMatches(topic,query)),[query]);
 const guideMatches=useMemo(()=>{
  if(!query.trim())return [GUIDE_TIPS[0],GUIDE_TIPS[10],GUIDE_TIPS[15],GUIDE_TIPS[35]];
  // Intents only rank relevant existing articles; they never produce a legal conclusion.
  const q=normal(query);
  const intents=matchingIntents(query);
  const featuredActions=[...new Set(intents.flatMap(intent=>intent.featuredActions))];
  const relatedSlugs=new Set(laborRights.topics.filter(topic=>
   (topicKeywords[topic.slug]||[]).some(word=>q.includes(normal(word)))
  ).map(topic=>topic.slug));
  for(const intent of intents){
   relatedSlugs.add(intent.primary);
   for(const slug of intent.subtopics)relatedSlugs.add(slug);
  }
  for(const topic of subMatches)relatedSlugs.add(topic.slug);
  return GUIDE_TIPS.map((tip,index)=>{
   const curatedPosition=featuredActions.indexOf(tip.id);
   const direct=tipMatches(tip,query);
   const related=tip.topic!==null&&relatedSlugs.has(tip.topic);
   if(curatedPosition<0&&!direct&&!related)return null;
   const specific=tip.topic!==null&&intents.some(intent=>intent.subtopics.includes(tip.topic!));
   const score=curatedPosition>=0?1000-curatedPosition:direct?300:specific?140:related?60:0;
   return {tip,index,score};
  }).filter((item):item is {tip:(typeof GUIDE_TIPS)[number];index:number;score:number}=>item!==null)
   .sort((a,b)=>b.score-a.score||a.index-b.index)
   .slice(0,6).map(item=>item.tip);
 },[query,subMatches]);
 const visibleTopics=useMemo(()=>{
  if(!isSearching){
   return selectedGroup.topics.map(item=>browseItems.find(topic=>topic.slug===item.slug)).filter((item):item is (typeof browseItems)[number]=>Boolean(item));
  }
  const intents=matchingIntents(query);
  const specific=new Set(intents.flatMap(intent=>intent.subtopics));
  const primary=new Set(intents.map(intent=>intent.primary));
  const q=normal(query);
  return browseItems.filter(item=>
   item.kind==='full'
    ? matches.some(topic=>topic.slug===item.slug)||normal(item.question).includes(q)
    : subMatches.some(topic=>topic.slug===item.slug)||normal(item.question).includes(q)
  ).map((item,index)=>({...item,index,rank:specific.has(item.slug)?3:primary.has(item.slug)?2:1}))
   .sort((a,b)=>b.rank-a.rank||a.index-b.index);
 },[isSearching,selectedGroup,query,matches,subMatches]);
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
      <span className="hhba-knowledge-kicker">HHBA / WORKPLACE RIGHTS</span>
      <h1 id="hhba-law-title">你遇到了什么职场问题？</h1>
      <p>直接搜索问题，或者按照分类浏览。</p>
     </section>

     <label className="hhba-knowledge-search">
      <Search size={19} aria-hidden="true"/>
      <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：公司不发工资、试用期不交社保…" aria-label="搜索劳动权益知识和职场行动建议"/>
     </label>
     <div className="hhba-knowledge-search-help"><span>本地检索 · 无需登录 · 不上传你的问题</span></div>
     <div className="hhba-knowledge-examples" aria-label="常见问题示例">
      {examples.map(v=><button type="button" onClick={()=>setQuery(v)} key={v}>{v}</button>)}
      {query&&<button type="button" className="hhba-knowledge-clear" onClick={()=>setQuery('')}>清除搜索</button>}
     </div>

     {!isSearching&&<section className="hhba-knowledge-categories" aria-labelledby="hhba-knowledge-categories-title">
      <div className="hhba-knowledge-section-heading">
       <h2 id="hhba-knowledge-categories-title">按问题分类</h2>
       <span>6 个分类 · 20 个专题</span>
      </div>
      <div className="hhba-knowledge-category-grid" role="group" aria-label="选择职场问题分类">
       {browseData.groups.map((group,index)=>{
        const Icon=categoryIcons[index]||Scale;
        return <button type="button" className={'hhba-knowledge-category'+(group.id===selectedGroup.id?' is-active':'')}
         key={group.id} aria-pressed={group.id===selectedGroup.id} aria-controls="hhba-knowledge-results"
         onClick={()=>setCategory(group.id)}>
         <Icon size={19} strokeWidth={1.7} aria-hidden="true"/>
         <span>{group.label}</span>
         <ChevronRight size={16} aria-hidden="true" className="hhba-knowledge-category-arrow"/>
        </button>;
       })}
      </div>
     </section>}

     <section id="hhba-knowledge-results" className="hhba-knowledge-results" aria-labelledby="hhba-knowledge-results-title">
      <div className="hhba-knowledge-section-heading">
       <h2 id="hhba-knowledge-results-title">{isSearching?'搜索结果':'相关问题'}</h2>
       <span aria-live="polite">{isSearching?visibleTopics.length+' 个匹配专题':selectedGroup.label+' · '+visibleTopics.length+' 个问题'}</span>
      </div>
      {visibleTopics.length?<div className="hhba-knowledge-result-list">
       {visibleTopics.map(item=>{
        const topic=browseItems.find(t=>t.slug===item.slug)||item;
        return <Link to={knowledgeHref+'/'+topic.slug} key={topic.slug}
         className={'hhba-knowledge-result-row '+(item.kind==='full'?'hhba-law-topic':'hhba-knowledge-subtopic-card')}
         aria-label={item.question+'，'+topic.title}>
         <span className="hhba-knowledge-result-title">{item.question}</span>
         <span className="hhba-knowledge-result-type">{item.kind==='full'?'深度专题':'细分问题'}</span>
         <ChevronRight size={17} aria-hidden="true"/>
        </Link>;
       })}
      </div>:<div className="hhba-knowledge-no-match">没有找到对应专题，可以试试「工资」「合同」「社保」等关键词，或 <button type="button" onClick={()=>setQuery('')}>按分类浏览</button>。</div>}
     </section>

     {isSearching&&guideMatches.length>0&&<section className="hhba-knowledge-actions" aria-labelledby="hhba-knowledge-actions-title">
      <div className="hhba-knowledge-section-heading"><h2 id="hhba-knowledge-actions-title">建议下一步</h2><span>仅作一般信息参考</span></div>
      <div className="hhba-knowledge-action-list">
       {guideMatches.slice(0,3).map(tip=><Link to={"/rights/guide?tip="+encodeURIComponent(tip.id)} className="hhba-knowledge-action" key={tip.id}>
        <strong>{tip.title}</strong><span>查看步骤 · {tip.minutes} <ArrowUpRight size={12} style={{verticalAlign:'middle'}}/></span>
       </Link>)}
      </div>
     </section>}
     <Link className="hhba-knowledge-guide-mini" to="/rights/guide">
      <BookOpen size={18} aria-hidden="true"/><span>高性价比职场指南 · {GUIDE_TIPS.length} 条原创建议</span><ArrowRight size={17} aria-hidden="true"/>
     </Link>
     <p className="hhba-knowledge-notice">已收录 8 个深度专题与 12 个细分专题。本站仅提供中国大陆劳动权益一般资料，不提供个案法律判断或案件受理；请结合官方现行规定、当地政策及实际情况核对。资料整理：深度专题 {laborRights.reviewedOn} · 细分专题 {subtopics.reviewedOn}。本页使用关键词和常见说法匹配，只用于查找资料，不会自动判断是否违法。</p>
    </div>
   </section>
  </main>
 </Shell>;
}
