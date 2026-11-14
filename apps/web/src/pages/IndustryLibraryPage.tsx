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
 const [search,setSearch]=useState('');
 const matched=useMemo(()=>manifest.halls.filter(item=>
  (item.label+' '+item.id).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
 ),[manifest.halls,search]);
 const total=manifest.halls.reduce((sum,hall)=>sum+hall.published,0);
 return <section className="hhba-library-content" aria-label="17 个行业招聘馆">
  <div className="hhba-library-heading">
   <span className="hhba-library-eyebrow">HHBA · ENTERPRISE RECRUITMENT DIRECTORY</span>
   <h1>企业招聘导航</h1>
   <p>按行业找到企业与招聘网址，进入对应招聘网站自行查看岗位。专业筛选和岗位级推荐将分阶段开放。</p>
  </div>
  <div className="hhba-library-overview">
   <div><strong>17</strong><span>个行业馆</span></div>
   <div><strong>{total.toLocaleString('zh-CN')}</strong><span>条整理后可浏览的网址记录</span></div>
   <div><strong>{manifest.asOf}</strong><span>数据快照日期</span></div>
  </div>
  <p className="hhba-library-alert"><ShieldAlert size={17} aria-hidden="true"/>
   目录包含尚未完成复核的历史候选网址。收录不代表企业与 HHBA 合作，也不代表当前正在招聘；请在跳转后核对网站主体和岗位状态。
  </p>
  <label className="hhba-library-search hhba-library-hall-search">
   <Search size={17} aria-hidden="true"/>
   <input type="search" value={search} maxLength={50} onChange={event=>setSearch(event.target.value)}
    placeholder="查找行业馆，如汽车、医药、传媒" aria-label="查找行业馆"/>
  </label>
  <div className="hhba-library-grid">
   {matched.map(item=>{
    const Icon=HALL_ICONS[item.id]||Building2;
    return <Link key={item.id} className="hhba-library-hall-card" to={'/companies/library/'+item.id}>
     <div className="hhba-library-hall-icon"><Icon size={23} aria-hidden="true"/></div>
     <strong>{item.label}</strong>
     <small>{item.enterprises} 个企业名称 · {item.published} 条网址记录</small>
     <span>进入行业馆 <ArrowRight size={15} aria-hidden="true"/></span>
    </Link>;
   })}
  </div>
  {!matched.length&&<p className="hhba-library-empty">没有找到对应行业馆，可以试试其他关键词。</p>}
  <p className="hhba-library-footnote">同一企业可能出现在多个行业馆，同一企业也可能登记多个招聘入口；数量是目录记录，不是实时招聘职位数量。未附有效安全网址的企业仍保留在后台，未显示为可跳转记录。</p>
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
  <div className="hhba-library-hall-stats">
   <span><strong>{selected.enterprises}</strong> 个企业名称</span>
   <span><strong>{selected.published}</strong> 条可浏览网址</span>
   <span><strong>{selected.unlinked}</strong> 条历史记录尚无招聘网址</span>
  </div>
  <p className="hhba-library-alert"><ShieldAlert size={17} aria-hidden="true"/>
   以下为截至 {manifest.asOf} 的只读目录。部分属于候选·待复核网址，甚至可能已失效；不提供岗位开放或录用结果保证。
  </p>
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
  <p className="hhba-library-footnote">HHBA 只提供招聘渠道导航，不代表与展示企业存在合作关系。使用外部链接时可能需要登录 HHBA 以记录求职来源；具体岗位、投递和个人信息由您在企业网站自行确认。</p>
 </section>;
}

export function IndustryLibraryPage({user,hallId}:{user:User|null;hallId?:string}){
 const {data,error}=useManifest();
 const invalid=Boolean(hallId&&!HALL_IDS.includes(hallId));
 return <Shell user={user}>
  {!data&&!error&&!invalid&&<section className="hhba-library-content"><p className="hhba-library-empty" role="status">正在加载行业馆目录…</p></section>}
  {error&&<section className="hhba-library-content"><p className="hhba-library-empty" role="alert">企业招聘导航暂时不可用：{error}。请稍后刷新页面。</p></section>}
  {invalid&&<section className="hhba-library-content"><Link to="/companies/library" className="hhba-library-back"><ArrowLeft size={16}/> 返回行业馆</Link><p className="hhba-library-empty">没有这个行业馆。</p></section>}
  {data&&!invalid&&(hallId?<HallDetails key={hallId} manifest={data} hallId={hallId}/>:<HallSelection manifest={data}/>)}
 </Shell>;
}
