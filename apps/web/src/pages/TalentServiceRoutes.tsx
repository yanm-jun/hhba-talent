import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Building2,CheckCircle2,ClipboardCheck,ExternalLink,FileSearch,FileText,GraduationCap,Home,MapPin,Search,ShieldCheck,Wallet} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {parsePolicyQuery} from '../components/TalentPolicySearch';
import {TALENT_POLICY_RECORDS,TALENT_POLICY_REVIEW_DATE,type TalentPolicyRecord} from '../data/talentPolicyRecords';
import {TALENT_HOUSING_RECORDS,HOUSING_REVIEW_DATE,type TalentHousingRecord} from '../data/talentHousingRecords';
import type {User} from '../services/api';
import '../styles/talent-service.css';
import '../styles/talent-subpages.css';

export type TalentListKind='policies'|'benefits'|'housing'|'guide';
export const talentCityUrl=(city:string)=>'/talent-service/city/'+encodeURIComponent(city);
export const talentListUrl=(kind:TalentListKind,city:string)=>'/talent-service/list/'+kind+'/'+encodeURIComponent(city);
export const talentSearchUrl=(city:string,query:string)=>'/talent-service/search/'+encodeURIComponent(city)+'/'+encodeURIComponent(query.slice(0,150));
export const talentPolicyUrl=(id:string)=>'/talent-service/policy/'+encodeURIComponent(id);
export const talentHousingUrl=(id:string)=>'/talent-service/housing/'+encodeURIComponent(id);

