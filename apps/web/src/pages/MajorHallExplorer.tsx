import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ExternalLink,GraduationCap,Search,ShieldAlert} from 'lucide-react';
import {Link} from '../router';
import majorGuide from '../data/majorHallGuide.json';

type Hall={id:string;label:string;published:number};
type Manifest={asOf:string;halls:Hall[]};
type Row={company:string;url:string;review:'candidate'|'reviewed_history'};
type HallFile={kind:string;hall:string;asOf:string;records:Row[]};
type CrossHallRow=Row&{hallIds:string[]};

const ROOT=import.meta.env.BASE_URL+'recruitment-library/v1/';
const PAGE_SIZE=25;
// Static files are public; this cache is only for browsing, not user data.
const hallCache=new Map<string,Row[]>();
function safeUrl(raw:string){
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   u.hostname.includes('.')&&u.hostname!=='localhost'?u.href:'';
 }catch{return ''}
}
function groupsContaining(term:string){
 const q=term.trim().toLocaleLowerCase();
 return majorGuide.groups.map(g=>({...g,majors:g.majors.filter(m=>m.toLocaleLowerCase().includes(q))}))
  .filter(g=>g.majors.length>0);
}
function mergeAcrossHalls(ids:string[],byHall:Record<string,Row[]>):CrossHallRow[]{
 const results=new Map<string,CrossHallRow>();
 for(const hallId of ids){
  for(const entry of byHall[hallId]||[]){
   const safe=safeUrl(entry.url);
   if(!safe||!entry.company.trim())continue;
   const key=entry.company.trim().toLocaleLowerCase()+'|'+safe.replace(/\/$/,'').toLocaleLowerCase();
   const previous=results.get(key);
   if(previous){
    if(!previous.hallIds.includes(hallId))previous.hallIds.push(hallId);
    if(entry.review==='reviewed_history')previous.review='reviewed_history';
   }else results.set(key,{company:entry.company,url:safe,review:entry.review,hallIds:[hallId]});
  }
 }
 return [...results.values()];
}

