import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,CheckCircle2,ExternalLink,MapPin,Search,ShieldCheck,BriefcaseBusiness,ChevronDown,Filter,Building2} from 'lucide-react';
import {Link} from '../router';
import {Shell} from '../components/Shell';
import {WINTER_2027_PROGRAMS,winterProgramById,type WinterProgram} from '../data/winter2027Programs';
import {WINTER_2027_JOBS,winterJobById,winterJobSafeUrl,winterJobStatusLabel,type WinterJob} from '../data/winter2027Jobs';
import type {User} from '../services/api';
import '../styles/winter-internship.css';

/**
 * A job-first page: ONLY independently published employer job postings appear
 * in the primary list. Employer-wide programmes without a job requisition live
 * in a clearly separate supplementary section. Legacy project detail URLs work.
 */
const PAGE_SIZE=10;
const WINTER_GROUPS=['科技研发','先进制造','金融银行','审计咨询','市场传播','教育文旅','企业职能','其他方向'] as const;
function winterIndustryGroup(job:WinterJob):string{
 const value=job.industry.toLowerCase();
 if(/审计|咨询|会计|税务/.test(value))return '审计咨询';
 if(/金融科技|软件研发/.test(value))return '科技研发';
 if(/金融|银行|证券|财富|精算|私募|投资|财务|风险/.test(value))return '金融银行';
 if(/人力资源|人事|行政|法务|职能/.test(value))return '企业职能';
 if(/工业软件|制造|机械|家电|芯片|半导体|硬件/.test(value))return '先进制造';
 if(/人工智能|ai|算法|数据|软件|研发|科技|技术|智能/.test(value))return '科技研发';
 if(/营销|传播|公关|市场|零售|电商|媒体|游戏|美妆|奢侈/.test(value))return '市场传播';
 if(/酒店|文旅|旅游|教育|教学|餐饮|培训/.test(value))return '教育文旅';
 return '其他方向';
}
function winterProgrammeGroup(category:WinterProgram['category']):string{
 return category==='审计咨询'?'审计咨询':category==='金融'?'金融银行':'市场传播';
}
const PROGRAM_ONLY=WINTER_2027_PROGRAMS.filter(p=>
 p.kind==='专项计划'&&p.id!=='jpm-2027-seasonal' &&
 !WINTER_2027_JOBS.some(job=>job.originalProgramId===p.id));
