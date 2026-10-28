import {useMemo,useState} from 'react';
import {ArrowRight,BookOpen,ExternalLink,GraduationCap,MapPin,Search,ShieldCheck} from 'lucide-react';
import {AutumnCompanyBrand} from './AutumnCompanyBrand';
import {Link} from '../router';
import employersJSON from '../data/domesticAutumnScreenshot20261028.json';
import jobsJSON from '../data/domesticAutumnVerifiedJobs20261028.json';
import officialEvidence from '../data/domesticAutumnOfficialEvidence20261028.json';
import '../styles/domestic-autumn-market.css';

type Employer={id:string;name:string;screenshotGroup:string;reviewStatus:string;officialUrl:string|null;evidenceUrl:string|null;notes:string|null};
type DomesticRecord={id:string;company:string;title:string;majors:string[];cities:string[];education:string;recruitmentType:string;recordKind:'job'|'program';locationScope:string;sourceUrl:string;status:string;observedOn:string;note:string};
const employers=employersJSON.entries as Employer[];
const jobs=jobsJSON.jobs as DomesticRecord[];
const additionalEvidence=officialEvidence.entries as Record<string,{officialRecruitment:string|null;source:string|null}>;
const recruitmentLink=(e:Employer)=>e.officialUrl||additionalEvidence[e.name]?.officialRecruitment||null;
function evidenceLabel(e:Employer){
 if(recruitmentLink(e))return '招聘官网入口已定位';
 if(e.evidenceUrl)return '招聘公告已有来源';
 if(additionalEvidence[e.name]?.source)return '企业资料已有来源';
 return '招聘信息待核验';
}
const employerIndex=new Map(employers.map(item=>[item.name,item]));
const normalize=(value:string)=>value.toLocaleLowerCase().replace(/[\\s·（）()_]/g,'');
const careerAliases:Record<string,string[]>={
 '计算机科学与技术':['计算机类','计算机'],'软件工程':['计算机类'],
 '人工智能':['计算机类','工学类'],'电气工程及其自动化':['电气工程类','电气类','工学类'],
 '机械工程':['机械类','工学类'],'金融学':['金融学类','金融经济类','经济学类'],
 '会计学':['财务会计类','管理学类'],'统计学':['数学类','理学类'],
};
function matchesMajor(item:DomesticRecord,term:string){
 if(!term)return true;
 if(!item.majors.length)return false;
 if(item.majors.includes('不限专业'))return true;
 const choices=[term,...(careerAliases[term]||[])].map(normalize);
 return item.majors.some(raw=>choices.some(t=>normalize(raw).includes(t)||t.includes(normalize(raw))));
}
const safeUrl=(value:string|null|undefined)=>{
 try{const u=new URL(value||'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null}
 catch{return null}
};
function JobTile({job}:{job:DomesticRecord}){
 const employer=employerIndex.get(job.company);
 const official=employer?safeUrl(recruitmentLink(employer)):null;
 const scope=job.locationScope==='job'?'岗位公开地点':job.locationScope==='not_disclosed'?'岗位地点未披露':'招聘项目城市范围（非逐岗）';
 return <article className="unified-job-card hhba-domestic-job-card">
  <div className="unified-job-head">
   <Link className="unified-company-brand hhba-autumn-company-identity" to={'/companies/autumn/'+employer!.id} title={'查看'+job.company+'的HHBA企业档案'}><AutumnCompanyBrand name={job.company}/><strong>{job.company}</strong></Link>
   <small>2027届 · 当前招聘状态待核实</small>
  </div>
  <h3>{job.title}</h3>
  <div className="hhba-domestic-major-row">
   <GraduationCap size={15} aria-hidden="true"/>
   <span><b>{job.recordKind==='program'?'专业方向／招聘条件：':'招聘专业：'}</b>
    {job.majors.length?job.majors.join('、'):'官方公告未逐岗披露，待核验'}</span>
  </div>
  <div className="hhba-domestic-location-row"><MapPin size={15} aria-hidden="true"/>
   <span>{job.cities.length?job.cities.join('、'):'工作地点未逐岗披露'}</span>
   <small>{scope}</small>
  </div>
  <div className="hhba-domestic-job-tags"><span>{job.recruitmentType}</span>
   <span>{job.recordKind==='job'?'公开具体岗位':'招聘项目／方向'}</span>
   <span>{job.education||'学历未披露'}</span></div>
  {job.recordKind==='program'&&<p className="hhba-domestic-scope-note">
   该记录不是已经核实专业与城市逐一对应的具体岗位，不参与严格的专业＋城市岗位匹配。</p>}
  <div className="unified-job-actions hhba-domestic-job-actions">
   {official?<a href={official} data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">前往官方招聘入口 <ExternalLink size={14}/></a>:
     <span className="hhba-domestic-pending">官方直达入口待核验</span>}
   <a href={job.sourceUrl} data-hhba-non-recruitment-link="true" target="_blank" rel="noopener noreferrer">查看公开证据 <BookOpen size={14}/></a>
  </div>
  <p className="hhba-domestic-observation">资料采集：{job.observedOn} · 来源状态：历史公开记录，非实时在招证明</p>
 </article>;
}

export function DomesticAutumnMarket({compact=false,standalone=false,query='',major='',city='',scope='',country=''}:
 {compact?:boolean;standalone?:boolean;query?:string;major?:string;city?:string;scope?:string;country?:string}){
 const [keyword,setKeyword]=useState('');
 const [majorText,setMajorText]=useState('');
 const [placeText,setPlaceText]=useState('');
 const [directoryText,setDirectoryText]=useState('');
 const [directoryStatus,setDirectoryStatus]=useState<'all'|'with_jobs'|'with_entry'|'not_checked'>('all');
 const foreignOnly=scope==='global'||(country!==''&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country));
 const search=standalone?keyword.trim():query.trim();
 const majorSearch=standalone?majorText.trim():major.trim();
 const placeSearch=standalone?placeText.trim():city.trim();
 const matched=useMemo(()=>{
  if(foreignOnly)return [];
  return jobs.filter(item=>{
   const text=normalize(search);
   const fields=normalize([item.company,item.title,...item.majors,...item.cities].join(' '));
   if(text&&!fields.includes(text))return false;
   if(!matchesMajor(item,majorSearch))return false;
   if(placeSearch&&!item.cities.some(c=>normalize(c).includes(normalize(placeSearch))||normalize(placeSearch).includes(normalize(c))))return false;
   return true;
  });
 },[search,majorSearch,placeSearch,foreignOnly]);
 const individual=matched.filter(item=>item.recordKind==='job');
 const programs=matched.filter(item=>item.recordKind==='program');
 const preview=useMemo(()=>{
   if(standalone)return [...individual,...programs];
   // Mix domestic employers first. Never allow one bank to monopolize a preview.
   const ordered=[...individual,...programs];
   const picked:DomesticRecord[]=[];const seen=new Set<string>();
   for(const job of ordered){if(!seen.has(job.company)){picked.push(job);seen.add(job.company);}}
   for(const job of ordered){if(!picked.includes(job))picked.push(job);}
   return picked.slice(0,compact?6:10);
 },[matched,compact,standalone]);
 const listed=useMemo(()=>employers.filter(item=>{
   if(!normalize(item.name).includes(normalize(directoryText.trim())))return false;
   if(directoryStatus==='with_jobs')return jobs.some(j=>j.company===item.name);
   if(directoryStatus==='with_entry')return !!recruitmentLink(item);
   if(directoryStatus==='not_checked')return !recruitmentLink(item)&&!item.evidenceUrl&&!additionalEvidence[item.name]?.source;
   return true;
 }),[directoryText,directoryStatus]);
 if(foreignOnly&&!standalone)return null;
 return <section className={'hhba-domestic-autumn '+(standalone?'hhba-domestic-autumn-full':'')} aria-label="国内秋招官方岗位与企业清单">
  <header className="hhba-domestic-autumn-head">
    <div><small>HHBA · 国内秋招静态来源档案</small><h2>国内企业岗位与专业、工作地点</h2>
      <p>已收录截图所列 {employers.length} 个不同企业名称。公开岗位与招聘项目分开展示；官网是否仍在招请自行核实。</p>
    </div>
    {!standalone&&<Link className="hhba-domestic-autumn-more" to="/candidate/domestic-autumn">查看全部企业和岗位 <ArrowRight size={15}/></Link>}
  </header>
  {standalone&&<div className="hhba-domestic-autumn-search">
   <label><Search size={16}/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="搜索企业、岗位或招聘方向" aria-label="搜索国内秋招岗位"/></label>
   <label><GraduationCap size={16}/><input value={majorText} onChange={e=>setMajorText(e.target.value)} placeholder="招聘专业，如计算机或电气" aria-label="筛选招聘专业"/></label>
   <label><MapPin size={16}/><input value={placeText} onChange={e=>setPlaceText(e.target.value)} placeholder="工作城市，如青岛" aria-label="筛选工作城市"/></label>
  </div>}
  <p className="hhba-domestic-autumn-disclaimer"><ShieldCheck size={17}/> 本轮核验：{jobs.length} 条来源记录（具体岗位 {jobs.filter(j=>j.recordKind==='job').length} 条，项目／方向 {jobs.filter(j=>j.recordKind==='program').length} 条）。
   截图中的“3日内截止／7日内更新”未经官网逐家确认，不能作为截止日期。无专业依据不猜专业，无岗位城市依据不猜城市。</p>
  {matched.length?<>
    <div className="hhba-domestic-autumn-stats"><span>符合当前筛选：{individual.length} 条具体岗位、{programs.length} 条项目记录</span>
     {!standalone&&<small>仅展示部分，全部结果请进入国内秋招档案</small>}</div>
    <div className="unified-job-grid">{preview.map(job=><JobTile key={job.id} job={job}/>)}</div>
   </>:<p className="unified-job-state">没有与当前筛选同时匹配的已核实岗位记录；这不意味着企业没有招聘该专业，请查看下方企业清单或放宽筛选。</p>}
  {standalone&&<section className="hhba-autumn-company-index">
    <h3>截图完整企业清单 · {employers.length} 家</h3>
    <p>名单全部保留。已核验入口才能点击；缺失官网证据的公司明确标注待核验，不冒充已有岗位。</p>
    <label className="hhba-autumn-company-search"><Search size={16}/><input value={directoryText} onChange={e=>setDirectoryText(e.target.value)} placeholder="搜索156家企业" aria-label="搜索截图企业"/></label>
    <nav className="hhba-autumn-directory-filters" aria-label="企业资料进度筛选">
     {([['all','全部企业'],['with_jobs','有岗位记录'],['with_entry','招聘入口已登记'],['not_checked','待核验']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={directoryStatus===id} onClick={()=>setDirectoryStatus(id)}>{label}</button>)}
     <small>当前显示 {listed.length} / {employers.length} 家</small>
    </nav>
    <div className="hhba-autumn-company-grid">{listed.map(e=><article key={e.id} className="hhba-autumn-company-row">
      <div><Link className="hhba-autumn-company-index-link" to={'/companies/autumn/'+e.id} title={'查看'+e.name+'企业档案'}><AutumnCompanyBrand name={e.name}/><strong>{e.name}</strong></Link><small>{e.screenshotGroup.replace('截图组A：','').replace('截图组B：','')} · {evidenceLabel(e)}</small></div>
      <div className="hhba-autumn-row-actions"><Link to={'/companies/autumn/'+e.id} className="hhba-autumn-row-detail">企业详情 <ArrowRight size={13}/></Link>
      {safeUrl(recruitmentLink(e))?<a href={safeUrl(recruitmentLink(e))!} data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer">招聘官网 <ExternalLink size={14}/></a>:
        <span className="hhba-domestic-pending">{e.evidenceUrl?'官网待核验':'待核验'}</span>}</div>
    </article>)}</div>
  </section>}
  {!standalone&&<Link className="hhba-domestic-autumn-bottom" to="/candidate/domestic-autumn">完整查看截图 156 家企业的招聘核验状态与岗位档案 <ArrowRight size={15}/></Link>}
 </section>;
}
