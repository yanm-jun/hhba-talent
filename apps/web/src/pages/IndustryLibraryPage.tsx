import {useEffect,useMemo,useState} from 'react';
import {
 ArrowLeft,ArrowRight,Building2,CarFront,Clapperboard,Cpu,ExternalLink,Factory,
 FlaskConical,GraduationCap,HardHat,HeartPulse,Landmark,Plane,RadioTower,
 Search,ShieldAlert,ShoppingBag,Smartphone,Sprout,Truck,Zap,type LucideIcon
} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/industry-library.css';
import {MajorHallExplorer} from './MajorHallExplorer';
import {GlobalCompanySearch} from '../components/GlobalCompanySearch';

type HallSummary={
 id:string;label:string;published:number;enterprises:number;reviewed:number;
 sourceRecords:number;sourceLinked:number;unlinked:number;
};
type HallManifest={kind:'HHBA_INDUSTRY_LIBRARY_MANIFEST_V1';asOf:string;halls:HallSummary[]};
type RecruitmentRow={company:string;url:string;review:'candidate'|'reviewed_history'};
type HallFile={kind:'HHBA_INDUSTRY_LIBRARY_HALL_V1';hall:string;asOf:string;records:RecruitmentRow[]};

const ROOT=import.meta.env.BASE_URL+'recruitment-library/v1/';
const PAGE_SIZE=25;
const HALL_IDS=[
 'automotive','semiconductor','internet-ai','energy','manufacturing','finance','telecom',
 'biomed','aerospace','logistics','construction','consumer-hardware','chem-materials',
 'retail','agri-food','culture-media','education-research'
];
const HALL_ICONS:Record<string,LucideIcon>={
 automotive:CarFront,semiconductor:Cpu,'internet-ai':Building2,energy:Zap,
 manufacturing:Factory,finance:Landmark,telecom:RadioTower,biomed:HeartPulse,
 aerospace:Plane,logistics:Truck,construction:HardHat,'consumer-hardware':Smartphone,
 'chem-materials':FlaskConical,retail:ShoppingBag,'agri-food':Sprout,
 'culture-media':Clapperboard,'education-research':GraduationCap
};

function safeRecruitmentUrl(raw:string){
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
  if(!url.hostname.includes('.')||url.hostname==='localhost')return '';
  return url.href;
 }catch{return ''}
}

function useManifest(){
 const [data,setData]=useState<HallManifest|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch(ROOT+'manifest.json',{signal:controller.signal,cache:'force-cache'})
   .then(async response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json()})
   .then((value:HallManifest)=>{
    if(value?.kind!=='HHBA_INDUSTRY_LIBRARY_MANIFEST_V1'||!Array.isArray(value.halls)||
       value.halls.length!==17||new Set(value.halls.map(x=>x.id)).size!==17)
      throw Error('目录校验失败');
    setData(value);
   })
   .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'读取失败')});
  return ()=>controller.abort();
 },[]);
 return {data,error};
}