export function MajorHallExplorer({manifest}:{manifest:Manifest}){
 const [majorQuery,setMajorQuery]=useState('');
 const [major,setMajor]=useState('');
 const [selectedHalls,setSelectedHalls]=useState<string[]>([]);
 const [byHall,setByHall]=useState<Record<string,Row[]>>({});
 const [errors,setErrors]=useState<string[]>([]);
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState<'all'|'candidate'|'reviewed_history'>('all');
 const [page,setPage]=useState(1);
 const selectedGroup=majorGuide.groups.find(g=>g.majors.includes(major));
 const hallById=useMemo(()=>new Map(manifest.halls.map(h=>[h.id,h])),[manifest.halls]);
 const visibleGroups=useMemo(()=>groupsContaining(majorQuery),[majorQuery]);
 const selectedKey=selectedHalls.join('|');
 useEffect(()=>{
  setPage(1);setErrors([]);
  if(!major||!selectedHalls.length){setByHall({});setLoading(false);return}
  const controller=new AbortController();
  let active=true;
  setLoading(true);setByHall({});
  const work=selectedHalls.map(async id=>{
   const cached=hallCache.get(manifest.asOf+'|'+id);
   if(cached)return {id,rows:cached,ok:true};
   try{
    const response=await fetch(ROOT+id+'.json',{signal:controller.signal,cache:'force-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json() as HallFile;
    const expected=hallById.get(id)?.published;
    if(data.kind!=='HHBA_INDUSTRY_LIBRARY_HALL_V1'||data.hall!==id||
       data.asOf!==manifest.asOf||!Array.isArray(data.records)||data.records.length!==expected)
     throw Error('数据版本与目录不一致');
    const records=data.records.filter(r=>r&&typeof r.company==='string'&&
     typeof r.url==='string'&&['candidate','reviewed_history'].includes(r.review));
    if(records.length!==data.records.length)throw Error('数据字段异常');
    hallCache.set(manifest.asOf+'|'+id,records);
    return {id,rows:records,ok:true};
   }catch(e){
    if(controller.signal.aborted)return {id,rows:[],ok:false};
    return {id,rows:[],ok:false};
   }
  });
  void Promise.all(work).then(resolved=>{
   if(!active)return;
   const next:Record<string,Row[]>={};
   const failed:string[]=[];
   for(const r of resolved){
    if(r.ok)next[r.id]=r.rows;
    else failed.push(hallById.get(r.id)?.label||r.id);
   }
   setByHall(next);setErrors(failed);setLoading(false);
  });
  return ()=>{active=false;controller.abort()};
 },[major,selectedKey,manifest.asOf,hallById]);
 const rows=useMemo(()=>mergeAcrossHalls(selectedHalls,byHall),[selectedKey,byHall]);
 const matched=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase();
  return rows.filter(r=>(status==='all'||r.review===status)&&
   (!q||(r.company+' '+r.url).toLocaleLowerCase().includes(q)));
 },[rows,status,search]);
 const pageCount=Math.max(1,Math.ceil(matched.length/PAGE_SIZE));
 const currentPage=Math.min(page,pageCount);
 const visible=matched.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const chooseMajor=(value:string)=>{
  const found=majorGuide.groups.find(g=>g.majors.includes(value));
  setMajor(value);
  setSelectedHalls(found?found.halls.slice():[]);
  setSearch('');setStatus('all');setPage(1);
 };
 const toggleHall=(id:string)=>{
  setSelectedHalls(current=>current.includes(id)?current.filter(x=>x!==id):
   manifest.halls.filter(h=>current.includes(h.id)||h.id===id).map(h=>h.id));
  setPage(1);
 };
 const extraHalls=manifest.halls.filter(h=>!selectedHalls.includes(h.id));
 return <section className="hhba-library-content hhba-major-explorer" aria-label="按专业跨行业探索招聘网站">
  <Link to="/companies/library" className="hhba-library-back"><ArrowLeft size={16}/> 返回 17 个行业馆</Link>
  <div className="hhba-library-heading">
   <span className="hhba-library-eyebrow">HHBA · CROSS-INDUSTRY EXPLORER</span>
   <h1>按专业找企业招聘入口</h1>
   <p>先选择专业，再跨多个行业馆查找相关行业的企业招聘网站。这里提供的是<strong>行业方向导航</strong>，不是企业是否正在招聘该专业的证明。</p>
  </div>
  <p className="hhba-library-alert"><ShieldAlert size={17} aria-hidden="true"/>
   专业与行业的关系来自预设方向性规则，而非实时岗位数据；选中行业馆的所有企业并不一定招聘该专业。请到招聘官网查看具体岗位、学历和专业要求。
  </p>
  <div className="hhba-major-chooser">
   <label className="hhba-major-search-label" htmlFor="hhba-major-keyword"><span>搜索专业</span>
    <span className="hhba-library-search"><Search size={17} aria-hidden="true"/>
     <input id="hhba-major-keyword" type="search" maxLength={55} value={majorQuery}
      onChange={event=>setMajorQuery(event.target.value)} placeholder="如：机械、计算机、舞蹈、会计"/>
    </span>
   </label>
   <label className="hhba-major-choice-label" htmlFor="hhba-major-choice"><span>选择专业</span>
    <select id="hhba-major-choice" value={major} onChange={event=>chooseMajor(event.target.value)}>
     <option value="">请选择专业</option>
     {major&&!visibleGroups.some(g=>g.majors.includes(major))&&<option value={major}>{major}</option>}
     {visibleGroups.map(group=><optgroup key={group.id} label={group.label}>
      {group.majors.map(value=><option key={value} value={value}>{value}</option>)}
     </optgroup>)}
    </select>
   </label>
  </div>
  {!visibleGroups.length&&<p className="hhba-library-footnote">暂未收录这一专业名称。可以清除搜索词，或直接进入 17 个行业馆浏览；不会为未知专业编造匹配结果。</p>}
  {!major&&<div className="hhba-major-start">
   <GraduationCap size={26} aria-hidden="true"/>
   <strong>请选择你所学的专业</strong>
   <p>已整理 {majorGuide.groups.reduce((n,g)=>n+g.majors.length,0)} 个常见专业的行业探索方向。无需上传简历，也无需调用 AI。</p>
  </div>}
  {selectedGroup&&<div className="hhba-major-selected">
   <div className="hhba-major-selected-head">
    <div><span>所选专业</span><h2>{major}</h2><p>优先浏览下面的相关行业方向；也可以自行增加或取消行业馆。</p></div>
    <span className="hhba-major-count">{selectedHalls.length} / 17 个行业馆</span>
   </div>
   <div className="hhba-major-chips" aria-label="已选行业馆">
    {selectedHalls.map(id=><button type="button" key={id} className="hhba-major-chip is-active"
     aria-pressed="true" onClick={()=>toggleHall(id)} title="点击取消选择">
     <Check size={13} aria-hidden="true"/>{hallById.get(id)?.label||id} ×
    </button>)}
   </div>
   <details className="hhba-major-extra">
    <summary>添加其他行业馆（全部 17 馆都可探索）</summary>
    <div className="hhba-major-chips">
     {extraHalls.length?extraHalls.map(h=><button key={h.id} type="button" className="hhba-major-chip"
      aria-pressed="false" onClick={()=>toggleHall(h.id)}>＋ {h.label}</button>):
      <span>所有行业馆已选中</span>}
    </div>
   </details>
  </div>}
  {major&&<div className="hhba-major-results">
   {!selectedHalls.length?<p className="hhba-library-empty">还没有选择行业馆，请从上方添加至少一个行业馆。</p>:<>
    <div className="hhba-library-controls">
     <label className="hhba-library-search"><Search size={17} aria-hidden="true"/>
      <input type="search" value={search} maxLength={80} onChange={event=>{setSearch(event.target.value);setPage(1)}}
       placeholder="在所选行业馆中搜索企业或招聘网址" aria-label="跨行业搜索企业或招聘网址"/>
     </label>
     <label className="hhba-library-filter"><span>网址来源状态</span>
      <select value={status} aria-label="筛选跨行业网址来源" onChange={event=>{setStatus(event.target.value as typeof status);setPage(1)}}>
       <option value="all">全部记录</option>
       <option value="reviewed_history">曾有来源核对</option>
       <option value="candidate">候选·待复核</option>
      </select>
     </label>
    </div>
    {loading&&<p className="hhba-library-empty" role="status">正在读取所选行业馆的静态目录…</p>}
    {!loading&&errors.length>0&&<p className="hhba-library-alert" role="alert">
     以下行业馆暂时无法加载：{errors.join('、')}。目前只显示成功加载的其他行业馆，数据可能不完整。
    </p>}
    {!loading&&<div className="hhba-library-results-head"><span>找到 {matched.length} 条招聘网址记录，来自 {Object.keys(byHall).length} 个已加载行业馆（已去除重复的企业+网址组合）</span>
     <span>第 {currentPage} / {pageCount} 页</span>
    </div>}
    {!loading&&<div className="hhba-library-records">
     {visible.map(record=><article className="hhba-library-record" key={record.company+'|'+record.url}>
      <div className="hhba-library-record-info">
       <strong>{record.company}</strong>
       <span className={record.review==='reviewed_history'?'hhba-library-tag is-reviewed':'hhba-library-tag'}>
        {record.review==='reviewed_history'?'曾有来源核对':'候选·待复核'}
       </span>
       <small title={record.url}>{record.url}</small>
       <span className="hhba-major-record-halls">所属行业馆：{record.hallIds.map(id=>hallById.get(id)?.label||id).join('、')}</span>
      </div>
      <a href={record.url} target="_blank" rel="noopener noreferrer" data-hhba-recruitment-outbound="true"
       className="hhba-library-outbound" aria-label={'打开'+record.company+'登记的招聘网址'}>
       查看招聘网址 <ExternalLink size={15} aria-hidden="true"/>
      </a>
     </article>)}
    </div>}
    {!loading&&!visible.length&&<p className="hhba-library-empty">当前没有符合条件的招聘网址。可以调整行业馆、搜索词或来源状态。</p>}
    {!loading&&pageCount>1&&<nav className="hhba-library-pager" aria-label="跨行业搜索分页">
     <button type="button" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ArrowLeft size={15}/> 上一页</button>
     <span>第 {currentPage} / {pageCount} 页 · 每页最多 {PAGE_SIZE} 条</span>
     <button type="button" disabled={currentPage>=pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))}>下一页 <ArrowRight size={15}/></button>
    </nav>}
   </>}
  </div>}
  <p className="hhba-library-footnote">数据快照：{manifest.asOf}。仅展示在 HHBA 行业馆中已登记的 HTTPS 招聘网站，不提供实时职位、专业录用资格或就业结果保证；未经核验的网址请自行检查主体与招聘状态。</p>
 </section>;
}
