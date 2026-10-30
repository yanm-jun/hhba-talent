import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, ExternalLink, Search, Sparkles, Building2 } from 'lucide-react';
import catalog from '../data/aiCompanyCatalog.json';
import { verifiedBrandRecords } from '../services/verifiedBrandRegistry';
import { Link } from '../router';
import '../styles/ai-company-search.css';

type Company={id:string;name:string;industry:string;overview:string;route:string|null;careers:string|null;lastReviewed:string;provenance:string};
type Result={id:string;reason:string;directions:string[]};
type MatchResponse={status:string;recommendations:Result[]};
const companies:Company[]=catalog.companies;
const STATIC_PREVIEW=import.meta.env.VITE_HHBA_COMPANY_PREVIEW==='1';
const RAW_ENDPOINT=(import.meta.env.VITE_HHBA_COMPANY_MATCH_API_ORIGIN||'').trim();
const quickBrands=['OpenAI','Anthropic','SpaceX'].map(name=>{
 const record=verifiedBrandRecords().find(brand=>brand.company===name);
 return record?{name,file:record.file,route:'/companies/'+name.toLowerCase()}:null;
}).filter((brand):brand is {name:string;file:string;route:string}=>!!brand);
const normalize=(s:string)=>s.trim().toLocaleLowerCase();
function apiEndpoint(){
 if(STATIC_PREVIEW||!RAW_ENDPOINT)return '';
 try{
  const url=new URL(RAW_ENDPOINT);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return '';
  return url.origin;
 }catch{return ''}
}
function verifiedUrl(value:string|null){
 if(!value)return '';
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}
 catch{return ''}
}
// Preview and API-offline fallback: keyword discovery only, NEVER career-fit scoring.
const keywords=['OpenAI','Anthropic','SpaceX','比亚迪','上汽','长城汽车','宁德时代','小米',
 '汽车','人工智能','教育','零售','制造','物流','能源','金融','支付','互联网','网络安全','软件','电商','航天'];
function keywordSearch(input:string):Company[]{
 const text=normalize(input);
 if(text.length<2)return [];
 const terms=keywords.filter(term=>text.includes(normalize(term)));
 if(!terms.length)terms.push(text);
 return companies.map(company=>{
  const target=normalize([company.name,company.industry,company.overview].join(' '));
  const name=normalize(company.name);
  const rank=terms.reduce((total,term)=>{
   const t=normalize(term);
   return total+(name.includes(t)?4:target.includes(t)?1:0);
  },0);
  return {company,rank};
 }).filter(row=>row.rank>0).sort((a,b)=>b.rank-a.rank||a.company.name.localeCompare(b.company.name,'zh-CN'))
   .slice(0,12).map(row=>row.company);
}

