import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Bookmark,BookmarkCheck,ExternalLink,GitCompareArrows,Search,ShieldCheck,SlidersHorizontal,Info} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {overseasCategoryLabels,type OverseasCategory} from '../data/overseasNewZealand';
import {overseasCountryPhotos} from '../data/overseasCountryPhotos';
import {usPathways,usNotEligible,usQuickSources,usVerifiedOn,type UsPathway} from '../data/overseasUnitedStates';
import '../styles/overseas-development.css';

type View='country'|'pathway'|'saved'|'compare'|'match';
type GuideKey='requirements'|'documents'|'steps'|'fees'|'timing'|'rights'|'future'|'risks';
const root='/study-abroad';
const country=root+'/country/united-states';
const pathwayLink=(id:string)=>root+'/united-states/pathway/'+id;
const savedKey='hhba.overseas.us.saved.v1';
const compareKey='hhba.overseas.us.compare.v1';
const sections:{key:GuideKey;title:string;intro:string}[]=[
 {key:'requirements',title:'01｜申请资格与适用门槛',intro:'按签证类别、教育或职业条件、国籍、岗位/项目要求和法规逐项核查。'},
 {key:'documents',title:'02｜材料与原始证据',intro:'检查文件由谁出具、能否独立核验、有效期是否匹配，不使用虚假材料。'},
 {key:'steps',title:'03｜从零开始的申请步骤',intro:'先核对资格与官方入口，再按要求联系学校、雇主或项目Sponsor。'},
 {key:'fees',title:'04｜申请费用与实际生活预算',intro:'政府收费、雇主/学校成本、资金证明与投资风险不混为一谈。'},
 {key:'timing',title:'05｜办理时间与重要日期',intro:'不承诺固定获批周期，注意签证年度窗口、课程开始、身份转换和排期。'},
 {key:'rights',title:'06｜获批后的权利与限制',intro:'签证、入境身份、工作授权、移民申请与永久居民不是一回事。'},
 {key:'future',title:'07｜以后可以怎样发展',intro:'讨论下一阶段的合法可能性，明确每一步需独立满足的条件。'},
 {key:'risks',title:'08｜常见误区与防骗警告',intro:'识别冒充官方、出售岗位和保证签证绿卡等高风险宣传。'}
];
function load(key:string):string[]{try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter((id:unknown):id is string=>typeof id==='string'&&usPathways.some(p=>p.id===id)):[];}catch{return[];}}
const employerRequired=new Set(['us-h1b','us-l1','us-h2a','us-h2b','us-eb3']);
export function UnitedStatesDevelopmentPage({user,view='country',pathwayId}:{user:User|null;view?:View;pathwayId?:string}){
 const [filter,setFilter]=useState<'all'|OverseasCategory>('all');
 const [query,setQuery]=useState('');
 const [saved,setSaved]=useState<string[]>(()=>load(savedKey));
 const [compared,setCompared]=useState<string[]>(()=>load(compareKey));
 const [goal,setGoal]=useState<OverseasCategory>(()=>{const v=new URLSearchParams(location.search).get('goal');return v==='study'||v==='residence'||v==='experience'?v:'work';});
 const [offer,setOffer]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(savedKey,JSON.stringify(saved));}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem(compareKey,JSON.stringify(compared));}catch{}},[compared]);
 const toggleSave=(id:string)=>setSaved(xs=>xs.includes(id)?xs.filter(x=>x!==id):[...xs,id]);
 const toggleCompare=(id:string)=>setCompared(xs=>xs.includes(id)?xs.filter(x=>x!==id):xs.length>=3?xs:[...xs,id]);
 const filtered=useMemo(()=>usPathways.filter(p=>(filter==='all'||p.category===filter)&&[p.name,p.english,p.summary,p.audience,...p.highlights].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[filter,query]);
 const detail=pathwayId?usPathways.find(p=>p.id===pathwayId):undefined;
 const matches=useMemo(()=>usPathways.filter(p=>p.category===goal&&(offer!=='no'||!employerRequired.has(p.id))),[goal,offer]);
 const photo=overseasCountryPhotos.us;
 const crumbs=(name?:string)=><nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link><span>/ <Link to={country}>美国</Link></span>{name&&<span>/ <strong>{name}</strong></span>}</nav>;
 const card=(p:UsPathway)=><article key={p.id} className="hhba-overseas-path-card">
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span></div>
  <h3><Link to={pathwayLink(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(tag=><span key={tag}>{tag}</span>)}</div>
  <div className="hhba-overseas-path-actions">
   <Link className="hhba-overseas-path-main" to={pathwayLink(p.id)}>查看完整方案 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>toggleSave(p.id)} aria-label={(saved.includes(p.id)?'取消收藏 ':'收藏 ')+p.name}>{saved.includes(p.id)?<BookmarkCheck size={18}/>:<Bookmark size={18}/>}</button>
   <button type="button" onClick={()=>toggleCompare(p.id)} aria-pressed={compared.includes(p.id)} aria-label={(compared.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={18}/></button>
  </div>
 </article>;
 const disclaimer=<div className="hhba-overseas-disclaimer"><ShieldCheck size={19}/><div><strong>美国政府官方资料优先 · {usVerifiedOn}政策核查</strong><p>HHBA只提供可追溯的规则和申请准备指南，不是移民律师或签证代理；签证、工作授权、录取、身份调整与绿卡均由有权机关决定。2026年美国H-1B与移民法规变化频繁，申请当日必须再次查阅USCIS、美国国务院、DHS和DOL的官方原文。</p></div></div>;
 return <Shell user={user}><div className="hhba-overseas" data-hhba-overseas-us={view}>
 {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
  {crumbs()}
  <header className="hhba-overseas-country-hero" style={{backgroundImage:"linear-gradient(90deg,#132b47f8 0%,#153959de 61%,#15395955 100%),url('"+import.meta.env.BASE_URL+"overseas/countries/us.webp')",backgroundPosition:'center'}}>
   <div><span className="hhba-overseas-kicker">UNITED STATES · OFFICIAL PATHWAYS</span><h1>🇺🇸 美国发展规划</h1>
    <p>留学、交流实习、CPT与OPT授权、H-1B和O-1专业就业、跨国企业派遣及EB类职业移民。每条都对应真实资格、申请步骤和官方来源。</p>
    <div className="hhba-overseas-country-summary"><span>{usPathways.length}条详细路径</span><span>{usVerifiedOn}资料核查</span><span>含2026年排期及政策警示</span></div>
    <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">纽约真实摄影 · {photo.credit} · {photo.license} <ExternalLink size={12}/></a>
   </div>
   <div className="hhba-overseas-kiwi" aria-hidden="true">US<span>美国</span></div>
  </header>
  <div className="hhba-overseas-utility"><Link to={root+'/united-states/match'}><SlidersHorizontal size={17}/> 按目标初筛</Link><Link to={root+'/united-states/saved'}><Bookmark size={17}/> 我的收藏（{saved.length}）</Link><Link to={root+'/united-states/compare'}><GitCompareArrows size={17}/> 方案对比（{compared.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 大学留学资料</Link></div>
  <section className="hhba-overseas-section">
   <div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">CHOOSE YOUR ROUTE</span><h2>美国真正有哪些合法发展路线？</h2><p>签证、实践训练授权与绿卡移民分类都清楚标示；既不出售岗位，也不会把移民申请获批写成已经获发绿卡。</p></div></div>
   <div className="hhba-overseas-filter-bar"><label className="hhba-overseas-search"><Search size={18}/><input aria-label="搜索美国发展方案" placeholder="搜索：F-1、OPT、H-1B、O-1、NIW、EB-5…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(x=><button type="button" key={x.id} className={filter===x.id?'is-active':''} aria-pressed={filter===x.id} onClick={()=>setFilter(x.id)}>{x.name}</button>)}</div></div>
   <div className="hhba-overseas-path-grid">{filtered.map(card)}</div>
   {!filtered.length&&<div className="hhba-overseas-empty"><Search size={23}/><h3>没有找到相应方案</h3><p>调整关键词或分类后重新浏览。</p><button type="button" onClick={()=>{setQuery('');setFilter('all');}}>清除筛选</button></div>}
  </section>
  <section className="hhba-overseas-section">
   <div className="hhba-overseas-section-head"><div><h2>申请之前，必须知道的美国政策误区</h2><p>每条都保留政府原文入口。请以当日实际适用法规为准。</p></div></div>
   {usNotEligible.map(p=><div className="hhba-overseas-inline-alert" key={p.title}><Info size={19}/><div><strong>{p.title}</strong><p>{p.detail} <a href={p.url} target="_blank" rel="noopener noreferrer">查看官方依据 <ExternalLink size={13}/></a></p></div></div>)}
  </section>
  <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><h2>美国官方信息查询入口</h2><p>优先政府信息；商业中介网站不能取代美国政府的申请规则。</p></div></div>
   <ul>{usQuickSources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} <ExternalLink size={13}/></a></li>)}</ul>
  </section>{disclaimer}
 </main>}
 {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content hhba-overseas-reader-page">
  {detail?<>{crumbs(detail.name)}
   <header className="hhba-overseas-pathway-head"><div className="hhba-overseas-eyebrow">{overseasCategoryLabels[detail.category]} · 美国 · {usVerifiedOn}</div><h1>{detail.name}</h1><p className="hhba-overseas-eng">{detail.english}</p><p>{detail.summary}</p></header>
   <div className="hhba-overseas-reader-actions"><a href={detail.officialUrl} target="_blank" rel="noopener noreferrer" className="hhba-overseas-reader-official">查看美国政府原文 <ExternalLink size={15}/></a><button type="button" onClick={()=>toggleSave(detail.id)}>{saved.includes(detail.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>} {saved.includes(detail.id)?'已收藏':'收藏'}</button><button type="button" onClick={()=>toggleCompare(detail.id)}><GitCompareArrows size={17}/> {compared.includes(detail.id)?'已加入对比':'加入对比'}</button><span className="hhba-overseas-reader-note">收藏、对比仅存当前浏览器</span></div>
   <section className="hhba-overseas-section"><h2>开始之前 · 先读懂这条路线</h2><p>{detail.audience}</p><p><strong>第一步要做：</strong>{detail.steps[0]}</p></section>
   <nav className="hhba-overseas-utility" aria-label="申请指南目录">{sections.map(x=><a href={'#us-guide-'+x.key} key={x.key}>{x.title.slice(0,2)} {x.title.split('｜')[1]}</a>)}<a href="#us-guide-faq">09 常见问题</a><a href="#us-guide-sources">10 官方来源</a></nav>
   {sections.map(s=><section className="hhba-overseas-section" id={'us-guide-'+s.key} key={s.key}><div className="hhba-overseas-section-head"><div><h2>{s.title}</h2><p>{s.intro}</p></div></div><ol>{detail[s.key].map((item,i)=><li key={i} style={{marginBottom:14,lineHeight:1.85}}>{item}</li>)}</ol></section>)}
   <section className="hhba-overseas-section" id="us-guide-faq"><h2>09｜常见问题 · 与本方案直接相关</h2><dl>{detail.faq.map(x=><div key={x.question} style={{marginBottom:20}}><dt><strong>{x.question}</strong></dt><dd style={{lineHeight:1.85,marginTop:7,marginLeft:0}}>{x.answer}</dd></div>)}</dl></section>
   <section className="hhba-overseas-section" id="us-guide-sources"><h2>10｜官方参考资料与核验日期</h2><p>本站于{usVerifiedOn}整理此方案，费用、签证窗口、裁决和排期可能改变，务必在正式申请时重新打开以下官方入口核对。</p><ul>{detail.sources.map(s=><li key={s.url} style={{marginBottom:15}}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label} <ExternalLink size={14}/></a><p>{s.purpose}</p></li>)}</ul></section>{disclaimer}
  </>:<>{crumbs('未找到方案')}<div className="hhba-overseas-empty"><h2>未找到该美国方案</h2><Link to={country}>返回美国全部方案 <ArrowRight size={16}/></Link></div></>}
 </main>}
 {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content">{crumbs('我的收藏')}<h1>美国路线收藏</h1><p>收藏仅保存在当前浏览器中，不代表已自动评估个人资格。</p><div className="hhba-overseas-path-grid">{usPathways.filter(p=>saved.includes(p.id)).map(card)}</div>{!saved.length&&<p>还没有收藏。<Link to={country}>浏览美国全部路径</Link></p>}{disclaimer}</main>}
 {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content">{crumbs('方案对比')}<h1>美国路线对比 · 最多3条</h1><p>签证、工作授权与职业移民属于不同法律类型，不宜只凭成本高低决定。</p><div className="hhba-overseas-compare-grid">{usPathways.filter(p=>compared.includes(p.id)).map(p=><article className="hhba-overseas-compare-card" key={p.id}><h2>{p.name}</h2><p>{p.summary}</p><h3>资格门槛</h3><ul>{p.requirements.slice(0,3).map(v=><li key={v}>{v}</li>)}</ul><h3>费用与风险</h3><ul>{[...p.fees.slice(0,2),...p.risks.slice(0,1)].map(v=><li key={v}>{v}</li>)}</ul><Link to={pathwayLink(p.id)}>完整申请说明 <ArrowRight size={16}/></Link><button type="button" onClick={()=>toggleCompare(p.id)} aria-label={'移除 '+p.name}>移出对比</button></article>)}</div>{!compared.length&&<p>尚未选择方案。<Link to={country}>先浏览全部路径</Link></p>}{disclaimer}</main>}
 {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content">{crumbs('目标筛选')}<header className="hhba-overseas-match-head"><h1>先从你的出国目标筛选美国路线</h1><p>仅为路线信息检索，不是签证、工作许可或移民获批率测算。</p></header><div className="hhba-overseas-match-layout"><div className="hhba-overseas-match-filters"><h2>第一步：你希望做什么？</h2><div className="hhba-overseas-match-options">{Object.entries(overseasCategoryLabels).map(([key,name])=><button type="button" key={key} onClick={()=>setGoal(key as OverseasCategory)} className={goal===key?'is-active':''}>{name}</button>)}</div><h2>第二步：已有真实美国雇主/项目支持吗？</h2><div className="hhba-overseas-match-options">{([{id:'yes',name:'有'},{id:'no',name:'没有'},{id:'unsure',name:'暂不确定'}] as const).map(x=><button type="button" key={x.id} className={offer===x.id?'is-active':''} onClick={()=>setOffer(x.id)}>{x.name}</button>)}</div><p>选择没有时会排除部分必须由美国雇主发起的类别，但仍须查核院校、项目、学历、身份及职业的全部条件。</p></div><div className="hhba-overseas-match-results"><h2>可进一步核查（{matches.length}条）</h2>{matches.map(p=><Link key={p.id} to={pathwayLink(p.id)} className="hhba-overseas-match-result"><strong>{p.name}</strong><small>{p.summary}</small><ArrowRight size={16}/></Link>)}{!matches.length&&<p>暂无匹配的初筛路线。<Link to={country}>返回全部美国方案</Link></p>}</div></div>{disclaimer}</main>}
 </div></Shell>;
}
