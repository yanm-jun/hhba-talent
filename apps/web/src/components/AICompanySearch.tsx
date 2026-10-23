import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, Building2, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import reviewed from '../data/reviewedEmployers.json';
import batchA from '../data/companyEditorialAdditionalA.json';
import batchB from '../data/companyEditorialAdditionalB.json';
import batchC from '../data/companyEditorialAdditionalC.json';
import batchD from '../data/companyEditorialAdditionalD.json';
import { companyProfiles } from '../services/companyProfiles';
import { Link } from '../router';
import '../styles/ai-company-search.css';

type Company={id:string;name:string;industry:string;overview:string;route:string;careers?:string};
type Result={id:string;reason:string;directions:string[]};
type MatchResponse={status:string;recommendations:Result[];notice:string};
const ENDPOINT=(import.meta.env.VITE_HHBA_COMPANY_MATCH_API_ORIGIN||'').trim().replace(/\/$/,'');
function endpoint(){
  if(!ENDPOINT)return '';
  try {const url=new URL(ENDPOINT);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&!url.pathname.replace(/\//g,'')?url.origin:'';}
  catch {return '';}
}
const normalize=(text:string)=>text.trim().toLocaleLowerCase();
const editorialRows=[...reviewed.profiles,...batchA.profiles,...batchB.profiles,...batchC.profiles,...batchD.profiles];
const candidates:Company[]=(()=>{
 const list:Company[]=Object.values(companyProfiles).map(p=>({
  id:p.slug,name:p.name,industry:p.industry.zh,overview:p.overview.map(t=>t.zh).join(' ').slice(0,600),
  route:'/companies/'+p.slug,careers:p.careers
 }));
 const seen=new Set(list.map(x=>normalize(x.name)));
 for(const raw of editorialRows){
  if(raw.status!=='VERIFIED'||!raw.id||!raw.name||!Array.isArray(raw.overview)||!raw.overview.length||
     !raw.industry?.zh||seen.has(normalize(raw.name)))continue;
  seen.add(normalize(raw.name));
  list.push({id:raw.id,name:raw.name,industry:raw.industry.zh,
   overview:raw.overview.map(p=>p.zh).join(' ').slice(0,600),route:'/companies/id/'+raw.id});
 }
 return list;
})();
function safeCareer(url?:string){
 if(!url)return '';
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return ''}
}
export function AICompanySearch(){
 const [query,setQuery]=useState('');
 const [consent,setConsent]=useState(false);
 const [status,setStatus]=useState<'checking'|'ready'|'disabled'>('checking');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [results,setResults]=useState<Result[]|null>(null);
 const [browse,setBrowse]=useState('');
 const api=endpoint();
 useEffect(()=>{
  if(!api){setStatus('disabled');return;}
  const ctrl=new AbortController();
  fetch(api+'/api/v1/company-match/status',{signal:ctrl.signal,credentials:'omit',cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(Error('unavailable')))
   .then(v=>setStatus(v.enabled===true?'ready':'disabled')).catch(()=>{if(!ctrl.signal.aborted)setStatus('disabled')});
  return()=>ctrl.abort();
 },[api]);
 const byId=useMemo(()=>new Map(candidates.map(c=>[c.id,c])),[]);
 const matches=useMemo(()=>results?.map(r=>({company:byId.get(r.id),result:r})).filter(x=>!!x.company)||[],[results,byId]);
 const browsed=useMemo(()=>{const q=normalize(browse);return q?candidates.filter(c=>normalize(c.name+' '+c.industry+' '+c.overview).includes(q)).slice(0,20):[];},[browse]);
 async function run(){
  if(query.trim().length<5){setError('请补充专业、学历、经历或期望方向。');return;}
  if(!consent){setError('请先确认 AI 处理说明。');return;}
  if(status!=='ready'){setError('智能匹配服务尚未启用。可以先浏览企业资料。');return;}
  setError('');setResults(null);setBusy(true);
  try{
   const response=await fetch(api+'/api/v1/company-match',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',
    body:JSON.stringify({query:query.trim(),consent:true,companies:candidates.slice(0,40).map(c=>({
      id:c.id,name:c.name,industry:c.industry,overview:c.overview
    }))})
   });
   if(!response.ok)throw Error(response.status===429?'今日 AI 试用额度已用完或服务繁忙。':'AI 匹配暂时不可用。');
   const data=await response.json() as MatchResponse;
   if(data.status!=='COMPLETE'||!Array.isArray(data.recommendations))throw Error('AI 返回数据不完整。');
   setResults(data.recommendations);
  }catch(e){setError(e instanceof Error?e.message:'网络连接失败。');}
  finally{setBusy(false)}
 }
 return <section className="ai-company-search" aria-labelledby="ai-company-title">
  <header><div><small>HHBA · AI COMPANY DISCOVERY</small><h2 id="ai-company-title">智能找企业</h2>
   <p>描述你的专业、学历、工作经历和求职方向，优先匹配企业，而不是只搜索岗位名称。</p></div>
   <span className="ai-company-status"><BrainCircuit size={15}/>{status==='ready'?'AI 试用可用':status==='checking'?'正在检查服务':'AI 尚未启用'}</span></header>
  <label className="ai-company-input"><Search size={18}/><textarea value={query} onChange={e=>setQuery(e.target.value)} maxLength={500} rows={2} placeholder="例如：舞蹈学本科，做过一年汽车销售和门店督导，想去上海找大型企业的培训或运营工作"/></label>
  <div className="ai-company-submit"><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
   我同意将输入的求职描述发送给 DeepSeek 分析；请勿输入身份证、住址等敏感信息。</label>
   <button type="button" disabled={busy||status!=='ready'} onClick={run}>
    {busy?'正在匹配企业…':'智能匹配企业'} <ArrowRight size={16}/></button></div>
  {error&&<p className="ai-company-notice" role="alert">{error}</p>}
  <p className="ai-company-note"><ShieldCheck size={15}/> 推荐仅基于企业介绍与个人自述，不代表当前在招、符合硬性资格或保证录用。首版仅覆盖已整理的企业样本。</p>
  {results!==null&&<div className="ai-company-results" aria-live="polite">
   <h3>企业匹配结果 · {matches.length} 家</h3>
   {matches.length===0?<p>没有足够依据推荐候选企业，可以尝试补充工作经历或目标方向。</p>:
    matches.map(({company,result})=>company&&<article key={company.id} className="ai-company-card">
     <div className="ai-company-card-header"><Building2 size={20}/><div><strong>{company.name}</strong><small>{company.industry}</small></div></div>
     <p>{result.reason}</p>{result.directions.length>0&&<p className="ai-company-tags">{result.directions.map(d=><span key={d}>{d}</span>)}</p>}
     <div className="ai-company-links"><Link to={company.route}>查看 HHBA 企业详情 <ArrowRight size={14}/></Link>
      {safeCareer(company.careers)&&<a href={safeCareer(company.careers)} target="_blank" rel="noopener noreferrer">官方招聘网站 <ExternalLink size={14}/></a>}
     </div>
    </article>)}
  </div>}
  <div className="ai-company-browse"><label>不使用 AI 也能免费查找现有企业资料
   <input value={browse} onChange={e=>setBrowse(e.target.value)} maxLength={100} placeholder="输入企业名称或行业"/></label>
   {browsed.length>0&&<div className="ai-company-browse-grid">{browsed.map(c=><Link to={c.route} key={c.id}><Building2 size={16}/><span>{c.name}</span><ArrowRight size={14}/></Link>)}</div>}
   <Link to="/companies" className="ai-company-all">浏览全部企业资料 <ArrowRight size={14}/></Link>
  </div>
 </section>;
}
