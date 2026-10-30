import {useState,type KeyboardEvent} from 'react';
import {ArrowRight,ArrowUpRight,Building2,ChevronDown,ClipboardList,FileText,GraduationCap,MapPin,Search,ShieldCheck,Wallet} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import {TALENT_CITY_INDEX,TALENT_MUNICIPALITIES,TALENT_LEGACY_CITIES,parseTalentCityQuery,suggestTalentCities} from '../data/talentCityRegistry';
import {TALENT_POLICY_RECORDS} from '../data/talentPolicyRecords';
import {TALENT_HOUSING_RECORDS} from '../data/talentHousingRecords';
import {talentCityUrl,talentListUrl,talentSearchUrl,talentPolicyUrl,talentHousingUrl} from './TalentServiceRoutes';
import '../styles/talent-home-v4-final.css';

const featured=['杭州','深圳','青岛'];
const hot=['北京','上海','杭州','深圳','济南','青岛'];
const apartmentIds=['hz-xiyue','sz-young'];
const policyIds=['hz-grad-living','qd-graduate-house','sz-youth-rent-subsidy'];
export function TalentServicePage({user}:{user:User|null}){
 const [city,setCity]=useState('北京'),[chosen,setChosen]=useState(false),[keyword,setKeyword]=useState('');
 const [cityOpen,setCityOpen]=useState(false),[suggestOpen,setSuggestOpen]=useState(false),[suggestIndex,setSuggestIndex]=useState(-1);
 const [allCities,setAllCities]=useState(false),[matchOpen,setMatchOpen]=useState(false);
 const [degree,setDegree]=useState('本科'),[grad,setGrad]=useState('应届'),[matchCity,setMatchCity]=useState('北京');
 const [badImages,setBadImages]=useState<string[]>([]);
 const parsed=parseTalentCityQuery(keyword,city);
 const suggestions=suggestTalentCities(keyword);
 const choose=(name:string)=>{setCity(name);setChosen(true);setCityOpen(false);setSuggestOpen(false)};
 const search=()=>{const q=keyword.trim();setSuggestOpen(false);navigate(!q||(parsed.matchedCity&&parsed.cityOnly)?talentCityUrl(parsed.matchedCity?parsed.city:city):talentSearchUrl(parsed.city,q))};
 const keydown=(e:KeyboardEvent<HTMLInputElement>)=>{
  if(e.key==='Escape'){setSuggestOpen(false);setSuggestIndex(-1)}
  if(suggestOpen&&suggestions.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();setSuggestIndex(i=>(i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length)}
  if(e.key==='Enter'){e.preventDefault();if(suggestOpen&&suggestIndex>=0&&suggestions[suggestIndex])navigate(talentCityUrl(suggestions[suggestIndex].name));else search()}
 };
 const previewPolicies=policyIds.map(id=>TALENT_POLICY_RECORDS.find(p=>p.id===id)).filter(p=>p!==undefined);
 const previewHomes=apartmentIds.map(id=>TALENT_HOUSING_RECORDS.find(h=>h.id===id)).filter(h=>h!==undefined);
 const failImage=(name:string)=>setBadImages(list=>list.includes(name)?list:[...list,name]);
 return <Shell user={user}><div className="hhba-talent-layout">
  <header className="htl-header"><strong>HHBA <span>· 人才服务</span></strong><small>全国城市人才服务平台</small></header>
  <div className="htl-main">
   <section className="htl-intro"><h1>选择一座城市，发现更多可能</h1><p>人才政策、安居保障、生活补贴、申请办理，一站式了解。</p>
    <div className="htl-search">
     <div className="htl-search-cell" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setCityOpen(false)}}>
      <button className="htl-city-picker" type="button" onClick={()=>{setCityOpen(v=>!v);setSuggestOpen(false)}} aria-expanded={cityOpen}><MapPin size={16}/><span>{chosen?TALENT_CITY_INDEX.find(c=>c.name===city)?.official:'选择省份 / 城市'}</span><ChevronDown size={15}/></button>
      {cityOpen&&<div className="htl-dropdown" role="group" aria-label="选择城市"><div className="htl-menu-label">四个直辖市</div>
       {TALENT_MUNICIPALITIES.map(c=><button key={c.name} type="button" onClick={()=>choose(c.name)}>{c.official}<small>直辖市</small></button>)}
       <div className="htl-menu-label">此前已收录城市</div>
       {TALENT_LEGACY_CITIES.map(c=><button key={c.name} type="button" onClick={()=>choose(c.name)}>{c.official}<small>{c.province}</small></button>)}
      </div>}
     </div>
     <div className="htl-search-cell" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setSuggestOpen(false)}}>
      <div className="htl-query"><Search size={17}/><input value={keyword} onChange={e=>{setKeyword(e.target.value);setSuggestOpen(true);setSuggestIndex(-1)}} onFocus={()=>setSuggestOpen(true)} onKeyDown={keydown} placeholder="搜索人才政策、公寓、补贴…" autoComplete="off" aria-label="搜索人才政策、公寓、补贴或城市"/>
       <button type="button" onClick={search}>搜索</button></div>
      {suggestOpen&&keyword.trim()&&suggestions.length>0&&<div className="htl-dropdown" role="listbox" aria-label="城市联想">
       {suggestions.map((c,i)=><button type="button" role="option" aria-selected={suggestIndex===i} className={suggestIndex===i?'active':''} key={c.name} onMouseDown={e=>e.preventDefault()} onClick={()=>navigate(talentCityUrl(c.name))}>{c.official}<small>{c.level==='municipality'?'直辖市':c.province}</small></button>)}
      </div>}
     </div>
    </div>
    <div className="htl-hot">热门城市：{hot.map((name,i)=><span key={name}><button type="button" onClick={()=>navigate(talentCityUrl(name))}>{name}</button>{i<hot.length-1&&' · '}</span>)}</div>
   </section>
   <section className="htl-quick" aria-label="人才服务快捷入口">
    {[
     {name:'人才公寓',kind:'housing' as const,Icon:Building2},
     {name:'人才政策',kind:'policies' as const,Icon:FileText},
     {name:'补贴福利',kind:'benefits' as const,Icon:Wallet},
     {name:'申请指南',kind:'guide' as const,Icon:ClipboardList}
    ].map(item=><button type="button" key={item.kind} onClick={()=>navigate(talentListUrl(item.kind,city))}><item.Icon size={21} strokeWidth={1.8}/><span>{item.name}</span></button>)}
   </section>
   <section className="htl-section" aria-labelledby="htl-city-title">
    <div className="htl-heading"><h2 id="htl-city-title">热门人才城市</h2><button type="button" onClick={()=>setAllCities(x=>!x)} aria-expanded={allCities}>{allCities?'收起城市':'查看全部城市'} ›</button></div>
    <div className="htl-city-grid">{featured.map(name=>{const c=TALENT_CITY_INDEX.find(v=>v.name===name);return <Link key={name} to={talentCityUrl(name)} className="htl-city-card">
     <div className="htl-city-photo">{c?.photo&&!badImages.includes(name)?<img src={c.photo} loading="lazy" alt={name+'城市实景'} onError={()=>failImage(name)}/>:<div className="htl-city-fallback"><MapPin size={20}/>{name}</div>}</div>
     <div className="htl-city-caption"><strong>{name}</strong><small>政策 · 安居 · 补贴</small></div></Link>})}</div>
    {allCities?<div className="htl-all-cities"><p>当前已接入的四个直辖市及此前已有城市</p>{TALENT_CITY_INDEX.map(c=><Link key={c.name} to={talentCityUrl(c.name)}>{c.official} <ArrowUpRight size={13}/></Link>)}</div>:<div className="htl-down" aria-hidden="true">⌄</div>}
   </section>
   <div className="htl-divider"/>
   <section className="htl-section" aria-labelledby="htl-housing-title">
    <div className="htl-heading"><h2 id="htl-housing-title">人才公寓推荐</h2><button type="button" onClick={()=>navigate(talentListUrl('housing',city))}>更多项目 ›</button></div>
    <div className="htl-housing-grid">{previewHomes.map(h=><Link key={h.id} to={talentHousingUrl(h.id)} className="htl-housing-card">
     <div className="htl-housing-photo"><Building2 size={36} strokeWidth={1.4}/><span>项目实景待官方核验</span></div>
     <div className="htl-housing-caption"><strong>{h.title}</strong><small>{h.kind==='program'?'住房政策入口 · 具体项目与房源请核验':h.district+' · 查看官方项目与配租说明'}</small></div>
    </Link>)}</div>
   </section>
   <div className="htl-divider"/>
   <section className="htl-section" aria-labelledby="htl-policy-title">
    <div className="htl-heading"><h2 id="htl-policy-title">人才政策与福利</h2><button type="button" onClick={()=>navigate(talentListUrl('policies',city))}>全部政策 ›</button></div>
    <div className="htl-policy-list">{previewPolicies.map(p=><Link key={p.id} to={talentPolicyUrl(p.id)} className="htl-policy-card">
     <div className="htl-policy-meta"><span>{p.city} · {p.category}</span><ArrowUpRight size={13}/></div>
     <strong>{p.title}</strong><small>{p.summary.length>58?p.summary.slice(0,58)+'…':p.summary}</small>
    </Link>)}</div>
   </section>
   <section className="htl-match"><div className="htl-match-heading"><div><h2>看看你可能符合哪些人才政策？</h2><p>输入学历、毕业时间、目标城市等信息，辅助筛选适用政策。</p></div><GraduationCap size={22}/></div>
    <button className="htl-match-button" type="button" onClick={()=>setMatchOpen(x=>!x)} aria-expanded={matchOpen}>{matchOpen?'收起初步筛选':'开始政策匹配 →'}</button>
    {matchOpen&&<div className="htl-match-panel"><div className="htl-match-fields">
     <label>目标城市<select value={matchCity} onChange={e=>setMatchCity(e.target.value)}>{TALENT_CITY_INDEX.map(c=><option key={c.name} value={c.name}>{c.official}</option>)}</select></label>
     <label>学历<select value={degree} onChange={e=>setDegree(e.target.value)}>{['专科','本科','硕士','博士'].map(d=><option key={d}>{d}</option>)}</select></label>
     <label>毕业情况<select value={grad} onChange={e=>setGrad(e.target.value)}>{['应届','毕业三年内','其他'].map(d=><option key={d}>{d}</option>)}</select></label>
    </div><p>当前仅按已收录的政策信息初步检索，不判断实际申领资格；社保、户籍和住房条件仍须核对。</p>
    <button type="button" onClick={()=>navigate(talentSearchUrl(matchCity,matchCity+' '+degree+(grad==='应届'?'应届毕业生':'人才政策')))}>查询相关政策 <ArrowRight size={14}/></button></div>}
   </section>
  </div>
  <footer className="htl-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度</span><span>页面布局 · <Link to="/talent-service/city/北京">城市独立服务页</Link></span></footer>
  <p className="htl-note"><ShieldCheck size={13}/> 城市图片来源可在对应城市档案核对；公寓实景未经核验不冒用示意图，政策以政府最新公告为准。</p>
 </div></Shell>;
}
