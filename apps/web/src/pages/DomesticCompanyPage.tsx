import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Building2,ShieldCheck,Search,ChevronDown} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import {loadDomesticCompanies,companyById,findParentCompany,findRelatedCompanies,type DomesticCompany} from '../services/domesticCompanySearch';
import type {User} from '../services/api';
import '../styles/domestic-company-search.css';
function httpsLink(raw?:string){
 if(!raw)return '';
 try{const value=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
  return value.protocol==='https:'&&!value.username&&!value.password?value.href:''}
 catch{return ''}
}
const typeLabel=(kind?:DomesticCompany['entityKind'])=>kind==='branch'?'分公司':kind==='business'?'业务板块':'企业主体';
export function DomesticCompanyPage({user,id}:{user:User|null;id:string}){
 const [all,setAll]=useState<DomesticCompany[]>([]);
 const [company,setCompany]=useState<DomesticCompany|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState('');const [shown,setShown]=useState(12);
 useEffect(()=>{
  let active=true;setLoading(true);setCompany(null);setSearch('');setShown(12);
  loadDomesticCompanies().then(items=>{if(active){setAll(items);setCompany(companyById(items,id));setError('')}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'无法读取企业档案')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[id]);
 const related=useMemo(()=>company?findRelatedCompanies(all,company):[],[all,company]);
 const parent=useMemo(()=>company?findParentCompany(all,company):null,[all,company]);
 const filtered=useMemo(()=>{const q=search.trim().toLocaleLowerCase().replace(/\s+/g,'');
  return q?related.filter(c=>[c.name,c.industry,c.city||'',c.parentName||'',...c.tags,...c.aliases||[]]
   .join(' ').toLocaleLowerCase().replace(/\s+/g,'').includes(q)):related;
 },[related,search]);
 return <Shell user={user}><article className="domestic-company-profile">
 <Link to="/candidate/jobs" className="domestic-company-back"><ArrowLeft size={16}/> 返回搜索</Link>
 {loading?<p role="status">正在读取企业档案…</p>:error?<p role="alert">{error}</p>:!company?<p>该企业资料暂未找到。</p>:<>
 <header><div className="domestic-company-profile-mark"><Building2 size={28}/></div>
  <div className="domestic-profile-identity"><span>HHBA · 国内企业与经营主体</span>
   <h1>{company.name}</h1><p>{company.industry}{company.city?' · '+company.city:''}</p>
   <small>{typeLabel(company.entityKind)}{company.relationLabel?' · '+company.relationLabel:''}</small>
  </div></header>
 <p className="domestic-company-disclaimer"><ShieldCheck size={17}/> HHBA 根据企业官方资料及交易所历史名录整理。企业关系不等于全部为直接控股；专业标签不代表正在招聘或任职资格。</p>
 {parent&&<section className="domestic-profile-parent">
  <h2>所属集团与经营主体</h2>
  <Link to={parent.route} className="domestic-parent-link">
   <Building2 size={18}/><strong>{parent.name}</strong><span>{company.relationLabel||'关联企业'}</span><ArrowRight size={16}/>
  </Link>
  {httpsLink(company.relationSourceUrl)&&<p className="domestic-company-note"><a target="_blank" rel="noopener noreferrer" href={httpsLink(company.relationSourceUrl)}>核对该企业关系的公开来源 <ExternalLink size={13}/></a></p>}
 </section>}
 <section><h2>{company.entityKind==='business'?'业务板块介绍':'企业介绍'}</h2>
  <p>{company.overview}</p>
  {company.legalName&&<p>登记名称：{company.legalName}</p>}
  {company.stockCode&&<p>证券代码：{company.stockCode}</p>}
  {company.entityKind==='business'&&<p className="domestic-company-note">该条目是业务板块，不自动视为独立法人公司。</p>}
 </section>
 <section><h2>业务方向与专业关联</h2>{company.tags.length?
  <div className="domestic-profile-tags">{company.tags.map(tag=><span key={tag}>{tag}</span>)}</div>:
  <p>该主体细分业务和对应专业尚未完成核验，暂不根据名称猜测岗位要求。</p>}
  <p className="domestic-company-note">专业关联只是业务方向参考，不代表招聘条件，也不代表具备相应岗位。</p>
 </section>
 {related.length>0&&<section className="domestic-relations-section" aria-label="旗下及关联企业">
  <div className="domestic-relations-head"><div><h2>旗下及关联企业</h2>
   <p>按公开的集团业务关系整理，共关联 {related.length} 条经营主体或业务板块记录。可直接搜索，无需逐层展开。</p></div></div>
  <label className="domestic-relations-search"><Search size={17}/>
   <input type="search" value={search} maxLength={90} onChange={e=>{setSearch(e.target.value);setShown(12)}}
    placeholder="搜索关联企业名称、专业或城市" aria-label="搜索旗下及关联企业"/></label>
  {filtered.length===0?<p className="domestic-company-note">当前没有匹配的关联企业。</p>:
   <div className="domestic-relations-grid">{filtered.slice(0,shown).map(item=><Link key={item.id}
    to={item.route} className="domestic-related-card">
    <div><strong>{item.name}</strong><span>{item.relationLabel||'关联企业'}</span></div>
    {item.parentName!==company.name&&<small>关联路径：{item.parentName}</small>}
    <p>{item.industry}{item.city?' · '+item.city:''}</p>
    <footer><span>{item.tags.slice(0,3).join(' · ')||'专业标签待完善'}</span><ArrowRight size={15}/></footer>
   </Link>)}</div>}
  {filtered.length>shown&&<button className="domestic-related-more" type="button" onClick={()=>setShown(s=>s+12)}>
   查看更多关联企业（剩余 {filtered.length-shown}） <ChevronDown size={16}/></button>}
 </section>}
 <section><h2>官网与核验来源</h2>
  {httpsLink(company.website)&&<p><a href={httpsLink(company.website)} target="_blank" rel="noopener noreferrer">企业官网或名录登记网址 <ExternalLink size={15}/></a></p>}
  {httpsLink(company.sourceUrl)&&<p><a href={httpsLink(company.sourceUrl)} target="_blank" rel="noopener noreferrer">企业资料来源 <ExternalLink size={15}/></a></p>}
  {company.relationSourceUrl&&company.relationSourceUrl!==company.sourceUrl&&httpsLink(company.relationSourceUrl)&&
   <p><a href={httpsLink(company.relationSourceUrl)} target="_blank" rel="noopener noreferrer">企业隶属与业务关系依据 <ExternalLink size={15}/></a></p>}
  <small>资料整理时间：{company.lastReviewed} · {company.status==='listed_identity_only'?'上市公司身份已收录，经营业务仍待核实':company.status==='official_entry_only'?'历史招聘入口信息': '公开业务信息已整理，股权及当前招聘状态需核对'}</small>
 </section>
 <section className="domestic-careers"><h2>招聘岗位与官方渠道</h2>
  <p>本站尚未对该主体提供可确认当前开放的独立岗位列表。招聘信息、岗位职责及任职要求以企业官方渠道为准。</p>
  {httpsLink(company.careers)?<>
   {company.careersShared&&<p className="domestic-company-note">以下是集团统一招聘入口，该主体名称在官方招聘公司筛选项中出现；不等于它有独立招聘网站或当前在招岗位。</p>}
   <a className="domestic-careers-link" href={httpsLink(company.careers)} target="_blank" rel="noopener noreferrer">
    {company.careersShared?'查看集团统一招聘入口':'查看官方招聘入口'} <ExternalLink size={17}/></a>
  </>:<p>暂未核验该主体独立的官方招聘入口，不提供猜测的岗位或网址。</p>}
 </section>
 </>}
 </article></Shell>;
}
