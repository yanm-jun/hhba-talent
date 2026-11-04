import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BriefcaseBusiness,Search,ShieldCheck} from 'lucide-react';
import {Link,navigate} from '../router';
import {Shell} from '../components/Shell';
import {buildSiteSearchIndex,searchSiteRecords,SITE_SEARCH_TABS,type SiteSearchKind,type SiteSearchRecord} from '../services/siteSearchIndex';
import {listJobs,localizedTitle,localizedCompany,localizedLocation,safeOfficialJobUrl,type LiveFilters,type LiveJob} from '../services/liveRecruitment';
import type {User} from '../services/api';
import '../styles/site-search.css';

type Category='all'|SiteSearchKind;
function queryFromAddress(){
 try{return new URLSearchParams(location.search).get('q')?.trim().slice(0,100)||'';}
 catch{return ''}
}
const labels:Record<SiteSearchKind,string>={
 page:'站内页面',job:'招聘岗位',company:'企业档案',policy:'人才政策',housing:'人才安居',study:'留学机会'
};
const baseFilters:LiveFilters={
 q:'',company:'',country:'',remote:false,recruitment_type:'',
 location_country:'',city:'',education:'',experience:'',major_slug:'',include_unknown_majors:false
};
function jobToRecord(j:LiveJob):SiteSearchRecord{
 return {id:'job:'+j.id,kind:'job',title:localizedTitle(j,'zh'),description:
   localizedCompany(j,'zh')+' · '+localizedLocation(j,'zh'),
  tags:[j.company,j.companyZh||'',j.recruitmentType||'',j.title],path:'/candidate/jobs/'+encodeURIComponent(j.id),
  status:j.currentApplicationVerified===false?'投递状态未核实':'请以招聘官网为准'};
}
const PER_PAGE=20;
export function SiteSearchPage({user}:{user:User|null}){
 const [query,setQuery]=useState(queryFromAddress);
 const [draft,setDraft]=useState(queryFromAddress);
 const [category,setCategory]=useState<Category>('all');
 const [page,setPage]=useState(1);
 const [jobs,setJobs]=useState<SiteSearchRecord[]>([]);
 const [jobTotal,setJobTotal]=useState(0);
 const [jobBusy,setJobBusy]=useState(false);
 const [jobError,setJobError]=useState('');
 useEffect(()=>{
  const sync=()=>{const q=queryFromAddress();setQuery(q);setDraft(q);setCategory('all');setPage(1)};
  addEventListener('popstate',sync);
  return()=>removeEventListener('popstate',sync);
 },[]);
 const catalog=useMemo(buildSiteSearchIndex,[]);
 const staticMatches=useMemo(()=>query?searchSiteRecords(catalog,query):[],[catalog,query]);
 useEffect(()=>{
  if(!query){setJobs([]);setJobTotal(0);setJobBusy(false);setJobError('');return}
  const controller=new AbortController();
  setJobs([]);setJobTotal(0);setJobError('');setJobBusy(true);
  void listJobs({...baseFilters,q:query},0,controller.signal)
    .then(result=>{
      if(controller.signal.aborted)return;
      setJobs(result.jobs.filter(j=>!!safeOfficialJobUrl(j)).map(jobToRecord));
      setJobTotal(result.total);
    })
    .catch(error=>{
      if(controller.signal.aborted)return;
      setJobError(error instanceof Error?error.message:'招聘数据暂不可用');
    })
    .finally(()=>{if(!controller.signal.aborted)setJobBusy(false)});
  return()=>controller.abort();
 },[query]);
 const filteredStatic=category==='all'?staticMatches:staticMatches.filter(x=>x.kind===category);
 const allMatches=useMemo(()=>{
  const combined=[...(category==='all'||category==='job'?jobs:[]),...filteredStatic];
  return combined.sort((a,b)=>
   // Job matches should appear prominently, not buried by generic company listings.
   (b.rank||0)+(b.kind==='job'?18:0)-(a.rank||0)-(a.kind==='job'?18:0));
 },[jobs,filteredStatic,category]);
 const visible=allMatches.slice((page-1)*PER_PAGE,page*PER_PAGE);
 const pageCount=Math.max(1,Math.ceil(allMatches.length/PER_PAGE));
 const moreJobs=(category==='all'||category==='job')&&jobTotal>jobs.length;
 function submit(e:React.FormEvent){e.preventDefault();const next=draft.trim().slice(0,100);
  navigate('/search'+(next?'?q='+encodeURIComponent(next):''));setQuery(next);setPage(1);setCategory('all');}
 function choose(k:Category){setCategory(k);setPage(1)}
 return <Shell user={user}>
  <section className="hhba-site-search-page" aria-labelledby="hhba-global-search-title">
   <p className="hhba-site-search-eyebrow">HHBA · ONE SEARCH, ALL PUBLIC CONTENT</p>
   <h1 id="hhba-global-search-title">搜索 HHBA</h1>
   <p className="hhba-site-search-intro">一个入口找到站内岗位、企业档案、人才政策、人才安居和留学资料。</p>
   <form role="search" className="hhba-site-search-main" onSubmit={submit}>
    <Search aria-hidden="true" size={22}/>
    <input aria-label="搜索 HHBA 全站内容" value={draft} onChange={e=>setDraft(e.target.value)}
       maxLength={100} autoFocus placeholder="搜索岗位、企业、城市政策、大学或留学方向"/>
    <button type="submit">搜索 <ArrowRight size={16}/></button>
   </form>
   {!query?<div className="hhba-site-search-guide">
     <h2>试试搜索这些内容</h2>
     <div className="hhba-site-search-chips">{['机械','济南硕士补贴','人才公寓','新西兰留学','迈诺特州立','实习'].map(s=>
      <button type="button" key={s} onClick={()=>{setDraft(s);navigate('/search?q='+encodeURIComponent(s));setQuery(s);setCategory('all');setPage(1)}}>{s}</button>)}</div>
    </div>:<>
    <div className="hhba-site-search-tabs" role="group" aria-label="搜索内容分类">
     {SITE_SEARCH_TABS.map(tab=><button type="button" key={tab.kind} aria-pressed={category===tab.kind}
      onClick={()=>choose(tab.kind)} className={category===tab.kind?'active':''}>{tab.label}</button>)}
    </div>
    <p className="hhba-site-search-count" aria-live="polite">
     {jobBusy&&['all','job'].includes(category)?'正在查询已收录岗位… · ':''}
     已找到 {allMatches.length} 条{category==='all'?'站内':'分类'}结果
     {moreJobs?'（岗位先展示前 '+jobs.length+' 条，可进入招聘市场继续查看）':''}
    </p>
    {jobError&&(category==='all'||category==='job')&&
      <p role="status" className="hhba-site-search-warning">岗位搜索暂不可用：{jobError}。其他站内资料仍可正常检索。</p>}
    {visible.length?<div className="hhba-site-search-results">
     {visible.map(r=><Link to={r.path} key={r.kind+':'+r.id} className="hhba-site-search-result">
       <div><span className="hhba-site-search-kind">{labels[r.kind]}</span>{r.status&&<small>{r.status}</small>}</div>
       <h2>{r.title}</h2><p>{r.description}</p><span className="hhba-site-search-result-arrow">查看站内详情 <ArrowRight size={15}/></span>
      </Link>)}
    </div>:!jobBusy&&<div className="hhba-site-search-empty" role="status">
      <Search size={26}/><strong>没有找到对应的公开内容</strong>
      <p>可以缩短关键词、换用企业或城市名称，或切换搜索分类。</p></div>}
    {pageCount>1&&<nav className="hhba-site-search-paging" aria-label="搜索结果分页">
     <button type="button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>上一页</button>
     <span>{page} / {pageCount}</span>
     <button type="button" disabled={page===pageCount} onClick={()=>setPage(p=>p+1)}>下一页</button>
    </nav>}
    {moreJobs&&<div className="hhba-site-search-more"><BriefcaseBusiness size={17}/>
      <span>更多岗位请在招聘市场查看完整结果。</span>
      <Link to={'/candidate/jobs?q='+encodeURIComponent(query)}>查看全部岗位 <ArrowRight size={14}/></Link>
    </div>}
   </>}
   <p className="hhba-site-search-disclaimer"><ShieldCheck size={15}/> 仅搜索 HHBA 站内公开资料，不搜索用户简历、私人收藏、账号信息或内部管理数据。岗位开放状态、人才政策时效与留学申请要求请以官方来源为准。</p>
  </section>
 </Shell>
}
