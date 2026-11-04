import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Search} from 'lucide-react';
import {Link} from '../router';
import {Shell} from './Shell';
import type {User} from '../services/api';
import {nzTier1Occupations,au189Occupations,type OccupationRecord,nzGreenListUrl,auOccupationList} from '../data/overseasOccupationGuide';
import '../styles/overseas-occupation.css';

const occupationUrl=(item:OccupationRecord)=>item.country==='nz'?'/study-abroad/nz/occupation/'+item.id:'/study-abroad/australia/occupation/'+item.id;
const visaUrl=(country:'nz'|'au')=>country==='nz'?'/study-abroad/pathway/nz-green-tier1':'/study-abroad/australia/pathway/au-189';
const officialUrl=(country:'nz'|'au')=>country==='nz'?nzGreenListUrl:auOccupationList;
const names=(country:'nz'|'au')=>country==='nz'?'新西兰':'澳大利亚';
const occupations=(country:'nz'|'au')=>country==='nz'?nzTier1Occupations:au189Occupations;
const pathwayName=(country:'nz'|'au')=>country==='nz'?'绿名单 Tier 1':'189 独立技术移民';

/** Real source-linked examples, not a claim of exhaustive occupational coverage. */
export function OverseasOccupationDirectory({country}:{country:'nz'|'au'}){
 const [q,setQ]=useState('');
 const [group,setGroup]=useState('全部');
 const all=occupations(country);
 const groups=['全部',...new Set(all.map(x=>x.group))];
 const matches=useMemo(()=>all.filter(item=>(group==='全部'||item.group===group)&&[item.name,item.english,item.code,item.group,...item.qualification].join(' ').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())),[all,q,group]);
 return <section id="hhba-overseas-occupation-directory" className="hhba-occupation-browser" aria-label={names(country)+'职业资格查询'}>
  <div className="hhba-occupation-browser-heading">
   <span className="hhba-occupation-eyebrow">职业资格数据库 · 首批官方资料整理</span>
   <h2>哪些具体职业可以核查？</h2>
   <p>不用猜自己的专业属于哪类。按中文名称、英文名称或职业代码查找，点击后直接看学历、工资、职业注册、材料和官方来源。</p>
   <p className="hhba-occupation-browser-limit">当前收录 {all.length} 个已整理的职业示例，<strong>并非完整官方职业名单</strong>。没搜到不代表该职业不符合条件，完整范围请使用政府职业查询。</p>
  </div>
  <label className="hhba-occupation-search"><Search size={18}/><span className="hhba-occupation-sr-only">搜索具体职业</span><input aria-label={'搜索'+names(country)+'具体职业'} value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索：机械工程、软件、护士、ANZSCO 代码…"/></label>
  <div className="hhba-occupation-filters" role="group" aria-label="职业类别">{groups.map(g=><button type="button" key={g} aria-pressed={group===g} className={g===group?'is-active':''} onClick={()=>setGroup(g)}>{g}</button>)}</div>
  <div className="hhba-occupation-result-summary" aria-live="polite">显示 {matches.length} 个结果</div>
  <div className="hhba-occupation-results">
   {matches.map(item=><Link className="hhba-occupation-result" key={item.id} to={occupationUrl(item)}>
    <div className="hhba-occupation-result-main"><strong>{item.name}</strong><span>{item.english}</span><small>ANZSCO {item.code} · {item.group}</small></div>
    <div className="hhba-occupation-result-summary-text">{item.wage.length>125?item.wage.slice(0,120)+'…':item.wage}</div>
    <ArrowRight size={17} aria-hidden="true"/>
   </Link>)}
   {!matches.length&&<p className="hhba-occupation-no-results">目前整理的示例中未找到该职业。请使用下面的官方完整清单核查，不能据此判定不符合资格。</p>}
  </div>
  <a className="hhba-occupation-government-link" href={officialUrl(country)} target="_blank" rel="noopener noreferrer">前往{names(country)}政府完整职业清单 <ExternalLink size={15}/></a>
 </section>;
}

