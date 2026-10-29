import {ArrowRight,Building2,GraduationCap} from 'lucide-react';
import {Link} from '../router';
import {EmployerBrandLogo} from './EmployerBrandLogo';
import {domesticV2Records} from '../services/domesticRebuildJobs';
import {rebuildListFilter,safeOfficialJobUrl,type LiveFilters,type LiveJob} from '../services/liveRecruitment';
import {majorName,matchRoleToMajor} from '../services/majorJobMatching';
import '../styles/major-company-flow.css';

type EmployerBucket={route:string;name:string;roles:LiveJob[];related:number;unknown:number};
export function MajorEmployerRecommendations({filters}:{filters:LiveFilters}){
 const slug=filters.major_slug||'';
 if(!slug)return null;
 const jobs=domesticV2Records.filter(job=>!!job.employerRoute&&!!safeOfficialJobUrl(job)&&rebuildListFilter(job,filters));
 const grouped=new Map<string,EmployerBucket>();
 for(const job of jobs){
  const route=job.employerRoute!;
  let entry=grouped.get(route);
  if(!entry){
   const names:Record<string,string>={
    '/companies/autumn/cn-autumn-005':'顺丰（岗位主体：顺丰科技）',
    '/companies/autumn/cn-autumn-006':'网易游戏（互娱）'
   };
   entry={route,name:names[route]||job.companyZh||job.company,roles:[],related:0,unknown:0};
   grouped.set(route,entry);
  }
  entry.roles.push(job);
  if(matchRoleToMajor(job,slug)==='unknown')entry.unknown++;
  else entry.related++;
 }
 const list=[...grouped.values()].sort((a,b)=>b.related-a.related||b.roles.length-a.roles.length||a.name.localeCompare(b.name,'zh-CN'));
 return <section className="hhba-major-recommendations" aria-labelledby="hhba-recommended-employers">
  <div className="hhba-major-recommendations-heading">
   <div><small>HHBA / PROFESSIONAL MATCHING</small>
    <h2 id="hhba-recommended-employers"><Building2 size={19}/> 与「{majorName(slug)}」相关的企业</h2>
    <p>从已审核入库的企业与岗位中生成，点击企业后继续沿用当前专业。{filters.include_unknown_majors?'已包含专业条件未披露的职位。':'没有专业关联依据的职位不会伪装成匹配结果。'}</p>
   </div>
   <span>{list.length} 家企业</span>
  </div>
  {list.length>0?<div className="hhba-major-employer-grid">
   {list.map(company=><Link className="hhba-major-employer-card" key={company.route}
    to={company.route+'?major='+encodeURIComponent(slug)+(filters.include_unknown_majors?'&unknown=1':'')}>
    <span className="hhba-major-employer-logo"><EmployerBrandLogo job={company.roles[0]}/></span>
    <span className="hhba-major-employer-info">
     <strong>{company.name}</strong>
     <small>{company.related} 条专业关联 / 不限专业 · {company.unknown} 条待核验</small>
     <span>进入企业查看对应岗位 <ArrowRight size={14}/></span>
    </span>
   </Link>)}
  </div>:<div className="hhba-major-no-company">
   <GraduationCap size={18}/>
   <p>当前筛选条件下尚无具备专业关联依据的企业岗位。可以更换国家、城市或招聘类型，或勾选“查看专业条件未披露岗位”；这不代表其他企业没有机会。</p>
  </div>}
  <p className="hhba-major-recommendations-footnote">本区只统计已整理的国内 V2 企业岗位；100 条海外历史岗位的专业要求尚未结构化，不能自动判定为符合。企业相关不等于具体岗位的录用条件已确认。</p>
 </section>;
}
