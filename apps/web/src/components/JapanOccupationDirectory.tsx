import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Search} from 'lucide-react';
import {Link} from '../router';
import {Shell} from './Shell';
import type {User} from '../services/api';
import {jpSSWFields,jpEngineerExamples,jpSSWOfficial,jpSSWSteps,jpSSWExam,jpTechOfficial,type JapanOccupation} from '../data/overseasJapanOccupations';
import '../styles/overseas-occupation.css';
import '../styles/overseas-japan.css';

export type JapanOccupationTrack='jp-ssw1'|'jp-ssw2'|'jp-engineer';
const nav=(track:JapanOccupationTrack)=>track==='jp-ssw1'?'/study-abroad/japan/pathway/jp-ssw1':track==='jp-ssw2'?'/study-abroad/japan/pathway/jp-ssw2':'/study-abroad/japan/pathway/jp-engineer';
const trackName=(track:JapanOccupationTrack)=>track==='jp-ssw1'?'特定技能1号':track==='jp-ssw2'?'特定技能2号':'技术·人文知识·国际业务';
const occupationURL=(track:JapanOccupationTrack,id:string)=>'/study-abroad/japan/occupation/'+track+'/'+id;
const available=(track:JapanOccupationTrack)=>track==='jp-engineer'?jpEngineerExamples:track==='jp-ssw2'?jpSSWFields.filter(x=>x.ssw2Eligible):jpSSWFields;
const official=(track:JapanOccupationTrack)=>track==='jp-engineer'?jpTechOfficial:jpSSWOfficial;

export function JapanOccupationDirectory({track}:{track:JapanOccupationTrack}){
 const list=available(track);
 const [q,setQ]=useState('');const [group,setGroup]=useState('全部');
 const groups=['全部',...new Set(list.map(x=>x.group))];
 const results=useMemo(()=>list.filter(x=>(group==='全部'||x.group===group)&&[x.name,x.japanese,x.english,x.group,...x.examples,x.qualification].join(' ').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())),[q,group,track]);
 return <section className="hhba-occupation-browser hhba-japan-occupation-browser" id="hhba-overseas-occupation-directory" aria-label={'日本'+trackName(track)+'职业资格查询'}>
  <div className="hhba-occupation-browser-heading"><span className="hhba-occupation-eyebrow">日本真实职业信息 · 2026-11-04 核验</span>
   <h2>{track==='jp-engineer'?'专业岗位具体怎么判断？':'到底有哪些领域可以工作？'}</h2>
   <p>{track==='jp-engineer'?'以下是可能属于技人国专业活动的9类岗位示例，能查具体学历、职责和工资原则。日本技人国没有可直接照搬的封闭职业白名单。':track==='jp-ssw2'?'按日本入管官方特定技能2号11个领域核对；不是特定技能1号的19领域都能升2号。':'按日本入管官方19个领域核对工作类型、日语、行业技能考试及目前能否办理新COE。'}</p>
   <p className="hhba-occupation-browser-limit">{track==='jp-engineer'?'此处9类是专业岗位示例，不是政府发布的穷尽职业清单，也不保证个案获批。':'当前展示的是政府公布的'+list.length+'个行业领域（不是'+list.length+'个正式招聘岗位）。领域中的细分工种、考试和最新受理状态以其官方说明为准。'}</p>
  </div>
  <label className="hhba-occupation-search"><Search size={18}/><span className="hhba-occupation-sr-only">搜索日本领域/职业</span><input aria-label={'搜索日本'+trackName(track)+'职业'} value={q} onChange={e=>setQ(e.target.value)} placeholder={track==='jp-engineer'?'搜索：机械、软件、翻译、设计、贸易…':'搜索：机械加工、汽车维修、护理、酒店、餐饮…'}/></label>
  <div className="hhba-occupation-filters" role="group" aria-label="领域分类">{groups.map(g=><button key={g} type="button" className={group===g?'is-active':''} aria-pressed={g===group} onClick={()=>setGroup(g)}>{g}</button>)}</div>
  <div className="hhba-occupation-result-summary" aria-live="polite">找到 {results.length} 项{track==='jp-engineer'?'专业活动示例':'官方行业领域'}</div>
  <div className="hhba-occupation-results">{results.map(x=><Link key={x.id} className="hhba-occupation-result" to={occupationURL(track,x.id)}>
    <div className="hhba-occupation-result-main"><strong>{x.name}</strong><span>{x.japanese} · {x.english}</span><small>{x.group} · {trackName(track)}</small></div>
    <div className="hhba-occupation-result-summary-text">{x.status==='closed-new-coe'&&track==='jp-ssw1'?<strong className="hhba-japan-closed-text">新COE暂停签发 · </strong>:null}
      {x.status==='detail-pending'?<span className="hhba-japan-pending-text">新领域细则待官方公布 · </span>:null}{x.examples.join('；').slice(0,100)}</div>
    <ArrowRight size={17} aria-hidden="true"/>
   </Link>)}
   {!results.length&&<p className="hhba-occupation-no-results">没有找到匹配的领域或示例。请尝试日文、中文关键词；没搜到不能据此判断无法申请。</p>}
  </div>
  <a className="hhba-occupation-government-link" href={official(track)} target="_blank" rel="noopener noreferrer">打开日本政府原始职业与在留资格资料 <ExternalLink size={14}/></a>
 </section>;
}

