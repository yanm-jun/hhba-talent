import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,Building2,ExternalLink,Search,GraduationCap,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,getCompanyReturnTarget} from '../router';
import {companiesForMajor,majorById,relatedCompanyCount} from '../services/domesticMajors';
import type {User} from '../services/api';
import '../styles/domestic-company-search.css';
function httpsLink(value?:string){
 if(!value)return '';
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return ''}
}
export function MajorCompaniesPage({user,slug}:{user:User|null;slug:string}){
 const major=majorById(slug);
 const back=getCompanyReturnTarget();
 const [search,setSearch]=useState('');
 const records=useMemo(()=>companiesForMajor(slug),[slug]);
 const filtered=useMemo(()=>records.filter(({company})=>(company.name+' '+(company.parentName||'')+' '+company.industry+' '+(company.city||'')).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[records,search]);
 return <Shell user={user}><article className="domestic-company-profile domestic-major-page">
  <Link to={back.to} restoreScrollY={back.scrollY} restoreMarketState={back.marketState} className="domestic-company-back"><ArrowLeft size={16}/> 返回上一页</Link>
  {!major?<div className="domestic-major-inner"><h1>暂无该专业资料</h1><Link to="/candidate/jobs">返回企业搜索</Link></div>:<>
   <div className="domestic-major-header"><GraduationCap size={27}/><div><small>HHBA · 按专业发现企业</small><h1>{major.name}</h1><p>{major.description}</p></div></div>
   <p className="domestic-company-disclaimer"><ShieldCheck size={16}/> 以下根据公开业务信息和经整理的专业关联推荐企业，<strong>不代表这些企业目前正在招聘该专业学生。</strong> 当前岗位和专业条件请进入企业招聘官网核对。</p>
   <section aria-label="相关企业" className="domestic-major-section">
    <div className="domestic-major-controls"><div><h2>相关企业</h2><p>已整理 {relatedCompanyCount(slug)} 家相关企业与经营主体。可以进入详情，也可以通过已登记的招聘入口访问官网。</p></div>
     <label className="domestic-relations-search"><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="筛选企业或城市" aria-label="筛选相关企业"/></label>
    </div>
    <div className="domestic-major-results">{filtered.map(({company,matchedTags})=><div key={company.id} className="domestic-major-company">
     <div className="domestic-major-company-identity"><Building2 size={22}/><div><strong>{company.name}</strong><small>{company.industry}{company.city?' · '+company.city:''}</small>{company.parentName&&<small>关联：{company.parentName}</small>}</div></div>
     <p>{matchedTags.length?('业务关联：'+matchedTags.join('、')):'业务方向与本专业存在关联，具体工作内容请以企业官网说明为准。'}</p>
     <div className="domestic-major-actions"><Link to={company.route}>了解企业 <ArrowRight size={15}/></Link>
      {httpsLink(company.careers)&&<a data-hhba-recruitment-outbound="true" target="_blank" rel="noopener noreferrer" href={httpsLink(company.careers)}>查看官方招聘入口 <ExternalLink size={15}/></a>}</div>
    </div>)}</div>
    {!filtered.length&&<p className="domestic-company-note">当前没有符合条件的关联企业。</p>}
    {relatedCompanyCount(slug)>records.length&&<p className="domestic-company-note">优先展示资料较完整的前 {records.length} 家，其余企业可通过 HHBA 搜索框按名称查询。</p>}
   </section>
  </>}
 </article></Shell>;
}
