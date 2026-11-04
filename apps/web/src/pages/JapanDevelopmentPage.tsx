import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Bookmark,BookmarkCheck,BriefcaseBusiness,GraduationCap,House,Plane,Search,ShieldCheck,ExternalLink,GitCompareArrows,SlidersHorizontal,Info,Compass,BookOpen} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import type {User} from '../services/api';
import {jpPathways,jpVerifiedOn} from '../data/overseasJapan';
import {jpCompleteGuidesV1} from '../data/overseasJapanGuides';
import {OverseasDetailedGuide} from '../components/OverseasDetailedGuide';
import {overseasCategoryLabels,type OverseasCategory,type OverseasPathway} from '../data/overseasNewZealand';
import '../styles/overseas-development.css';
import '../styles/overseas-japan.css';

type JapanView='country'|'pathway'|'saved'|'compare'|'match';
const root='/study-abroad';
const country=root+'/country/japan';
const pathFor=(id:string)=>root+'/japan/pathway/'+id;
const storageSaved='hhba.overseas.japan.saved.v1';
const storageCompared='hhba.overseas.japan.compare.v1';
function stored(key:string):string[]{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter((x:unknown):x is string=>typeof x==='string'&&jpPathways.some(p=>p.id===x)):[];}catch{return [];}}
function CategoryIcon({category}:{category:OverseasCategory}){const Icon=category==='work'?BriefcaseBusiness:category==='residence'?House:category==='study'?GraduationCap:Plane;return <Icon size={20}/>;}
const credit='https://commons.wikimedia.org/wiki/File:Tokyo_-_Sunset_Skyline.jpg';
function Credits(){return <a className="hhba-overseas-jp-credit" href={credit} target="_blank" rel="noopener noreferrer">东京与富士山真实摄影 · Fred Cherrygarden · CC BY-SA 4.0 <ExternalLink size={12}/></a>;}
function Notice(){return <div className="hhba-overseas-disclaimer"><ShieldCheck size={19}/><div><strong>来源：日本出入国在留管理厅、外务省、JASSO · {jpVerifiedOn} 核验</strong><p>日本“签证”和“在留资格”不是同一程序。考试、工作合同、COE和入境签证要分开办理。本站提供政策理解和准备方法，不承诺签发在留资格或安排工作。</p></div></div>;}
export function JapanDevelopmentPage({user,view='country',pathwayId}:{user:User|null;view?:JapanView;pathwayId?:string}){
 const [category,setCategory]=useState<'all'|OverseasCategory>('all');
 const [keyword,setKeyword]=useState('');
 const [saved,setSaved]=useState<string[]>(()=>stored(storageSaved));
 const [compared,setCompared]=useState<string[]>(()=>stored(storageCompared));
 const [goal,setGoal]=useState<OverseasCategory>('work');
 const [hasEmployer,setHasEmployer]=useState<'yes'|'no'|'unsure'>('unsure');
 useEffect(()=>{try{localStorage.setItem(storageSaved,JSON.stringify(saved));}catch{}},[saved]);
 useEffect(()=>{try{localStorage.setItem(storageCompared,JSON.stringify(compared));}catch{}},[compared]);
 const bookmark=(id:string)=>setSaved(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const compare=(id:string)=>setCompared(a=>a.includes(id)?a.filter(x=>x!==id):a.length>=3?a:[...a,id]);
 const results=useMemo(()=>jpPathways.filter(x=>(category==='all'||x.category===category)&&[x.name,x.english,x.summary,x.audience,...x.highlights].join(' ').toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase())),[category,keyword]);
 const matching=useMemo(()=>jpPathways.filter(x=>x.category===goal&&(hasEmployer!=='no'||!['jp-ssw1','jp-ssw2','jp-engineer','jp-jskip'].includes(x.id))),[goal,hasEmployer]);
 const detail=pathwayId?jpPathways.find(x=>x.id===pathwayId):undefined;
 const card=(p:OverseasPathway)=><article className="hhba-overseas-path-card" key={p.id}>
  <div className="hhba-overseas-path-top"><span className="hhba-overseas-path-icon"><CategoryIcon category={p.category}/></span><span className="hhba-overseas-path-type">{overseasCategoryLabels[p.category]}</span></div>
  <h3><Link to={pathFor(p.id)}>{p.name}</Link></h3><small>{p.english}</small><p>{p.summary}</p>
  <div className="hhba-overseas-path-tags">{p.highlights.map(x=><span key={x}>{x}</span>)}</div>
  <div className="hhba-overseas-path-actions">
   <Link className="hhba-overseas-path-main" to={pathFor(p.id)}>查看具体条件 <ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>bookmark(p.id)} aria-label={(saved.includes(p.id)?'取消收藏 ':'收藏 ')+p.name}>{saved.includes(p.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}</button>
   <button type="button" onClick={()=>compare(p.id)} aria-pressed={compared.includes(p.id)} aria-label={(compared.includes(p.id)?'移出对比 ':'加入对比 ')+p.name}><GitCompareArrows size={17}/></button>
  </div>
 </article>;
 const crumb=(name:string)=><nav className="hhba-overseas-crumb" aria-label="面包屑"><Link to={root}>海外发展</Link><span>/ <Link to={country}>日本</Link></span>{name&&<span>/ <strong>{name}</strong></span>}</nav>;
 return <Shell user={user}><div className="hhba-overseas hhba-overseas-jp" data-hhba-overseas-jp={view}>
  {view==='country'&&<main className="hhba-overseas-container hhba-overseas-content">
   {crumb('')}
   <header className="hhba-overseas-country-hero hhba-overseas-jp-hero">
    <div><span className="hhba-overseas-kicker">JAPAN · REAL RESIDENCE PATHWAYS</span><h1>🇯🇵 日本发展规划</h1>
     <p>工作、特定技能、专业就业、高度人才、留学与毕业求职。查具体行业、日语考试和雇主合同，不靠猜自己适用哪条路线。</p>
     <div className="hhba-overseas-country-summary"><span>{jpPathways.length} 条详细指南</span><span>特定技能1号19领域 / 2号11领域</span><span>{jpVerifiedOn} 官方资料核验</span></div>
     <Credits/>
    </div><div className="hhba-overseas-kiwi" aria-hidden="true">JP<span>日本</span></div>
   </header>
   <div className="hhba-overseas-utility"><Link to={root+'/japan/match'}><SlidersHorizontal size={17}/> 选择目标</Link><Link to={root+'/japan/saved'}><Bookmark size={17}/> 我的收藏（{saved.length}）</Link><Link to={root+'/japan/compare'}><GitCompareArrows size={17}/> 方案对比（{compared.length}/3）</Link><Link to={root+'/legacy'}><BookOpen size={17}/> 原大学资料库</Link></div>
   <section className="hhba-overseas-section"><div className="hhba-overseas-section-head"><div><span className="hhba-overseas-kicker">EXPLORE REAL PATHWAYS</span><h2>日本有哪些合法发展路径？</h2><p>点进去按10个章节读条件、材料、流程和费用；在特定技能、技人国页面可进一步查询真实行业和专业工作详情。</p></div></div>
    <div className="hhba-overseas-filter-bar"><label className="hhba-overseas-search"><Search size={18}/><input value={keyword} onChange={e=>setKeyword(e.target.value)} aria-label="搜索日本在留资格路线" placeholder="搜索技人国、特定技能、N4、N1、留学…"/></label><div className="hhba-overseas-filter-chips">{([{id:'all',name:'全部'},...Object.entries(overseasCategoryLabels).map(([id,name])=>({id,name}))] as {id:'all'|OverseasCategory;name:string}[]).map(x=><button key={x.id} type="button" aria-pressed={category===x.id} className={category===x.id?'is-active':''} onClick={()=>setCategory(x.id)}>{x.name}</button>)}</div></div>
    <div className="hhba-overseas-path-grid">{results.map(card)}</div>{!results.length&&<div className="hhba-overseas-empty"><Search size={23}/><h3>没有找到对应路线</h3><p>可以用日本制度的正式名称搜索，或浏览全部路线。</p><button type="button" onClick={()=>{setKeyword('');setCategory('all');}}>清除筛选</button></div>}
   </section>
   <div className="hhba-overseas-inline-alert"><Info size={19}/><p><strong>重要政策状态：</strong>日本特定技能1号外食业自2026-04-13起暂停新COE签发；资源循环、布草洗涤和物流仓储已经列入官方19领域总表，但独立领域详细页面仍标注建设中。请勿购买所谓“当前保签名额”。</p></div>
   <section className="hhba-overseas-extras"><div><h2>想比较其他国家？</h2><p>先核对工作属于什么制度和实际可用的资格，再对比澳大利亚与新西兰的移民路线。</p></div><Link to={root+'/country/australia'} className="hhba-overseas-outline">查看澳大利亚 <ArrowRight size={16}/></Link></section>
   <Notice/>
  </main>}
  {view==='pathway'&&<main className="hhba-overseas-container hhba-overseas-content hhba-overseas-reader-page">
   {detail?<>{crumb(detail.name)}
    <header className="hhba-overseas-pathway-head">
     <div className="hhba-overseas-eyebrow">{overseasCategoryLabels[detail.category]} · 日本在留资格 · {jpVerifiedOn} 核验</div>
     <h1>{detail.name}</h1><p className="hhba-overseas-eng">{detail.english}</p><p>{detail.summary}</p>
     {detail.id==='jp-ssw1'&&<p className="hhba-japan-pathway-warning">外食业领域的1号新COE签发目前暂停；新设领域详情尚待政府正式公布。</p>}
    </header>
    <div className="hhba-overseas-reader-actions">
     <a href={detail.officialUrl} target="_blank" rel="noopener noreferrer" className="hhba-overseas-reader-official">查看日本政府原文 <ExternalLink size={15}/></a>
     <button type="button" onClick={()=>bookmark(detail.id)} aria-label={saved.includes(detail.id)?'取消收藏日本方案':'收藏日本方案'}>{saved.includes(detail.id)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}{saved.includes(detail.id)?'已收藏':'收藏'}</button>
     <button type="button" onClick={()=>compare(detail.id)} aria-pressed={compared.includes(detail.id)}><GitCompareArrows size={17}/>{compared.includes(detail.id)?'已加入对比':'加入对比'}</button>
     <span className="hhba-overseas-reader-note">收藏与对比仅保存在当前浏览器</span>
    </div>
    <OverseasDetailedGuide key={detail.id} pathway={detail} guide={jpCompleteGuidesV1[detail.id]}/>
    <p className="hhba-overseas-reader-related">需要查询日本大学与课程？ <Link to={root+'/legacy'}>打开原留学资料库 <ArrowRight size={14}/></Link></p>
   </>:<>{crumb('方案不存在')}<div className="hhba-overseas-empty"><h1>未找到此日本在留资格方案</h1><Link to={country}>返回日本全部方案 <ArrowRight size={15}/></Link></div></>}
  </main>}
  {view==='saved'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('我的收藏')}<div className="hhba-overseas-section-head"><div><h1>已收藏的日本方案</h1><p>信息只保存在当前浏览器，没有开启跨设备同步。</p></div></div><div className="hhba-overseas-path-grid">{jpPathways.filter(x=>saved.includes(x.id)).map(card)}</div>{!saved.length&&<div className="hhba-overseas-empty"><Bookmark size={24}/><h2>尚未收藏任何日本方案</h2><Link to={country}>浏览日本所有方案 <ArrowRight size={15}/></Link></div>}</main>}
  {view==='compare'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('方案对比')}<div className="hhba-overseas-section-head"><div><h1>日本在留资格对比</h1><p>最多对比3条方案，注意“签证”和“在留资格”及就业范围的法律区别。</p></div><Link to={country}>返回全部 <ArrowRight size={15}/></Link></div><div className="hhba-overseas-compare-grid">{jpPathways.filter(x=>compared.includes(x.id)).map(p=><article className="hhba-overseas-compare-card" key={p.id}><div className="hhba-overseas-compare-heading"><h2>{p.name}</h2><button type="button" onClick={()=>compare(p.id)}>移除</button></div><p>{p.summary}</p><h3>适合谁</h3><p>{p.audience}</p><h3>具体前提</h3><ul>{p.requirement.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>钱花在哪里</h3><ul>{p.fees.map((x,i)=><li key={i}>{x}</li>)}</ul><Link to={pathFor(p.id)}>详细条件 <ArrowRight size={15}/></Link></article>)}</div>{!compared.length&&<div className="hhba-overseas-empty"><h2>还没有选择方案</h2><Link to={country}>从日本路线中添加 <ArrowRight size={15}/></Link></div>}</main>}
  {view==='match'&&<main className="hhba-overseas-container hhba-overseas-content">{crumb('目标筛选')}<header className="hhba-overseas-match-head"><span className="hhba-overseas-kicker"><Compass size={15}/> BEGIN YOUR JAPAN JOURNEY</span><h1>先按目标了解可能的日本路线</h1><p>这里仅帮助筛选信息类别，不是移民法律资格判断。每一条仍需依据行业、考试、学历、合同、学校、排名和财力单独核验。</p></header>
   <div className="hhba-overseas-match-layout"><section className="hhba-overseas-match-filters"><h2>第一步：你主要想做什么？</h2><div className="hhba-overseas-match-options">{(Object.entries(overseasCategoryLabels) as [OverseasCategory,string][]).map(([id,name])=><button type="button" key={id} className={goal===id?'is-active':''} onClick={()=>setGoal(id)}>{name}</button>)}</div>
    <h2>第二步：有日本雇主的真实合同或邀约吗？</h2><div className="hhba-overseas-match-options">{[{id:'yes',name:'有'},{id:'no',name:'没有'},{id:'unsure',name:'尚不确定'}].map(x=><button type="button" key={x.id} className={hasEmployer===x.id?'is-active':''} onClick={()=>setHasEmployer(x.id as 'yes'|'no'|'unsure')}>{x.name}</button>)}</div><div className="hhba-overseas-match-note"><Info size={17}/><p>没有日本雇主时暂不推荐某些雇佣工作路线；这不是对J-Find、留学、企业经营或其他类别的资格裁定。</p></div></section>
    <section className="hhba-overseas-match-results"><h2>还可以进一步核查的方案（{matching.length}）</h2>{matching.map(x=><Link to={pathFor(x.id)} className="hhba-overseas-match-result" key={x.id}><strong>{x.name}</strong><small>{x.summary}</small><ArrowRight size={17}/></Link>)}{!matching.length&&<p>当前筛选没有对应类别。可以换目标或浏览全部方案。</p>}</section></div><Notice/>
  </main>}
 </div></Shell>;
}
