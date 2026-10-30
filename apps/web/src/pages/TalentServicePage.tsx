import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,Building2,ChevronDown,FileText,MapPin,Search,ShieldCheck} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link,navigate} from '../router';
import {TALENT_CITY_INDEX,TALENT_MUNICIPALITIES,TALENT_LEGACY_CITIES,parseTalentCityQuery,suggestTalentCities} from '../data/talentCityRegistry';
import {TALENT_POLICY_RECORDS} from '../data/talentPolicyRecords';
import {TALENT_HOUSING_RECORDS} from '../data/talentHousingRecords';
import {talentCityUrl,talentListUrl,talentSearchUrl,talentHousingUrl,talentPolicyUrl} from './TalentServiceRoutes';
import type {User} from '../services/api';
import '../styles/talent-service.css';
import '../styles/talent-carousel.css';
import '../styles/talent-portal.css';
import '../styles/talent-v4.css';

export function TalentServicePage({user}:{user:User|null}){
 const [city,setCity]=useState('北京');
 const [keyword,setKeyword]=useState('');
 const [slideIndex,setSlideIndex]=useState(0);
 const [slideshowPaused,setSlideshowPaused]=useState(false);
 const [photoFailed,setPhotoFailed]=useState(false);
 const [suggestOpen,setSuggestOpen]=useState(false);
 const [suggestIndex,setSuggestIndex]=useState(0);
 const slideCity=TALENT_CITY_INDEX[slideIndex]||TALENT_CITY_INDEX[0];
 const suggestions=suggestTalentCities(keyword);
 const parsed=parseTalentCityQuery(keyword,city);
 useEffect(()=>{
  if(slideshowPaused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const timer=window.setInterval(()=>setSlideIndex(i=>(i+1)%TALENT_CITY_INDEX.length),6500);
  return ()=>window.clearInterval(timer);
 },[slideshowPaused]);
 useEffect(()=>setPhotoFailed(false),[slideIndex]);
 const chooseCity=(name:string)=>{setCity(name);setSuggestOpen(false);const i=TALENT_CITY_INDEX.findIndex(c=>c.name===name);if(i>=0)setSlideIndex(i)};
 const slideBy=(d:number)=>setSlideIndex(i=>(i+d+TALENT_CITY_INDEX.length)%TALENT_CITY_INDEX.length);
 const submit=()=>{setSuggestOpen(false);const q=keyword.trim();navigate(!q||(parsed.matchedCity&&parsed.cityOnly)?talentCityUrl(parsed.matchedCity?parsed.city:city):talentSearchUrl(parsed.city,q))};
 const policies=TALENT_POLICY_RECORDS.filter(p=>p.city===city).slice(0,2);
 const housing=TALENT_HOUSING_RECORDS.filter(h=>h.city===city).slice(0,2);
 return <Shell user={user}><div className="ts-page">
  <section className="ts-hero" aria-labelledby="talent-heading">
   <div className="ts-hero-content">
    <span className="ts-kicker"><span className="ts-kicker-dot"/> HHBA · TALENT SERVICES</span>
    <h1 id="talent-heading">选择一座城市，<br/><em>发现更多可能。</em></h1>
    <p className="ts-lead">从选城市开始，查询人才政策与人才安居。首批上线四个直辖市，已有城市资料继续保留。</p>
    <div className="ts-searchbar">
     <label className="ts-city-select"><MapPin size={17}/><span className="sr-only">选择城市</span><select value={city} onChange={e=>chooseCity(e.target.value)} aria-label="选择城市">
      <optgroup label="四个直辖市">{TALENT_MUNICIPALITIES.map(c=><option key={c.name} value={c.name}>{c.official}</option>)}</optgroup>
      <optgroup label="此前已收录的城市">{TALENT_LEGACY_CITIES.map(c=><option key={c.name} value={c.name}>{c.official}</option>)}</optgroup>
     </select><ChevronDown size={15}/></label>
     <div className="ts-query-container">
      <label className="ts-query-field"><Search size={18}/><span className="sr-only">搜索城市和人才服务</span>
       <input value={keyword} autoComplete="off" placeholder="搜北京市、天津市、重庆硕士补贴…" aria-label="搜索城市、人才政策和公寓"
        onFocus={()=>setSuggestOpen(true)}
        onChange={e=>{setKeyword(e.target.value);setSuggestOpen(true);setSuggestIndex(0)}}
        onKeyDown={e=>{
         if(e.key==='Escape'){setSuggestOpen(false);return}
         if(suggestOpen&&suggestions.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();setSuggestIndex(i=>(i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);return}
         if(e.key==='Enter'){e.preventDefault();if(parsed.cityOnly&&parsed.matchedCity&&suggestOpen&&suggestions.length)navigate(talentCityUrl(suggestions[Math.min(suggestIndex,suggestions.length-1)].name));else submit()}
        }}/></label>
      {suggestOpen&&keyword.trim()&&suggestions.length>0&&<div className="ts-city-suggestions" role="listbox" aria-label="搜索匹配的城市">
       {suggestions.map((c,i)=><button type="button" key={c.name} role="option" aria-selected={suggestIndex===i} className={suggestIndex===i?'active':''}
        onMouseDown={e=>e.preventDefault()} onClick={()=>navigate(talentCityUrl(c.name))}><MapPin size={14}/><strong>{c.official}</strong><small>{c.level==='municipality'?'直辖市':'已有资料城市'}</small><ArrowRight size={14}/></button>)}
      </div>}
     </div>
     <button type="button" className="ts-search-submit" onClick={submit}>搜索 <ArrowRight size={17}/></button>
    </div>
    <div className="ts-hot-cities"><span>四个直辖市</span>{TALENT_MUNICIPALITIES.map(c=><button key={c.name} type="button" className={city===c.name?'active':''} onClick={()=>navigate(talentCityUrl(c.name))}>{c.official}</button>)}</div>
    <div className="ts-trust-note"><ShieldCheck size={15}/> 四个直辖市均可检索 · 首批数据来自政府公开文件，非实时申报系统</div>
   </div>
   <div className="ts-hero-art ts-carousel" role="region" aria-roledescription="轮播" aria-label="热门城市实景照片"
    onMouseEnter={()=>setSlideshowPaused(true)} onMouseLeave={()=>setSlideshowPaused(false)}
    onFocusCapture={()=>setSlideshowPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setSlideshowPaused(false)}}>
    <div className="ts-hero-photo-halo" aria-hidden="true"/>
    <figure className="ts-hero-photo">
     {!photoFailed&&<img key={slideCity.name} src={slideCity.photo} alt={slideCity.name+'城市实景照片'} onError={()=>setPhotoFailed(true)} loading="eager" decoding="async"/>}
     <span className="ts-photo-topline" aria-hidden="true">CITY IN FOCUS <span>●</span> {slideCity.province}</span>
     <figcaption className="ts-photo-caption"><span>DISCOVER YOUR NEXT CITY</span><strong>{slideCity.name}</strong><small>{slideCity.province} · 城市实景</small></figcaption>
    </figure>
    <button type="button" className="ts-carousel-arrow ts-carousel-prev" aria-label="上一座城市" onClick={()=>slideBy(-1)}>‹</button>
    <button type="button" className="ts-carousel-arrow ts-carousel-next" aria-label="下一座城市" onClick={()=>slideBy(1)}>›</button>
    <div className="ts-carousel-bottom"><span className="ts-carousel-count">{slideIndex+1} / {TALENT_CITY_INDEX.length}</span><div className="ts-carousel-dots" aria-label="选择轮播城市">{TALENT_CITY_INDEX.map((c,i)=><button type="button" key={c.name} aria-label={'查看'+c.name+'照片'} aria-pressed={i===slideIndex} className={i===slideIndex?'active':''} onClick={()=>setSlideIndex(i)}/>)}</div>
     <button type="button" className="ts-carousel-to-policy" onClick={()=>navigate(talentCityUrl(slideCity.name))}>查看{slideCity.name}服务 <ArrowRight size={13}/></button></div>
   </div>
  </section>
  <section className="ts-quick-wrap" aria-label="两大核心服务">
   <div className="ts-quick-grid">{[{name:'政策与补贴',description:'生活补贴 · 落户 · 就业支持',kind:'policies',icon:FileText},{name:'人才安居',description:'人才公寓 · 租房支持 · 申请条件',kind:'housing',icon:Building2}].map(item=><button type="button" className="ts-quick-card" key={item.name} onClick={()=>navigate(talentListUrl(item.kind as 'policies'|'housing',city))}><span className="ts-quick-icon"><item.icon size={23}/></span><span><strong>{item.name}</strong><small>{item.description}</small></span><ArrowUpRight size={16} className="ts-quick-arrow"/></button>)}</div>
  </section>
  <section className="ts-section ts-v4-cities" id="ts-cities">
   <div className="ts-section-heading"><div><span className="ts-section-kicker">MUNICIPALITIES / 直辖市</span><h2>四个直辖市 · 人才服务</h2><p>北京、天津、上海、重庆均可搜索并进入独立城市页，了解政策与安居服务。</p></div><span className="ts-sample-label">首批4座城市已接入</span></div>
   <div className="ts-city-grid">{TALENT_MUNICIPALITIES.map(c=><button type="button" className={'ts-city-card '+(city===c.name?'is-current':'')} key={c.name} onClick={()=>navigate(talentCityUrl(c.name))}><div className="ts-city-photo"><img src={c.photo} alt={c.official+'城市风貌'} loading="lazy"/><span className="ts-city-badge">直辖市</span></div><div className="ts-city-info"><div><h3>{c.official}</h3><p>{c.intro}</p></div><span className="ts-circle-arrow"><ArrowUpRight size={19}/></span></div></button>)}</div>
   <div className="ts-more-cities"><span>此前已收录城市</span>{TALENT_LEGACY_CITIES.map(c=><button type="button" key={c.name} onClick={()=>navigate(talentCityUrl(c.name))}>{c.official} <ArrowRight size={13}/></button>)}</div>
  </section>
  <section className="ts-section ts-home-featured" aria-label="精选人才政策">
   <div className="ts-section-heading"><div><span className="ts-section-kicker">OFFICIAL POLICY / 官方来源</span><h2>{city} · 精选政策与补贴</h2><p>首页只展示少量摘要，完整内容请点击进入独立详情页。</p></div><Link className="ts-home-more" to={talentListUrl('policies',city)}>查看全部政策 <ArrowRight size={15}/></Link></div>
   <div className="ts-home-preview-grid">{policies.map(p=><Link to={talentPolicyUrl(p.id)} className="ts-home-preview" key={p.id}><span>{p.category}{p.district?' · '+p.district:''}</span><strong>{p.title}</strong><p>{p.summary}</p><small>查看政策详情 <ArrowRight size={14}/></small></Link>)}{!policies.length&&<p className="ts-home-no-data">暂无已核验政策。<Link to={talentCityUrl(city)}>查看城市入口</Link></p>}</div>
  </section>
  <section className="ts-section ts-home-featured" aria-label="精选住房">
   <div className="ts-section-heading"><div><span className="ts-section-kicker">REAL HOUSING / 人才安居</span><h2>{city} · 人才安居</h2><p>仅展示有政府公开文件依据的项目与制度，历史房源不代表当前空房。</p></div><Link className="ts-home-more" to={talentListUrl('housing',city)}>查看所有住房 <ArrowRight size={15}/></Link></div>
   <div className="ts-home-preview-grid">{housing.map(h=><Link to={talentHousingUrl(h.id)} className="ts-home-preview" key={h.id}><span>{h.district}</span><strong>{h.title}</strong><p>{h.address}</p><small>查看住房详情 <ArrowRight size={14}/></small></Link>)}{!housing.length&&<p className="ts-home-no-data">暂无已核验住房项目。<Link to={talentCityUrl(city)}>查看城市入口</Link></p>}</div>
  </section>
  <footer className="ts-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度。</span><Link to="/candidate/jobs">返回招聘市场 <ArrowRight size={14}/></Link></footer>
  <p className="ts-photo-credit">城市图片来源：{TALENT_CITY_INDEX.map((c,i)=><span key={c.name}>{i?' · ':''}<a href={c.photoPage} target="_blank" rel="noreferrer noopener">{c.name} / {c.credit}</a></span>)}。住房未取得实际项目授权照片时不展示替代图片。</p>
 </div></Shell>;
}