function HallSelection({manifest}:{manifest:HallManifest}){
 return <section className="hhba-library-content" aria-label="企业招聘导航">
  <div className="hhba-library-heading hhba-library-user-heading">
   <span className="hhba-library-eyebrow">HHBA · 企业招聘导航</span>
   <h1>寻找你想加入的企业</h1>
  </div>
  <Link className="hhba-major-entry" to="/companies/library/majors">
   <span className="hhba-major-entry-icon"><GraduationCap size={24} aria-hidden="true"/></span>
   <span><strong>按专业找企业</strong><small>不知道有哪些企业适合自己的专业？从这里开始探索</small></span>
   <ArrowRight size={20} aria-hidden="true"/>
  </Link>
  <GlobalCompanySearch asOf={manifest.asOf} halls={manifest.halls}/>
  <div className="hhba-library-browse-heading">
   <div><h2>按行业浏览</h2><p>选择感兴趣的行业，查看该行业收录的企业招聘入口。</p></div>
  </div>
  <div className="hhba-library-grid">
   {manifest.halls.map(item=>{
    const Icon=HALL_ICONS[item.id]||Building2;
    return <Link key={item.id} className="hhba-library-hall-card" to={'/companies/library/'+item.id}>
     <div className="hhba-library-hall-icon"><Icon size={23} aria-hidden="true"/></div>
     <strong>{item.label}</strong>
     <span>查看企业招聘入口 <ArrowRight size={15} aria-hidden="true"/></span>
    </Link>;
   })}
  </div>
  <p className="hhba-library-footnote">页面展示的是招聘渠道，不代表企业当前一定有岗位，也不代表与 HHBA 存在合作。具体招聘信息请以企业网站为准。</p>
 </section>;
}
function HallDetails({manifest,hallId}:{manifest:HallManifest;hallId:string}){
 const selected=manifest.halls.find(item=>item.id===hallId);
 const [data,setData]=useState<HallFile|null>(null);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<'all'|'candidate'|'reviewed_history'>('all');
 const [page,setPage]=useState(1);
 useEffect(()=>{
  setData(null);setError('');setSearch('');setFilter('all');setPage(1);
  if(!selected)return;
  const controller=new AbortController();
  fetch(ROOT+hallId+'.json',{signal:controller.signal,cache:'force-cache'})
   .then(async response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json()})
   .then((value:HallFile)=>{
    if(value?.kind!=='HHBA_INDUSTRY_LIBRARY_HALL_V1'||value.hall!==hallId||
       !Array.isArray(value.records)||value.records.length!==selected.published)
      throw Error('行业馆数据校验失败');
    setData(value);
   })
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'读取失败')});
  return ()=>controller.abort();
 },[hallId,selected?.published]);
 const matched=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase();
  return (data?.records||[]).filter(item=>
   (filter==='all'||item.review===filter)&&
   (!q||(item.company+' '+item.url).toLocaleLowerCase().includes(q))
  );
 },[data,search,filter]);
 const pageCount=Math.max(1,Math.ceil(matched.length/PAGE_SIZE));
 const currentPage=Math.min(page,pageCount);
 const visible=matched.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 if(!selected)return <section className="hhba-library-content">
  <Link to="/companies/library" className="hhba-library-back"><ArrowLeft size={16}/> 返回 17 个行业馆</Link>
  <p className="hhba-library-empty">未找到该行业馆。</p>
 </section>;
 return <section className="hhba-library-content" aria-label={selected.label+'企业招聘网址'}>
  <Link to="/companies/library" className="hhba-library-back"><ArrowLeft size={16}/> 返回 17 个行业馆</Link>
  <div className="hhba-library-heading hhba-library-detail-heading">
   <span className="hhba-library-eyebrow">HHBA · ENTERPRISE DIRECTORY</span>
   <h1>{selected.label}</h1>
   <p>从已登记的企业招聘入口中查找网站。点击外部链接后，请以企业公布的最新招聘信息为准。</p>
  </div>
  <p className="hhba-library-inline-notice"><ShieldAlert size={15} aria-hidden="true"/> 部分招聘网址仍待复核，实际岗位与招聘状态请以企业网站为准。</p>
  <Link className="hhba-major-secondary-entry" to="/companies/library/majors"><GraduationCap size={17} aria-hidden="true"/> 按专业跨行业探索企业招聘入口 <ArrowRight size={15} aria-hidden="true"/></Link>
  <div className="hhba-library-controls">
   <label className="hhba-library-search"><Search size={17} aria-hidden="true"/>
    <input type="search" value={search} maxLength={80} onChange={event=>{setSearch(event.target.value);setPage(1)}}
     placeholder="搜索企业名称或招聘网址" aria-label="搜索当前行业馆的企业和网址"/>
   </label>
   <label className="hhba-library-filter">
    <span>网址来源状态</span>
    <select value={filter} aria-label="筛选网址状态" onChange={event=>{setFilter(event.target.value as typeof filter);setPage(1)}}>
     <option value="all">全部记录</option>
     <option value="reviewed_history">曾有来源核对</option>
     <option value="candidate">候选·待复核</option>
    </select>
   </label>
  </div>
  {!data&&!error&&<p className="hhba-library-empty" role="status">正在读取本馆的静态目录…</p>}
  {error&&<p className="hhba-library-empty" role="alert">本馆暂时无法加载：{error}。不会用模拟企业填充，请稍后刷新。</p>}
  {data&&<>
   <div className="hhba-library-results-head"><span>符合条件 {matched.length} 条</span><span>第 {currentPage} / {pageCount} 页 · 每页最多 {PAGE_SIZE} 条</span></div>
   <div className="hhba-library-records">
    {visible.map((item,index)=>{
     const url=safeRecruitmentUrl(item.url);
     return <article className="hhba-library-record" key={item.company+'|'+item.url+'|'+index}>
      <div className="hhba-library-record-info">
       <strong>{item.company}</strong>
       <span className={item.review==='reviewed_history'?'hhba-library-tag is-reviewed':'hhba-library-tag'}>
        {item.review==='reviewed_history'?'曾有来源核对':'候选·待复核'}
       </span>
       <small title={item.url}>{item.url}</small>
      </div>
      {url?<a href={url} className="hhba-library-outbound" target="_blank" rel="noopener noreferrer"
       data-hhba-recruitment-outbound="true" aria-label={'前往'+item.company+'的登记招聘网址'}>
       查看招聘网址 <ExternalLink size={15} aria-hidden="true"/>
      </a>:<span className="hhba-library-unavailable">链接不可用</span>}
     </article>;
    })}
   </div>
   {!matched.length&&<p className="hhba-library-empty">没有符合条件的企业或网址，请尝试修改搜索词。</p>}
   {pageCount>1&&<nav className="hhba-library-pager" aria-label="行业馆列表分页">
    <button type="button" disabled={currentPage<=1} onClick={()=>setPage(Math.max(1,currentPage-1))}><ArrowLeft size={15}/> 上一页</button>
    <span>第 {currentPage} / {pageCount} 页</span>
    <button type="button" disabled={currentPage>=pageCount} onClick={()=>setPage(Math.min(pageCount,currentPage+1))}>下一页 <ArrowRight size={15}/></button>
   </nav>}
  </>}
  <p className="hhba-library-footnote">HHBA 提供企业招聘渠道导航，不代表与展示企业存在合作。跳转后请自行核对企业主体、招聘岗位及隐私要求。</p>
 </section>;
}

export function IndustryLibraryPage({user,hallId,view='halls'}:{user:User|null;hallId?:string;view?:'halls'|'majors'}){
 const {data,error}=useManifest();
 const invalid=Boolean(hallId&&!HALL_IDS.includes(hallId));
 return <Shell user={user}>
  {!data&&!error&&!invalid&&<section className="hhba-library-content"><p className="hhba-library-empty" role="status">正在加载行业馆目录…</p></section>}
  {error&&<section className="hhba-library-content"><p className="hhba-library-empty" role="alert">企业招聘导航暂时不可用：{error}。请稍后刷新页面。</p></section>}
  {invalid&&<section className="hhba-library-content"><Link to="/companies/library" className="hhba-library-back"><ArrowLeft size={16}/> 返回行业馆</Link><p className="hhba-library-empty">没有这个行业馆。</p></section>}
  {data&&!invalid&&(view==='majors'?<MajorHallExplorer manifest={data}/>:hallId?<HallDetails key={hallId} manifest={data} hallId={hallId}/>:<HallSelection manifest={data}/>)}
 </Shell>;
}
