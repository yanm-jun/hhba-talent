import {useEffect,useMemo,useState} from 'react';
import {ChevronDown,ChevronUp,ExternalLink,Search} from 'lucide-react';

type SourceState='candidate'|'reviewed_history';
type SearchRow={company:string;url:string;review:SourceState;halls:string[]};
type SearchIndex={kind:'HHBA_DIRECTORY_GLOBAL_SEARCH_V1';asOf:string;records:SearchRow[]};
type Hall={id:string;label:string};
type CompanyResult={company:string;links:SearchRow[];halls:string[]};

const ROOT=import.meta.env.BASE_URL+'recruitment-library/v1/';
const PAGE_SIZE=8;
let cachedSearch:Promise<SearchIndex>|null=null;

function safeUrl(raw:string){
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
   url.hostname.includes('.')&&url.hostname!=='localhost'?url.href:'';
 }catch{return ''}
}
function getIndex(asOf:string){
 if(!cachedSearch){
  cachedSearch=fetch(ROOT+'search.json',{cache:'force-cache'}).then(async response=>{
   if(!response.ok)throw Error('招聘目录暂时无法读取');
   const data=await response.json() as SearchIndex;
   if(data?.kind!=='HHBA_DIRECTORY_GLOBAL_SEARCH_V1'||!Array.isArray(data.records))
    throw Error('招聘目录格式异常');
   return data;
  }).catch(error=>{cachedSearch=null;throw error});
 }
 return cachedSearch.then(data=>{
  if(data.asOf!==asOf)throw Error('目录版本未同步，请刷新后再试');
  return data;
 });
}
function normalizeName(text:string){return text.normalize('NFKC').trim().toLocaleLowerCase()}
function groupResults(records:SearchRow[],query:string){
 const q=normalizeName(query);
 if(!q)return [];
 const groups=new Map<string,CompanyResult>();
 for(const row of records){
  if(!row||typeof row.company!=='string'||!normalizeName(row.company).includes(q)||
     typeof row.url!=='string'||!safeUrl(row.url)||!Array.isArray(row.halls))continue;
  const key=normalizeName(row.company);
  const found=groups.get(key);
  if(found){
   if(!found.links.some(item=>item.url===row.url))found.links.push(row);
   for(const hall of row.halls)if(!found.halls.includes(hall))found.halls.push(hall);
  }else groups.set(key,{company:row.company,links:[row],halls:[...row.halls]});
 }
 const weight=(company:string)=>{
  const s=normalizeName(company);
  return s===q?0:s.startsWith(q)?1:2;
 };
 return [...groups.values()].sort((a,b)=>
  weight(a.company)-weight(b.company)||a.company.length-b.company.length||
  a.company.localeCompare(b.company,'zh-CN')
 );
}

export function GlobalCompanySearch({asOf,halls}:{asOf:string;halls:Hall[]}){
 const [query,setQuery]=useState('');
 const [index,setIndex]=useState<SearchIndex|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [page,setPage]=useState(1);
 const [expanded,setExpanded]=useState<string[]>([]);
 useEffect(()=>{
  if(!query.trim()||index)return;
  let active=true;
  setBusy(true);setError('');
  void getIndex(asOf).then(data=>{if(active)setIndex(data)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'搜索暂时不可用')})
   .finally(()=>{if(active)setBusy(false)});
  return ()=>{active=false};
 },[query,index,asOf]);
 const results=useMemo(()=>index?groupResults(index.records,query):[],[index,query]);
 const totalPages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));
 const currentPage=Math.min(page,totalPages);
 const visible=results.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const hallNames=useMemo(()=>new Map(halls.map(h=>[h.id,h.label])),[halls]);
 const changeQuery=(value:string)=>{setQuery(value);setPage(1);setExpanded([])};
 const searching=Boolean(query.trim());
 return <section className="hhba-company-finder" aria-labelledby="hhba-company-finder-title">
  <div className="hhba-company-finder-head">
   <h2 id="hhba-company-finder-title">直接搜索目标企业</h2>
   <p>知道想投哪家公司？输入名称，就能查看我们已收录的招聘入口。</p>
  </div>
  <label className="hhba-company-global-search">
   <Search size={21} aria-hidden="true"/>
   <input type="search" name="company" autoComplete="off" maxLength={80}
    value={query} onChange={e=>changeQuery(e.target.value)}
    placeholder="搜索企业名称，例如：华为、比亚迪、小米"
    aria-label="跨全部 17 个行业馆搜索企业名称"/>
   {query&&<button type="button" onClick={()=>changeQuery('')} aria-label="清除企业搜索">清除</button>}
  </label>
  {searching&&<div className="hhba-company-result-panel" aria-live="polite">
   {busy&&!index&&<p className="hhba-company-result-notice" role="status">正在查找现有企业目录…</p>}
   {error&&<p className="hhba-company-result-notice" role="alert">{error}。请稍后重试。</p>}
   {!busy&&!error&&index&&<>
    <div className="hhba-company-result-heading">
     <strong>{results.length?'找到 '+results.length+' 家相关企业':'未找到相关企业'}</strong>
     {results.length>0&&<small>优先显示名称完全相同的企业</small>}
    </div>
    {visible.map(result=>{
     const id=normalizeName(result.company);
     const open=expanded.includes(id);
     const links=open?result.links:result.links.slice(0,2);
     return <article key={id} className="hhba-company-result-card">
      <div className="hhba-company-result-main">
       <strong>{result.company}</strong>
       <small>{result.halls.map(h=>hallNames.get(h)).filter(Boolean).join(' · ')}</small>
      </div>
      <div className="hhba-company-result-links">
       {links.map(link=><div className="hhba-company-result-url" key={link.url}>
        <span className="hhba-company-result-urltext" title={link.url}>{link.url}</span>
        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer"
         data-hhba-recruitment-outbound="true"
         aria-label={'前往'+result.company+'的招聘网址'}>
         查看招聘网址 <ExternalLink size={14} aria-hidden="true"/>
        </a>
       </div>)}
       {result.links.length>2&&<button className="hhba-company-more" type="button"
        aria-expanded={open} onClick={()=>setExpanded(items=>open?items.filter(x=>x!==id):[...items,id])}>
        {open?<><ChevronUp size={14}/> 收起其他入口</>:<><ChevronDown size={14}/> 查看其他 {result.links.length-2} 个入口</>}
       </button>}
      </div>
     </article>;
    })}
    {!results.length&&<p className="hhba-company-result-notice">可以尝试企业简称、集团名称，或者在下方按行业浏览。</p>}
    {totalPages>1&&<nav className="hhba-library-pager" aria-label="全站企业搜索分页">
     <button type="button" disabled={currentPage===1} onClick={()=>setPage(x=>Math.max(1,x-1))}>上一页</button>
     <span>第 {currentPage} / {totalPages} 页</span>
     <button type="button" disabled={currentPage===totalPages} onClick={()=>setPage(x=>Math.min(totalPages,x+1))}>下一页</button>
    </nav>}
    <p className="hhba-company-result-disclaimer">部分招聘网址仍待复核，收录不代表当前正在招聘或与 HHBA 存在合作。请在企业网站核实主体和职位信息。</p>
   </>}
  </div>}
 </section>;
}