function QualificationSection({number,title,children}:{number:string;title:string;children:React.ReactNode}){
 return <section className="hhba-occupation-detail-section"><h2><span>{number}</span>{title}</h2>{children}</section>;
}
export function OverseasOccupationDetailPage({user,country,id}:{user:User|null;country:'nz'|'au';id:string}){
 const record=occupations(country).find(x=>x.id===id);
 const official=officialUrl(country);
 return <Shell user={user}>
  <main className="hhba-overseas hhba-occupation-detail-page">
   <div className="hhba-overseas-container hhba-occupation-detail-container">
    <nav className="hhba-occupation-breadcrumb"><Link to="/study-abroad">海外发展</Link><span>/</span><Link to={visaUrl(country)}>{names(country)} · {pathwayName(country)}</Link><span>/</span><strong>{record?.name||'职业未收录'}</strong></nav>
    {!record?<div className="hhba-occupation-missing"><h1>该职业暂无已核实详情</h1><p>当前只有首批整理的职业样本。未收录不表示不能申请，请使用官方职业数据库。</p><a href={official} target="_blank" rel="noopener noreferrer">查看政府完整职业清单 <ExternalLink size={16}/></a></div>:<>
     <header className="hhba-occupation-detail-header">
      <p className="hhba-occupation-eyebrow">{names(country)} · {pathwayName(country)} · 职业条件核查</p>
      <h1>{record.name}</h1><p className="hhba-occupation-detail-english">{record.english} · ANZSCO {record.code}</p>
      <p className="hhba-occupation-detail-lede">{record.intro}</p>
      <p className="hhba-occupation-detail-verified">资料核验：{record.verifiedOn}。仅供初步准备，不替代政府对申请人的判定。</p>
     </header>
     <div className="hhba-occupation-detail-layout">
      <nav className="hhba-occupation-detail-toc" aria-label="职业详情目录">
       <strong>职业详情</strong>
       <a href="#occupation-education">01 学历与专业</a><a href="#occupation-license">02 注册资格</a>
       <a href="#occupation-wage">03 工资门槛</a><a href="#occupation-experience">04 经验要求</a>
       <a href="#occupation-documents">05 准备材料</a><a href="#occupation-steps">06 下一步怎么做</a>
       <a href="#occupation-sources">07 官方依据</a>
      </nav>
      <article className="hhba-occupation-detail-article">
       <div id="occupation-education"><QualificationSection number="01" title="学历与对应专业">
        <ul>{record.qualification.map((x,i)=><li key={i}>{x}</li>)}</ul>
       </QualificationSection></div>
       <div id="occupation-license"><QualificationSection number="02" title="是否需要职业注册或技能评估">
        <p>{record.registration}</p>
       </QualificationSection></div>
       <div id="occupation-wage"><QualificationSection number="03" title="工资要求具体是多少">
        <p>{record.wage}</p><small>{record.wageAsOf}</small>
       </QualificationSection></div>
       <div id="occupation-experience"><QualificationSection number="04" title="工作经验怎么判断">
        <p>{record.experience}</p>
       </QualificationSection></div>
       <div id="occupation-documents"><QualificationSection number="05" title="要准备哪些证据材料">
        <ul>{record.proof.map((x,i)=><li key={i}>{x}</li>)}</ul>
       </QualificationSection></div>
       <div id="occupation-steps"><QualificationSection number="06" title="可以从哪一步开始操作">
        <ol>{record.actions.map((x,i)=><li key={i}>{x}</li>)}</ol>
       </QualificationSection></div>
       <div className="hhba-occupation-important"><strong>避免误解</strong><p>{record.warning}</p></div>
       <div id="occupation-sources"><QualificationSection number="07" title="官方原文与查询入口">
        <ul className="hhba-occupation-official-list">{record.sources.map((x,i)=><li key={i}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.label} <ExternalLink size={14}/></a></li>)}</ul>
       </QualificationSection></div>
      </article>
     </div>
     <div className="hhba-occupation-detail-back"><Link to={visaUrl(country)}><ArrowLeft size={16}/> 返回{pathwayName(country)}完整申请指南</Link></div>
    </>}
   </div>
  </main>
 </Shell>;
}