export function AICompanySearch(){
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState<'checking'|'ready'|'offline'>('checking');
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [localResults,setLocalResults]=useState<Company[]|null>(null);
 const [aiResults,setAiResults]=useState<Result[]|null>(null);
 const api=apiEndpoint();
 const byId=useMemo(()=>new Map(companies.map(c=>[c.id,c])),[]);
 useEffect(()=>{
  if(!api){setStatus('offline');return;}
  const controller=new AbortController();
  fetch(api+'/api/v1/company-match/status',{signal:controller.signal,cache:'no-store',credentials:'omit'})
   .then(reply=>reply.ok?reply.json():Promise.reject(Error('unavailable')))
   .then(body=>setStatus(body.enabled===true?'ready':'offline'))
   .catch(()=>{if(!controller.signal.aborted)setStatus('offline');});
  return()=>controller.abort();
 },[api]);
 const matched=useMemo(()=>aiResults?.filter(r=>typeof r.id==='string'&&typeof r.reason==='string'&&
  Array.isArray(r.directions)).map(result=>({company:byId.get(result.id),result}))
  .filter(row=>!!row.company)||[],[aiResults,byId]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const value=query.trim();
  if(value.length<2){setError('请输入企业名称、行业或你的求职方向。');return;}
  if(busy)return;
  if(status==='ready'&&value.length<5){setError('请多描述一点你的学历、经历或求职方向。');return;}
  if(status==='ready'&&!consent){setError('使用 AI 前请先同意下方的信息处理说明。');return;}
  setLocalResults(null);setAiResults(null);setError('');
  if(status!=='ready'){
   setLocalResults(keywordSearch(value));
   return;
  }
  setBusy(true);
  try{
   const reply=await fetch(api+'/api/v1/company-match',{
    method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:value,consent:true})
   });
   if(!reply.ok)throw Error(reply.status===429?'AI 试用额度已用完，请稍后再试。':'智能搜索暂时不可用，可以尝试稍后重试。');
   const data=await reply.json() as MatchResponse;
   if(data.status!=='COMPLETE'||!Array.isArray(data.recommendations))throw Error('返回数据不完整，请重试。');
   setAiResults(data.recommendations);
  }catch(cause){setError(cause instanceof Error?cause.message:'连接失败，请稍后重试。')}
  finally{setBusy(false)}
 }
 function updateQuery(value:string){setQuery(value);setError('');setLocalResults(null);setAiResults(null)}
 const isAi=status==='ready';
 return <section className="ai-company-search" aria-label="企业智能搜索">
  <form className="ai-company-single-search" onSubmit={submit} role="search">
   <Search size={19} aria-hidden="true" className="ai-company-search-icon"/>
   <input type="search" value={query} onChange={e=>updateQuery(e.target.value)}
    maxLength={500} aria-label="搜索企业或描述自己的求职需求"
    placeholder="输入专业、学历、工作经历，或直接搜索企业名称…"/>
   <button type="submit" disabled={busy}>{isAi?<Sparkles size={16}/>:<Search size={16}/>}
    {busy?'搜索中…':isAi?'智能搜索':'搜索企业'}</button>
  </form>
  <div className="ai-company-search-bottom">
   {localResults===null&&aiResults===null&&<div className="ai-company-quick-links" aria-label="精选企业">
    <span>精选企业</span>
    {quickBrands.map(brand=><Link key={brand.name} to={brand.route}>
     <img src={import.meta.env.BASE_URL+'brands/'+brand.file} alt="" loading="eager"/>{brand.name}</Link>)}
   </div>}
   {isAi?<label className="ai-company-consent"><input type="checkbox" checked={consent}
      onChange={e=>setConsent(e.target.checked)}/>同意将本次求职描述发送至 DeepSeek 分析；请勿填写敏感身份信息。</label>:
    <span className="ai-company-source-note">{STATIC_PREVIEW?'预览模式：':'AI 尚未开启：'}当前只检索已整理的企业资料，不分析个人职业适配。</span>}
  </div>
  {error&&<p className="ai-company-error" role="alert">{error}</p>}
  {localResults!==null&&<div className="ai-company-results" data-testid="company-results" aria-live="polite">
   <div className="ai-company-results-head"><strong>企业资料搜索</strong><small>{localResults.length} 家 · 关键词检索，非 AI 推荐</small></div>
   {localResults.length===0?<p className="ai-company-empty">暂时没有命中的企业资料，试试企业名称或行业关键词。</p>:
    <div className="ai-company-grid">{localResults.map(c=><article className="ai-company-card" key={c.id}>
     <div className="ai-company-card-heading"><Building2 size={18}/><strong>{c.name}</strong><span>{c.industry}</span></div>
     <p>{c.provenance==='official_recruitment_entry_only'
       ?'这家企业的官方招聘入口曾经过核验，具体招聘岗位及资格仍需官网核对。'
       :c.overview.slice(0,150)}</p>
     <div className="ai-company-card-footer"><small>资料记录：{c.lastReviewed||'待核对'}</small>
      {c.route&&<Link to={c.route}>企业介绍 <ArrowRight size={14}/></Link>}
      {verifiedUrl(c.careers)&&<a data-hhba-recruitment-outbound="true" href={verifiedUrl(c.careers)} target="_blank" rel="noopener noreferrer">官方招聘 <ExternalLink size={14}/></a>}
     </div>
    </article>)}</div>}
  </div>}
  {aiResults!==null&&<div className="ai-company-results" data-testid="company-results" aria-live="polite">
   <div className="ai-company-results-head"><strong>企业智能推荐</strong><small>{matched.length} 家 · 企业方向参考</small></div>
   {matched.length===0?<p className="ai-company-empty">目前资料不足以形成可靠推荐，请补充职业方向或相关经历。</p>:
    <div className="ai-company-grid">{matched.map(({company,result})=>company&&<article className="ai-company-card" key={company.id}>
     <div className="ai-company-card-heading"><Building2 size={18}/><strong>{company.name}</strong><span>{company.industry}</span></div>
     <p>{result.reason}</p>
     {result.directions.length>0&&<p className="ai-company-directions">{result.directions.join(' · ')}</p>}
     <div className="ai-company-card-footer"><small>不代表当前在招或保证符合任职资格</small>
      {company.route&&<Link to={company.route}>企业介绍 <ArrowRight size={14}/></Link>}
      {verifiedUrl(company.careers)&&<a data-hhba-recruitment-outbound="true" href={verifiedUrl(company.careers)} target="_blank" rel="noopener noreferrer">官方招聘 <ExternalLink size={14}/></a>}
     </div>
    </article>)}</div>}
  </div>}
 </section>;
}