function ArticlePart({id,n,title,children}:{id:string;n:string;title:string;children:React.ReactNode}){
 return <section id={id} className="hhba-occupation-detail-section"><h2><span>{n}</span>{title}</h2>{children}</section>;
}
export function JapanOccupationDetailPage({user,track,id}:{user:User|null;track:JapanOccupationTrack;id:string}){
 const o=available(track).find(x=>x.id===id);
 const ssw2=track==='jp-ssw2';
 const suffix=ssw2?'该领域属于特定技能2号官方11领域之一。必须单独满足该领域2号高级技能考试、现场管理或工作经验等具体要求；不能直接拿1号考试证明代替。':'';
 return <Shell user={user}><main className="hhba-overseas hhba-occupation-detail-page hhba-japan-occupation-page"><div className="hhba-overseas-container hhba-occupation-detail-container">
   <nav className="hhba-occupation-breadcrumb"><Link to="/study-abroad">海外发展</Link><span>/</span><Link to="/study-abroad/country/japan">日本</Link><span>/</span><Link to={nav(track)}>{trackName(track)}</Link><span>/</span><strong>{o?.name||'未找到'}</strong></nav>
   {!o?<div className="hhba-occupation-missing"><h1>暂无该领域的已整理资料</h1><p>不存在于目前核验清单的条目不能冒充真实职业。请回到日本官方完整说明。</p><a href={official(track)} target="_blank" rel="noopener noreferrer">查看日本入管官方信息 <ExternalLink size={15}/></a></div>:<>
    <header className="hhba-occupation-detail-header"><span className="hhba-occupation-eyebrow">日本 · {trackName(track)} · 真实资格详情</span>
     <h1>{o.name}</h1><p className="hhba-occupation-detail-english">{o.japanese} / {o.english}</p>
     <p className="hhba-occupation-detail-lede">{track==='jp-engineer'?'这是日本技人国专业活动的岗位示例，不存在保证任何岗位名称获批的官方白名单。':'这是日本入管收录的特定技能行业领域，不是雇主职位，也不是已经获批的签证。'}{suffix}</p>
     {o.status==='closed-new-coe'&&track==='jp-ssw1'&&<p className="hhba-japan-status-warning">截至2026-11-04：本领域特定技能1号新COE暂停签发。请勿向私人购买所谓开放名额。</p>}
     {o.status==='detail-pending'&&<p className="hhba-japan-status-warning">政府已将本领域列入19行业总表，但独立领域详细页面仍为准备中。考试与实施日不能假定已开放。</p>}
     <p className="hhba-occupation-detail-verified">官方资料核验：{o.verifiedOn} · 个案需按最新法规和岗位实际情况确认</p>
    </header>
    <div className="hhba-occupation-detail-layout"><nav className="hhba-occupation-detail-toc" aria-label="职业详情目录">
      {['工作到底做什么','技能与学历','日语要求','经验与许可','工资怎么判断','准备材料','办理步骤','政府依据'].map((v,i)=><a href={'#jpocc-'+i} key={v}>{i+1}. {v}</a>)}
     </nav><article className="hhba-occupation-detail-article">
      <ArticlePart id="jpocc-0" n="01" title="实际允许从事哪些工作"><ul>{o.examples.map((x,i)=><li key={i}>{x}</li>)}</ul><p>务必将日本公司的真实职位描述与这项专业活动或领域允许的细分工作比对，不能只靠中文招聘标题判断。</p></ArticlePart>
      <ArticlePart id="jpocc-1" n="02" title="需要什么技能或学历"><p>{ssw2?'特定技能2号：'+suffix: o.qualification}</p><p>{ssw2?'2号技能评定不等于1号技能评价，请到下方日本入管2号官方说明核对自己领域的考试类型和经验。':o.sector?'本领域技能考试：'+(o.id==='jp-food-service'?'当前新COE暂停；'+o.qualification:'请在该行业官方页面查相应考试。'):'核对专业大学教育、适用专业学校或相关工作经历与真实职责。'}</p></ArticlePart>
      <ArticlePart id="jpocc-2" n="03" title="日语考试到底需要多少"><p>{ssw2?'特定技能2号的语言和行业资格应按对应2号细则核查，不得把1号的JLPT N4统一当成2号批准条件。':o.language}</p><p>JLPT是日本语能力考试；JFT-Basic是国际交流基金基础日语测试。只在政府明确接受的工作类别或豁免条件下使用对应成绩。</p></ArticlePart>
      <ArticlePart id="jpocc-3" n="04" title="工作经验与职业许可证"><p>{ssw2?'2号须按该领域更高的技能、现场管理或其他实务门槛准备证据。':o.experience}</p><p>{o.license}</p></ArticlePart>
      <ArticlePart id="jpocc-4" n="05" title="工资最低多少？有什么扣费"><p>{o.salary}</p><p>请向日本企业索要书面的税前工资、工作小时、住宿费用、加班与社保项目。所谓“统一全国工签工资标准”通常不适用于全部领域。</p></ArticlePart>
      <ArticlePart id="jpocc-5" n="06" title="需要准备的证明文件"><ul>{o.evidence.map((v,i)=><li key={i}>{v}</li>)}</ul></ArticlePart>
      <ArticlePart id="jpocc-6" n="07" title="按什么顺序申请"><ol>{o.steps.map((v,i)=><li key={i}>{v}</li>)}</ol></ArticlePart>
      <div className="hhba-occupation-important"><strong>特别提醒</strong><p>{o.caution}</p></div>
      <ArticlePart id="jpocc-7" n="08" title="日本政府的原始资料"><ul className="hhba-occupation-official-list"><li><a href={o.source} target="_blank" rel="noopener noreferrer">{o.sourceLabel} <ExternalLink size={14}/></a></li>{o.sector&&<><li><a href={jpSSWOfficial} target="_blank" rel="noopener noreferrer">日本入管19个领域与11个2号领域 <ExternalLink size={14}/></a></li><li><a href={jpSSWExam} target="_blank" rel="noopener noreferrer">特定技能考试与报名指南 <ExternalLink size={14}/></a></li><li><a href={jpSSWSteps} target="_blank" rel="noopener noreferrer">工作合同、COE和签证办理步骤 <ExternalLink size={14}/></a></li></>}</ul></ArticlePart>
     </article></div>
    <div className="hhba-occupation-detail-back"><Link to={nav(track)}><ArrowLeft size={15}/> 返回{trackName(track)}完整指南</Link></div>
   </>}
  </div></main></Shell>;
}
