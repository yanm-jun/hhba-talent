import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,Building2,FileText,MapPin,Search,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import {TALENT_CITY_INDEX,TALENT_MUNICIPALITIES,TALENT_PROVINCES,queryTalentCities,findTalentProvince} from '../data/talentCityRegistry';
import {TALENT_POLICY_RECORDS} from '../data/talentPolicyRecords';
import {TALENT_HOUSING_RECORDS} from '../data/talentHousingRecords';
import '../styles/talent-city-directory.css';

const PAGE_SIZE=24;
const totals={city:TALENT_CITY_INDEX.length,prefecture:293,municipality:4,autonomous:8,otherPrefectures:32};
const policyCounts=new Map<string,number>();
const housingCounts=new Map<string,number>();
for(const p of TALENT_POLICY_RECORDS)policyCounts.set(p.city,(policyCounts.get(p.city)||0)+1);
for(const h of TALENT_HOUSING_RECORDS)housingCounts.set(h.city,(housingCounts.get(h.city)||0)+1);
const cityUrl=(city:string)=>'/talent-service/city/'+encodeURIComponent(city);
export function TalentCityDirectory({initialProvince='',initialQuery=''}:{initialProvince?:string;initialQuery?:string}){
 const [province,setProvince]=useState(()=>{
  const match=findTalentProvince(initialProvince);
  return match?.official||'';
 });
 const [query,setQuery]=useState(initialQuery);
 const [page,setPage]=useState(1);
 const cities=useMemo(()=>queryTalentCities(query,province),[query,province]);
 const pages=Math.max(1,Math.ceil(cities.length/PAGE_SIZE));
 const current=Math.min(page,pages);
 const visible=cities.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 const pickProvince=(value:string)=>{setProvince(value);setPage(1)};
 const editQuery=(value:string)=>{setQuery(value);setPage(1)};
 return <div className="tcd-directory">
  <nav aria-label="当前位置" className="tcd-breadcrumb"><Link to="/talent-service">人才服务首页</Link><span>›</span><span>全部城市</span></nav>
  <header className="tcd-hero"><span className="tcd-kicker">HHBA / NATIONAL CITY DIRECTORY</span><h1>选择城市，查询当地人才服务</h1>
   <p>全国目标城市的搜索入口已建立。是否已有政策、公寓资料以各城市实际收录情况为准。</p>
   <div className="tcd-numbers"><span><b>{totals.city}</b> 城市入口</span><span><b>{totals.municipality}</b> 直辖市</span><span><b>{totals.prefecture}</b> 地级市</span><span><b>{totals.autonomous}</b> 云南自治州</span><span><b>{totals.otherPrefectures}</b> 其他盟州地区</span></div></header>
  <section className="tcd-controls" aria-label="城市筛选">
   <label className="tcd-search"><Search size={17}/><input aria-label="搜索城市名称、拼音或省份" autoComplete="off" value={query} onChange={e=>editQuery(e.target.value)} placeholder="搜索：临沂、linyi、聊城、山东省…"/></label>
   <label className="tcd-select"><span>省份 / 自治区</span><select aria-label="选择省份或自治区" value={province} onChange={e=>pickProvince(e.target.value)}>
     <option value="">全部省份</option><option value="直辖市">四个直辖市</option>
     {TALENT_PROVINCES.map(p=><option value={p.official} key={p.code}>{p.official}</option>)}
    </select></label>
  </section>
  <div className="tcd-quick-provinces"><span>快捷选择：</span>{[{name:'全部城市',code:''},{name:'四个直辖市',code:'直辖市'},...['山东省','广东省','江苏省','浙江省','云南省','四川省'].map(name=>({name,code:name}))].map(p=><button key={p.name} type="button" className={province===p.code?'active':''} onClick={()=>pickProvince(p.code)}>{p.name}</button>)}</div>
  <div className="tcd-list-head"><h2>{province==='直辖市'?'四个直辖市':province||'全国已录入城市'}</h2>
   <span>找到 {cities.length} 座城市{query?' · 搜索 “'+query+'”':''}</span></div>
  {visible.length?<div className="tcd-grid">
   {visible.map(c=>{const a=policyCounts.get(c.name)||0,b=housingCounts.get(c.name)||0;
    return <Link className="tcd-card" to={cityUrl(c.name)} key={c.code||c.name}><span className="tcd-card-label"><MapPin size={16}/>{c.level==='municipality'?'直辖市':c.province}</span>
      <div className="tcd-card-title"><strong>{c.official}</strong><ArrowRight size={16}/></div>
      <div className="tcd-card-meta">{a+b?<><span><FileText size={12}/> {a} 条政策</span><span><Building2 size={12}/> {b} 条住房资料</span></>:<span className="tcd-preparing">政策数据整理中 · 城市入口已开通</span>}</div>
     </Link>})}
  </div>:<div className="tcd-empty"><Search size={24}/><strong>没有找到符合条件的地级市或直辖市</strong>
   <p>请尝试完整城市名称、拼音或更换省份。当前已包含云南省8个自治州，目前已补充地级自治州、盟和地区入口；省直管县级市、县与林区仍须独立层级管理。</p><button type="button" onClick={()=>{pickProvince('');editQuery('')}}>清除筛选条件</button></div>}
  {pages>1&&<nav className="tcd-pager" aria-label="城市列表翻页">
   <button disabled={current===1} type="button" onClick={()=>setPage(x=>Math.max(1,x-1))}><ArrowLeft size={14}/>上一页</button>
   <span>第 {current} / {pages} 页</span>
   <button disabled={current===pages} type="button" onClick={()=>setPage(x=>Math.min(pages,x+1))}>下一页<ArrowRight size={14}/></button></nav>}
  <aside className="tcd-note"><ShieldCheck size={16}/><span>名录采用2025年县以上行政区划代码整理，基础范围为4个直辖市和293个地级市，另接入云南省8个自治州和其他32个盟州地区。这里提供城市搜索与页面入口，<strong>不代表已收录每个城市的实时政策、申请渠道和住房空房</strong>。</span></aside>
 </div>;
}
