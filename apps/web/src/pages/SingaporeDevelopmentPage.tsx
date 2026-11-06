import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Bookmark,BookmarkCheck,ExternalLink,GitCompareArrows,Search,ShieldCheck,SlidersHorizontal,Info} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {overseasCategoryLabels,type OverseasCategory} from '../data/overseasNewZealand';
import {sgNotEligible,sgPathways,sgVerifiedOn,type SgPathway} from '../data/overseasSingapore';
import '../styles/overseas-development.css';

type View='country'|'pathway'|'saved'|'compare'|'match';
const root='/study-abroad',country=root+'/country/singapore';
const path=(id:string)=>root+'/singapore/pathway/'+id;
const savedKey='hhba.overseas.sg.saved.v1',compareKey='hhba.overseas.sg.compare.v1';
const sections:{key:'requirements'|'documents'|'steps'|'fees'|'rights'|'risks';title:string;intro:string}[]=[
 {key:'requirements',title:'01｜适用条件与资格门槛',intro:'逐项核对，不要仅凭签证名字或学历推断可申请。'},
 {key:'documents',title:'02｜需要准备的材料',intro:'以官方实际递交清单为准，相关文件可能需要认证翻译。'},
 {key:'steps',title:'03｜申请办理流程与先后顺序',intro:'优先执行能核实资格的步骤，再考虑支付第三方费用。'},
 {key:'fees',title:'04｜费用及资金安排',intro:'区分官方准证费、政府准证费、雇主征税、资金要求和实际生活成本。'},
 {key:'rights',title:'05｜获批后的工作与居留权利',intro:'工作或学生准证与PR不是同一件事，需单独核验。'},
 {key:'risks',title:'06｜不适用情况与常见风险',intro:'保留风险提示，避免“保证就业”或“保证获签”的误导。'}];