function verificationLabel(p:WinterProgram){
 if(p.verificationLevel==='historical-only')return '往期冬季实习资料 · 2027待核实';
 if(p.verificationLevel==='date-conflict')return '申请截止时间待核实';
 if(p.verificationLevel==='official-posting')return '企业官网具体岗位';
 if(p.verificationLevel==='official-program')return '官方项目 · 需核对在招';
 return '已收录项目资料';
}
function safeOfficialHref(p:WinterProgram){
 try{
  const url=new URL(p.applicationUrl),source=new URL(p.sourceUrl);
  if(url.protocol!=='https:'||source.protocol!=='https:'||url.username||url.password)return '';
  return p.applicationUrl;
 }catch{return ''}
}
function SourceButton({program}:{program:WinterProgram}){
 const href=safeOfficialHref(program);
 return href?<a className="hhba-winter-official" href={href} target="_blank" rel="noopener noreferrer">前往企业官方招聘页面 <ExternalLink size={15}/></a>:null;
}
/** Programme-only results remain readable; they are NOT counted as concrete jobs. */
function WinterCard({program}:{program:WinterProgram}){
 return <article className="hhba-winter-program-row" data-winter-program={program.id}>
  <div className="hhba-winter-program-row-main">
   <div className="hhba-winter-card-label"><span>企业项目资料</span><span>{program.region}</span><span className="hhba-winter-status-neutral">{verificationLabel(program)}</span></div>
   <h3>{program.title}</h3>
   <p className="hhba-winter-card-company">{program.company} <small>{program.english}</small></p>
   <p className="hhba-winter-program-summary">{program.statusNote}</p>
  </div>
  <Link className="hhba-winter-card-detail" to={'/winter-internship/'+program.id}>项目资料与官网 <ArrowRight size={15}/></Link>
 </article>;
}
function WinterDetail({user,id}:{user:User|null;id:string}){
 const p=winterProgramById(id);
 if(!p)return <Shell user={user}><div className="hhba-winter-missing"><h1>未找到这个实习项目</h1><Link to="/winter-internship">返回寒假实习专区</Link></div></Shell>;
 return <Shell user={user}>
  <main className="hhba-winter-page hhba-winter-detail" data-winter-page="detail">
   <Link className="hhba-winter-back" to="/winter-internship"><ArrowLeft size={16}/> 返回寒假实习岗位列表</Link>
   <p className="hhba-winter-eyebrow">HHBA · 2027 WINTER INTERNSHIP</p>
   <div className="hhba-winter-detail-panel"><div>
    <span className="hhba-winter-source-tag"><ShieldCheck size={14}/> {verificationLabel(p)}</span>
    <h1>{p.title}</h1><p className="hhba-winter-detail-company">{p.company} · {p.english}</p>
    <p>{p.intro}</p>
   </div>
   <div className="hhba-winter-detail-facts">
    <div><small>项目类型</small><strong>{p.kind} · {p.category}</strong></div>
    <div><small>工作地点</small><strong>{p.location}</strong></div>
    <div><small>实习周期</small><strong>{p.period}</strong></div>
    <div><small>申请时间</small><strong>{p.deadline}</strong></div>
    {p.workRightsNote&&<div className="hhba-winter-work-rights"><small>工作资格提醒</small><strong>{p.workRightsNote}</strong></div>}
   </div></div>
   <section className="hhba-winter-detail-info"><h2>谁适合申请？</h2>
    <ul>{p.requirements.map((x,i)=><li key={i}>{x}</li>)}</ul>
    <h2>官方来源与报名</h2><p>HHBA 仅整理公开招聘信息，不收取报名费、不承诺录取。请在企业官网核对最新职位、地点、专业和截止日期。</p>
    <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="hhba-winter-source-link">查看企业官方项目说明 <ExternalLink size={15}/></a>
    {p.evidenceUrl&&<a href={p.evidenceUrl} target="_blank" rel="noopener noreferrer" className="hhba-winter-source-link">查看补充招聘证据 <ExternalLink size={15}/></a>}
    <SourceButton program={p}/>
    {p.verificationLevel==='date-conflict'&&<p className="hhba-winter-warning" role="note">这条项目的官方截止日期出现不一致的公开页面版本，HHBA 不将其标为已确认可申请。请直接在企业招聘系统验证申请按钮及日期。</p>}
    <p className="hhba-winter-verified">资料核对日期：{p.checkedOn}。{p.statusNote}。</p>
   </section>
  </main>
 </Shell>;
}
function WinterRoleRow({job}:{job:WinterJob}){
 const url=winterJobSafeUrl(job);
 return <article className="hhba-winter-role-row" data-winter-job={job.id}>
  <div className="hhba-winter-role-body">
   <div className="hhba-winter-role-flags">
    <span>{job.region}</span>
    <span className={job.status==='verify-apply'?'hhba-winter-status-neutral':'hhba-winter-status-caution'}>{winterJobStatusLabel(job)}</span>
   </div>
   <h3><Link to={'/winter-internship/'+job.id}>{job.title}</Link></h3>
   <p className="hhba-winter-role-company"><Building2 size={14}/><strong>{job.company}</strong><span>{job.city}</span><span>{job.industry}</span></p>
   <p className="hhba-winter-role-intro">{job.description}</p>
   <div className="hhba-winter-role-labels"><span><CalendarDays size={13}/>{job.startDate}{job.status==='campus-limited'||job.status==='winter-unverified'?'':'开始'}</span>
    {job.majorTags.slice(0,3).map(x=><span key={x}>{x}</span>)}</div>
  </div>
  <div className="hhba-winter-role-actions">
   <Link to={'/winter-internship/'+job.id} className="hhba-winter-role-detail">岗位详情 <ArrowRight size={15}/></Link>
   {url&&<a href={url} target="_blank" rel="noopener noreferrer" className="hhba-winter-role-apply">{job.status==='filled'?'查看已招满公告':job.status==='closed'?'查看已截止公告':job.status==='campus-limited'?'企业官网（非直投）':job.status==='platform-posting'?'查看平台岗位（申请需核实）':job.id==='roys-hz-2027winter-class-assistant-source-review'?'查看招聘线索（非直投）':job.status==='source-verify'?'企业招聘首页（非直投）':'官网核实'} <ExternalLink size={14}/></a>}
   <small>核对：{job.checkedOn}</small>
  </div>
 </article>;
}
function WinterJobDetail({user,job}:{user:User|null;job:WinterJob}){
 const url=winterJobSafeUrl(job);
 return <Shell user={user}><main className="hhba-winter-page hhba-winter-detail" data-winter-page="job-detail">
  <Link className="hhba-winter-back" to="/winter-internship"><ArrowLeft size={16}/> 返回寒假实习岗位列表</Link>
  <p className="hhba-winter-eyebrow">HHBA · 2027 WINTER INTERNSHIP · JOB DETAIL</p>
  <div className="hhba-winter-detail-panel"><div>
   <span className="hhba-winter-source-tag"><ShieldCheck size={14}/>{winterJobStatusLabel(job)}</span>
   <h1>{job.title}</h1><p className="hhba-winter-detail-company">{job.company} · {job.english}</p>
   <p>{job.description}</p>
  </div>
  <div className="hhba-winter-detail-facts">
   <div><small>工作地点</small><strong>{job.location}</strong></div>
   <div><small>入职时间</small><strong>{job.startDate}</strong></div>
   <div><small>实习周期</small><strong>{job.period}</strong></div>
   <div><small>报名截止</small><strong>{job.deadline}</strong></div>
   {job.workRightsNote&&<div className="hhba-winter-work-rights"><small>工作资格提醒</small><strong>{job.workRightsNote}</strong></div>}
  </div></div>
  <section className="hhba-winter-detail-info">
   <h2>岗位要求与申请资格</h2>
   <ul>{job.requirements.map((r,i)=><li key={i}>{r}</li>)}</ul>
   <h2>匹配专业背景</h2><p>{job.majorTags.join('、')}。具体是否满足条件以官方职位描述为准。</p>
   {job.salaryNote&&<><h2>薪酬备注</h2><p>{job.salaryNote}</p></>}
   {(job.status==='deadline-conflict'||job.status==='year-conflict')&&<p className="hhba-winter-warning" role="note">{job.reviewWarning||'官方截止日期出现不一致的公开页面版本，HHBA 无法确认当前可申请。请以雇主申请系统最新页面为准。'}</p>}
   {job.reviewWarning&&job.status!=='deadline-conflict'&&job.status!=='year-conflict'&&<p className="hhba-winter-warning" role="note">{job.reviewWarning}</p>}
   {job.evidenceUrl&&<a href={job.evidenceUrl} target="_blank" rel="noopener noreferrer" className="hhba-winter-source-link">{job.status==='campus-limited'?'查看高校公开职位与截止日':job.status==='source-verify'?'查看招聘平台原始记录':'查看补充招聘时间证据'} <ExternalLink size={15}/></a>}
   <h2>职位来源与申请核实</h2><p>本站整理有出处的公开职位和招聘批次信息；部分仅见于高校或第三方招聘平台。已过截止日或已被雇主宣布招满的岗位仅保留历史资料与官方公告链接，不代表可投递；企业招聘首页不等于具体岗位直投入口。HHBA 不代收申请材料，也不承诺名额或录取结果。</p>
   {url&&<a href={url} target="_blank" rel="noopener noreferrer" className="hhba-winter-official">{job.status==='filled'?'查看雇主已招满岗位公告':job.status==='closed'?'查看雇主已截止岗位公告':job.status==='campus-limited'?'企业官网（非岗位直投）':job.status==='platform-posting'?'查看第三方招聘平台的独立岗位':job.id==='roys-hz-2027winter-class-assistant-source-review'?'查看2027招聘汇总（非寒假直投）':job.status==='source-verify'?'企业招聘首页（非岗位直投）':'前往企业官方岗位核实及申请'} <ExternalLink size={16}/></a>}
   <p className="hhba-winter-verified">资料核对日期：{job.checkedOn}。{job.statusNote}。</p>
  </section>
 </main></Shell>;
}
export function WinterInternshipPage({user,slug}:{user:User|null;slug?:string}){
 const [draft,setDraft]=useState('');
 const [keyword,setKeyword]=useState('');
 const [region,setRegion]=useState('全部地区');
 const [industry,setIndustry]=useState('全部行业');
 const [major,setMajor]=useState('全部专业');
 const [group,setGroup]=useState('全部分组');
 const [page,setPage]=useState(0);
 const regions=['全部地区',...new Set(WINTER_2027_JOBS.map(j=>j.region))];
 const industries=['全部行业',...new Set(WINTER_2027_JOBS.map(j=>j.industry))];
 const majors=['全部专业',...new Set(WINTER_2027_JOBS.flatMap(j=>j.majorTags).filter(v=>v!=='不限专业'))];
 const filtered=useMemo(()=>{
  const terms=keyword.trim().normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return WINTER_2027_JOBS.filter(j=>{
   const haystack=[j.title,j.company,j.english,j.region,j.city,j.industry,j.description,...j.majorTags,...j.tags].join(' ').normalize('NFKC').toLocaleLowerCase();
   return (region==='全部地区'||j.region===region)&&
    (group==='全部分组'||winterIndustryGroup(j)===group)&&
    (industry==='全部行业'||j.industry===industry)&&
    (major==='全部专业'||j.majorTags.includes(major)||j.majorTags.includes('不限专业'))&&
    terms.every(term=>haystack.includes(term));
  }).sort((a,b)=>{
   const majorPriority=major==='全部专业'?0:Number(b.majorTags.includes(major))-Number(a.majorTags.includes(major));
   const mainlandPriority=Number(b.region==='中国内地')-Number(a.region==='中国内地');
   return majorPriority||mainlandPriority||
    WINTER_GROUPS.indexOf(winterIndustryGroup(a) as typeof WINTER_GROUPS[number])-
    WINTER_GROUPS.indexOf(winterIndustryGroup(b) as typeof WINTER_GROUPS[number]);
  });
 },[keyword,region,industry,major,group]);
 const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const visible=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const visibleGroups=WINTER_GROUPS.map(name=>({name,jobs:visible.filter(j=>winterIndustryGroup(j)===name)})).filter(entry=>entry.jobs.length>0);
 const matchedPrograms=useMemo(()=>{
  const terms=keyword.trim().normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return PROGRAM_ONLY.filter(p=>{
   const haystack=[p.title,p.company,p.english,p.region,p.location,p.intro,p.category,...p.requirements,...p.tags].join(' ').normalize('NFKC').toLocaleLowerCase();
   return (region==='全部地区'||p.region===region)&&
    (group==='全部分组'||winterProgrammeGroup(p.category)===group)&&
    (industry==='全部行业'||p.category===industry)&&
    (major==='全部专业'||haystack.includes(major.toLocaleLowerCase()))&&
    terms.every(term=>haystack.includes(term));
  });
 },[keyword,region,industry,major,group]);
 const clear=()=>{setDraft('');setKeyword('');setRegion('全部地区');setIndustry('全部行业');setMajor('全部专业');setGroup('全部分组');setPage(0)};
 if(slug){
  const job=winterJobById(slug);
  return job?<WinterJobDetail user={user} job={job}/>:<WinterDetail user={user} id={slug}/>;
 }
 return <Shell user={user}><main className="hhba-winter-page hhba-winter-job-first" data-winter-page="directory">
  <section className="hhba-winter-job-hero">
   <div><p className="hhba-winter-eyebrow">HHBA · 2027 WINTER INTERNSHIP</p>
    <h1>寒假实习 · 直接找岗位</h1>
    <p>先看真实企业发布的具体岗位，再了解职位要求、时间和申请入口。</p>
   </div>
   <div className="hhba-winter-job-hero-stat"><strong>{WINTER_2027_JOBS.length}</strong><span>条公开岗位及招聘批次记录</span>
    <small>不等于实时可申请名额</small></div>
  </section>
  <section className="hhba-winter-job-market" id="winter-opportunities" aria-labelledby="winter-opportunities-title">
   <div className="hhba-winter-section-title"><div>
    <p>公开职位证据 · 每条独立记录保留来源与核验状态</p>
    <h2 id="winter-opportunities-title">探索寒假实习机会</h2>
    <span>输入时即时检索企业、岗位、城市和专业，支持按地区、行业分组、专业及细分行业筛选；企业项目资料与具体岗位分开展示；高校校内限制、未证实寒假时段仍有明确提示。</span>
   </div></div>
   <form className="hhba-winter-job-filters" role="search" onSubmit={e=>{e.preventDefault();setKeyword(draft);setPage(0)}}>
    <label className="hhba-winter-query"><Search size={18}/><input type="search" value={draft} onChange={e=>{setDraft(e.target.value);setKeyword(e.target.value);setPage(0)}} maxLength={80}
      aria-label="搜索寒假实习具体岗位" placeholder="输入企业、职位、城市或专业，例如：上海 传播"/></label>
    <button className="hhba-winter-job-search-btn" type="submit">搜索岗位 <ArrowRight size={15}/></button>
   </form>
   <div className="hhba-winter-job-facets"><span><Filter size={15}/>筛选</span>
    <label>专业<select aria-label="按专业筛选寒假岗位" value={major} onChange={e=>{setMajor(e.target.value);setPage(0)}}>{majors.map(m=><option key={m}>{m}</option>)}</select></label>
    <label>地区<select aria-label="按地区筛选寒假岗位" value={region} onChange={e=>{setRegion(e.target.value);setPage(0)}}>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
    <label>分组<select aria-label="按行业分组筛选寒假岗位" value={group} onChange={e=>{setGroup(e.target.value);setPage(0)}}><option value="全部分组">全部分组</option>{WINTER_GROUPS.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
    <label>行业<select aria-label="按行业筛选寒假岗位" value={industry} onChange={e=>{setIndustry(e.target.value);setPage(0)}}>{industries.map(x=><option key={x}>{x}</option>)}</select></label>
    <button type="button" onClick={clear} className="hhba-winter-filters-reset">重置</button>
   </div>
   <div className="hhba-winter-list-summary" aria-live="polite"><strong>{filtered.length}</strong> 条公开岗位及招聘批次结果
    <span> · 包含雇主官方及招聘平台公开记录，部分寒假时间待核实</span></div>
   {visible.length?<div className="hhba-winter-role-groups" aria-label="寒假实习具体岗位列表">
     {visibleGroups.map(entry=><section className="hhba-winter-role-group" key={entry.name}>
      <h3 className="hhba-winter-role-group-title">{entry.name}<small>本页 {entry.jobs.length} 条</small></h3>
      <div className="hhba-winter-role-list">{entry.jobs.map(j=><WinterRoleRow job={j} key={j.id}/>)}</div>
     </section>)}
    </div>:
    <div className="hhba-winter-none" role="status"><Search size={24}/><h3>{keyword.trim()&&matchedPrograms.length?'暂无匹配的具体岗位，下方有相关企业项目资料':'没有找到相符的具体寒假岗位'}</h3>
      <p>可缩短关键词或修改专业、地区和行业条件；不使用未经核实的项目名称凑岗位数量。</p><button type="button" onClick={clear}>重置筛选</button></div>}
   {totalPages>1&&<nav className="hhba-winter-job-paging" aria-label="寒假实习岗位分页">
    <button type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>上一页</button>
    <span>第 {page+1} / {totalPages} 页</span>
    <button type="button" disabled={page+1>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>下一页</button>
   </nav>}
  </section>
  <details className="hhba-winter-program-archive" data-winter-program-archive open={Boolean(keyword.trim()&&matchedPrograms.length)}>
   <summary><span><ChevronDown size={18}/> 其他冬季项目与历年招聘资料（尚缺具体岗位）</span><strong>{matchedPrograms.length} 家</strong></summary>
   <p>以下是雇主冬季项目介绍或历年招聘线索；未找到可核实的本年度独立职位时，不计入上面的岗位数量。历史资料不代表当前开放申请。</p>
   <div className="hhba-winter-program-archive-grid">{matchedPrograms.map(p=><WinterCard key={p.id} program={p}/>)}</div>
  </details>
  <div className="hhba-winter-page-trust"><span><CheckCircle2 size={17}/> 每条独立岗位或申请批次均披露核验等级</span><span><CheckCircle2 size={17}/> 不把业务方向拆成虚假岗位</span><span><CheckCircle2 size={17}/> 明确提示申请状态</span></div>
  <section className="hhba-winter-help"><BriefcaseBusiness size={26}/><div><h2>想继续寻找更多专业实习机会？</h2>
   <p>优先展示覆盖冬季的具体岗位；尚未核实寒假入职的相关实习会明显标注。更多职位可到 HHBA 招聘市场查看。</p></div>
   <Link to="/candidate/jobs">查看完整招聘市场 <ArrowUpRight size={16}/></Link></section>
  <p className="hhba-winter-page-note"><ShieldCheck size={16}/> 岗位发布不代表仍在招，部分已招满或已截止；信息核验日期请查看每条详情。香港职位可能要求有效工作资格；若某岗位官网已关闭申请，须以企业官网为准。</p>
 </main></Shell>;
}
