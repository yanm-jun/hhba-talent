import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,Building2,CalendarDays,CheckCircle2,ChevronDown,ClipboardCheck,ExternalLink,FileText,GraduationCap,Home,MapPin,Search,ShieldCheck,Sparkles,Wallet,X} from 'lucide-react';
import {Shell} from '../components/Shell';
import {TalentPolicySearch,parsePolicyQuery} from '../components/TalentPolicySearch';
import {TALENT_HOUSING_RECORDS} from '../data/talentHousingRecords';
import {talentCityUrl,talentListUrl,talentSearchUrl,talentHousingUrl,talentPolicyUrl} from './TalentServiceRoutes';
import {TALENT_POLICY_RECORDS} from '../data/talentPolicyRecords';
import {Link,navigate} from '../router';
import type {User} from '../services/api';
import '../styles/talent-service.css';
import '../styles/talent-carousel.css';
import '../styles/talent-portal.css';

type City={name:string;province:string;photo?:string;credit?:string;photoPage?:string;intro:string};
const CITIES:City[]=[
 {name:'杭州',province:'浙江',photo:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/%E6%9D%AD%E5%B7%9E%E9%92%B1%E6%B1%9F%E6%96%B0%E5%9F%8E.jpg/1280px-%E6%9D%AD%E5%B7%9E%E9%92%B1%E6%B1%9F%E6%96%B0%E5%9F%8E.jpg',credit:'EditQ · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:%E6%9D%AD%E5%B7%9E%E9%92%B1%E6%B1%9F%E6%96%B0%E5%9F%8E.jpg',intro:'数字经济、先进制造与青年人才发展'},
 {name:'深圳',province:'广东',photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Skyline_in_Shenzhen_%2820250327%29.jpg?width=1280',credit:'Fumikas Sagisavas · CC0',photoPage:'https://commons.wikimedia.org/wiki/File:Skyline_in_Shenzhen_(20250327).jpg',intro:'科技创新、产业人才与城市安居'},
 {name:'青岛',province:'山东',photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/%E9%9D%92%E5%B2%9B%E5%A4%A9%E9%99%85%E7%BA%BF201809.jpg?width=1280',credit:'WFan · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:%E9%9D%92%E5%B2%9B%E5%A4%A9%E9%99%85%E7%BA%BF201809.jpg',intro:'海洋产业、先进制造与青年就业'},
 {name:'上海',province:'上海',photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Shanghai_skyline.jpg?width=1280',credit:'Rose Abrams · Wikimedia Commons',photoPage:'https://commons.wikimedia.org/wiki/File:Shanghai_skyline.jpg',intro:'金融、科技创新与多层次人才保障'},
 {name:'北京',province:'北京',photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Guomao_Skyline.jpg?width=1280',credit:'郭友柏 · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:Guomao_Skyline.jpg',intro:'研发创新、公共服务与人才发展'},
 {name:'济南',province:'山东',photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Jinan_CBD_skyline_June_2023.jpg?width=1280',credit:'Percival Kestreltail · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:Jinan_CBD_skyline_June_2023.jpg',intro:'省会就业机会与青年人才支持'}
]
const HOWTO=[
 {number:'01',title:'先看申请资格',description:'核对城市、学历、毕业时间、就业及社保条件'},
 {number:'02',title:'准备申报材料',description:'确认身份证明、学历证明、合同等官方材料清单'},
 {number:'03',title:'进入政府办理入口',description:'通过当地人社、住建或政务服务平台提交'},
 {number:'04',title:'跟进审核与结果',description:'以政府窗口公布的审核时间和结果为准'}
];
const scrollToSection=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
export function TalentServicePage({user}:{user:User|null}){
 const [city,setCity]=useState('杭州');
 const [keyword,setKeyword]=useState('');
 const [slideIndex,setSlideIndex]=useState(0);
 const [slideshowPaused,setSlideshowPaused]=useState(false);
 const [photoFailed,setPhotoFailed]=useState(false);
 useEffect(()=>{
  if(slideshowPaused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const id=window.setInterval(()=>setSlideIndex(index=>(index+1)%CITIES.length),6500);
  return ()=>window.clearInterval(id);
 },[slideshowPaused]);
 useEffect(()=>setPhotoFailed(false),[slideIndex]);
 const slideCity=CITIES[slideIndex]||CITIES[0];
 const chooseCity=(name:string)=>{setCity(name);const i=CITIES.findIndex(c=>c.name===name);if(i>=0)setSlideIndex(i);};
 const submitSearch=()=>{
  const query=keyword.trim();
  const matchedCity=parsePolicyQuery(query,city).city;
  navigate(query?talentSearchUrl(matchedCity,query):talentCityUrl(matchedCity));
 };
 const slideBy=(delta:number)=>setSlideIndex(i=>(i+delta+CITIES.length)%CITIES.length);
 return <Shell user={user}>
  <div className="ts-page">
   <section className="ts-hero" aria-labelledby="ts-hero-title">
    <div className="ts-hero-content">
     <span className="ts-kicker"><span className="ts-kicker-dot"/> HHBA · TALENT SERVICES</span>
     <h1 id="ts-hero-title">选择一座城市，<br/><em>发现更多可能。</em></h1>
     <p className="ts-lead">从一份工作，到一座城市的生活。人才政策、安居保障、生活补贴与办事指南，帮你把未来看得更清楚。</p>
     <div className="ts-searchbar">
      <label className="ts-city-select"><MapPin size={17} aria-hidden="true"/><span className="sr-only">选择城市</span><select value={city} onChange={e=>chooseCity(e.target.value)} aria-label="选择城市">{!CITIES.some(c=>c.name===city)&&<option value={city}>{city}（数据待收录）</option>}{CITIES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label>
      <label className="ts-query-field"><Search size={19} aria-hidden="true"/><span className="sr-only">搜索人才服务</span><input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submitSearch();}}} placeholder="输入杭州硕士补贴、青岛人才公寓…" aria-label="搜索人才政策、公寓和补贴"/></label>
      <button className="ts-search-submit" type="button" onClick={submitSearch}>搜索 <ArrowRight size={17}/></button>
     </div>
     <div className="ts-hot-cities"><span>热门城市</span>{CITIES.slice(0,6).map(c=><button key={c.name} type="button" className={c.name===city?'active':''} onClick={()=>navigate(talentCityUrl(c.name))}>{c.name}</button>)}</div>
     <div className="ts-trust-note"><ShieldCheck size={15}/> 已接入首批政府来源政策索引 · 非实时全网搜索，申报前请核对最新政府公告</div>
    </div>
    <div className="ts-hero-art ts-carousel" role="region" aria-roledescription="轮播" aria-label="热门城市实景照片"
      onMouseEnter={()=>setSlideshowPaused(true)} onMouseLeave={()=>setSlideshowPaused(false)}
      onFocusCapture={()=>setSlideshowPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setSlideshowPaused(false)}}>
     <div className="ts-hero-photo-halo" aria-hidden="true"/>
     <figure className="ts-hero-photo">
      {!photoFailed&&<img key={slideCity.name} src={slideCity.photo} onError={()=>setPhotoFailed(true)} alt={slideCity.name+'城市实景照片'} loading="eager" decoding="async"/>}
      <span className="ts-photo-topline" aria-hidden="true">CITY IN FOCUS <span>●</span> {slideCity.province}</span>
      <figcaption className="ts-photo-caption"><span>DISCOVER YOUR NEXT CITY</span><strong>{slideCity.name}</strong><small>{slideCity.province} · 城市实景</small></figcaption>
     </figure>
     <button type="button" className="ts-carousel-arrow ts-carousel-prev" aria-label="上一座城市" onClick={()=>slideBy(-1)}>‹</button>
     <button type="button" className="ts-carousel-arrow ts-carousel-next" aria-label="下一座城市" onClick={()=>slideBy(1)}>›</button>
     <div className="ts-carousel-bottom"><span className="ts-carousel-count">{slideIndex+1} / {CITIES.length}</span>
      <div className="ts-carousel-dots" aria-label="选择轮播城市">{CITIES.map((c,i)=><button type="button" key={c.name} aria-label={'查看'+c.name+'照片'} aria-pressed={i===slideIndex} className={i===slideIndex?'active':''} onClick={()=>setSlideIndex(i)}/>)}</div>
      <button type="button" className="ts-carousel-to-policy" onClick={()=>navigate(talentCityUrl(slideCity.name))}>查看{slideCity.name}服务 <ArrowRight size={13}/></button>
     </div>
    </div>
   </section>

   <section className="ts-quick-wrap" aria-label="人才服务快捷入口">
    <div className="ts-quick-grid">
     {[{title:'人才公寓',sub:'真实项目与申请条件',kind:'housing',icon:Building2},{title:'人才政策',sub:'引进 · 落户 · 就业创业',kind:'policies',icon:FileText},{title:'补贴与福利',sub:'生活 · 住房 · 创业支持',kind:'benefits',icon:Wallet},{title:'申请指南',sub:'材料 · 流程 · 官方入口',kind:'guide',icon:ClipboardCheck}].map(item=><button type="button" className="ts-quick-card" key={item.title} onClick={()=>navigate(talentListUrl(item.kind as 'housing'|'policies'|'benefits'|'guide',city))}><span className="ts-quick-icon"><item.icon size={23}/></span><span><strong>{item.title}</strong><small>{item.sub}</small></span><ArrowUpRight size={16} className="ts-quick-arrow"/></button>)}
    </div>
   </section>

   <section className="ts-section" id="ts-cities">
    <div className="ts-section-heading"><div><span className="ts-section-kicker">EXPLORE CITIES / 城市探索</span><h2>从城市出发，寻找更好的生活</h2><p>点击城市卡片进入独立服务页，查看该城市的政策、公寓和办理指南。</p></div><span className="ts-sample-label">城市展示 · 预览版</span></div>
    <div className="ts-city-grid">{CITIES.slice(0,3).map(c=><button type="button" className={'ts-city-card '+(city===c.name?'is-current':'')} key={c.name} onClick={()=>navigate(talentCityUrl(c.name))}><div className="ts-city-photo">{c.photo&&<img src={c.photo} alt={c.name+'城市风貌'} loading="lazy"/>}<span className="ts-city-badge">{c.province}</span></div><div className="ts-city-info"><div><h3>{c.name}</h3><p>{c.intro}</p></div><span className="ts-circle-arrow"><ArrowUpRight size={19}/></span></div></button>)}</div>
    <div className="ts-more-cities"><span>更多城市</span>{CITIES.slice(3).map(c=><button type="button" onClick={()=>navigate(talentCityUrl(c.name))} className={city===c.name?'active':''} key={c.name}>{c.name} <ArrowRight size={13}/></button>)}</div>
   </section>

   <section className="ts-section ts-home-featured" aria-label="精选人才政策">
    <div className="ts-section-heading"><div><span className="ts-section-kicker">CURATED POLICIES / 精选政策</span><h2>{city} · 精选人才政策</h2><p>少量政府来源政策展示；完整列表和申请材料在独立页面查看。</p></div>
     <Link className="ts-home-more" to={talentListUrl('policies',city)}>全部政策 <ArrowRight size={15}/></Link></div>
    <div className="ts-home-preview-grid">{TALENT_POLICY_RECORDS.filter(p=>p.city===city).slice(0,2).map(p=><Link to={talentPolicyUrl(p.id)} className="ts-home-preview" key={p.id}><span>{p.category}</span><strong>{p.title}</strong><p>{p.summary}</p><small>查看政策详情 <ArrowRight size={14}/></small></Link>)}
     {!TALENT_POLICY_RECORDS.some(p=>p.city===city)&&<p className="ts-home-no-data">该城市暂无已核验政策。<Link to={talentCityUrl(city)}>查看城市服务</Link></p>}</div>
   </section>
   <section className="ts-section ts-home-featured" aria-label="精选人才公寓">
    <div className="ts-section-heading"><div><span className="ts-section-kicker">REAL HOUSING / 人才安居</span><h2>{city} · 真实人才住房项目</h2><p>真实存在的公寓项目，历史公告套数不代表当前有空房。</p></div>
     <Link className="ts-home-more" to={talentListUrl('housing',city)}>全部公寓 <ArrowRight size={15}/></Link></div>
    <div className="ts-home-preview-grid">{TALENT_HOUSING_RECORDS.filter(p=>p.city===city).slice(0,2).map(p=><Link to={talentHousingUrl(p.id)} className="ts-home-preview" key={p.id}><span>{p.district}</span><strong>{p.title}</strong><p>{p.address}</p><small>查看公寓详情 <ArrowRight size={14}/></small></Link>)}
     {!TALENT_HOUSING_RECORDS.some(p=>p.city===city)&&<p className="ts-home-no-data">该城市暂无已核验公寓。<Link to={talentCityUrl(city)}>查看城市服务</Link></p>}</div>
   </section>
   <section className="ts-home-guide-banner"><div><span className="ts-section-kicker">HOW TO APPLY</span><h2>办理之前，先弄清申请规则。</h2><p>核对资格、准备材料、进入官方办理入口，从独立申请指南开始。</p></div><Link to={talentListUrl('guide',city)}>查看{city}申请指南 <ArrowRight size={15}/></Link></section>
   <footer className="ts-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度。</span><Link to="/candidate/jobs">返回招聘市场 <ArrowRight size={14}/></Link></footer>
   <p className="ts-photo-credit">城市图片来源：{CITIES.map((c,i)=><span key={c.name}>{i>0?' · ':''}<a href={c.photoPage} target="_blank" rel="noreferrer noopener">{c.name} / {c.credit}</a></span>)}。人才公寓只展示来源已核对的具体项目，未取得可用照片的项目不展示替代图片。</p>
  </div>

 </Shell>;
}
