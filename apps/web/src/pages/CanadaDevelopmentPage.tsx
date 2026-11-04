import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Bookmark,BookmarkCheck,BookOpen,BriefcaseBusiness,Compass,ExternalLink,GitCompareArrows,GraduationCap,House,Info,Plane,Search,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {caVerifiedOn,caOfficial,caPathways} from '../data/overseasCanada';
import {caCompleteGuides} from '../data/overseasCanadaGuides';
import {OverseasDetailedGuide} from '../components/OverseasDetailedGuide';
import {overseasCategoryLabels,type OverseasCategory,type OverseasPathway} from '../data/overseasNewZealand';
import '../styles/overseas-development.css';
import '../styles/overseas-canada.css';

type View='country'|'pathway'|'saved'|'compare'|'match';
const root='/study-abroad',country=root+'/country/canada';
const routeFor=(id:string)=>root+'/canada/pathway/'+id;
const favoriteKey='hhba.overseas.canada.favourites.v1',compareKey='hhba.overseas.canada.compare.v1';
const introPhoto='https://commons.wikimedia.org/wiki/File:Moraine_Lake_panorama.jpg';
function savedItems(key:string):string[]{try{const ids=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(ids)?ids.filter((x:unknown):x is string=>typeof x==='string'&&caPathways.some(p=>p.id===x)):[];}catch{return[];}}
function CategoryIcon({cat}:{cat:OverseasCategory}){const I=cat==='work'?BriefcaseBusiness:cat==='residence'?House:cat==='study'?GraduationCap:Plane;return <I size={19}/>;}
function RegulatoryNote(){return <div className="hhba-overseas-disclaimer"><ShieldCheck size={19}/><div><strong>加拿大IRCC、魁北克及各省政府2026政策 · {caVerifiedOn}核验</strong><p>这次重点核验：2026年11月3日EE工作offer/CRS新规则、9月1日留学资金、魁北克PEQ关闭及创业签证暂停。本站解释法律资格与实际步骤，不承诺获得职位、工签或永久居民。</p></div></div>;}
export function CanadaDevelopmentPage({user,view='country',pathwayId}:{user:User|null;view?:View;pathwayId?:string}){
 const [filter,setFilter]=useState<'all'|OverseasCategory>('all'),[term,setTerm]=useState('');
 const [saved,setSaved]=useState<string[]>(()=>savedItems(favoriteKey));
 const [compared,setCompared]=useState<string[]>(()=>savedItems(compareKey));
 const [goal,setGoal]=useState<OverseasCategory>('work');
 const [job,setJob]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(favoriteKey,JSON.stringify(saved));}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem(compareKey,JSON.stringify(compared));}catch{}},[compared]);
 const favourite=(id:string)=>setSaved(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const compare=(id:string)=>setCompared(v=>v.includes(id)?v.filter(x=>x!==id):v.length<3?[...v,id]:v);
 const list=useMemo(()=>caPathways.filter(p=>(filter==='all'||p.category===filter)&&[p.name,p.english,p.summary,p.audience,...p.highlights].join(' ').toLocaleLowerCase().includes(term.trim().toLocaleLowerCase())),[filter,term]);
 const suggested=useMemo(()=>caPathways.filter(p=>p.category===goal&&(job!=='no'||!['ca-employer-work','ca-aip','ca-rcip','ca-fcip','ca-francophone-mobility'].includes(p.id))),[goal,job]);
 const detail=pathwayId?caPathways.find(x=>x.id===pathwayId):undefined;
 const breadcrumbs=(label:string)=><nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link><span>/ <Link to={country}>加拿大</Link></span>{label&&<span>/ <strong>{label}</strong></span>}</nav>;
 const card=(p:OverseasPathway)=><article className="hhba-overseas-path-card" key={p.id}>
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-icon"><CategoryIcon cat={p.category}/></span><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span></div>
  <h3><Link to={routeFor(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(x=><span key={x}>{x}</span>)}</div>
  <div className="hhba-overseas-path-actions">
   <Link className="hhba-overseas-path-main" to={routeFor(p.id)}>查看具体条件 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>favourite(p.id)} aria-label={(saved.includes(p.id)?'取消收藏 ':'收藏 ')+p.name}>{saved.includes(p.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}</button>
   <button type="button" onClick={()=>compare(p.id)} aria-pressed={compared.includes(p.id)} aria-label={(compared.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={17}/></button>
  </div>
 </article>;
 return <Shell user={user}><div className="hhba-overseas hhba-overseas-canada" data-hhba-overseas-de={view}>
  {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
   {breadcrumbs('')}
   <header className="hhba-overseas-country-hero hhba-canada-hero" style={{backgroundImage:"linear-gradient(90deg,#132f49f5 0%,#1c4168d9 57%,#1c416846 100%),url('"+import.meta.env.BASE_URL+"overseas/countries/ca.webp')"}}>
    <div><span className="hhba-overseas-kicker">CANADA · 2026 FEDERAL + PROVINCIAL PATHWAYS</span><h1>🇨🇦 加拿大发展规划</h1>
     <p>Express Entry三大联邦项目、2026职业类别、省提名、AIP、乡村与法语社区、雇主工作许可、留学及毕业工签。具体查NOC五位职业编码、TEER、语言及2026最新规则。</p>
     <div className="hhba-overseas-country-summary"><span>{caPathways.length}条完整详细指南</span><span>2026官方NOC示例 · 11省区PNP</span><span>{caVerifiedOn} 政策核验</span></div>
     <a className="hhba-canada-photo-credit" href={introPhoto} rel="noopener noreferrer" target="_blank">班夫国家公园梦莲湖实景 · Adam Bishop · CC BY-SA 4.0 <ExternalLink size={12}/></a>
    </div><div className="hhba-overseas-kiwi" aria-hidden="true">CA<span>加拿大</span></div>
   </header>
   <div className="hhba-overseas-utility"><Link to={root+'/canada/match'}><SlidersHorizontal size={17}/> 选择目标</Link><Link to={root+'/canada/saved'}><Bookmark size={17}/> 我的收藏（{saved.length}）</Link><Link to={root+'/canada/compare'}><GitCompareArrows size={17}/> 方案对比（{compared.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 原大学资料库</Link></div>
   <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">FIND YOUR REAL PATHWAY</span><h2>加拿大具体有哪些合法路径？</h2><p>每条路线有10章中文指南。Express Entry类别可查真实NOC与TEER；省提名按11个省/地区独立查询，所有2026法规均列官方来源。</p></div></div>
    <div className="hhba-overseas-filter-bar">
     <label className="hhba-overseas-search"><Search size={18}/><input value={term} onChange={e=>setTerm(e.target.value)} aria-label="搜索加拿大签证方案" placeholder="搜索：FSW、CEC、PNP、PGWP、NOC、23,448…"/></label>
     <div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(x=><button type="button" key={x.id} className={filter===x.id?'is-active':''} aria-pressed={filter===x.id} onClick={()=>setFilter(x.id)}>{x.name}</button>)}</div>
    </div>
    <div className="hhba-overseas-path-grid">{list.map(card)}</div>
    {!list.length&&<div className="hhba-overseas-empty"><Search size={24}/><h3>暂未匹配加拿大方案</h3><button type="button" onClick={()=>{setFilter('all');setTerm('');}}>清除筛选</button></div>}
   </section>
   <div className="hhba-overseas-inline-alert"><Info size={19}/><p><strong>请分清三种金额：</strong>2026年11月3日Express Entry合格工作offer规则已取消LMIA统一前置要求，但雇主专属临时工签仍需另查LMIA；9月1日起魁省以外单人留学生活资金证明CAD23,448/年，不含学费和交通；魁省PEQ于10月31日停止接收新申请。</p></div>
   <section className="hhba-overseas-extras"><div><h2>进一步查加拿大官方真实岗位</h2><p>职业名称、签证资格和招聘岗位是不同概念。本页不伪造加拿大公司招聘名额。</p></div><a href={caOfficial.canadaJobBank} className="hhba-overseas-outline" target="_blank" rel="noopener noreferrer">查看加拿大政府职位库 <ArrowUpRight size={16}/></a></section><RegulatoryNote/>
  </main>}
  {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content hhba-overseas-reader-page">
   {detail?<>{breadcrumbs(detail.name)}
    <header className="hhba-overseas-pathway-head"><div className="hhba-overseas-eyebrow">{overseasCategoryLabels[detail.category]} · 加拿大 · {caVerifiedOn}核验</div><h1>{detail.name}</h1><p className="hhba-overseas-eng">{detail.english}</p><p>{detail.summary}</p></header>
    <div className="hhba-overseas-reader-actions">
     <a className="hhba-overseas-reader-official" href={detail.officialUrl} target="_blank" rel="noopener noreferrer">查看加拿大政府原文 <ExternalLink size={15}/></a>
     <button type="button" aria-label={saved.includes(detail.id)?'取消收藏加拿大方案':'收藏加拿大方案'} onClick={()=>favourite(detail.id)}>{saved.includes(detail.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}{saved.includes(detail.id)?'已收藏':'收藏'}</button>
     <button type="button" onClick={()=>compare(detail.id)} aria-pressed={compared.includes(detail.id)}><GitCompareArrows size={17}/>{compared.includes(detail.id)?'已加入对比':'加入对比'}</button>
     <span className="hhba-overseas-reader-note">收藏与对比仅保存在当前浏览器</span>
    </div>
    <OverseasDetailedGuide pathway={detail} guide={caCompleteGuides[detail.id]} key={detail.id}/>
    <p className="hhba-overseas-reader-related">想查询大学与课程？<Link to={root+'/legacy'}>进入原留学资料库 <ArrowRight size={14}/></Link></p>
   </>:<>{breadcrumbs('方案不存在')}<div className="hhba-overseas-empty"><h1>找不到这条加拿大签证路线</h1><Link to={country}>返回加拿大方案 <ArrowRight size={15}/></Link></div></>}
  </main>}
  {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content">{breadcrumbs('我的收藏')}<div className="hhba-overseas-section-head"><div><h1>收藏的加拿大路线</h1><p>此浏览器本地保存，不上传个人数据。</p></div></div><div className="hhba-overseas-path-grid">{caPathways.filter(x=>saved.includes(x.id)).map(card)}</div>{!saved.length&&<div className="hhba-overseas-empty"><Bookmark size={23}/><h2>还没有收藏</h2><Link to={country}>浏览加拿大全部方案 <ArrowRight size={15}/></Link></div>}</main>}
  {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content">{breadcrumbs('方案对比')}<div className="hhba-overseas-section-head"><div><h1>对比加拿大签证路线</h1><p>最多3条，按真实NOC、工作年限、CLB/NCLC、资金与省份逐项比较。</p></div><Link to={country}>返回加拿大全部路线 <ArrowRight size={15}/></Link></div><div className="hhba-overseas-compare-grid">{caPathways.filter(x=>compared.includes(x.id)).map(x=><article className="hhba-overseas-compare-card" key={x.id}><div className="hhba-overseas-compare-heading"><h2>{x.name}</h2><button type="button" onClick={()=>compare(x.id)}>移除</button></div><p>{x.summary}</p><h3>适合谁</h3><p>{x.audience}</p><h3>核心门槛</h3><ul>{x.requirement.map((y,i)=><li key={i}>{y}</li>)}</ul><h3>费用与资金</h3><ul>{x.fees.map((y,i)=><li key={i}>{y}</li>)}</ul><Link to={routeFor(x.id)}>查看完整步骤 <ArrowRight size={15}/></Link></article>)}</div>{!compared.length&&<div className="hhba-overseas-empty"><h2>暂未添加方案</h2><Link to={country}>选择加拿大方案 <ArrowRight size={15}/></Link></div>}</main>}
  {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content">{breadcrumbs('目标筛选')}<header className="hhba-overseas-match-head"><span className="hhba-overseas-kicker"><Compass size={15}/> CANADA 2026 PATHWAYS</span><h1>根据实际出国目标初步筛选</h1><p>这只帮你找到需要研究的法律路径，不构成个人资格审查。职业NOC、TEER、学历、工作经历和语言要求仍要逐项核对。</p></header>
   <div className="hhba-overseas-match-layout"><section className="hhba-overseas-match-filters"><h2>你目前的主要目标</h2><div className="hhba-overseas-match-options">{(Object.entries(overseasCategoryLabels) as [OverseasCategory,string][]).map(([id,name])=><button key={id} type="button" className={goal===id?'is-active':''} onClick={()=>setGoal(id)}>{name}</button>)}</div>
    <h2>已经有加拿大企业真实专业工作合同吗？</h2><div className="hhba-overseas-match-options">{[{id:'yes',name:'有'},{id:'no',name:'没有'},{id:'unsure',name:'不确定'}].map(x=><button type="button" key={x.id} className={job===x.id?'is-active':''} onClick={()=>setJob(x.id as 'yes'|'no'|'unsure')}>{x.name}</button>)}</div>
    <div className="hhba-overseas-match-note"><Info size={17}/><p>没有加拿大真实雇主合同，雇主专属工签、AIP/RCIP/FCIP等不宜直接认为可用；FSW、PNP部分通道、留学等另有独立要求。</p></div>
   </section><section className="hhba-overseas-match-results"><h2>建议先研究这些路线（{suggested.length}）</h2>{suggested.map(x=><Link to={routeFor(x.id)} className="hhba-overseas-match-result" key={x.id}><strong>{x.name}</strong><small>{x.summary}</small><ArrowRight size={17}/></Link>)}{!suggested.length&&<p>此目标没有筛选结果，可以调整目标或查看加拿大完整列表。</p>}</section></div><RegulatoryNote/>
  </main>}
 </div></Shell>;
}