function load(key:string):string[]{try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter((v:unknown):v is string=>typeof v==='string'&&sgPathways.some(p=>p.id===v)):[];}catch{return[];}}
export function SingaporeDevelopmentPage({user,view='country',pathwayId}:{user:User|null;view?:View;pathwayId?:string}){
 const [filter,setFilter]=useState<'all'|OverseasCategory>('all'),[query,setQuery]=useState('');
 const [saved,setSaved]=useState<string[]>(()=>load(savedKey)),[compared,setCompared]=useState<string[]>(()=>load(compareKey));
 const [goal,setGoal]=useState<OverseasCategory>('work'),[offer,setOffer]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(savedKey,JSON.stringify(saved));}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem(compareKey,JSON.stringify(compared));}catch{}},[compared]);
 const toggleSave=(id:string)=>setSaved(xs=>xs.includes(id)?xs.filter(x=>x!==id):[...xs,id]);
 const toggleCompare=(id:string)=>setCompared(xs=>xs.includes(id)?xs.filter(x=>x!==id):xs.length>=3?xs:[...xs,id]);
 const filtered=useMemo(()=>sgPathways.filter(p=>(filter==='all'||p.category===filter)&&[p.name,p.english,p.summary,p.audience,...p.highlights].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[filter,query]);
 const detail=sgPathways.find(p=>p.id===pathwayId);
 const eligible=sgPathways.filter(p=>p.category===goal&&(offer!=='no'||!['sg-ep','sg-s-pass','sg-work-permit'].includes(p.id)));
 const crumb=(label='')=><nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link><span>/ <Link to={country}>新加坡</Link></span>{label&&<span>/ <strong>{label}</strong></span>}</nav>;
 const card=(p:SgPathway)=><article key={p.id} className="hhba-overseas-path-card">
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span></div>
  <h3><Link to={path(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(t=><span key={t}>{t}</span>)}</div>
  <div className="hhba-overseas-path-actions"><Link className="hhba-overseas-path-main" to={path(p.id)}>查看完整方案 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>toggleSave(p.id)} aria-label={(saved.includes(p.id)?'取消收藏 ':'收藏 ')+p.name}>{saved.includes(p.id)?<BookmarkCheck size={18}/>:<Bookmark size={18}/>}</button>
   <button type="button" onClick={()=>toggleCompare(p.id)} aria-pressed={compared.includes(p.id)} aria-label={(compared.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={18}/></button>
  </div>
 </article>;
 const note=<div className="hhba-overseas-disclaimer"><ShieldCheck size={19}/><div><strong>新加坡MOM/ICA官方资料 · {sgVerifiedOn}资料核验</strong><p>只提供法律路径资讯，不是工作准证或PR资格评估，也不作获批承诺。工资、费用、雇主配额、准证类别和递交规则可能变更，申请前必须以MOM / ICA当日原文为准。</p></div></div>;
 return <Shell user={user}><div className="hhba-overseas" data-hhba-overseas-uk={view}>
 {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
  {crumb()}<header className="hhba-overseas-country-hero" style={{backgroundImage:"linear-gradient(90deg,#132b47f8 0%,#153959de 61%,#15395955 100%),url('"+import.meta.env.BASE_URL+"overseas/countries/sg.webp')",backgroundPosition:'center'}}>
   <div><span className="hhba-overseas-kicker">SINGAPORE · OFFICIAL PATHWAYS</span><h1>🇸🇬 新加坡发展规划</h1>
   <p>核对真实合法的EP、S Pass、Work Permit、人才就业、留学、毕业求职与PR路径。先判断资格，再看申请材料、费用、限制及官方来源。</p>
   <div className="hhba-overseas-country-summary"><span>{sgPathways.length}条新加坡完整路径</span><span>{sgVerifiedOn}官方核验</span><span>含适用性警示</span></div>
   <a href="https://commons.wikimedia.org/wiki/File:Panorama_of_Singapore%27s_Marina_Bay.jpg" target="_blank" rel="noopener noreferrer">滨海湾实景 · Rocks n' Scapes · CC BY 2.0 <ExternalLink size={12}/></a></div>
   <div className="hhba-overseas-kiwi" aria-hidden="true">SG<span>新加坡</span></div>
  </header>
  <div className="hhba-overseas-utility"><Link to={root+'/singapore/match'}><SlidersHorizontal size={17}/> 按目标初筛</Link><Link to={root+'/singapore/saved'}><Bookmark size={17}/> 我的收藏（{saved.length}）</Link><Link to={root+'/singapore/compare'}><GitCompareArrows size={17}/> 方案对比（{compared.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 留学资料库</Link></div>
  <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">CHOOSE A LEGAL ROUTE</span><h2>新加坡有哪些真正可申请的路径？</h2><p>优先收录可从新加坡境外研究或毕业后实际转换的路线，不把不适用国籍、毕业求职身份或PR资格伪装成保证申请机会。</p></div></div>
   <div className="hhba-overseas-filter-bar"><label className="hhba-overseas-search"><Search size={18}/><input aria-label="搜索新加坡方案" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索：EP、S Pass、COMPASS、Student’s Pass、PR…"/></label><div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(c=><button type="button" key={c.id} className={filter===c.id?'is-active':''} aria-pressed={filter===c.id} onClick={()=>setFilter(c.id)}>{c.name}</button>)}</div></div>
   <div className="hhba-overseas-path-grid">{filtered.map(card)}</div>{!filtered.length&&<div className="hhba-overseas-empty"><p>没有对应方案，请调整搜索条件。</p><button type="button" onClick={()=>{setQuery('');setFilter('all');}}>清除筛选</button></div>}
  </section>
  <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><h2>特别注意：常见误判的新加坡路线</h2></div></div>{sgNotEligible.map(x=><div className="hhba-overseas-inline-alert" key={x.title}><Info size={19}/><div><strong>{x.title}</strong><p>{x.detail} <a href={x.url} target="_blank" rel="noopener noreferrer">查看新加坡政府原文 <ExternalLink size={13}/></a></p></div></div>)}</section>{note}
 </main>}
 {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content hhba-overseas-reader-page">
  {detail?<>{crumb(detail.name)}<header className="hhba-overseas-pathway-head"><div className="hhba-overseas-eyebrow">{overseasCategoryLabels[detail.category]} · 新加坡 · {sgVerifiedOn}</div><h1>{detail.name}</h1><p className="hhba-overseas-eng">{detail.english}</p><p>{detail.summary}</p></header>
   <div className="hhba-overseas-reader-actions"><a className="hhba-overseas-reader-official" target="_blank" rel="noopener noreferrer" href={detail.officialUrl}>打开MOM / ICA官方申请说明 <ExternalLink size={15}/></a><button type="button" onClick={()=>toggleSave(detail.id)}>{saved.includes(detail.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>} {saved.includes(detail.id)?'已收藏':'收藏此路线'}</button><button type="button" onClick={()=>toggleCompare(detail.id)}><GitCompareArrows size={17}/> {compared.includes(detail.id)?'已加入对比':'加入对比'}</button></div>
   <div className="hhba-overseas-section"><h2>这条路线到底适合谁？</h2><p>{detail.audience}</p><p><strong>先做的第一件事：</strong>{detail.steps[0]}</p></div>
   <nav className="hhba-overseas-utility" aria-label="跳转至指南章节">{sections.map(s=><a key={s.key} href={'#'+s.key}>{s.title.slice(0,2)} {s.title.split('｜')[1]}</a>)}</nav>
   {sections.map(s=><section className="hhba-overseas-section" key={s.key} id={s.key}><div className="hhba-overseas-section-head"><div><h2>{s.title}</h2><p>{s.intro}</p></div></div><ol>{detail[s.key].map((line,i)=><li key={i} style={{marginBottom:14,lineHeight:1.85}}>{line}</li>)}</ol></section>)}
   <section className="hhba-overseas-section"><h2>07｜官方来源与更新核验</h2><p>核验基准日：{sgVerifiedOn}。准证与移民政策并非永久有效，递交时请逐项核对官方页面中的资格、费用、申请地和政策发布日期。</p><a href={detail.officialUrl} target="_blank" rel="noopener noreferrer">MOM / ICA · {detail.english} <ExternalLink size={15}/></a></section>
   <section className="hhba-overseas-section"><h2>08｜常见问题</h2><h3>这是不是保证获批的路线？</h3><p>不是。每条路线都需要符合入境、资金、个人情况与最新规则，并由新加坡相关主管机关决定是否批准。</p><h3>能直接申请新加坡永久居留吗？</h3><p>不一定。EP或S Pass持有人可按ICA规定申请PR，但是否获批取决于个人身份、家庭、工作贡献及ICA综合评估；Student's Pass、LTVP等不等于PR资格。</p><h3>持学生准证、LTVP或工作准证就一定能上班吗？</h3><p>不能。通常必须有真实雇主聘用及对应工作准证才可以正式工作；例外情形须以MOM为准，本站不提供虚构名额。</p></section>{note}
  </>:<>{crumb('方案不存在')}<div className="hhba-overseas-empty"><h2>没有找到这个新加坡申请方案</h2><Link to={country}>返回新加坡方案列表 <ArrowRight size={17}/></Link></div></>}
 </main>}
 {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('我的收藏')}<h1>新加坡方案收藏</h1><p>仅保存在当前浏览器，暂不进行跨设备同步。</p><div className="hhba-overseas-path-grid">{sgPathways.filter(p=>saved.includes(p.id)).map(card)}</div>{!saved.length&&<p>暂无收藏。<Link to={country}>查看全部新加坡方案</Link></p>}</main>}
 {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('方案对比')}<h1>新加坡准证与身份路线对比（最多3项）</h1><div className="hhba-overseas-compare-grid">{sgPathways.filter(p=>compared.includes(p.id)).map(p=><article key={p.id} className="hhba-overseas-compare-card"><h2>{p.name}</h2><p>{p.summary}</p><h3>资格要求</h3><ul>{p.requirements.slice(0,3).map(x=><li key={x}>{x}</li>)}</ul><h3>费用</h3><ul>{p.fees.map(x=><li key={x}>{x}</li>)}</ul><Link to={path(p.id)}>完整申请说明 <ArrowRight size={16}/></Link><button type="button" onClick={()=>toggleCompare(p.id)}>移出比较</button></article>)}</div>{!compared.length&&<p>尚未选择任何路线。<Link to={country}>返回方案列表</Link></p>}{note}</main>}
 {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('目标初筛')}<header className="hhba-overseas-match-head"><h1>先按出国目标筛选新加坡路线</h1><p>仅对路线类别进行初步过滤，不是AI自动通过率预测或法律资格审查。</p></header><div className="hhba-overseas-match-layout"><div className="hhba-overseas-match-filters"><h2>你更重视什么？</h2><div className="hhba-overseas-match-options">{Object.entries(overseasCategoryLabels).map(([id,name])=><button type="button" key={id} className={goal===id?'is-active':''} onClick={()=>setGoal(id as OverseasCategory)}>{name}</button>)}</div><h2>已获得新加坡工作邀请吗？</h2><div className="hhba-overseas-match-options">{([{id:'yes',name:'有'},{id:'no',name:'没有'},{id:'unsure',name:'暂不确定'}] as const).map(o=><button type="button" key={o.id} className={offer===o.id?'is-active':''} onClick={()=>setOffer(o.id)}>{o.name}</button>)}</div><p>没有工作邀请时，默认排除需要雇主先签发雇主聘用的工作路线；不代表其余方案均适合你。</p></div><div className="hhba-overseas-match-results"><h2>可进一步查证（{eligible.length}条）</h2>{eligible.map(p=><Link key={p.id} to={path(p.id)} className="hhba-overseas-match-result"><strong>{p.name}</strong><small>{p.summary}</small><ArrowRight size={16}/></Link>)}{!eligible.length&&<p>当前筛选未找到匹配路线，可以修改目标或返回全部方案。</p>}</div></div>{note}</main>}
 </div></Shell>;
}
