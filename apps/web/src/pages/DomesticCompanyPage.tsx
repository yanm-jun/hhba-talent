import {useEffect,useState} from 'react';
import {ArrowLeft,ExternalLink,Building2,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {loadDomesticCompanies,companyById,type DomesticCompany} from '../services/domesticCompanySearch';
import type {User} from '../services/api';
import '../styles/domestic-company-search.css';
function httpsLink(raw?:string){if(!raw)return '';
 try{const v=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);return v.protocol==='https:'&&!v.username&&!v.password?v.href:''}
 catch{return ''}}
export function DomesticCompanyPage({user,id}:{user:User|null;id:string}){
 const [company,setCompany]=useState<DomesticCompany|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;loadDomesticCompanies().then(all=>{if(active){setCompany(companyById(all,id));setError('')}})
 .catch(e=>{if(active)setError(e instanceof Error?e.message:'无法读取企业档案')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[id]);
 return <Shell user={user}><article className="domestic-company-profile">
 <Link to="/candidate/jobs" className="domestic-company-back"><ArrowLeft size={16}/> 返回搜索</Link>
 {loading?<p>正在读取企业档案…</p>:error?<p role="alert">{error}</p>:!company?<p>该企业资料暂未找到。</p>:<>
 <header><div className="domestic-company-profile-mark"><Building2 size={28}/></div><div><span>HHBA · 国内企业资料</span><h1>{company.name}</h1><p>{company.industry}{company.city?' · '+company.city:''}</p></div></header>
 <p className="domestic-company-disclaimer"><ShieldCheck size={17}/> 企业资料由 HHBA 根据公开来源独立整理；不代表与企业存在招聘合作，也不代表当前有岗位开放。</p>
 <section><h2>企业介绍</h2><p>{company.overview}</p>{company.legalName&&<p>登记名称：{company.legalName}</p>}
 {company.stockCode&&<p>证券代码：{company.stockCode}</p>}</section>
 <section><h2>业务方向与专业关联</h2>{company.tags.length?
 <div className="domestic-profile-tags">{company.tags.map(tag=><span key={tag}>{tag}</span>)}</div>:
 <p>该企业的细分业务和对应专业尚未完成核验，不根据行业大类推测岗位需求。</p>}
 <p className="domestic-company-note">专业关联是业务方向参考，不是岗位招聘条件。</p></section>
 <section><h2>官方网站与公开来源</h2>
 {httpsLink(company.website)&&<p><a href={httpsLink(company.website)} target="_blank" rel="noopener noreferrer">企业官方网站 <ExternalLink size={15}/></a></p>}
 {httpsLink(company.sourceUrl)&&<p><a href={httpsLink(company.sourceUrl)} target="_blank" rel="noopener noreferrer">企业资料来源 <ExternalLink size={15}/></a></p>}
 <small>名录/资料日期：{company.lastReviewed} · {company.status==='listed_identity_only'?'企业上市身份已收录，业务信息未逐项核对':company.status==='official_entry_only'?'历史官方招聘入口记录': '业务资料已整理，招聘状态未核验'}</small></section>
 <section className="domestic-careers"><h2>企业招聘</h2><p>请在企业官方渠道确认当前岗位、工作地点及投递条件。</p>
 {httpsLink(company.careers)?<a className="domestic-careers-link" href={httpsLink(company.careers)} target="_blank" rel="noopener noreferrer">查看官方招聘入口 <ExternalLink size={17}/></a>:
 <p>尚未核验可直接访问的官方招聘入口；暂不提供猜测的招聘链接。</p>}</section>
 </>}
 </article></Shell>
}
