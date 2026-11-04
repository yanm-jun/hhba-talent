import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Bookmark,BookmarkCheck,BriefcaseBusiness,CheckCircle2,Compass,ExternalLink,Globe2,GraduationCap,House,Info,Plane,Search,ShieldCheck,SlidersHorizontal,Wallet,AlertTriangle,GitCompareArrows,BookOpen,MapPinned} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {nzPathways,nzVerifiedOn,overseasCategoryLabels,overseasCountryOptions,type OverseasCategory,type OverseasPathway} from '../data/overseasNewZealand';
import {overseasCountryPhotos} from '../data/overseasCountryPhotos';
import {OverseasDetailedGuide} from '../components/OverseasDetailedGuide';
import {nzCompleteGuidesV2} from '../data/overseasNzGuidesV2';
import '../styles/overseas-development.css';

type View='home'|'country'|'pathway'|'saved'|'compare'|'match';
const root='/study-abroad';
const countryLink=root+'/country/new-zealand';
const pathname=(id:string)=>root+'/pathway/'+id;
const storedBookmarks='hhba.overseas.bookmarks.local.v1';
const storedCompare='hhba.overseas.compare.local.v1';
function readIds(key:string){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x.filter((id:unknown)=>typeof id==='string'&&nzPathways.some(p=>p.id===id)):[] as string[];}catch{return [] as string[];}}
function CategoryIcon({category}:{category:OverseasCategory}){
 const Icon=category==='work'?BriefcaseBusiness:category==='residence'?House:category==='study'?GraduationCap:Plane;
 return <Icon size={22} strokeWidth={1.8}/>;
}
function Breadcrumb({items}:{items:{title:string;to?:string}[]}){
 return <nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link>{items.map((x,i)=><span key={i}><span aria-hidden="true">/</span>{x.to?<Link to={x.to}>{x.title}</Link>:<strong>{x.title}</strong>}</span>)}</nav>;
}
function Disclaimer(){return <div className="hhba-overseas-disclaimer"><ShieldCheck size={19}/><div><strong>政府官方来源优先 · 不承诺获签</strong><p>页面按 2026-11-04 可公开核实的官方说明整理。资格、签证费用、开放状态及申请规则可能变动，提交前请再次核对官方原文。HHBA 不是签证代理机构。</p></div></div>;}
function Block({title,items}:{title:string;items:string[]}){return <section className="hhba-overseas-detail-block"><h2>{title}</h2><ol>{items.map((line,i)=><li key={i}>{line}</li>)}</ol></section>;}
export function OverseasDevelopmentPage({user,view='home',pathwayId}:{user:User|null;view?:View;pathwayId?:string}){
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState<'all'|OverseasCategory>('all');
 const [bookmarks,setBookmarks]=useState<string[]>(()=>readIds(storedBookmarks));
 const [comparison,setComparison]=useState<string[]>(()=>readIds(storedCompare));
 const [matchGoal,setMatchGoal]=useState<'work'|'study'|'residence'|'experience'>(()=>{const goal=new URLSearchParams(location.search).get('goal');return goal==='study'||goal==='residence'||goal==='experience'?goal:'work';});
 const [matchOffer,setMatchOffer]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(storedBookmarks,JSON.stringify(bookmarks));}catch{}},[bookmarks]);
 useEffect(()=>{try{localStorage.setItem(storedCompare,JSON.stringify(comparison));}catch{}},[comparison]);
 const toggleBookmark=(id:string)=>setBookmarks(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const toggleComparison=(id:string)=>setComparison(old=>old.includes(id)?old.filter(x=>x!==id):old.length>=3?old:[...old,id]);
 const results=useMemo(()=>nzPathways.filter(p=>(category==='all'||p.category===category)&&[p.name,p.english,p.summary,p.audience,...p.highlights].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())),[category,search]);
 const matches=useMemo(()=>nzPathways.filter(p=>p.category===matchGoal).filter(p=>matchOffer!=='no'||!['nz-aewv','nz-green-tier1','nz-green-tier2','nz-smc'].includes(p.id)),[matchGoal,matchOffer]);
 const chosen=pathwayId?nzPathways.find(p=>p.id===pathwayId):undefined;
 const featured=(p:OverseasPathway)=><article className="hhba-overseas-path-card" key={p.id}>
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-icon"><CategoryIcon category={p.category}/></span><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span>{p.availability==='closed'&&<span className="hhba-overseas-closed">官方当前关闭</span>}</div>
  <h3><Link to={pathname(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(tag=><span key={tag}>{tag}</span>)}</div>
  <div className="hhba-overseas-path-actions">
   <Link to={pathname(p.id)} className="hhba-overseas-path-main">查看完整方案 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>toggleBookmark(p.id)} aria-label={bookmarks.includes(p.id)?'取消收藏 '+p.name:'收藏 '+p.name} title={bookmarks.includes(p.id)?'取消收藏':'收藏此方案'}>{bookmarks.includes(p.id)?<BookmarkCheck size={18}/>:<Bookmark size={18}/>}</button>
   <button type="button" onClick={()=>toggleComparison(p.id)} aria-pressed={comparison.includes(p.id)} title={comparison.includes(p.id)?'移出对比':'加入对比（最多3条）'} aria-label={(comparison.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={18}/></button>
  </div>
 </article>;
 return <Shell user={user}>
  <div className="hhba-overseas" data-hhba-overseas={view}>
   {view==='home'&&<>
    <header className="hhba-overseas-hero"><div className="hhba-overseas-container">
     <div className="hhba-overseas-eyebrow"><Globe2 size={15}/> HHBA · GLOBAL OPPORTUNITIES</div>
     <h1>你的下一站，<br/><em>可以是更广阔的世界。</em></h1>
     <p>不止留学。探索各国合法的海外工作、职业发展、学习与居留路径，从自己的目标出发，找到可核实的行动方案。</p>
     <div className="hhba-overseas-hero-actions"><Link to={countryLink} className="hhba-overseas-primary">探索新西兰 <ArrowRight size={17}/></Link><Link to={root+'/country/australia'} className="hhba-overseas-outline">探索澳大利亚 <ArrowRight size={17}/></Link><Link to={root+'/match'} className="hhba-overseas-outline">按目标初步筛选 <Compass size={17}/></Link></div>
     <div className="hhba-overseas-hero-meta"><span><CheckCircle2 size={15}/> 官方政策来源</span><span><CheckCircle2 size={15}/> 申请门槛透明</span><span><CheckCircle2 size={15}/> 不保证获签</span></div>
    </div><div className="hhba-overseas-hero-credit"><a className="hhba-overseas-photo-credit" target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:The_Remarkables_from_Queenstown,_New_Zealand_04.jpg">实景摄影：Σ64 · CC BY 4.0 · Wikimedia Commons <ExternalLink size={12}/></a></div><div className="hhba-overseas-hero-globe" aria-hidden="true"><div className="hhba-overseas-orbit">✦</div><span>NZ</span></div></header>
    <main className="hhba-overseas-container hhba-overseas-home-main">
     <section className="hhba-overseas-section" aria-labelledby="hhba-overseas-countries">
      <div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">EXPLORE DESTINATIONS</span><h2 id="hhba-overseas-countries">探索国家与地区</h2><p>逐国开发、逐条核实。资料未完成的国家不会伪装成可申请方案。</p></div></div>
      <div className="hhba-overseas-country-grid">{overseasCountryOptions.map(c=><article className={'hhba-overseas-country-card hhba-overseas-country-'+c.code} key={c.code}>
       <div className="hhba-overseas-country-banner">
        <img className="hhba-overseas-country-photo"
          src={import.meta.env.BASE_URL+'overseas/countries/'+overseasCountryPhotos[c.code].file}
          alt={overseasCountryPhotos[c.code].alt}
          width={960} height={384} loading="lazy" decoding="async"
          style={{objectPosition:overseasCountryPhotos[c.code].position}}/>
        <a className="hhba-overseas-photo-attribution" href={overseasCountryPhotos[c.code].sourceUrl}
          target="_blank" rel="noopener noreferrer"
          title={overseasCountryPhotos[c.code].credit+' · '+overseasCountryPhotos[c.code].license+' · 照片已为网页裁切'}
          aria-label={c.name+'照片来源：'+overseasCountryPhotos[c.code].credit+'，'+overseasCountryPhotos[c.code].license}>
          <span aria-hidden="true">©</span> {overseasCountryPhotos[c.code].credit} · {overseasCountryPhotos[c.code].license}
        </a>
        <span className="hhba-overseas-country-status">{c.ready?'国家方案已收录':'规划中'}</span>
       </div>
       <div className="hhba-overseas-country-copy"><small>{c.region} · {c.english}</small><h3>{c.name}</h3><p>{c.description}</p>{c.ready?<Link to={c.code==='nz'?countryLink:c.code==='au'?root+'/country/australia':c.code==='jp'?root+'/country/japan':c.code==='de'?root+'/country/germany':c.code==='ca'?root+'/country/canada':root}>探索全部方案 <ArrowRight size={16}/></Link>:<span className="hhba-overseas-country-pending">资料开发中 · 暂不开放</span>}</div>
      </article>)}</div>
     </section>
     <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">CHOOSE YOUR PATH</span><h2>不确定去哪里？先从目标出发</h2><p>先看有哪些可研究的合法方案，再核对个人具体资格。</p></div></div>
      <div className="hhba-overseas-goal-grid">{[{name:'海外工作',desc:'找到适用的雇主支持和就业路径',icon:<BriefcaseBusiness/>,goal:'work'},{name:'留学深造',desc:'比较课程与学生签证要求',icon:<GraduationCap/>,goal:'study'},{name:'长期居留',desc:'梳理技能和居留资格门槛',icon:<House/>,goal:'residence'},{name:'工作与旅行',desc:'了解短期工作及打工度假项目',icon:<Plane/>,goal:'experience'}].map(item=><Link to={root+'/match?goal='+item.goal} key={item.goal} onClick={()=>setMatchGoal(item.goal as OverseasCategory)} className="hhba-overseas-goal-card"><span>{item.icon}</span><strong>{item.name}</strong><small>{item.desc}</small><ArrowUpRight size={17}/></Link>)}</div>
     </section>
     <section className="hhba-overseas-extras"><div><span className="hhba-overseas-kicker">EXISTING STUDY RESOURCES</span><h2>原有大学与专业资料继续保留</h2><p>已开发的大学、专业及课程资源将保留在留学资料库中，作为海外发展模块的教育资源。</p></div><Link to={root+'/legacy'} className="hhba-overseas-outline">查看原留学资料 <ArrowRight size={16}/></Link></section>
     <Disclaimer/>
    </main>
   </>}
   {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
    <Breadcrumb items={[{title:'新西兰'}]}/>
    <div className="hhba-overseas-country-hero"><div><span className="hhba-overseas-kicker">NEW ZEALAND · OFFICIAL PATHWAYS</span><h1>🇳🇿 新西兰发展规划</h1><p>从就业、绿名单相关居留、留学到短期打工度假，选择符合自己条件的合法路径。绿名单是职业分类，不是单独的签证。</p><div className="hhba-overseas-country-summary"><span>{nzPathways.length} 条已整理方案</span><span>2026-11-04 官方资料核验</span></div><a className="hhba-overseas-photo-credit" target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:The_Remarkables_from_Queenstown,_New_Zealand_04.jpg">实景摄影：Σ64 · CC BY 4.0 · Wikimedia Commons <ExternalLink size={12}/></a></div><div className="hhba-overseas-kiwi" aria-hidden="true">NZ<span>新西兰</span></div></div>
    <div className="hhba-overseas-utility"><Link to={root+'/match'}><SlidersHorizontal size={17}/> 目标筛选</Link><Link to={root+'/saved'}><Bookmark size={17}/> 我的收藏（{bookmarks.length}）</Link><Link to={root+'/compare'}><GitCompareArrows size={17}/> 方案对比（{comparison.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 留学资料库</Link></div>
    <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><h2>选择赴新西兰方案</h2><p>按出国目标分类，所有方案均有申请条件、材料、流程、限制和官方来源。</p></div></div>
     <div className="hhba-overseas-filter-bar"><div className="hhba-overseas-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="搜索新西兰方案" placeholder="搜索签证、职业、条件或关键词"/></div><div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(item=><button type="button" key={item.id} className={category===item.id?'is-active':''} aria-pressed={category===item.id} onClick={()=>setCategory(item.id)}>{item.name}</button>)}</div></div>
     <div className="hhba-overseas-path-grid">{results.map(featured)}</div>{!results.length&&<div className="hhba-overseas-empty"><Search size={24}/><h3>没有找到匹配的路径</h3><p>更换关键词或查看全部方案。</p><button type="button" onClick={()=>{setCategory('all');setSearch('');}}>清除筛选</button></div>}
    </section>
    <div className="hhba-overseas-inline-alert"><Info size={19}/><p>中国公民打工度假签证在核验时处于关闭状态，开放时间须以新西兰移民局为准。本站不提供所谓“抢名额”收费服务。</p></div><Disclaimer/>
   </main>}
   {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content hhba-overseas-reader-page">
    {chosen?<><Breadcrumb items={[{title:'新西兰',to:countryLink},{title:chosen.name}]}/>
     <header className="hhba-overseas-pathway-head">
      <div className="hhba-overseas-eyebrow">{overseasCategoryLabels[chosen.category]} · 新西兰 · {nzVerifiedOn} 核验</div>
      <h1>{chosen.name}</h1>
      <p className="hhba-overseas-eng">{chosen.english}</p>
      <p>{chosen.summary}</p>
      {chosen.availability==='closed'&&<p className="hhba-overseas-reader-closed">当前官方关闭申请；请核实最新开放状态。</p>}
     </header>
     <div className="hhba-overseas-reader-actions">
      <a href={chosen.officialUrl} target="_blank" rel="noopener noreferrer" className="hhba-overseas-reader-official">
       {chosen.availability==='closed'?'查看官方开放状态':'查看移民局官方说明'} <ExternalLink size={15}/>
      </a>
      <button type="button" onClick={()=>toggleBookmark(chosen.id)} aria-label={bookmarks.includes(chosen.id)?'取消收藏此方案':'收藏此方案'}>
       {bookmarks.includes(chosen.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}
       {bookmarks.includes(chosen.id)?'已收藏':'收藏'}
      </button>
      <button type="button" onClick={()=>toggleComparison(chosen.id)} aria-pressed={comparison.includes(chosen.id)}>
       <GitCompareArrows size={17}/>{comparison.includes(chosen.id)?'已加入对比':'加入对比'}
      </button>
      <span className="hhba-overseas-reader-note">收藏与对比仅保存在当前浏览器</span>
     </div>
     <OverseasDetailedGuide key={chosen.id} pathway={chosen} guide={nzCompleteGuidesV2[chosen.id]}/>
     <p className="hhba-overseas-reader-related">还想了解新西兰的大学和课程？
      <Link to={root+'/legacy'}>打开原留学资料库 <ArrowRight size={14}/></Link>
     </p>
    </>:<><Breadcrumb items={[{title:'新西兰',to:countryLink},{title:'方案不存在'}]}/><div className="hhba-overseas-empty"><h1>未找到此方案</h1><Link to={countryLink}>返回新西兰全部方案 <ArrowRight size={16}/></Link></div></>}
   </main>}
   {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content"><Breadcrumb items={[{title:'我的海外收藏'}]}/><div className="hhba-overseas-section-head"><div><h1>我的海外收藏</h1><p>这里仅展示当前浏览器收藏的新西兰方案；账户跨设备同步尚未接入。</p></div></div><div className="hhba-overseas-path-grid">{nzPathways.filter(p=>bookmarks.includes(p.id)).map(featured)}</div>{!bookmarks.length&&<div className="hhba-overseas-empty"><Bookmark size={26}/><h2>还没有收藏方案</h2><Link to={countryLink}>浏览新西兰路径 <ArrowRight size={16}/></Link></div>}</main>}
   {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content"><Breadcrumb items={[{title:'方案对比'}]}/><div className="hhba-overseas-section-head"><div><h1>方案对比</h1><p>最多并排对比3条方案。不同类别适用资格并不直接等同，不能仅用费用判断难易。</p></div><Link to={countryLink}>返回全部方案 <ArrowRight size={16}/></Link></div><div className="hhba-overseas-compare-grid">{nzPathways.filter(p=>comparison.includes(p.id)).map(p=><article key={p.id} className="hhba-overseas-compare-card"><div className="hhba-overseas-compare-heading"><h2>{p.name}</h2><button type="button" onClick={()=>toggleComparison(p.id)} aria-label={'移出 '+p.name}>移除</button></div><p>{p.summary}</p><h3>适用人群</h3><p>{p.audience}</p><h3>核心门槛</h3><ul>{p.requirement.slice(0,3).map(x=><li key={x}>{x}</li>)}</ul><h3>预算说明</h3><ul>{p.fees.slice(0,2).map(x=><li key={x}>{x}</li>)}</ul><Link to={pathname(p.id)}>完整申请指南 <ArrowRight size={16}/></Link></article>)}</div>{!comparison.length&&<div className="hhba-overseas-empty"><GitCompareArrows size={26}/><h2>尚未加入比较方案</h2><Link to={countryLink}>先选择需要比较的方案 <ArrowRight size={16}/></Link></div>}<Disclaimer/></main>}
   {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content"><Breadcrumb items={[{title:'目标筛选'}]}/><header className="hhba-overseas-match-head"><span className="hhba-overseas-kicker">FIND YOUR DIRECTION</span><h1>从你的目标出发，先排查可能的路线</h1><p>这是基于已核验路线类别的初步筛选，不是个人签证资格评估，也不会上传或保存个人敏感资料。当前仅覆盖新西兰。</p></header>
    <div className="hhba-overseas-match-layout"><div className="hhba-overseas-match-filters"><h2>第一步：你希望实现什么？</h2><div className="hhba-overseas-match-options">{(Object.entries(overseasCategoryLabels) as [OverseasCategory,string][]).map(([id,name])=><button type="button" className={matchGoal===id?'is-active':''} key={id} onClick={()=>setMatchGoal(id)}>{name}</button>)}</div><h2>第二步：已经有新西兰的工作邀请吗？</h2><div className="hhba-overseas-match-options">{[{id:'yes',name:'有真实工作邀请'},{id:'no',name:'没有'},{id:'unsure',name:'暂不确定'}].map(x=><button type="button" key={x.id} className={matchOffer===x.id?'is-active':''} onClick={()=>setMatchOffer(x.id as 'yes'|'no'|'unsure')}>{x.name}</button>)}</div><div className="hhba-overseas-match-note"><Info size={18}/><p>此项仅作信息过滤。年龄、国籍、英语、学位、经验、职业注册、工资和资金条件都需要按官方逐项核验。</p></div></div><div className="hhba-overseas-match-results"><h2>可进一步核查的方向（{matches.length}）</h2>{matches.length?matches.map(p=><Link to={pathname(p.id)} key={p.id} className="hhba-overseas-match-result"><strong>{p.name}</strong><small>{p.summary}</small><ArrowRight size={17}/></Link>):<div className="hhba-overseas-empty"><p>在当前条件下暂未列出合适类别。可以修改目标或查看全部新西兰路径。</p><Link to={countryLink}>查看所有方案 <ArrowRight size={16}/></Link></div>}</div></div><Disclaimer/></main>}
  </div>
 </Shell>;
}
