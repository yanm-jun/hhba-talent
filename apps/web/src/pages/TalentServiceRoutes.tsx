import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Building2,CheckCircle2,ClipboardCheck,FileSearch,FileText,GraduationCap,Home,MapPin,Search,ShieldCheck,Wallet} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {parsePolicyQuery} from '../components/TalentPolicySearch';
import {findTalentCity,parseTalentCityQuery,TALENT_MUNICIPALITIES} from '../data/talentCityRegistry';
import {TalentCityDirectory} from './TalentCityDirectory';
import {TALENT_POLICY_RECORDS,TALENT_POLICY_REVIEW_DATE,type TalentPolicyRecord} from '../data/talentPolicyRecords';
import {TALENT_HOUSING_RECORDS,HOUSING_REVIEW_DATE,type TalentHousingRecord} from '../data/talentHousingRecords';
import type {User} from '../services/api';
import {TalentMatchingPage} from './TalentMatchingPage';
import {TalentJinanPolicyPreview} from './TalentJinanPolicyPreview';
import {TalentJinanGuidePreview} from './TalentJinanGuidePreview';
import {TalentQingdaoPolicyPreview} from './TalentQingdaoPolicyPreview';
import {TalentQingdaoGuidePreview} from './TalentQingdaoGuidePreview';
import {TalentLaoshanGuide} from './TalentLaoshanGuide';
import {UnifiedPolicyGuide} from '../components/talent/UnifiedPolicyGuide';
import {yantaiLivingGuide,yantaiHomeGuide} from '../data/talentYantaiGuide';
import {linyiLivingGuide} from '../data/talentLinyiGuide';
import {UnifiedTalentRecordDetail} from '../components/talent/UnifiedTalentRecordDetail';
import {UnifiedPolicyList,buildCityPolicyConfig} from '../components/talent/UnifiedPolicyList';
import '../styles/talent-service.css';
import '../styles/talent-subpages.css';

export type TalentListKind='policies'|'benefits'|'housing'|'guide';
export const talentCityUrl=(city:string)=>'/talent-service/city/'+encodeURIComponent(city);
export const talentListUrl=(kind:TalentListKind,city:string)=>'/talent-service/list/'+kind+'/'+encodeURIComponent(city);
export const talentSearchUrl=(city:string,query:string)=>'/talent-service/search/'+encodeURIComponent(city)+'/'+encodeURIComponent(query.slice(0,150));
export const talentPolicyUrl=(id:string)=>'/talent-service/policy/'+encodeURIComponent(id);
export const talentHousingUrl=(id:string)=>'/talent-service/housing/'+encodeURIComponent(id);

