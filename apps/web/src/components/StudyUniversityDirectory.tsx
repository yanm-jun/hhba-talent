import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,CheckCircle2,ExternalLink,GraduationCap,MapPin,Search,ShieldCheck,SlidersHorizontal,University} from 'lucide-react';
import type {User} from '../services/api';
import {Link} from '../router';
import {Shell} from './Shell';
import {studyCountries,studyCountry,type StudyCountryCode} from '../data/studyAbroad';
import {findProgram,findUniversity,programsForUniversity,searchUniversityPrograms,studyDegreeLabels,studyFieldLabels,studyLanguageLabels,studyModeLabels,universities,universityPrograms,type DirectoryFilters,type StudyDegree,type StudyField} from '../data/studyUniversities';
import '../styles/study-universities.css';

export function StudyUniversityDirectory({country,query,onClear,onCountryChange}:{country:StudyCountryCode|'';query:string;onClear:()=>void;onCountryChange:(code:StudyCountryCode|'')=>void}){
 const [degree,setDegree]=useState<StudyDegree|''>('');
 const [field,setField]=useState<StudyField|''>('');
 const [language,setLanguage]=useState<'en'|''>('');
 const matches=useMemo(()=>searchUniversityPrograms({country,keyword:query,degree,field,language}),[country,query,degree,field,language]);
 const grouped=universities.map(s=>({school:s,programs:matches.filter(p=>p.universityId===s.id)})).filter(g=>g.programs.length>0);
 const reset=()=>{setDegree('');setField('');setLanguage('');onClear();};
 return <div className="hhba-uni-directory" data-study-module="university-program-registry">
  <div className="hhba-study-section-head">
   <div><p className="hhba-study-eyebrow"><University size={14}/> MODULE 01 · OFFICIAL UNIVERSITY PROGRAMS</p><h2 id="hhba-uni-directory-heading">真实大学与专业数据库</h2><p>来自学校官方课程页，按具体专业返回结果，不会把学校所有专业混进搜索结果。</p></div>
   <span className="hhba-uni-registry-count">{universities.length} 所大学 · {universityPrograms.length} 个真实项目</span>
  </div>
  <div className="hhba-uni-filter-bar" aria-label="大学与专业筛选">
   <div className="hhba-uni-filter-label"><SlidersHorizontal size={17}/> 精确筛选</div>
   <label>国家
    <select aria-label="筛选国家" value={country} onChange={e=>onCountryChange(e.target.value as StudyCountryCode|'')}>
     <option value="">全部国家</option>
     {studyCountries.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}
    </select>
   </label>
   <label>学历
    <select aria-label="筛选学历层次" value={degree} onChange={e=>setDegree(e.target.value as StudyDegree|'')}>
     <option value="">全部学历</option>
     {Object.entries(studyDegreeLabels).map(([key,val])=><option value={key} key={key}>{val}</option>)}
    </select>
   </label>
   <label>专业
    <select aria-label="筛选专业领域" value={field} onChange={e=>setField(e.target.value as StudyField|'')}>
     <option value="">全部专业</option>
     {Object.entries(studyFieldLabels).map(([key,val])=><option value={key} key={key}>{val}</option>)}
    </select>
   </label>
   <label>授课语言
    <select aria-label="筛选授课语言" value={language} onChange={e=>setLanguage(e.target.value as 'en'|'')}>
     <option value="">不限语言</option><option value="en">英语（官网确认）</option>
    </select>
   </label>
   <button type="button" className="hhba-uni-clear" onClick={reset}>清空所有条件 ↺</button>
  </div>
  <p className="hhba-uni-result-summary" aria-live="polite">{country?studyCountry(country).flag+' '+studyCountry(country).name+' · ':''}{query?'关键词「'+query+'」 · ':''}匹配 <strong>{matches.length}</strong> 个具体专业，涉及 <strong>{grouped.length}</strong> 所大学。</p>
  {grouped.length?<div className="hhba-uni-grid">
   {grouped.map(({school,programs})=><article className="hhba-uni-school-card" key={school.id}>
    <div className="hhba-uni-school-card-top">
     <span className="hhba-uni-school-avatar" aria-hidden="true"><GraduationCap size={26}/></span>
     <span className="hhba-uni-school-location">{studyCountry(school.country).flag} {studyCountry(school.country).name}</span>
    </div>
    <h3><Link to={'/study-abroad/university/'+school.id}>{school.chinese}</Link></h3>
    <p className="hhba-uni-school-english">{school.english}</p>
    <p className="hhba-uni-school-place"><MapPin size={13}/>{school.city} · {school.ownership}</p>
    <div className="hhba-uni-offerings"><strong>匹配专业 {programs.length} 个</strong>
     {programs.map(p=><Link key={p.id} className="hhba-uni-program-link" to={'/study-abroad/program/'+p.id}>
      <span>{p.chinese}<small>{p.english}</small></span><ArrowUpRight size={15}/>
     </Link>)}
    </div>
    <div className="hhba-uni-card-foot"><span><CheckCircle2 size={14}/> 官方项目来源</span><Link to={'/study-abroad/university/'+school.id}>大学详情 <ArrowRight size={15}/></Link></div>
   </article>)}
  </div>:<div className="hhba-uni-no-results"><Search size={26}/><h3>没有匹配的具体专业</h3><p>首批数据库为 8 所大学、15 个项目。请调整关键词、国家或筛选条件；没有命中并不意味着全球没有该专业。</p><button className="hhba-study-btn" type="button" onClick={reset}>查看全部已收录专业</button></div>}
  <p className="hhba-uni-source-note"><ShieldCheck size={17}/> “已核验”仅代表学校官网能够证明该项目存在，不代表当前有名额、国际生符合资格或能够获得录取。所有资料保留项目级来源及核验日期。</p>
 </div>;
}

