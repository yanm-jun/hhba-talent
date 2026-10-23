import { useEffect,useMemo,useState } from 'react';
import { Building2,ArrowRight } from 'lucide-react';
import { Link } from '../router';
import { loadDomesticCompanies,searchDomesticCompanies,type DomesticCompany } from '../services/domesticCompanySearch';
import '../styles/domestic-company-search.css';
export function DomesticCompanyResults({query}:{query:string}){
 const [companies,setCompanies]=useState<DomesticCompany[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;loadDomesticCompanies().then(data=>{if(active){setCompanies(data);setError('')}})
  .catch(e=>{if(active)setError(e instanceof Error?e.message:'企业目录读取失败')})
  .finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[]);
 const matched=useMemo(()=>searchDomesticCompanies(companies,query),[companies,query]);
 if(!query.trim()||query.trim().length<2)return null;
 return <section className="domestic-company-result" aria-label="国内企业搜索结果">
 <div className="domestic-company-title"><h3>相关国内企业</h3><small>{busy?'载入企业名录中…':error||('匹配 '+matched.length+' 家 · 收录 '+companies.length.toLocaleString()+' 家')}</small></div>
 <p className="domestic-company-caution">按企业名称、主营业务资料和行业线索检索；不代表存在当前在招岗位，也不代表符合具体任职条件。</p>
 {!busy&&!error&&!matched.length&&<p className="domestic-company-empty">暂未找到有足够资料的相关企业，可尝试更具体的专业或行业关键词。</p>}
 <div className="domestic-company-grid">{matched.map(c=><Link className="domestic-company-card" key={c.id} to={c.route}>
  <div className="domestic-company-card-head"><Building2 size={20}/><strong>{c.name}</strong></div>
  <small>{c.industry}{c.city?' · '+c.city:''}</small>
  <p>{c.overview}</p><footer><span>{c.status==='industry_reviewed'?'已整理业务资料':c.status==='official_entry_only'?'已有历史招聘入口':'上市主体已收录 · 业务待核验'}</span><span>了解企业 <ArrowRight size={14}/></span></footer>
 </Link>)}</div>
 </section>;
}
