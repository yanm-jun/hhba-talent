import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Bookmark,BookmarkCheck,BriefcaseBusiness,GraduationCap,House,Plane,Search,ShieldCheck,ExternalLink,GitCompareArrows,SlidersHorizontal,Info,AlertTriangle,Compass,BookOpen} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {auPathways,auVerifiedOn} from '../data/overseasAustralia';
import {overseasCategoryLabels,type OverseasCategory,type OverseasPathway} from '../data/overseasNewZealand';
import '../styles/overseas-development.css';
import '../styles/overseas-australia.css';
type View='country'|'pathway'|'saved'|'compare'|'match';
const root='/study-abroad';
const country=root+'/country/australia';
const pathway=(id:string)=>root+'/australia/pathway/'+id;
const storageSaved='hhba.overseas.australia.saved.v1';
const storageCompared='hhba.overseas.australia.compare.v1';
function readSelection(key:string):string[]{try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter((x:unknown):x is string=>typeof x==='string'&&auPathways.some(p=>p.id===x)):[];}catch{return []}}
function CategoryIcon({type}:{type:OverseasCategory}){const Icon=type==='work'?BriefcaseBusiness:type==='residence'?House:type==='study'?GraduationCap:Plane;return <Icon size={22}/>;}
function DocSection({heading,points,number}:{heading:string;points:string[];number:string}){return <section className="hhba-overseas-detail-block"><h2>{number} · {heading}</h2><ol>{points.map((point,i)=><li key={i}>{point}</li>)}</ol></section>;}
const license='https://commons.wikimedia.org/wiki/File:Sydney_Harbour_Bridge_and_Sydney_Opera_House_panorama.jpg';
function Credit(){return <a className="hhba-overseas-au-credit" href={license} target="_blank" rel="noopener noreferrer">悉尼真实摄影：Kgbo · CC BY-SA 4.0 <ExternalLink size={12}/></a>}
function Alert(){return <div className="hhba-overseas-disclaimer"><ShieldCheck size={18}/><div><strong>来源：澳大利亚内政部 · 最后核验 {auVerifiedOn}</strong><p>仅用于公开信息检索，不是移民法律意见。签证资格、职业清单、配额、费用和申请窗口均可能更新；提交前请再次核对官方原文。达到最低要求不保证获邀或获签。</p></div></div>;}
export function AustraliaDevelopmentPage({user,view='country',pathwayId}:{user:User|null;view?:View;pathwayId?:string}){
 const [filter,setFilter]=useState<'all'|OverseasCategory>('all');
 const [query,setQuery]=useState('');
 const [saved,setSaved]=useState<string[]>(()=>readSelection(storageSaved));
 const [compared,setCompared]=useState<string[]>(()=>readSelection(storageCompared));
 const [goal,setGoal]=useState<OverseasCategory>('work');
 const [hasOffer,setHasOffer]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(storageSaved,JSON.stringify(saved))}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem(storageCompared,JSON.stringify(compared))}catch{}},[compared]);
 const toggleSaved=(id:string)=>setSaved(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const toggleCompared=(id:string)=>setCompared(a=>a.includes(id)?a.filter(x=>x!==id):a.length>=3?a:[...a,id]);
 const paths=useMemo(()=>auPathways.filter(x=>(filter==='all'||x.category===filter)&&[x.name,x.english,x.summary,x.audience,...x.highlights].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[filter,query]);
 const matched=useMemo(()=>auPathways.filter(x=>x.category===goal&&(hasOffer!=='no'||!['au-482','au-186','au-494'].includes(x.id))),[goal,hasOffer]);
 const detail=pathwayId?auPathways.find(x=>x.id===pathwayId):undefined;
 const cards=(p:OverseasPathway)=><article className="hhba-overseas-path-card" key={p.id}>
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-icon"><CategoryIcon type={p.category}/></span><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span>{p.availability==='closed'&&<span className="hhba-overseas-closed">本年度登记已关闭</span>}</div>
  <h3><Link to={pathway(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(x=><span key={x}>{x}</span>)}</div>
  <div className="hhba-overseas-path-actions"><Link to={pathway(p.id)} className="hhba-overseas-path-main">查看完整方案 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>toggleSaved(p.id)} aria-label={(saved.includes(p.id)?'取消收藏 ':'收藏 ')+p.name}>{saved.includes(p.id)?<BookmarkCheck size={18}/>:<Bookmark size={18}/>}</button>
   <button type="button" onClick={()=>toggleCompared(p.id)} aria-pressed={compared.includes(p.id)} aria-label={(compared.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={18}/></button>
  </div>
 </article>;
 const crumb=(label:string)=><nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link><span>/ <Link to={country}>澳大利亚</Link></span>{label&&<span>/ <strong>{label}</strong></span>}</nav>;
 return <Shell user={user}><div className="hhba-overseas hhba-overseas-au" data-hhba-overseas-au={view}>
  {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
   {crumb('')}
   <header className="hhba-overseas-country-hero hhba-overseas-au-hero">
    <div><span className="hhba-overseas-kicker">AUSTRALIA · OFFICIAL IMMIGRATION PATHWAYS</span><h1>🇦🇺 澳大利亚发展规划</h1><p>按真正的移民签证类别寻找海外工作、技术移民、偏远地区就业、大学留学与短期旅行工作方案。不同签证之间并不自动互转。</p><div className="hhba-overseas-country-summary"><span>{auPathways.length} 条独立方案</span><span>{auVerifiedOn} 官方资料核验</span></div><Credit/></div>
    <div className="hhba-overseas-kiwi" aria-hidden="true">AU<span>澳大利亚</span></div>
   </header>
   <div className="hhba-overseas-utility"><Link to={root+'/australia/match'}><SlidersHorizontal size={17}/> 初步条件筛选</Link><Link to={root+'/australia/saved'}><Bookmark size={17}/> 我的收藏（{saved.length}）</Link><Link to={root+'/australia/compare'}><GitCompareArrows size={17}/> 方案对比（{compared.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 原大学资料库</Link></div>
   <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">CHOOSE YOUR VISA PATH</span><h2>可探索的赴澳方案</h2><p>每条路线均提供申请资格、证据材料、申请步骤、费用、签证权利及官方来源。</p></div></div>
    <div className="hhba-overseas-filter-bar"><div className="hhba-overseas-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索签证编号、职业、申请条件…" aria-label="搜索澳大利亚方案"/></div><div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(x=><button type="button" key={x.id} onClick={()=>setFilter(x.id)} aria-pressed={filter===x.id} className={filter===x.id?'is-active':''}>{x.name}</button>)}</div></div>
    <div className="hhba-overseas-path-grid">{paths.map(cards)}</div>{!paths.length&&<div className="hhba-overseas-empty"><Search/><h3>没有找到符合关键词的方案</h3><button type="button" onClick={()=>{setFilter('all');setQuery('')}}>清除筛选</button></div>}
   </section>
   <div className="hhba-overseas-inline-alert"><Info size={19}/><p><strong>中国公民 462 打工度假：</strong>2026—27 年度的首签抽签登记已经结束。只有本年度已成功登记且被抽中的用户，才可能根据通知要求提交申请。不要支付“保中签”费用。</p></div>
   <section className="hhba-overseas-extras"><div><h2>想比较新西兰和澳大利亚？</h2><p>两个国家具有不同的雇主、技术移民及留学制度。先分别查清真实资格，再选择适合的国家。</p></div><Link to={root+'/country/new-zealand'} className="hhba-overseas-outline">查看新西兰方案 <ArrowRight size={16}/></Link></section>
   <Alert/>
  </main>}
  {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content">
   {detail?<>{crumb(detail.name)}
    <header className="hhba-overseas-pathway-head"><div className="hhba-overseas-eyebrow"><CategoryIcon type={detail.category}/>{overseasCategoryLabels[detail.category]} · AUSTRALIA {auVerifiedOn}</div><h1>{detail.name}</h1><p className="hhba-overseas-eng">{detail.english}</p><p>{detail.summary}</p><div className="hhba-overseas-detail-tags">{detail.highlights.map(x=><span key={x}>{x}</span>)}{detail.availability==='closed'&&<span className="is-closed">登记已关闭</span>}</div></header>
    <div className="hhba-overseas-detail-layout"><div className="hhba-overseas-detail-main">
     <section className="hhba-overseas-detail-intro"><h2>什么人可能适合这条路线？</h2><p>{detail.audience}</p></section>
     <DocSection heading="申请资格和门槛" number="01" points={detail.requirement}/>
     <DocSection heading="证据与申请材料" number="02" points={detail.documents}/>
     <DocSection heading="从准备到递交" number="03" points={detail.steps}/>
     <DocSection heading="真实费用与预算" number="04" points={detail.fees}/>
     <DocSection heading="获签后有哪些权利" number="05" points={detail.rights}/>
     <section className="hhba-overseas-detail-block hhba-overseas-warning"><h2><AlertTriangle size={20}/> 需要格外注意</h2><ul>{detail.risks.map((x,i)=><li key={i}>{x}</li>)}</ul></section>
     <div className="hhba-overseas-study-follow"><h2>准备通过大学留学赴澳？</h2><p>我们保留了原来开发的澳大利亚真实大学与课程信息，但大学录取不代表毕业工签或永居资格。</p><Link to={root+'/legacy'}>进入原大学资料库 <ArrowRight size={16}/></Link></div>
    </div><aside className="hhba-overseas-detail-aside"><div className="hhba-overseas-aside-card"><span className="hhba-overseas-kicker">OFFICIAL SOURCE</span><h2>澳大利亚内政部</h2><p>最后核验：{auVerifiedOn}</p><p>官方是最终申请入口。签证类别、受邀时间和费用请在正式递交前再次核对。</p>
     <a className="hhba-overseas-primary" href={detail.availability==='closed'?(detail.secondaryUrl||detail.officialUrl):detail.officialUrl} target="_blank" rel="noopener noreferrer">{detail.availability==='closed'?'查看抽签登记状态':'查看官方签证说明'} <ExternalLink size={16}/></a>
     {detail.secondaryUrl&&<a className="hhba-overseas-aside-link" href={detail.secondaryUrl} target="_blank" rel="noopener noreferrer">相关官方政策与补充规则 <ExternalLink size={15}/></a>}
     <button type="button" onClick={()=>toggleSaved(detail.id)}>{saved.includes(detail.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>} {saved.includes(detail.id)?'已收藏 · 点击取消':'收藏此签证路径'}</button>
     <button type="button" onClick={()=>toggleCompared(detail.id)}><GitCompareArrows size={17}/>{compared.includes(detail.id)?'已加入对比 · 点击移除':'加入对比（最多3项）'}</button>
     <small>当前收藏和对比仅在本机浏览器保存，不代表已经接入 HHBA 账号系统。</small></div></aside>
    </div><Alert/>
   </>:<>{crumb('未找到方案')}<div className="hhba-overseas-empty"><h1>未找到此签证方案</h1><Link to={country}>返回澳大利亚全部方案 <ArrowRight size={16}/></Link></div></>}
  </main>}
  {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('我的收藏')}<div className="hhba-overseas-section-head"><div><h1>已收藏的澳大利亚方案</h1><p>存储在当前浏览器。跨设备同步尚未实现。</p></div></div><div className="hhba-overseas-path-grid">{auPathways.filter(x=>saved.includes(x.id)).map(cards)}</div>{!saved.length&&<div className="hhba-overseas-empty"><Bookmark size={24}/><h2>你还没有收藏澳大利亚方案</h2><Link to={country}>探索全部方案 <ArrowRight size={16}/></Link></div>}</main>}
  {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('方案对比')}<div className="hhba-overseas-section-head"><div><h1>澳大利亚方案对比</h1><p>最多比较3条签证路径，核对工作、移民与留学的不同资格。</p></div><Link to={country}>返回全部方案 <ArrowRight size={16}/></Link></div><div className="hhba-overseas-compare-grid">{auPathways.filter(x=>compared.includes(x.id)).map(p=><article key={p.id} className="hhba-overseas-compare-card"><div className="hhba-overseas-compare-heading"><h2>{p.name}</h2><button type="button" onClick={()=>toggleCompared(p.id)}>移除</button></div><p>{p.summary}</p><h3>适用对象</h3><p>{p.audience}</p><h3>核心门槛</h3><ul>{p.requirement.slice(0,3).map(x=><li key={x}>{x}</li>)}</ul><h3>费用</h3><ul>{p.fees.map(x=><li key={x}>{x}</li>)}</ul><Link to={pathway(p.id)}>完整申请指南 <ArrowRight size={16}/></Link></article>)}</div>{!compared.length&&<div className="hhba-overseas-empty"><GitCompareArrows/><h2>还没有选择要比较的签证</h2><Link to={country}>去添加方案 <ArrowRight size={16}/></Link></div>}<Alert/></main>}
  {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('目标筛选')}<header className="hhba-overseas-match-head"><span className="hhba-overseas-kicker"><Compass size={15}/> BEGIN YOUR JOURNEY</span><h1>按照目标初步筛选澳大利亚方案</h1><p>当前是类别筛选，不是法律资格测算；英语、学历、年龄、雇主、职业清单、资金等条件仍需逐项由官方认定。</p></header>
   <div className="hhba-overseas-match-layout"><section className="hhba-overseas-match-filters"><h2>第一步 · 主要出国目标</h2><div className="hhba-overseas-match-options">{(Object.entries(overseasCategoryLabels) as [OverseasCategory,string][]).map(([id,name])=><button type="button" key={id} onClick={()=>setGoal(id)} className={goal===id?'is-active':''}>{name}</button>)}</div><h2>第二步 · 是否有澳洲雇主的真实工作提名？</h2><div className="hhba-overseas-match-options">{[{id:'yes',name:'已有'},{id:'no',name:'没有'},{id:'unsure',name:'还不确定'}].map(x=><button type="button" key={x.id} className={hasOffer===x.id?'is-active':''} onClick={()=>setHasOffer(x.id as 'yes'|'no'|'unsure')}>{x.name}</button>)}</div><div className="hhba-overseas-match-note"><Info size={18}/><p>尚无雇主提名时隐藏482、186、494只是信息分组，不意味满足其他签证要求。某些类别也可能需要其他提名、邀请或签证历史。</p></div></section>
    <section className="hhba-overseas-match-results"><h2>可进一步核对的路线（{matched.length}）</h2>{matched.map(x=><Link to={pathway(x.id)} className="hhba-overseas-match-result" key={x.id}><strong>{x.name}</strong><small>{x.summary}</small><ArrowRight size={17}/></Link>)}{!matched.length&&<p>当前条件下没有直接匹配的类别。可以切换目标或浏览全部签证。</p>}</section></div><Alert/>
  </main>}
 </div></Shell>;
}