const kinds:{id:TalentListKind;name:string;description:string;icon:typeof FileText}[]=[
 {id:'policies',name:'政策与补贴',description:'生活补贴、人才引进、落户与就业支持',icon:FileText},
 {id:'housing',name:'人才安居',description:'公寓项目、租金、住房支持与申请资格',icon:Building2}
];
const benefit=(p:TalentPolicyRecord)=>p.category==='生活补贴'||p.category==='购房补贴'||p.category==='交通福利'||p.category==='就业创业'||p.title.includes('补贴');
const housingStatus=(r:TalentHousingRecord)=>{
 const today=new Date().toISOString().slice(0,10);
 if(r.applicationEnd&&today>r.applicationEnd)return '历史批次已截止';
 if(r.applicationEnd&&r.applicationEnd>=today)return '公告申报期内 · 房源需核验';
 return r.kind==='program'?'住房制度 · 具体项目待核验':'真实项目 · 剩余房源待核验';
};
const housingFirst=(a:TalentHousingRecord,b:TalentHousingRecord)=>Number(a.kind==='program')-Number(b.kind==='program')||b.published.localeCompare(a.published,'zh-CN');
const policyStatus=(r:TalentPolicyRecord)=>{
 if(r.deadline&&r.deadline<new Date().toISOString().slice(0,10))return '该批次申请已截止';
 if(r.deadline)return '公告申请截止 '+r.deadline;
 if(r.temporal==='past-window')return '年度批次 · 申请状态待核验';
 if(r.temporal==='historical')return '历史规则 · 现行政策待核验';
 return '政策参考 · 资格按官方核验';
};
const policyPriority=(r:TalentPolicyRecord)=>r.temporal==='historical'?2:r.deadline&&r.deadline<new Date().toISOString().slice(0,10)?1:0;
const recentPolicies=(a:TalentPolicyRecord,b:TalentPolicyRecord)=>policyPriority(a)-policyPriority(b)||b.published.localeCompare(a.published,'zh-CN');
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
  <div className="ts-sub-tile-top"><span>{data.category}{data.scope?' · '+data.scope:''}</span><small>{policyStatus(data)}</small></div>
  <h3>{data.title}</h3><p>{data.summary}</p>
  {data.targetGroup&&<p className="ts-policy-audience"><b>适用人群：</b>{data.targetGroup}</p>}
  <div className="ts-sub-tile-benefit">{data.benefit}</div>
  {data.payoutTo&&data.payoutTo!=='个人'&&<p className="ts-sub-payout-hint">扶持性质：{data.payoutTo==='用人单位'?'单位补助':data.payoutTo==='非现金贷款'?'需偿还贷款':data.payoutTo==='住房折扣'?'房款折扣':data.payoutTo}</p>}
  <footer><small>{data.department} · {data.published}</small><ArrowUpRight size={18}/></footer>
 </Link>;
}
function HousingTile({data}:{data:TalentHousingRecord}){
 return <Link to={talentHousingUrl(data.id)} className="ts-sub-tile">
  <div className="ts-sub-tile-top"><span>{data.housingCategory|| (data.kind==='program'?'住房政策入口':'官方真实项目')}</span><small>{housingStatus(data)}</small></div>
  <h3>{data.title}</h3>
  <p className="ts-housing-location"><MapPin size={14}/>{data.district} · {data.address}</p>
  <div className="ts-housing-short-facts"><small>政府公开房型 / 项目规模</small><p>{data.units}</p><small>公告租金 / 费用说明</small><strong>{data.rent}</strong></div>
  <p className="ts-housing-inventory-note">{data.statusNote}</p>
  <footer><small>官方公告 {data.published} · 核验 {data.reviewedAt}</small><ArrowUpRight size={18}/></footer>
 </Link>;
}
function Empty({city,kind}:{city:string;kind:string}){
 return <div className="ts-sub-empty"><FileSearch size={26}/><strong>{city}暂无已收录的{kind}数据</strong>
  <p>当前只展示有政府公开来源的已核验记录，不会借用其他城市数据，也不会虚构可申请房源或补贴金额。</p>
  <Link to={talentCityUrl(city)}>返回{city}人才服务 <ArrowRight size={16}/></Link>
 </div>;
}
function CityHub({city}:{city:string}){
 const match=findTalentCity(city);
 if(!match)return <><Bread current="城市尚未收录"/><section className="ts-sub-header"><h1>该城市尚未加入本次城市名录</h1><p>当前目标范围是4个直辖市和293个地级市，不包含县级市、自治州、地区和盟。请先到全国城市目录核对名称。</p><Link to="/talent-service/cities">返回全国城市目录 <ArrowRight size={16}/></Link></section></>;
 const policies=TALENT_POLICY_RECORDS.filter(p=>p.city===match.name).sort(recentPolicies);
 const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city===match.name);
 const hasSources=policies.length+homes.length>0;
 return <>
  <Bread current={match.official+' · 人才服务'}/>
  <section className="ts-sub-header ts-v4-city-hero">
   <span className="ts-section-kicker">{match.level==='municipality'?'MUNICIPALITY / 直辖市':'CITY SERVICES / 已收录城市'}</span>
   <h1>{match.official} · 人才服务</h1>
   <p>{hasSources?match.intro+'。从下面两个入口查看已有政府来源的政策和住房资料。':'该城市入口已开通，人才政策与住房资料正在整理。我们不会生成未经核验的补贴金额、公寓或申请入口。'}</p>
   <div className="ts-sub-counts"><QuickCount count={policies.length} label="已收录政策"/><QuickCount count={homes.length} label="已收录住房资料"/>{!hasSources&&<span className="ts-v4-data-pending">官方资料整理中</span>}</div>
  </section>
  <section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>你想了解什么？</h2><Link to="/talent-service/cities">更换城市 <ArrowRight size={15}/></Link></div>
   <div className="ts-sub-kinds ts-v4-two-kinds">
    {kinds.map(k=><Link key={k.id} className="ts-sub-kind" to={match.name==='青岛'&&k.id==='policies'?'/talent-service/policy-layout-preview/qingdao':talentListUrl(k.id,match.name)}>
      <k.icon size={25}/><strong>{k.name}</strong><small>{k.description}</small>
      <span className="ts-v4-kind-count">{k.id==='policies'?policies.length:homes.length} 条已收录 <ArrowRight size={15}/></span>
     </Link>)}
   </div>
  </section>
  <section className="ts-v4-city-note"><ShieldCheck size={18}/>
   <div><strong>{hasSources?'政策以当地官方发布和审核结果为准':'城市入口已开通，政策资料尚在核验'}</strong><p>只有政府来源确认的信息才会展示。没有核验的城市不展示虚拟补贴或虚假房源；申请材料和步骤以具体政策原文为准。</p></div>
  </section>
 </>;
}
function ListPage({city,kind,query}:{city:string;kind:TalentListKind|'search';query?:string}){
 const [filter,setFilter]=useState('全部类型');
 const [housingDistrict,setHousingDistrict]=useState('全部区域');
 const [draft,setDraft]=useState(query||'');
 const searchMode=kind==='search';
 const housingMode=kind==='housing';
 const guideMode=kind==='guide';
 const title=searchMode?'搜索结果':housingMode?'人才公寓':kind==='benefits'?'补贴与福利':guideMode?'申请指南':'人才政策';
 const resultPolicies=TALENT_POLICY_RECORDS.filter(p=>p.city===city&&(!query||matchesPolicy(p,query,city))&&(!housingMode)&&(kind!=='benefits'||benefit(p))).sort(recentPolicies);
 const resultHomes=TALENT_HOUSING_RECORDS.filter(p=>p.city===city&&(housingMode||searchMode)&&(!query||matchesHousing(p,query,city))).sort(housingFirst);
 const housingDistricts=['全部区域',...new Set(resultHomes.map(p=>p.district))];
 const activeDistrict=housingDistricts.includes(housingDistrict)?housingDistrict:'全部区域';
 const shownHomes=resultHomes.filter(p=>activeDistrict==='全部区域'||p.district===activeDistrict);
 const cats=['全部类型',...new Set(resultPolicies.map(p=>p.category))];
 const shownPolicies=filter==='全部类型'?resultPolicies:resultPolicies.filter(p=>p.category===filter);
 const relatedLink=(kindName:TalentListKind)=>talentListUrl(kindName,city);
 const doSearch=()=>{const parsed=parseTalentCityQuery(draft.trim(),city);navigate(!draft.trim()||(parsed.matchedCity&&parsed.cityOnly)?talentCityUrl(parsed.matchedCity?parsed.city:city):talentSearchUrl(parsed.city,draft.trim()))};
 return <><Bread city={city} current={title}/>
  {guideMode?<GuideContent city={city}/>:<>
  <section className="ts-sub-header">
   <span className="ts-section-kicker">{searchMode?'SEARCH RESULTS':'CITY SERVICES'} / {city}</span><h1>{city} · {title}</h1>
   <p>{searchMode?'搜索政府公开政策和具体人才公寓项目。结果仅来自已收录的数据。':'按实际城市整理有官方来源的资料，点击卡片进入单独的详情页。'}</p>
   <div className="ts-sub-counts"><QuickCount count={shownPolicies.length} label="政策结果"/>{(housingMode||searchMode)&&<QuickCount count={shownHomes.length} label="住房结果"/>}</div>
  </section>
  <form className="ts-sub-search" onSubmit={e=>{e.preventDefault();doSearch()}}><Search size={18}/><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={'搜索'+city+'硕士补贴、住房项目…'} aria-label="搜索人才服务"/><button type="submit">搜索 <ArrowRight size={15}/></button></form>
  {searchMode&&query&&<p className="ts-sub-found">关键词：<strong>{query}</strong> · 实际匹配 {shownPolicies.length+shownHomes.length} 条</p>}
  {resultPolicies.length>0&&<div className="ts-sub-filters">{cats.map(c=><button key={c} type="button" aria-pressed={filter===c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}</div>}
  {shownPolicies.length>0&&<section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>人才政策与福利</h2>{searchMode&&<Link to={relatedLink('policies')}>浏览全部政策 <ArrowRight size={15}/></Link>}</div>
   <div className="ts-sub-grid">{shownPolicies.map(p=><PolicyTile data={p} key={p.id}/>)}</div></section>}
  {resultHomes.length>0&&<section className="ts-sub-section"><div className="ts-sub-section-heading"><h2>真实人才公寓与住房项目</h2>{searchMode&&<Link to={relatedLink('housing')}>浏览全部项目 <ArrowRight size={15}/></Link>}</div>
   {housingMode&&housingDistricts.length>2&&<div className="ts-housing-districts" aria-label="按区域筛选住房项目">{housingDistricts.map(d=><button type="button" key={d} aria-pressed={activeDistrict===d} className={activeDistrict===d?'active':''} onClick={()=>setHousingDistrict(d)}>{d}</button>)}</div>}
   {shownHomes.length?<div className="ts-sub-grid">{shownHomes.map(h=><HousingTile data={h} key={h.id}/>)}</div>:<p className="ts-housing-filter-empty">该区域没有匹配的已核验项目，试试“全部区域”。</p>}
  </section>}
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
 if(!p&&!h)return <><Bread current="未找到该条资料"/><Empty city="所选城市" kind="详情"/></>;
 return <UnifiedTalentRecordDetail policy={p} housing={h}/>;
}
export function TalentServiceRoutes({user,route}:{user:User|null;route:string}){
 const fragments=route.split('/').filter(Boolean);
 const kind=fragments[1]||'';
 const city=decode(fragments[3]||fragments[2]||'北京').slice(0,60)||'北京';
 let body;
 if(kind==='cities')body=<TalentCityDirectory key={route} initialProvince={fragments[2]==='search'?'':decode(fragments[2]||'')} initialQuery={fragments[2]==='search'?decode(fragments[3]||''):''}/>;
 else if(kind==='city')body=<CityHub city={decode(fragments[2]||'北京')||'北京'}/>;
 else if(kind==='list'&&fragments[2]==='policies')body=city==='济南'?<TalentJinanPolicyPreview/>:city==='青岛'?<TalentQingdaoPolicyPreview/>:<UnifiedPolicyList config={buildCityPolicyConfig(city)}/>;
 else if(kind==='list'&&['policies','benefits','housing','guide'].includes(fragments[2]))body=<ListPage city={city} kind={fragments[2] as TalentListKind}/>;
 else if(kind==='search')body=<ListPage key={route} city={decode(fragments[2]||'杭州')||'杭州'} kind="search" query={decode(fragments.slice(3).join('/'))}/>;
 else if(kind==='policy-guide-preview'&&fragments[2]==='linyi'&&fragments[3]==='living')body=<UnifiedPolicyGuide data={linyiLivingGuide}/>;
 else if(kind==='policy-guide-preview'&&fragments[2]==='yantai')body=<UnifiedPolicyGuide data={fragments[3]==='home'?yantaiHomeGuide:yantaiLivingGuide}/>;
  else if(kind==='policy-layout-preview'&&fragments[2]==='jinan')body=<TalentJinanPolicyPreview/>;
 else if(kind==='policy-guide-preview'&&fragments[2]==='jinan')body=<TalentJinanGuidePreview/>;
 else if(kind==='policy-layout-preview'&&fragments[2]==='qingdao')body=<TalentQingdaoPolicyPreview/>;
 else if(kind==='policy-guide-preview'&&fragments[2]==='qingdao'&&fragments[3]==='laoshan')body=<TalentLaoshanGuide/>;
 else if(kind==='policy-guide-preview'&&fragments[2]==='qingdao')body=<TalentQingdaoGuidePreview kind={fragments[3]==='stay'?'stay':'housing'}/>;
 else if(kind==='match')body=<TalentMatchingPage city={decode(fragments[2]||'北京')||'北京'}/>;
 else if(kind==='policy'||kind==='housing')body=<DetailPage kind={kind} id={decode(fragments[2]||'')}/>;
 else body=<><Bread current="页面未找到"/><section className="ts-sub-header"><h1>暂时找不到这个页面</h1><Link to="/talent-service">返回人才政策首页 <ArrowRight size={16}/></Link></section></>;
 return <Shell user={user}><div className="ts-page ts-sub-page">{body}<footer className="ts-sub-footer"><Link to="/talent-service">人才政策首页</Link><span>HHBA · 让劳动更有尊严，让商业更有温度</span></footer></div></Shell>;
}
