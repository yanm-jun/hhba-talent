import {useMemo,useState} from 'react';
import {majorNamesRelated} from '../services/majorEligibility.mjs';
import {employerProfileById} from '../services/employerProfiles';
import {ArrowLeft,ArrowRight,ChevronDown,ExternalLink,GraduationCap} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import type {User} from '../services/api';
import '../styles/kpmg-compact-profile.css';
import '../styles/unified-v2-company.css';

type Business={title:string;description:string;tags:string;details:string[]};
type Role={
 id:string;title:string;city:string;summary:string;requirements:string;category?:string;
 majorNames:string[];editorialRelatedMajors:string[];majorUnrestricted:boolean;
 educationLabel:string;currentOpenVerified:false;observedOn:string;evidenceUrl:string;
};
type Photo={path:string;caption:string;note:string;alt:string};
type Company={
 id:string;name:string;displayName?:string;englishName:string;industry:string;subtitle:string;
 overview:string;lastReviewed:string;media:{logo:string;photos:Photo[]};
 recruitment:{url:string;label:string;status:string;subject:string;note:string};
 photoNote:string;majorIntro:string;preferredMajors:string[];
 business:Business[];jobs:Role[];
};
const asset=(path:string)=>import.meta.env.BASE_URL+path;
const qizhengGroups=[
 {label:'中医学',majors:['中医学','藏医学']},
 {label:'机械 / 电气',majors:['机械工程','机械设计制造及其自动化','电气工程及其自动化','自动化']},
 {label:'质量管理',majors:['质量管理工程','中药学','药学','制药工程']},
 {label:'康复理疗',majors:['康复治疗学','针灸推拿学']},
 {label:'市场营销',majors:['市场营销','工商管理']}
] as const;
const weipuGroups=[
 {label:'化学 / 材料',majors:['化学','应用化学','化学工程与工艺','材料科学与工程','高分子材料与工程']},
 {label:'机械 / 车辆',majors:['车辆工程','机械工程','机械设计制造及其自动化','自动化','电气工程及其自动化']},
 {label:'生物 / 医药',majors:['生物技术','药学','化妆品科学与技术','食品科学与工程']},
 {label:'质量 / 检测',majors:['质量管理工程']},
 {label:'计算机 / AI',majors:['人工智能','计算机科学与技术','软件工程','网络空间安全','信息安全']},
 {label:'市场 / 财务',majors:['市场营销','工商管理','会计学','财务管理','审计学']}
] as const;
const bodorGroups=[
 {
  "label": "机械 / 自动化",
  "majors": [
   "机械工程",
   "自动化",
   "电气工程及其自动化",
   "机械设计制造及其自动化",
   "车辆工程"
  ]
 },
 {
  "label": "光学 / 电子",
  "majors": [
   "光学工程",
   "光电信息科学与工程",
   "电子信息工程",
   "通信工程"
  ]
 },
 {
  "label": "软件 / 人工智能",
  "majors": [
   "计算机科学与技术",
   "软件工程",
   "信息与计算科学"
  ]
 },
 {
  "label": "材料 / 工艺",
  "majors": [
   "材料科学与工程",
   "焊接技术与工程",
   "材料成型及控制工程"
  ]
 },
 {
  "label": "供应链 / 质量",
  "majors": [
   "采购管理",
   "供应链管理",
   "质量管理工程",
   "工业工程"
  ]
 },
 {
  "label": "营销 / 服务",
  "majors": [
   "市场营销",
   "国际经济与贸易",
   "英语",
   "机械工程"
  ]
 }
] as const;
const pxwGroups=[
 {
  "label": "工艺研发",
  "majors": [
   "微电子科学与工程",
   "集成电路科学与工程",
   "材料科学与工程"
  ]
 },
 {
  "label": "制程 / 良率",
  "majors": [
   "集成电路设计与集成系统",
   "微电子科学与工程",
   "材料科学与工程"
  ]
 },
 {
  "label": "材料 / 分析",
  "majors": [
   "材料科学与工程",
   "化学",
   "物理学"
  ]
 },
 {
  "label": "设备 / 自动化",
  "majors": [
   "机械工程",
   "电气工程及其自动化",
   "自动化"
  ]
 },
 {
  "label": "软件 / 系统",
  "majors": [
   "计算机科学与技术",
   "软件工程",
   "自动化"
  ]
 },
 {
  "label": "生产 / 管理",
  "majors": [
   "工业工程",
   "工程管理",
   "机械工程"
  ]
 }
] as const;
const keyenceGroups=[{label:'专业不限',majors:[]}] as const;
const minieyeGroups=[
 {
  "label": "算法 / AI",
  "majors": [
   "人工智能",
   "计算机科学与技术",
   "控制科学与工程"
  ]
 },
 {
  "label": "软件 / 数据",
  "majors": [
   "计算机科学与技术",
   "软件工程",
   "数据科学与大数据技术"
  ]
 },
 {
  "label": "嵌入式 / 硬件",
  "majors": [
   "电子信息工程",
   "电气工程及其自动化",
   "自动化"
  ]
 },
 {
  "label": "测试 / 验证",
  "majors": [
   "软件工程",
   "自动化",
   "电子信息工程"
  ]
 },
 {
  "label": "项目 / 管培",
  "majors": [
   "工程管理",
   "工业工程",
   "日语"
  ]
 },
 {
  "label": "供应链",
  "majors": [
   "供应链管理",
   "物流管理",
   "工业工程"
  ]
 }
] as const;
function roleMatches(role:Role,major:string){
 if(!major||role.majorUnrestricted)return true;
 return [...role.majorNames,...role.editorialRelatedMajors].some(x=>majorNamesRelated(x,major));
}
export function UnifiedV2CompanyPage({user,id}:{user:User|null;id:string}){
 const p=employerProfileById.get(id) as Company|undefined;
 const [major,setMajor]=useState('');
 const qizheng=id==='cn-autumn-031';
 const weipu=id==='cn-autumn-032';
 const bodor=id==='cn-autumn-033';
 const pxw=id==='cn-autumn-034';
 const minieye=id==='cn-autumn-035';
 const keyence=id==='cn-autumn-157';
 // Shared four-block V2 layout for all approved enterprise records.
 const batch3756=/^cn-autumn-(?:03[7-9]|04[0-9]|05[0-9])$/.test(id);
 const showcase=qizheng||weipu||bodor||pxw||minieye||keyence||batch3756;
 const detailedCards=weipu||bodor||pxw||minieye||keyence||batch3756;
 const batchGroups=useMemo(()=>p?[...new Set(p.jobs.map(job=>job.category).filter((value):value is string=>!!value))].map(label=>({label,majors:[]})):[],[p]);
 const majorGroups=batch3756?batchGroups:(minieye?minieyeGroups:(keyence?keyenceGroups:(pxw?pxwGroups:(bodor?bodorGroups:(weipu?weipuGroups:qizhengGroups)))));
 const [expanded,setExpanded]=useState(false);
 const [focusedRole]=useState(()=>new URLSearchParams(location.search).get('role')||'');
 const back=getCompanyReturnTarget();
 const choices=useMemo(()=>p?[...new Set([
  ...p.preferredMajors,
  ...p.jobs.flatMap(j=>[...j.majorNames,...j.editorialRelatedMajors])
 ])].slice(0,22):[],[p]);
 const matches=useMemo(()=>p?.jobs.filter(job=>{
  if(!major)return true;
  if(bodor)return job.category===major;
  if(pxw)return job.category===major;
  if(minieye)return job.category===major;
  if(batch3756)return job.category===major;
  if(keyence)return major==='专业不限'&&job.majorUnrestricted;
  if(showcase){const g=majorGroups.find(g=>g.label===major);return !!g&&g.majors.some(name=>roleMatches(job,name));}
  return roleMatches(job,major);
 })||[],[p,major,bodor,pxw,minieye,keyence,batch3756,showcase,majorGroups]);
 if(!p)return <Shell user={user}><section className="hhba-v2-company-status" role="alert">企业档案未加入主站数据目录。<p><Link to="/candidate/jobs">返回招聘市场</Link></p></section></Shell>;
 return <Shell user={user}>
  <article className={"company-profile hhba-kpmg-compact"+(showcase?" hhba-v2-showcase":"")+(weipu?" hhba-v2-weipu":"")+(bodor||pxw||keyence||minieye||batch3756?" hhba-v2-bodor":"")+(pxw?" hhba-v2-pxw":"")+(minieye?" hhba-v2-minieye":"")+(keyence?" hhba-v2-keyence":"")+(qizheng?" hhba-v2-qizheng":"")} data-company-template="unified-v2" data-domestic-rebuild="v2" data-employer-id={p.id}>
   <nav className="company-profile-top" aria-label="企业详情导航">
    <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState}><ArrowLeft size={15}/> 返回上一页</Link>
    <Link to="/candidate/jobs">招聘市场 <ArrowRight size={15}/></Link>
   </nav>
   <section className="hhba-kpmg-hero">
    <header className="hhba-kpmg-identity">
     <div className="hhba-kpmg-logo"><img src={asset(p.media.logo)} alt={p.name+' Logo'} loading="eager"/></div>
     <div className="hhba-kpmg-identity-copy">
      <span className="hhba-kpmg-kicker">HHBA / COMPANY PROFILE</span>
      <h1>{p.displayName||p.name} <span>{p.englishName}</span></h1><p>{p.subtitle}</p>
     </div>
     {p.recruitment.status!=='unconfirmed'&&<a className="hhba-kpmg-quick-link" data-hhba-recruitment-outbound="true"
      href={p.recruitment.url} rel="noopener noreferrer" target="_blank">{p.recruitment.label} <ExternalLink size={14}/></a>}
    </header>
    <div className="hhba-kpmg-photo-grid">{p.media.photos.map(photo=><figure key={photo.path}>
     <img src={asset(photo.path)} alt={photo.alt} loading="lazy"/>
     <figcaption><span>{photo.caption}</span><small>{photo.note}</small></figcaption>
    </figure>)}</div>
    <p className="hhba-hypergryph-photo-note">{p.photoNote}</p>
   </section>
   {showcase&&<section className="hhba-kpmg-section hhba-v2-qizheng-majors" aria-label="适合哪些专业背景">
     <div className="hhba-kpmg-section-heading"><div><h2>适合哪些专业背景？</h2><p>点击专业标签，下方只显示与该方向有关的岗位。专业匹配仅供参考，不代表满足官方报名条件。{keyence?' 基恩士官方2027届校园招聘专业不限，目前仅确认一个岗位方向。':''}</p></div></div>
     <div className="hhba-v2-company-chips">
      <button type="button" className={!major?'selected':''} onClick={()=>setMajor('')}>全部专业 ({p.jobs.length})</button>
      {majorGroups.map(g=><button type="button" key={g.label} className={major===g.label?'selected':''} onClick={()=>setMajor(g.label)}>
       {g.label} ({p.jobs.filter(j=>keyence?g.label==='专业不限'&&j.majorUnrestricted:(bodor||pxw||minieye||batch3756?j.category===g.label:g.majors.some(name=>roleMatches(j,name)))).length})</button>)}
     </div>
    </section>}
   <section className="hhba-kpmg-section hhba-v2-company-jobs" aria-label="招聘岗位">
    {showcase?<div className="hhba-kpmg-section-heading"><div><h2>招聘岗位</h2><p>{major||'全部专业'} · {matches.length} 条岗位资料。当前申请状态请以{batch3756?p.recruitment.label:(minieye?'佑驾创新2027校园招聘系统':(keyence?'基恩士官方招聘系统':(pxw?'鹏芯微校园招聘系统':(bodor?'邦德激光招聘系统':(weipu?'微谱招聘系统':'奇正集团官网')))))}为准。</p></div></div>:null}
    {!showcase&&<>
    <div className="hhba-kpmg-section-heading"><div><h2>岗位与所学专业</h2>
     <p>{p.majorIntro}</p></div></div>
    <div className="hhba-v2-company-chips">
     <button type="button" className={!major?'selected':''} onClick={()=>setMajor('')}>全部岗位 ({p.jobs.length})</button>
     {choices.map(name=>{
      const count=p.jobs.filter(j=>roleMatches(j,name)).length;
      return <button type="button" key={name} className={major===name?'selected':''}
       onClick={()=>setMajor(name)}>{name} ({count})</button>;
     })}
    </div>
    <p className="hhba-v2-company-note"><GraduationCap size={15}/> 该专业筛选仅依据已公开方向辅助匹配，不代表满足全部招聘资格。职位是否仍开放请以官方招聘站为准。</p>
    </>}
    <div className="hhba-v2-company-role-grid">{matches.map(job=>
     <article className="hhba-v2-company-role" key={job.id} id={'role-'+job.id} data-focus={focusedRole===job.id?'true':'false'}>
      <div className="hhba-v2-company-role-head"><h3>{job.title}</h3>{!detailedCards&&<small>{job.educationLabel}</small>}</div>
      {detailedCards&&<p className="hhba-v2-weipu-education">{job.educationLabel} · 具体条件以官方岗位为准</p>}
      <p className={detailedCards?'hhba-v2-weipu-description':''}>{job.summary}</p>
      <small className={detailedCards?'hhba-v2-weipu-location':''}>{detailedCards?'工作地点：'+job.city:job.city}</small>
      <details open={focusedRole===job.id}>
       <summary>查看岗位要求 <ChevronDown size={14}/></summary>
       <p>{job.requirements}</p>
       {detailedCards&&<div className="hhba-v2-weipu-detail-links">
        <Link to={'/candidate/jobs/'+encodeURIComponent('cn-v2-profile-'+p.id+'-'+job.id)}>站内岗位详情 <ArrowRight size={13}/></Link>
        <a href={p.recruitment.url} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">官方招聘入口 <ExternalLink size={13}/></a>
       </div>}
      </details>
      {showcase&&!detailedCards&&<div className="hhba-v2-qizheng-role-actions">
       <Link to={'/candidate/jobs/'+encodeURIComponent('cn-v2-profile-'+p.id+'-'+job.id)}>查看详情 <ArrowRight size={13}/></Link>
       <a href={p.recruitment.url} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true">查看官网 <ExternalLink size={13}/></a>
      </div>}
     </article>)}</div>
    {!matches.length&&<p className="hhba-v2-company-no-roles">该专业暂无已收录的对应岗位方向。请切换专业或选择全部岗位。</p>}
   </section>
   <section className="hhba-kpmg-section">
    <div className="hhba-kpmg-section-heading"><div><h2>主要业务与专业服务</h2>
     <p>{p.overview} 企业业务范围不代表目前全部开放招聘。</p></div></div>
    <div className="hhba-kpmg-service-grid">{p.business.slice(0,showcase?6:(expanded?99:4)).map((service,i)=>
     <article className="hhba-kpmg-service" key={service.title}>
      <span className="hhba-kpmg-service-number">{String(i+1).padStart(2,'0')} / 业务领域</span>
      <h3>{service.title}</h3><p>{service.description}</p><span className="hhba-kpmg-service-tags">{service.tags}</span>
      <details><summary>了解业务详情 <ChevronDown size={14}/></summary>
       <div className="hhba-kpmg-service-detail"><ul>{service.details.map(item=><li key={item}>{item}</li>)}</ul></div>
      </details>
     </article>)}</div>
    {!showcase&&p.business.length>4&&<button type="button" className="hhba-kpmg-service-more" onClick={()=>setExpanded(x=>!x)}>
     {expanded?'收起其他业务':'查看更多业务（共 '+p.business.length+' 项）'} <ChevronDown size={15}/></button>}
   </section>
  </article>
 </Shell>;
}
