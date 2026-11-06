import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Bookmark,BookmarkCheck,BookOpen,BriefcaseBusiness,Compass,ExternalLink,GitCompareArrows,GraduationCap,House,Info,Plane,Search,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {ukVerifiedOn,ukOfficial,ukPathways} from '../data/overseasUK';
import {ukCompleteGuides} from '../data/overseasUKGuides';
import {OverseasDetailedGuide} from '../components/OverseasDetailedGuide';
import {overseasCategoryLabels,type OverseasCategory,type OverseasPathway} from '../data/overseasNewZealand';
import '../styles/overseas-development.css';
import '../styles/overseas-uk.css';

type View='country'|'pathway'|'saved'|'compare'|'match';
const root='/study-abroad',country=root+'/country/united-kingdom';
const routeFor=(id:string)=>root+'/uk/pathway/'+id;
const favoriteKey='hhba.overseas.uk.favourites.v1',compareKey='hhba.overseas.uk.compare.v1';
const introPhoto='https://commons.wikimedia.org/wiki/File:Westminster_Palace_and_Big_Ben.jpg';
function savedItems(key:string):string[]{try{const ids=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(ids)?ids.filter((x:unknown):x is string=>typeof x==='string'&&ukPathways.some(p=>p.id===x)):[];}catch{return[];}}
function CategoryIcon({cat}:{cat:OverseasCategory}){const I=cat==='work'?BriefcaseBusiness:cat==='residence'?House:cat==='study'?GraduationCap:Plane;return <I size={19}/>;}
function RegulatoryNote(){return <div className="hhba-overseas-disclaimer"><ShieldCheck size={19}/><div><strong>英国内政部与UKVI官方签证政策 · {ukVerifiedOn}核验</strong><p>特别提醒：2026新Skilled Worker一般工资门槛£41,700与SOC标准取高、首次申请英语B2；2025年7月起海外护理员新担保关闭；2027年Graduate一般缩为18个月；YMS不接受中国大陆普通护照申请。官方规则会更新，本站不保证签证或工作结果。</p></div></div>;}
export function UKDevelopmentPage({user,view='country',pathwayId}:{user:User|null;view?:View;pathwayId?:string}){
 const [filter,setFilter]=useState<'all'|OverseasCategory>('all'),[term,setTerm]=useState('');
 const [saved,setSaved]=useState<string[]>(()=>savedItems(favoriteKey));
 const [compared,setCompared]=useState<string[]>(()=>savedItems(compareKey));
 const [goal,setGoal]=useState<OverseasCategory>('work');
 const [job,setJob]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(favoriteKey,JSON.stringify(saved));}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem(compareKey,JSON.stringify(compared));}catch{}},[compared]);
 const favourite=(id:string)=>setSaved(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const compare=(id:string)=>setCompared(v=>v.includes(id)?v.filter(x=>x!==id):v.length<3?[...v,id]:v);
 const list=useMemo(()=>ukPathways.filter(p=>(filter==='all'||p.category===filter)&&[p.name,p.english,p.summary,p.audience,...p.highlights].join(' ').toLocaleLowerCase().includes(term.trim().toLocaleLowerCase())),[filter,term]);
 const suggested=useMemo(()=>ukPathways.filter(p=>p.category===goal&&p.availability!=='closed'&&(job!=='no'||!['uk-skilled-worker','uk-health-care','uk-scale-up','uk-seasonal','uk-creative-worker','uk-gov-exchange','uk-senior-specialist','uk-global-business-graduate-trainee'].includes(p.id))),[goal,job]);
 const detail=pathwayId?ukPathways.find(x=>x.id===pathwayId):undefined;
 const breadcrumbs=(label:string)=><nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link><span>/ <Link to={country}>英国</Link></span>{label&&<span>/ <strong>{label}</strong></span>}</nav>;
 const card=(p:OverseasPathway)=><article className="hhba-overseas-path-card" key={p.id}>
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-icon"><CategoryIcon cat={p.category}/></span><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span>{p.availability==='closed'&&<span className="hhba-overseas-closed">中国大陆普通护照不可申请</span>}</div>
  <h3><Link to={routeFor(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(x=><span key={x}>{x}</span>)}</div>
  <div className="hhba-overseas-path-actions">
   <Link className="hhba-overseas-path-main" to={routeFor(p.id)}>查看具体条件 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>favourite(p.id)} aria-label={(saved.includes(p.id)?'取消收藏 ':'收藏 ')+p.name}>{saved.includes(p.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}</button>
   <button type="button" onClick={()=>compare(p.id)} aria-pressed={compared.includes(p.id)} aria-label={(compared.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={17}/></button>
  </div>
 </article>;
 return <Shell user={user}><div className="hhba-overseas hhba-overseas-uk" data-hhba-overseas-uk={view}>
  {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
   {breadcrumbs('')}
    <header className="hhba-overseas-country-hero hhba-uk-hero" style={{backgroundImage:"linear-gradient(90deg,#1a3045f5 0%,#234b60d6 57%,#234b6048 100%),url('"+import.meta.env.BASE_URL+"overseas/countries/uk.webp')"}}>
     <div><span className="hhba-overseas-kicker">UNITED KINGDOM · 2026 HOME OFFICE PATHWAYS</span><h1>🇬🇧 英国海外发展规划</h1>
      <p>逐条解读正规工作、医疗专业、英国大学留学、毕业工签、HPI、Global Talent、创新创业、跨国调派、艺术演出及季节性就业。尤其核对2026年职业SOC、工资、英语、担保及家属限制。</p>
      <div className="hhba-overseas-country-summary"><span>{ukPathways.length}条独立详细指南</span><span>每条8章核验与操作步骤</span><span>{ukVerifiedOn} 官方资料核验</span></div>
      <a className="hhba-uk-photo-credit" href={introPhoto} rel="noopener noreferrer" target="_blank">伦敦威斯敏斯特宫实景 · Balise42 · CC BY-SA 4.0 <ExternalLink size={12}/></a>
     </div><div className="hhba-overseas-kiwi" aria-hidden="true">UK<span>英国</span></div>
   </header>
   <div className="hhba-overseas-utility"><Link to={root+'/uk/match'}><SlidersHorizontal size={17}/> 选择目标</Link><Link to={root+'/uk/saved'}><Bookmark size={17}/> 我的收藏（{saved.length}）</Link><Link to={root+'/uk/compare'}><GitCompareArrows size={17}/> 方案对比（{compared.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 原大学资料库</Link></div>
    <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">REAL UK IMMIGRATION ROUTES</span><h2>英国有哪些可以实际研究的合法路线？</h2><p>每条含8章中文操作指南、至少3份官方来源、资格证据、费用、风险及常见问答。符合与否以个人材料及英国政府决定为准。</p></div></div>
    <div className="hhba-overseas-filter-bar">
      <label className="hhba-overseas-search"><Search size={18}/><input value={term} onChange={e=>setTerm(e.target.value)} aria-label="搜索英国签证方案" placeholder="搜索：Skilled Worker、HPI、Graduate、£41,700、创意演出…"/></label>
     <div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(x=><button type="button" key={x.id} className={filter===x.id?'is-active':''} aria-pressed={filter===x.id} onClick={()=>setFilter(x.id)}>{x.name}</button>)}</div>
    </div>
    <div className="hhba-overseas-path-grid">{list.map(card)}</div>
    {!list.length&&<div className="hhba-overseas-empty"><Search size={24}/><h3>暂未匹配英国方案</h3><button type="button" onClick={()=>{setFilter('all');setTerm('');}}>清除筛选</button></div>}
   </section>
    <div className="hhba-overseas-inline-alert"><Info size={19}/><p><strong>英国2026政策重点：</strong>普通Skilled Worker通常年薪至少£41,700或SOC going rate中更高者；2026首次工作签证英语通常B2；2027年1月起Graduate一般18个月；海外护理员新担保已关闭；大陆普通护照不适用2026 Youth Mobility名单。任何方案均不保证获签。</p></div>
    <section className="hhba-overseas-extras"><div><h2>核验英国真实持牌担保机构与职业薪资</h2><p>担保名单只代表许可，不代表公司正在招聘，更不等于可以购买CoS。请再核实真实offer、SOC编码及going rate。</p></div><a href={ukOfficial.sponsors} className="hhba-overseas-outline" target="_blank" rel="noopener noreferrer">查看UKVI最新担保雇主名册 <ArrowUpRight size={16}/></a><a href={ukOfficial.rates} className="hhba-overseas-outline" target="_blank" rel="noopener noreferrer">查看官方SOC工资表 <ArrowUpRight size={16}/></a></section><RegulatoryNote/>
  </main>}
  {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content hhba-overseas-reader-page">
   {detail?<>{breadcrumbs(detail.name)}
    <header className="hhba-overseas-pathway-head"><div className="hhba-overseas-eyebrow">{overseasCategoryLabels[detail.category]} · 英国 · {ukVerifiedOn}核验</div><h1>{detail.name}</h1><p className="hhba-overseas-eng">{detail.english}</p><p>{detail.summary}</p>{detail.availability==='closed'&&<p className="hhba-overseas-reader-closed">目前不适用于中国大陆普通护照；请查最新参与国籍。</p>}</header>
    <div className="hhba-overseas-reader-actions">
      <a className="hhba-overseas-reader-official" href={detail.officialUrl} target="_blank" rel="noopener noreferrer">查看英国内政部官方原文 <ExternalLink size={15}/></a>
     <button type="button" aria-label={saved.includes(detail.id)?'取消收藏英国方案':'收藏英国方案'} onClick={()=>favourite(detail.id)}>{saved.includes(detail.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}{saved.includes(detail.id)?'已收藏':'收藏'}</button>
     <button type="button" onClick={()=>compare(detail.id)} aria-pressed={compared.includes(detail.id)}><GitCompareArrows size={17}/>{compared.includes(detail.id)?'已加入对比':'加入对比'}</button>
     <span className="hhba-overseas-reader-note">收藏与对比仅保存在当前浏览器</span>
    </div>
    <OverseasDetailedGuide pathway={detail} guide={ukCompleteGuides[detail.id]} key={detail.id}/>
    <p className="hhba-overseas-reader-related">想查询大学与课程？<Link to={root+'/legacy'}>进入原留学资料库 <ArrowRight size={14}/></Link></p>
   </>:<>{breadcrumbs('方案不存在')}<div className="hhba-overseas-empty"><h1>找不到这条英国签证路线</h1><Link to={country}>返回英国方案 <ArrowRight size={15}/></Link></div></>}
  </main>}
  {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content">{breadcrumbs('我的收藏')}<div className="hhba-overseas-section-head"><div><h1>收藏的英国路线</h1><p>此浏览器本地保存，不上传个人数据。</p></div></div><div className="hhba-overseas-path-grid">{ukPathways.filter(x=>saved.includes(x.id)).map(card)}</div>{!saved.length&&<div className="hhba-overseas-empty"><Bookmark size={23}/><h2>还没有收藏</h2><Link to={country}>浏览英国全部方案 <ArrowRight size={15}/></Link></div>}</main>}
  {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content">{breadcrumbs('方案对比')}<div className="hhba-overseas-section-head"><div><h1>对比英国签证路线</h1><p>最多同时比较3条，核对职业与薪资、语言、资金、开放限制、家属和是否可定居。</p></div><Link to={country}>返回英国全部路线 <ArrowRight size={15}/></Link></div><div className="hhba-overseas-compare-grid">{ukPathways.filter(x=>compared.includes(x.id)).map(x=><article className="hhba-overseas-compare-card" key={x.id}><div className="hhba-overseas-compare-heading"><h2>{x.name}</h2><button type="button" onClick={()=>compare(x.id)}>移除</button></div><p>{x.summary}</p>{x.availability==='closed'&&<p><strong>该路线不适用于中国大陆普通护照，请核对法律资格。</strong></p>}<h3>适合谁</h3><p>{x.audience}</p><h3>核心门槛</h3><ul>{x.requirement.map((y,i)=><li key={i}>{y}</li>)}</ul><h3>费用与资金</h3><ul>{x.fees.map((y,i)=><li key={i}>{y}</li>)}</ul><Link to={routeFor(x.id)}>查看完整步骤 <ArrowRight size={15}/></Link></article>)}</div>{!compared.length&&<div className="hhba-overseas-empty"><h2>暂未添加方案</h2><Link to={country}>选择英国方案 <ArrowRight size={15}/></Link></div>}</main>}
  {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content">{breadcrumbs('目标筛选')}<header className="hhba-overseas-match-head"><span className="hhba-overseas-kicker"><Compass size={15}/> UK 2026 PATHWAYS</span><h1>根据实际出国目标初步筛选</h1><p>只是合法路线类别初筛，不是个人签证资格评估。需继续核对实际护照、英语、SOC、工资、offer、学校及申请地点。</p></header>
   <div className="hhba-overseas-match-layout"><section className="hhba-overseas-match-filters"><h2>你目前的主要目标</h2><div className="hhba-overseas-match-options">{(Object.entries(overseasCategoryLabels) as [OverseasCategory,string][]).map(([id,name])=><button key={id} type="button" className={goal===id?'is-active':''} onClick={()=>setGoal(id)}>{name}</button>)}</div>
    <h2>是否已持有英国雇主的真实工作邀请或批准的交流赞助？</h2><div className="hhba-overseas-match-options">{[{id:'yes',name:'有'},{id:'no',name:'没有'},{id:'unsure',name:'不确定'}].map(x=><button type="button" key={x.id} className={job===x.id?'is-active':''} onClick={()=>setJob(x.id as 'yes'|'no'|'unsure')}>{x.name}</button>)}</div>
    <div className="hhba-overseas-match-note"><Info size={17}/><p>没有真实雇主、CoS或批准的交流项目时，不应认为普通Skilled Worker、医疗、Scale-up或其他赞助工作路线已经可申请。Global Talent、HPI、Student等另有资格门槛。</p></div>
   </section><section className="hhba-overseas-match-results"><h2>建议先研究这些路线（{suggested.length}）</h2>{suggested.map(x=><Link to={routeFor(x.id)} className="hhba-overseas-match-result" key={x.id}><strong>{x.name}</strong><small>{x.summary}</small><ArrowRight size={17}/></Link>)}{!suggested.length&&<p>此目标没有筛选结果，可以调整目标或查看英国完整列表。</p>}</section></div><RegulatoryNote/>
  </main>}
 </div></Shell>;
}
