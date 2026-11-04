import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Search} from 'lucide-react';
import {Link} from '../router';
import {Shell} from './Shell';
import type {User} from '../services/api';
import {deBlueProfessionSamples,deTrainingOccupationSamples,type DeProfession} from '../data/overseasGermanyOccupations';
import {deOfficial} from '../data/overseasGermany';
import '../styles/overseas-occupation.css';
import '../styles/overseas-germany.css';

export type GermanyOccupationTrack='blue'|'training';
const listing=(track:GermanyOccupationTrack)=>track==='blue'?deBlueProfessionSamples:deTrainingOccupationSamples;
const pathwayUrl=(track:GermanyOccupationTrack)=>track==='blue'?'/study-abroad/germany/pathway/de-blue-card':'/study-abroad/germany/pathway/de-training';
const pageTitle=(track:GermanyOccupationTrack)=>track==='blue'?'欧盟蓝卡职业资格':'德国职业培训 Ausbildung';
const occupationUrl=(track:GermanyOccupationTrack,id:string)=>'/study-abroad/germany/occupation/'+track+'/'+id;

export function GermanyOccupationDirectory({track}:{track:GermanyOccupationTrack}){
 const [q,setQ]=useState('');const [group,setGroup]=useState('全部');
 const arr=listing(track);
 const groups=['全部',...new Set(arr.map(x=>x.group))];
 const found=useMemo(()=>arr.filter(x=>(group==='全部'||x.group===group)&&[x.cn,x.de,x.en,x.duties,x.group].join(' ').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())),[q,group,track]);
 return <section className="hhba-occupation-browser hhba-germany-occupation-directory" id="hhba-overseas-occupation-directory" aria-label={'德国'+pageTitle(track)+'查询'}>
  <header className="hhba-occupation-browser-heading">
   <span className="hhba-occupation-eyebrow">真实职业与培训项目 · 德国官方资料核验 2026-11-04</span>
   <h2>{track==='blue'?'哪些职业可能属于欧盟蓝卡紧缺领域？':'德国有哪些真实职业培训方向？'}</h2>
   <p>{track==='blue'?'这里列出德国政府公布的紧缺职业类别中的常见具体专业示例。需要把“实际职业、学位、工资和执照”一起核查，不是看到职业名称就有申请资格。':'以下展示真实的德国Ausbildung培训职业，点击查看工作内容、德语、正式培训合同与2026生活资金标准，不是虚构的企业岗位。'}</p>
   <p className="hhba-occupation-browser-limit">已整理 {arr.length} 项具体职业示例，<strong>不是全德国所有可申请职业或当期招聘名额</strong>。搜不到不代表该职业不合格，完整工作机会请使用德国官方职位库核查。</p>
  </header>
  <label className="hhba-occupation-search"><Search size={18}/><span className="hhba-occupation-sr-only">输入德国职业名称</span>
   <input aria-label={'搜索德国'+pageTitle(track)} value={q} onChange={e=>setQ(e.target.value)} placeholder={track==='blue'?'输入职业：软件、机械工程、护士、医生、德文…':'输入职业：机电、物流、汽车维修、电子、IT…'}/>
  </label>
  <div className="hhba-occupation-filters" role="group" aria-label="德国职业类别">{groups.map(g=><button type="button" key={g} onClick={()=>setGroup(g)} aria-pressed={group===g} className={group===g?'is-active':''}>{g}</button>)}</div>
  <div className="hhba-occupation-result-summary" aria-live="polite">找到 {found.length} 个职业示例</div>
  <div className="hhba-occupation-results">
   {found.map(item=><Link className="hhba-occupation-result" to={occupationUrl(track,item.id)} key={item.id}>
    <div className="hhba-occupation-result-main"><strong>{item.cn}</strong><span>{item.de} · {item.en}</span><small>{item.group} · {track==='blue'?'欧盟蓝卡职业领域':'正规Ausbildung职业培训'}</small></div>
    <div className="hhba-occupation-result-summary-text">{item.duties}</div><ArrowRight size={17}/>
   </Link>)}
   {!found.length&&<p className="hhba-occupation-no-results">当前示例目录中没有这个职业。请用下面的德国官方职位查询核实，不能据此断言无法申请。</p>}
  </div>
  <a className="hhba-occupation-government-link" href={track==='blue'?deOfficial.occupations:deOfficial.trainings} target="_blank" rel="noopener noreferrer">查看德国政府完整职业介绍 <ExternalLink size={15}/></a>
 </section>;
}
function Part({id,index,title,children}:{id:string;index:string;title:string;children:React.ReactNode}){
 return <section className="hhba-occupation-detail-section" id={id}><h2><span>{index}</span>{title}</h2>{children}</section>;
}
export function GermanyOccupationDetailPage({user,track,id}:{user:User|null;track:GermanyOccupationTrack;id:string}){
 const item:DeProfession|undefined=listing(track).find(x=>x.id===id);
 return <Shell user={user}><main className="hhba-overseas hhba-occupation-detail-page hhba-germany-occupation-detail"><div className="hhba-overseas-container hhba-occupation-detail-container">
  <nav className="hhba-occupation-breadcrumb"><Link to="/study-abroad">海外发展</Link><span>/</span><Link to="/study-abroad/country/germany">德国</Link><span>/</span><Link to={pathwayUrl(track)}>{pageTitle(track)}</Link><span>/</span><strong>{item?.cn||'未找到职业'}</strong></nav>
  {!item?<div className="hhba-occupation-missing"><h1>当前尚未整理这个职业</h1><p>没有收录不等于不能申请；我们不会编造所谓合法职业名单或真实岗位。</p><a href={deOfficial.jobs} target="_blank" rel="noopener noreferrer">打开德国政府真实职位查询 <ExternalLink size={15}/></a></div>:<>
  <header className="hhba-occupation-detail-header"><span className="hhba-occupation-eyebrow">德国 · {pageTitle(track)} · 具体条件</span>
   <h1>{item.cn}</h1><p className="hhba-occupation-detail-english">{item.de} / {item.en}</p><p className="hhba-occupation-detail-lede">{item.duties}</p>
   <p className="hhba-occupation-detail-verified">依据德国联邦政府2026年说明整理 · 不等于职业、工资或签证获批保证 · 2026-11-04核验</p>
  </header>
  <div className="hhba-occupation-detail-layout"><nav className="hhba-occupation-detail-toc" aria-label="德国职业资格目录">
   {['这个职业做什么','学历或培训资格','德语或英语要求','执业许可证','2026工资/资金','经验怎么算','证明材料','怎么申请','官方依据'].map((title,i)=><a href={'#de-prof-'+i} key={title}>{String(i+1).padStart(2,'0')} · {title}</a>)}
  </nav><article className="hhba-occupation-detail-article">
   <Part id="de-prof-0" index="01" title="具体工作内容"><p>{item.duties}</p><p>需要让德国企业在正式合同中写出实际日常任务，不能只靠中文专业或岗位头衔来判断工作资格。</p></Part>
   <Part id="de-prof-1" index="02" title="什么学历或培训资格才符合"><p>{item.qualification}</p></Part>
   <Part id="de-prof-2" index="03" title="德语与英语需要什么程度"><p>{item.language}</p></Part>
   <Part id="de-prof-3" index="04" title="是否需要受监管职业许可"><p>{item.regulation}</p></Part>
   <Part id="de-prof-4" index="05" title="2026工资要求或生活资金"><p>{item.salary}</p><p className="hhba-germany-disclaimer">工资门槛可能每年调整；德国职业培训津贴、蓝卡税前年薪及冻结账户生活资金并不是同一种费用。</p></Part>
   <Part id="de-prof-5" index="06" title="实际工作经验怎样计算"><p>{item.experience}</p></Part>
   <Part id="de-prof-6" index="07" title="证明材料具体有哪些"><ul>{item.documents.map((s,i)=><li key={i}>{s}</li>)}</ul></Part>
   <Part id="de-prof-7" index="08" title="从零开始的办理步骤"><ol>{item.actions.map((s,i)=><li key={i}>{s}</li>)}</ol></Part>
   <div className="hhba-occupation-important"><strong>避免误解</strong><p>{item.important}</p></div>
   <Part id="de-prof-8" index="09" title="核实所用德国政府来源"><ul className="hhba-occupation-official-list">{item.sources.map((s,i)=><li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} <ExternalLink size={14}/></a></li>)}</ul></Part>
  </article></div>
  <div className="hhba-occupation-detail-back"><Link to={pathwayUrl(track)}><ArrowLeft size={15}/> 返回{pageTitle(track)}完整申请指南</Link></div>
  </>}
 </div></main></Shell>;
}
