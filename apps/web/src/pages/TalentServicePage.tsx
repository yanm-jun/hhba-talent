import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Building2,CalendarDays,CheckCircle2,ChevronDown,ClipboardCheck,ExternalLink,FileText,GraduationCap,Home,MapPin,Search,ShieldCheck,Sparkles,Wallet,X} from 'lucide-react';
import {Shell} from '../components/Shell';
import {TalentPolicySearch,parsePolicyQuery} from '../components/TalentPolicySearch';
import {TalentHousingSection} from '../components/TalentHousingSection';
import {TALENT_POLICY_RECORDS} from '../data/talentPolicyRecords';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/talent-service.css';
import '../styles/talent-carousel.css';

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
 const [submittedQuery,setSubmittedQuery]=useState('');
 const [slideIndex,setSlideIndex]=useState(0);
 const [slideshowPaused,setSlideshowPaused]=useState(false);
 const [photoFailed,setPhotoFailed]=useState(false);
 useEffect(()=>{
  if(slideshowPaused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const id=window.setInterval(()=>setSlideIndex(index=>(index+1)%CITIES.length),6500);
  return ()=>window.clearInterval(id);
 },[slideshowPaused]);
 useEffect(()=>setPhotoFailed(false),[slideIndex]);
 const [education,setEducation]=useState('本科');
 const [grad,setGrad]=useState('应届毕业生');
 const [matchVisible,setMatchVisible]=useState(false);
 const current=CITIES.find(c=>c.name===city)||CITIES[0];
 const slideCity=CITIES[slideIndex]||CITIES[0];
 const chooseCity=(name:string)=>{setCity(name);setMatchVisible(false);setKeyword('');setSubmittedQuery('');const i=CITIES.findIndex(c=>c.name===name);if(i>=0)setSlideIndex(i);};
 const submitSearch=()=>{
  const result=parsePolicyQuery(keyword,city);
  if(result.city!==city){
   setCity(result.city);
   const idx=CITIES.findIndex(c=>c.name===result.city);
   if(idx>=0)setSlideIndex(idx);
  }
  setSubmittedQuery(keyword);
  const housingWords=/公寓|住房|住宿|房源|安居|租房|保租房|保障房/;
  const destination=housingWords.test(keyword)&&!keyword.includes('补贴')?'ts-housing':'ts-policies';
  requestAnimationFrame(()=>document.getElementById(destination)?.scrollIntoView({behavior:'smooth',block:'start'}));
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
     <div className="ts-hot-cities"><span>热门城市</span>{CITIES.slice(0,6).map(c=><button key={c.name} type="button" className={c.name===city?'active':''} onClick={()=>chooseCity(c.name)}>{c.name}</button>)}</div>
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
      <button type="button" className="ts-carousel-to-policy" onClick={()=>{chooseCity(slideCity.name);scrollToSection('ts-policies')}}>查看{slideCity.name}政策 <ArrowRight size={13}/></button>
     </div>
    </div>
   </section>

   <section className="ts-quick-wrap" aria-label="人才服务快捷入口">
    <div className="ts-quick-grid">
     {[{title:'人才公寓',sub:'查项目 · 看条件 · 了解住房',id:'ts-housing',icon:Building2},{title:'人才政策',sub:'引进 · 落户 · 就业创业',id:'ts-policies',icon:FileText},{title:'补贴与福利',sub:'生活 · 住房 · 创业扶持',id:'ts-policies',icon:Wallet},{title:'申请指南',sub:'材料 · 流程 · 官方入口',id:'ts-guide',icon:ClipboardCheck}].map(item=><button type="button" className="ts-quick-card" key={item.title} onClick={()=>scrollToSection(item.id)}><span className="ts-quick-icon"><item.icon size={23}/></span><span><strong>{item.title}</strong><small>{item.sub}</small></span><ArrowUpRight size={16} className="ts-quick-arrow"/></button>)}
    </div>
   </section>

   <section className="ts-section" id="ts-cities">
    <div className="ts-section-heading"><div><span className="ts-section-kicker">EXPLORE CITIES / 城市探索</span><h2>从城市出发，寻找更好的生活</h2><p>点击城市卡片后，下方人才公寓和政策会同时切换；其他城市支持搜索，但必须先核实数据。</p></div><span className="ts-sample-label">城市展示 · 预览版</span></div>
    <div className="ts-city-grid">{CITIES.slice(0,3).map(c=><button type="button" className={'ts-city-card '+(city===c.name?'is-current':'')} key={c.name} onClick={()=>chooseCity(c.name)}><div className="ts-city-photo">{c.photo&&<img src={c.photo} alt={c.name+'城市风貌'} loading="lazy"/>}<span className="ts-city-badge">{c.province}</span></div><div className="ts-city-info"><div><h3>{c.name}</h3><p>{c.intro}</p></div><span className="ts-circle-arrow"><ArrowUpRight size={19}/></span></div></button>)}</div>
    <div className="ts-more-cities"><span>更多城市</span>{CITIES.slice(3).map(c=><button type="button" onClick={()=>chooseCity(c.name)} className={city===c.name?'active':''} key={c.name}>{c.name} <ArrowRight size={13}/></button>)}</div>
   </section>

   <TalentHousingSection city={city} query={submittedQuery} onShowPolicies={()=>scrollToSection('ts-policies')}/>

   <TalentPolicySearch city={city} query={submittedQuery} onCityClick={chooseCity}/>

   <section className="ts-section" id="ts-guide">
    <div className="ts-section-heading"><div><span className="ts-section-kicker">HOW IT WORKS / 申请指南</span><h2>清楚每一步，少走一点弯路</h2><p>不同城市和政策的申报规则不同，以下为办理流程框架。</p></div></div>
    <div className="ts-step-grid">{HOWTO.map(s=><div className="ts-step" key={s.number}><span>{s.number}</span><h3>{s.title}</h3><p>{s.description}</p></div>)}</div>
    <div className="ts-official"><div><ShieldCheck size={22}/><span><strong>政策以官方发布和审批为准</strong><small>仅通过政府官方渠道核验最新补贴标准、申请期限、项目房源和办理入口。</small></span></div><a href="https://www.gov.cn/" target="_blank" rel="noreferrer noopener">中国政府网 <ExternalLink size={15}/></a></div>
   </section>

   <section className="ts-match" id="ts-matching">
    <div className="ts-match-intro"><span className="ts-section-kicker">FIND YOUR OPPORTUNITY</span><h2>看看你可能需要了解<br/>哪些人才支持政策？</h2><p>只需选择几项基本条件，帮你整理适合优先查询的政策类型。无需上传简历或个人证件。</p><span className="ts-match-privacy"><ShieldCheck size={15}/> 本次筛选仅在浏览器运行，不提交个人数据</span></div>
    <div className="ts-match-form"><div className="ts-match-form-title"><GraduationCap size={20}/> 政策匹配 · 初步体验 <span>DEMO</span></div><label>意向城市<select value={city} onChange={e=>chooseCity(e.target.value)}>{CITIES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label><label>最高学历<select value={education} onChange={e=>{setEducation(e.target.value);setMatchVisible(false)}}>{['专科','本科','硕士','博士','其他'].map(s=><option key={s}>{s}</option>)}</select></label><label>毕业情况<select value={grad} onChange={e=>{setGrad(e.target.value);setMatchVisible(false)}}>{['应届毕业生','毕业1—3年','毕业3年以上','在校学生'].map(s=><option key={s}>{s}</option>)}</select></label><button type="button" className="ts-match-submit" onClick={()=>setMatchVisible(true)}>查看可能相关的政策类型 <ArrowRight size={16}/></button>
    {matchVisible&&<div role="status" className="ts-match-result"><CheckCircle2 size={17}/><div><strong>{city} · {education} · {grad}</strong><p>以下仅为与所填条件关键词相关的官方政策记录，尚未核验社保、户籍、房产和毕业时间等必要资格，不能视为符合申领条件。</p><div className="ts-match-source-links">{TALENT_POLICY_RECORDS.filter(p=>p.city===city&&(p.eligibility+p.benefit+p.keywords.join('')).includes(education)).slice(0,3).map(p=><a key={p.id} href={p.sourceUrl} target="_blank" rel="noreferrer noopener">{p.title} <ExternalLink size={12}/></a>)}{!TALENT_POLICY_RECORDS.some(p=>p.city===city&&(p.eligibility+p.benefit+p.keywords.join('')).includes(education))&&<small>暂无与所填学历相关的已收录政策，请查看该城市全部政策。</small>}</div><button type="button" onClick={()=>scrollToSection('ts-policies')}>查看政策详情 <ArrowRight size={14}/></button></div></div>}</div>
   </section>
   <footer className="ts-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度。</span><Link to="/candidate/jobs">返回招聘市场 <ArrowRight size={14}/></Link></footer>
   <p className="ts-photo-credit">城市图片来源：{CITIES.map((c,i)=><span key={c.name}>{i>0?' · ':''}<a href={c.photoPage} target="_blank" rel="noreferrer noopener">{c.name} / {c.credit}</a></span>)}。人才公寓只展示来源已核对的具体项目，未取得可用照片的项目不展示替代图片。</p>
  </div>

 </Shell>;
}
