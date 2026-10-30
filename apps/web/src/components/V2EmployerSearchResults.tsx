import {useEffect,useMemo,useState} from 'react';
import {searchEmployersByIndividualRoles,isMajorSearch} from '../services/employerJobSearch.mjs';
import {MAJOR_OPTIONS} from '../services/domesticMajors';
import {ArrowRight,Building2} from 'lucide-react';
import {employerProfiles} from '../services/employerProfiles';
import '../styles/employer-v2-search.css';

type PublishedV2Employer={
 id:string;name:string;englishName:string;aliases:string[];industry:string;
 overview:string;media:{logo:string};jobs:{id:string;title:string;city:string;majorNames:string[];editorialRelatedMajors:string[]}[];
 lastReviewed:string;
};
type V2Index={schemaVersion:1;employers:PublishedV2Employer[]};
// The ONE maintained employer catalog is bundled from the same main branch.
// Never fetch a separately generated branch index at runtime.
function approvedV2Employers():Promise<PublishedV2Employer[]>{
 return Promise.resolve(employerProfiles.filter(p=>p.jobs.length>0));
}
const knownMajorNames=MAJOR_OPTIONS.map(m=>m.name);
export function V2EmployerSearchResults({query,scope='',country='',major='',onMatchChange}:{
 query:string;scope?:string;country?:string;major?:string;onMatchChange?:(yes:boolean)=>void
}){
 const [employers,setEmployers]=useState<PublishedV2Employer[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  approvedV2Employers().then(data=>{if(active){setEmployers(data);setError('')}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'V2 企业索引读取失败')});
  return()=>{active=false};
 },[]);
 const matches=useMemo(()=>{
  if(!query.trim()||scope==='global'||(country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country)))return [];
  return searchEmployersByIndividualRoles(employers,query,{selectedMajor:major,knownMajors:knownMajorNames});
 },[employers,query,scope,country,major]);
 const majorIntent=isMajorSearch(query,knownMajorNames);
 useEffect(()=>{onMatchChange?.(matches.length>0)},[matches.length,onMatchChange]);
 if(!query.trim()||scope==='global'||country&&!/^(cn|chn|china|中国|中国大陆)$/i.test(country))return null;
 if(error)return <p className="hhba-v2-search-alert" role="status">V2 企业数据暂时无法读取：{error}</p>;
 if(!matches.length)return null;
 return <section className="hhba-v2-search" aria-label="HHBA V2 已收录企业与校招岗位">
  <div className="hhba-v2-search-heading">
   <h2>招聘市场</h2>
   <span>{matches.length} 家企业 · 独立核验的招聘方向，开放状态待官网确认</span>
  </div>
  {matches.map(({profile:p,jobs,matchedBy})=>{
   const root=import.meta.env.BASE_URL;
   const detail=root+'companies/autumn/'+p.id+'/';
   return <article key={p.id} className="hhba-v2-employer-hit" data-v2-search-company={p.id} data-v2-match-kind={matchedBy}>
    <div className="hhba-v2-employer-heading">
     <div className="hhba-v2-employer-logo">
      {p.media?.logo?<img alt={p.name+'品牌Logo'} src={root+p.media.logo} onError={e=>{e.currentTarget.style.visibility='hidden'}}/>:<Building2 size={22}/>}
     </div>
     <div className="hhba-v2-employer-identity">
      <strong>{p.name}</strong><span>{p.englishName} · {p.industry}</span>
     </div>
     <a href={detail}>查看企业详情 <ArrowRight size={15}/></a>
    </div>
    <p className="hhba-v2-employer-overview">{p.overview}</p>
    <div className="hhba-v2-job-subheading">{matchedBy==='company'&&!major?'已收录的':'筛选匹配的'} {jobs.length} 个岗位方向 <small>{majorIntent?'按专业关联逐岗筛选 · 非官方资格认定 · ':''}历史校招资料 · 当前投递状态未确认</small></div>
    <div className="hhba-v2-job-list">
     {jobs.map(job=><a key={job.id} href={detail+'?role='+encodeURIComponent(job.id)} className="hhba-v2-job-result">
      <b>{job.title}</b><small>{job.city}</small><span>查看岗位与专业匹配 <ArrowRight size={13}/></span>
     </a>)}
    </div>
   </article>
  })}
 </section>
}