const kinds:{id:TalentListKind;name:string;description:string;icon:typeof FileText}[]=[
 {id:'housing',name:'人才公寓',description:'具体项目、地址、房型与官方申请渠道',icon:Building2},
 {id:'policies',name:'人才政策',description:'人才引进、落户、就业与政策支持',icon:FileText},
 {id:'benefits',name:'补贴与福利',description:'生活、住房、安家及其他福利',icon:Wallet},
 {id:'guide',name:'申请指南',description:'申报材料、资格核验与办理步骤',icon:ClipboardCheck}
];
const benefit=(p:TalentPolicyRecord)=>p.category==='生活补贴'||p.category==='购房补贴'||p.category==='交通福利'||p.category==='就业创业'||p.title.includes('补贴');
const housingStatus=(r:TalentHousingRecord)=>{
 const today=new Date().toISOString().slice(0,10);
 if(r.applicationEnd&&today>r.applicationEnd)return '历史批次已截止';
 if(r.applicationEnd&&r.applicationEnd>=today)return '公告申报期内 · 房源需核验';
 return r.kind==='program'?'住房制度 · 具体项目待核验':'真实项目 · 剩余房源待核验';
};
const policyStatus=(r:TalentPolicyRecord)=>r.temporal==='past-window'?'历史批次 · 申请状态待核验':r.temporal==='historical'?'历史政策 · 需核对现行规则':'政策参考 · 以政府公告为准';
const decode=(s:string)=>{try{return decodeURIComponent(s)}catch{return ''}};
function matchesPolicy(p:TalentPolicyRecord,query:string,city:string){
 const parsed=parsePolicyQuery(query,city);
 if(p.city!==parsed.city)return false;
 if(parsed.wants.length&&!parsed.wants.every(w=>w.match(p)))return false;
 const corpus=[p.title,p.summary,p.eligibility,p.benefit,p.application,p.category,...p.keywords].join(' ').toLowerCase();
 return parsed.terms.every(t=>corpus.includes(t.toLowerCase()));
}
function matchesHousing(p:TalentHousingRecord,query:string,city:string){
 if(p.city!==city)return false;
 const rest=query.replace(city,'').replace(/人才|政策|补贴|公寓|住房|租房|安居|保障|什么|申请|在哪|哪里|查询|的|区|市|青年|高校|大学生|房源|待遇/g,'').replace(/\s/g,'');
 if(!rest)return true;
 return [p.title,p.district,p.address,p.units,p.rent,p.eligibility,p.statusNote].join(' ').includes(rest);
}
function Bread({city,current,parent}:{city?:string;current:string;parent?:{title:string;to:string}}){
 return <nav className="ts-sub-breadcrumb" aria-label="面包屑导航"><Link to="/talent-service">人才政策首页</Link><span>›</span>
  {city&&<><Link to={talentCityUrl(city)}>{city}</Link><span>›</span></>}
  {parent&&<><Link to={parent.to}>{parent.title}</Link><span>›</span></>}
  <span aria-current="page">{current}</span></nav>;
}
function QuickCount({count,label}:{count:number;label:string}){return <span className="ts-sub-count"><strong>{count}</strong><small>{label}</small></span>}
function PolicyTile({data}:{data:TalentPolicyRecord}){
 return <Link to={talentPolicyUrl(data.id)} className="ts-sub-tile">
  <div className="ts-sub-tile-top"><span>{data.category}</span><small>{policyStatus(data)}</small></div>
  <h3>{data.title}</h3><p>{data.summary}</p><div className="ts-sub-tile-benefit">{data.benefit}</div>
  <footer><small>{data.department} · {data.published}</small><ArrowUpRight size={18}/></footer>
 </Link>;
}
function HousingTile({data}:{data:TalentHousingRecord}){
 return <Link to={talentHousingUrl(data.id)} className="ts-sub-tile">
  <div className="ts-sub-tile-top"><span>{data.kind==='program'?'城市住房制度':'真实公寓项目'}</span><small>{housingStatus(data)}</small></div>
  <h3>{data.title}</h3><p><MapPin size={14}/>{data.district} · {data.address}</p>
  <div className="ts-sub-tile-benefit">{data.rent}</div>
  <footer><small>政府公告 {data.published} · 非实时房源</small><ArrowUpRight size={18}/></footer>
 </Link>;
}
function Empty({city,kind}:{city:string;kind:string}){
 return <div className="ts-sub-empty"><FileSearch size={26}/><strong>{city}暂无已收录的{kind}数据</strong>
  <p>当前只展示有政府公开来源的已核验记录，不会借用其他城市数据，也不会虚构可申请房源或补贴金额。</p>
  <Link to={talentCityUrl(city)}>返回{city}人才服务 <ArrowRight size={16}/></Link>
 </div>;
}
function CityHub({city}:{city:string}){
 const policies=TALENT_POLICY_RECORDS.filter(p=>p.city===city);
 const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city===city);
 const benefits=policies.filter(benefit);
 return <>
  <Bread current={city+' · 人才服务'}/>
  <section className="ts-sub-header"><span className="ts-section-kicker">CITY SERVICES / 城市人才服务</span><h1>{city} · 人才服务</h1>
   <p>查看当地已整理的人才政策、补贴福利、具体住房项目以及办理指南。未收录的信息如实标注。</p>
   <div className="ts-sub-counts"><QuickCount count={policies.length} label="政策资料"/><QuickCount count={homes.length} label="住房资料"/><QuickCount count={benefits.length} label="福利政策"/></div>
  </section>
  <section className="ts-sub-section"><h2>选择服务</h2><div className="ts-sub-kinds">{kinds.map(k=><Link key={k.id} className="ts-sub-kind" to={talentListUrl(k.id,city)}><k.icon size={24}/><strong>{k.name}</strong><small>{k.description}</small><ArrowRight size={16}/></Link>)}</div></section>
  <section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>{city} · 精选政策</h2><Link to={talentListUrl('policies',city)}>全部政策 <ArrowRight size={15}/></Link></div>
   {policies.length?<div className="ts-sub-grid">{policies.slice(0,2).map(p=><PolicyTile data={p} key={p.id}/>)}</div>:<Empty city={city} kind="人才政策"/>}
  </section>
  <section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>{city} · 住房项目</h2><Link to={talentListUrl('housing',city)}>所有项目 <ArrowRight size={15}/></Link></div>
   {homes.length?<div className="ts-sub-grid">{homes.slice(0,2).map(h=><HousingTile data={h} key={h.id}/>)}</div>:<Empty city={city} kind="人才公寓"/>}
  </section></>;
}
function ListPage({city,kind,query}:{city:string;kind:TalentListKind|'search';query?:string}){
 const [filter,setFilter]=useState('全部类型');
 const [draft,setDraft]=useState(query||'');
 const searchMode=kind==='search';
 const housingMode=kind==='housing';
 const guideMode=kind==='guide';
 const title=searchMode?'搜索结果':housingMode?'人才公寓':kind==='benefits'?'补贴与福利':guideMode?'申请指南':'人才政策';
 const resultPolicies=TALENT_POLICY_RECORDS.filter(p=>p.city===city&&(!query||matchesPolicy(p,query,city))&&(!housingMode)&&(kind!=='benefits'||benefit(p)));
 const resultHomes=TALENT_HOUSING_RECORDS.filter(p=>p.city===city&&(housingMode||searchMode)&&(!query||matchesHousing(p,query,city)));
 const cats=['全部类型',...new Set(resultPolicies.map(p=>p.category))];
 const shownPolicies=filter==='全部类型'?resultPolicies:resultPolicies.filter(p=>p.category===filter);
 const relatedLink=(kindName:TalentListKind)=>talentListUrl(kindName,city);
 const doSearch=()=>navigate(draft.trim()?talentSearchUrl(city,draft.trim()):talentListUrl('policies',city));
 return <><Bread city={city} current={title}/>
  {guideMode?<GuideContent city={city}/>:<>
  <section className="ts-sub-header">
   <span className="ts-section-kicker">{searchMode?'SEARCH RESULTS':'CITY SERVICES'} / {city}</span><h1>{city} · {title}</h1>
   <p>{searchMode?'搜索政府公开政策和具体人才公寓项目。结果仅来自已收录的数据。':'按实际城市整理有官方来源的资料，点击卡片进入单独的详情页。'}</p>
   <div className="ts-sub-counts"><QuickCount count={shownPolicies.length} label="政策结果"/>{(housingMode||searchMode)&&<QuickCount count={resultHomes.length} label="住房结果"/>}</div>
  </section>
  <form className="ts-sub-search" onSubmit={e=>{e.preventDefault();doSearch()}}><Search size={18}/><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={'搜索'+city+'硕士补贴、住房项目…'} aria-label="搜索人才服务"/><button type="submit">搜索 <ArrowRight size={15}/></button></form>
  {searchMode&&query&&<p className="ts-sub-found">关键词：<strong>{query}</strong> · 实际匹配 {shownPolicies.length+resultHomes.length} 条</p>}
  {resultPolicies.length>0&&<div className="ts-sub-filters">{cats.map(c=><button key={c} type="button" aria-pressed={filter===c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}</div>}
  {shownPolicies.length>0&&<section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>人才政策与福利</h2>{searchMode&&<Link to={relatedLink('policies')}>浏览全部政策 <ArrowRight size={15}/></Link>}</div>
   <div className="ts-sub-grid">{shownPolicies.map(p=><PolicyTile data={p} key={p.id}/>)}</div></section>}
  {resultHomes.length>0&&<section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>真实人才公寓与住房项目</h2>{searchMode&&<Link to={relatedLink('housing')}>浏览全部项目 <ArrowRight size={15}/></Link>}</div>
   <div className="ts-sub-grid">{resultHomes.map(h=><HousingTile data={h} key={h.id}/>)}</div></section>}
  {!shownPolicies.length&&!resultHomes.length&&<Empty city={city} kind={searchMode?'匹配结果':title}/>}
  <section className="ts-sub-cross"><ShieldCheck size={17}/><span>静态官方资料索引，非政府实时申报系统。补贴金额、资格、截止时间和剩余房源以最新官方公告为准。政策整理日期：{TALENT_POLICY_REVIEW_DATE}；项目整理日期：{HOUSING_REVIEW_DATE}。</span></section>
  </>}
 </>;
}
function GuideContent({city}:{city:string}){
 return <>
  <section className="ts-sub-header"><span className="ts-section-kicker">HOW TO APPLY / 申请指南</span><h1>{city} · 申请指南</h1><p>按具体政策办理，以下为通用步骤，实际所需材料和申请渠道应以政府原文为准。</p></section>
  <div className="ts-sub-guide">{[
   ['01','找到正式政策或公寓公告','从已核验的城市列表查找政策文件，核对发布日期、适用区县及申报批次。'],
   ['02','核对申报资格与材料','按个人学历、毕业年限、户籍、社保及住房情况查验是否符合条件。'],
   ['03','使用政府官方渠道提交','点击对应政策或住房项目详情提供的官方原文与办事入口，核实材料后申请。'],
   ['04','等待审核、公示或选房','跟踪政府系统公示和审核；历史批次截止后应等待新的公告。']
  ].map(x=><article key={x[0]}><b>{x[0]}</b><h2>{x[1]}</h2><p>{x[2]}</p></article>)}</div>
  <section className="ts-sub-section"><h2>从哪里开始办理？</h2><div className="ts-sub-two-links"><Link to={talentListUrl('policies',city)}>打开政策列表 <ArrowRight size={17}/></Link><Link to={talentListUrl('housing',city)}>打开公寓列表 <ArrowRight size={17}/></Link></div></section>
 </>;
}
function DetailPage({kind,id}:{kind:'policy'|'housing';id:string}){
 const p=kind==='policy'?TALENT_POLICY_RECORDS.find(x=>x.id===id):undefined;
 const h=kind==='housing'?TALENT_HOUSING_RECORDS.find(x=>x.id===id):undefined;
 const x=p||h;
 if(!x)return <><Bread current="未找到该条资料"/><Empty city="所选城市" kind="详情"/></>;
 const city=x.city;
 const parent=kind==='housing'?{title:'人才公寓',to:talentListUrl('housing',city)}:{title:'人才政策',to:talentListUrl('policies',city)};
 return <><Bread city={city} parent={parent} current={x.title}/>
  <article className="ts-sub-detail">
   <div className="ts-sub-detail-hero">
    <span className="ts-section-kicker">{kind==='housing'?'HOUSING DETAILS':'POLICY DETAILS'} / {city}</span>
    <h1>{x.title}</h1><p>{kind==='housing'?(h?.district+' · '+h?.address):(p?.summary)}</p>
    <div className="ts-sub-detail-tags"><span>{kind==='housing'?housingStatus(h!):policyStatus(p!)}</span><span>来源 {kind==='housing'?h?.published:p?.published}</span><span>整理 {kind==='housing'?h?.reviewedAt:TALENT_POLICY_REVIEW_DATE}</span></div>
   </div>
   <div className="ts-sub-detail-body">
    {p?<><section><h2>政策支持 / 福利待遇</h2><p className="ts-sub-emphasis">{p.benefit}</p></section>
      <section><h2>申请条件</h2><p>{p.eligibility}</p></section>
      <section><h2>办理流程与入口</h2><p>{p.application}</p></section>
      <section><h2>政府发布部门</h2><p>{p.department} · {p.sourceName} · {p.published}</p></section>
    </>:h?<><section><h2>项目地址</h2><p>{h.address}</p></section>
      <section><h2>房源规模与户型</h2><p>{h.units}</p></section>
      <section><h2>租金及费用</h2><p className="ts-sub-emphasis">{h.rent}</p></section>
      <section><h2>申请资格</h2><p>{h.eligibility}</p></section>
      <section><h2>公告批次状态</h2><p>{h.statusNote}</p></section>
      <section><h2>申请办理步骤</h2><ol>{h.steps.map(step=><li key={step}>{step}</li>)}</ol></section>
    </>:null}
    <aside className="ts-sub-warning"><ShieldCheck size={19}/><span>这是政府公开文件的整理索引，不代表资格审核已通过。历史配租套数不是当前剩余房源，申请期与政策待遇请以政府最新通知为准。</span></aside>
    <div className="ts-sub-detail-links"><a href={x.sourceUrl} rel="noopener noreferrer" target="_blank">查看政府原文 <ExternalLink size={16}/></a>
      {x.applyUrl&&<a href={x.applyUrl} rel="noopener noreferrer" target="_blank">官方申请渠道 / 说明 <ArrowUpRight size={16}/></a>}
      {p?.applicationUrl&&<a href={p.applicationUrl} rel="noopener noreferrer" target="_blank">官方办理渠道 / 说明 <ArrowUpRight size={16}/></a>}
    </div>
   </div>
  </article>
  <div className="ts-sub-return"><Link to={parent.to}><ArrowLeft size={16}/> 返回{city}{parent.title}</Link></div>
 </>;
}
export function TalentServiceRoutes({user,route}:{user:User|null;route:string}){
 const fragments=route.split('/').filter(Boolean);
 const kind=fragments[1]||'';
 const city=decode(fragments[3]||fragments[2]||'杭州').slice(0,60)||'杭州';
 let body;
 if(kind==='city')body=<CityHub city={decode(fragments[2]||'杭州')||'杭州'}/>;
 else if(kind==='list'&&['policies','benefits','housing','guide'].includes(fragments[2]))body=<ListPage city={city} kind={fragments[2] as TalentListKind}/>;
 else if(kind==='search')body=<ListPage key={route} city={decode(fragments[2]||'杭州')||'杭州'} kind="search" query={decode(fragments.slice(3).join('/'))}/>;
 else if(kind==='policy'||kind==='housing')body=<DetailPage kind={kind} id={decode(fragments[2]||'')}/>;
 else body=<><Bread current="页面未找到"/><section className="ts-sub-header"><h1>暂时找不到这个页面</h1><Link to="/talent-service">返回人才政策首页 <ArrowRight size={16}/></Link></section></>;
 return <Shell user={user}><div className="ts-page ts-sub-page">{body}<footer className="ts-sub-footer"><Link to="/talent-service">人才政策首页</Link><span>HHBA · 让劳动更有尊严，让商业更有温度</span></footer></div></Shell>;
}