function DetailShell({user,children}:{user:User|null;children:React.ReactNode}){
 return <Shell user={user}><main className="hhba-study hhba-uni-detail-page"><div className="hhba-study-wrap"><Link className="hhba-study-back" to="/study-abroad"><ArrowLeft size={16}/> 返回留学机会 · 大学与专业数据库</Link>{children}</div></main></Shell>;
}
export function StudyUniversityDetail({user,id}:{user:User|null;id:string}){
 const u=findUniversity(id);
 if(!u)return <DetailShell user={user}><div className="hhba-uni-not-found"><h1>未找到这所大学</h1><p>请返回已收录的学校目录重新选择。</p><Link className="hhba-study-btn" to="/study-abroad">返回目录 <ArrowRight size={15}/></Link></div></DetailShell>;
 const ps=programsForUniversity(u.id);
 const c=studyCountry(u.country);
 return <DetailShell user={user}>
  <header className="hhba-uni-detail-hero">
   <p className="hhba-study-eyebrow">{c.flag} {c.name} · 大学官方资料</p>
   <h1>{u.chinese}</h1><p className="hhba-uni-detail-en">{u.english}</p>
   <p><MapPin size={16}/>{u.city} · {u.ownership}</p>
   <p className="hhba-uni-detail-intro">{u.introduction}</p>
   <div className="hhba-uni-detail-actions"><a className="hhba-study-btn" href={u.officialSite} target="_blank" rel="noopener noreferrer">大学官网 <ExternalLink size={16}/></a><span><CheckCircle2 size={15}/> 学校资料核验 {u.verifiedAt}</span></div>
  </header>
  <section className="hhba-uni-detail-section" aria-labelledby="hhba-uni-degrees-title"><div className="hhba-study-section-head"><div><h2 id="hhba-uni-degrees-title">已核实的具体专业（{ps.length}）</h2><p>每个项目都有独立的官方课程来源，点击可查看具体信息。</p></div></div>
   <div className="hhba-uni-degree-list">{ps.map(p=><article className="hhba-uni-degree-row" key={p.id}>
    <div><span className="hhba-uni-degree-kicker">{studyDegreeLabels[p.degree]} · {studyFieldLabels[p.field]}</span><h3>{p.chinese}</h3><p className="hhba-uni-degree-en">{p.english}</p><p>{p.description}</p><div className="hhba-uni-degree-meta"><span>{studyModeLabels[p.mode]}</span><span>{studyLanguageLabels[p.language]}</span></div></div>
    <Link to={'/study-abroad/program/'+p.id}>专业详情 <ArrowUpRight size={16}/></Link>
   </article>)}</div>
  </section>
  <p className="hhba-uni-source-note"><ShieldCheck size={17}/> 尚未逐校核实的专业、金额或招生批次不会以确定信息呈现。这里列出的 {ps.length} 个项目不代表该校全部专业。</p>
 </DetailShell>;
}
export function StudyProgramDetail({user,id}:{user:User|null;id:string}){
 const p=findProgram(id),u=p?findUniversity(p.universityId):undefined;
 if(!p||!u)return <DetailShell user={user}><div className="hhba-uni-not-found"><h1>未找到该专业</h1><Link className="hhba-study-btn" to="/study-abroad">返回目录</Link></div></DetailShell>;
 const c=studyCountry(u.country);
 const rows=[
  {name:'学位类型',value:studyDegreeLabels[p.degree]},
  {name:'专业领域',value:studyFieldLabels[p.field]},
  {name:'授课形式',value:studyModeLabels[p.mode]},
  {name:'授课语言',value:studyLanguageLabels[p.language]},
  {name:'学费与费用',value:p.tuitionNote},
  {name:'项目简介',value:p.description},
  {name:'申请背景与条件',value:p.admissions}
 ];
 return <DetailShell user={user}>
  <div className="hhba-uni-program-breadcrumb"><Link to={'/study-abroad/university/'+u.id}>{u.chinese}</Link><ArrowRight size={15}/><span>{p.chinese}</span></div>
  <header className="hhba-uni-detail-hero hhba-uni-program-head">
   <p className="hhba-study-eyebrow">{c.flag} {c.name} · 官方课程资料</p><h1>{p.chinese}</h1><p className="hhba-uni-detail-en">{p.english}</p>
   <p><GraduationCap size={16}/>{u.chinese} · {u.english}</p>
   <div className="hhba-uni-detail-actions"><a className="hhba-study-btn" href={p.officialProgramUrl} target="_blank" rel="noopener noreferrer">查看学校官方项目说明 <ExternalLink size={16}/></a><Link className="hhba-uni-school-back" to={'/study-abroad/university/'+u.id}>返回大学详情 <ArrowRight size={15}/></Link></div>
  </header>
  <div className="hhba-uni-program-layout">
   <div><h2>项目资料</h2><div className="hhba-uni-info-list">{rows.map(row=><section key={row.name}><h3>{row.name}</h3><p>{row.value}</p></section>)}
    {p.pathwayNote&&<section className="hhba-uni-pathway"><h3>跨学科申请提示</h3><p>{p.pathwayNote}</p></section>}
   </div></div>
   <aside className="hhba-uni-program-source">
    <h2><BookOpen size={19}/> 信息核验</h2><p><CheckCircle2 size={16}/> 官方来源：{p.sourceQuality==='official-program'?'学校项目说明':'学校正式课程目录'}</p>
    <p>核验日期：{p.checkedAt}</p>
    <p>收费状态：{p.tuitionStatus==='published'?'学校已公开所列年份参考收费':'未核实具体国际学生学费'}</p>
    <p>录取与开放状态：未单独确认</p>
    <a href={p.officialProgramUrl} target="_blank" rel="noopener noreferrer">打开官方原文 <ExternalLink size={15}/></a>
    <small>学校官方资料可能调整。正式申请前请再次确认申请人所属地区、国际生身份、语言、学制、学费和截止日期。</small>
   </aside>
  </div>
  <p className="hhba-uni-source-note"><ShieldCheck size={17}/> 本页是可靠的项目发现资料，不提供保录或资格判断；网站不采集申请材料，也不代替学校招生部门。</p>
 </DetailShell>;
}
