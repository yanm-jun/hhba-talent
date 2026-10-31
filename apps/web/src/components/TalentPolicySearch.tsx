import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,ExternalLink,FileSearch,FilterX,MapPin,ShieldCheck,X} from 'lucide-react';
import {TALENT_POLICY_RECORDS,TALENT_POLICY_REVIEW_DATE,type TalentPolicyRecord} from '../data/talentPolicyRecords';
import {XINGTAI_POLICY_RESEARCH_RECORDS} from '../data/xingtaiPolicyResearch';
import {talentSourceKind} from '../data/talentQuality';
import '../styles/talent-policy-search.css';
const V51_SEARCH_RECORDS=[...TALENT_POLICY_RECORDS,...XINGTAI_POLICY_RESEARCH_RECORDS];

const knownCities=['杭州','深圳','青岛','上海','北京','济南','苏州','南京','广州','成都','重庆','武汉','西安','天津','宁波','厦门','福州','长沙','郑州','合肥','无锡','东莞','佛山','珠海','烟台','临沂','聊城','菏泽','大连','沈阳','哈尔滨','长春','南昌','南宁','贵阳','昆明','邢台','石家庄','太原','兰州','乌鲁木齐','呼和浩特','海口','银川','西宁','拉萨','温州','嘉兴','绍兴','金华','惠州'];
const concepts:{words:string[];match:(item:TalentPolicyRecord)=>boolean}[]=[
 {words:['博士'],match:x=>x.keywords.includes('博士')||x.eligibility.includes('博士')},
 {words:['硕士','研究生'],match:x=>/硕士|研究生/.test(x.eligibility+' '+x.benefit+' '+x.keywords.join(' '))},
 {words:['本科','学士'],match:x=>/本科|学士/.test(x.eligibility+' '+x.benefit+' '+x.keywords.join(' '))},
 {words:['专科','大专'],match:x=>/专科|大专/.test(x.eligibility+' '+x.benefit+' '+x.keywords.join(' '))},
 {words:['租房','住房','公寓','安居','保租房','保障房','住宿'],match:x=>x.category==='租房安居'||/住房|租房|住宿|安居|公寓/.test(x.title)},
 {words:['购房','买房','安家费'],match:x=>x.category==='购房补贴'||/购房|安家费/.test(x.title+' '+x.benefit)},
 {words:['落户','户口','户籍','引进'],match:x=>x.category==='落户引进'||/落户|入户/.test(x.title+' '+x.summary)},
 {words:['交通','地铁','公交'],match:x=>x.category==='交通福利'},
 {words:['创业','就业扶持'],match:x=>x.category==='就业创业'||x.summary.includes('创业')},
 {words:['生活补贴'],match:x=>x.category==='生活补贴'},
 {words:['补贴'],match:x=>x.title.includes('补贴')||x.category==='生活补贴'||x.category==='购房补贴'||x.benefit.includes('补贴')},
 {words:['应届','毕业生'],match:x=>/应届|毕业/.test(x.title+' '+x.eligibility+' '+x.keywords.join(' '))}
];
export function parsePolicyQuery(query:string,selectedCity:string){
 const trimmed=query.trim().replace(/\s+/g,'');
 const city=[...knownCities].sort((a,b)=>b.length-a.length).find(c=>trimmed.includes(c));
 const resolved=city||selectedCity;
 let rest=city?trimmed.replace(city,''):trimmed;
 rest=rest.replace(/^(河北省|浙江省|广东省|山东省|上海市|北京市|江苏省|四川省|湖北省|福建省|陕西省)/,'').replace(/^市/,'');
 const wants=concepts.filter(p=>p.words.some(w=>rest.includes(w)));
 let cleaned=rest;
 for(const p of wants)for(const word of [...p.words].sort((a,b)=>b.length-a.length))cleaned=cleaned.replaceAll(word,'');
 cleaned=cleaned.replace(/人才|政策|福利|补贴|待遇|有什么|哪些|怎么|申请|查询|的|市|区|大学生|青年|高校/g,'');
 const terms=cleaned.match(/[\u4e00-\u9fa5a-zA-Z0-9]{2,}/g)||[];
 return {city:resolved,wants,terms,query:trimmed};
}
function rankMatches(x:TalentPolicyRecord,query:ReturnType<typeof parsePolicyQuery>){
 const haystack=[x.title,x.summary,x.benefit,x.eligibility,x.application,x.category,...x.keywords].join(' ').toLowerCase();
 if(x.city!==query.city)return -1;
 if(query.wants.length&&!query.wants.every(w=>w.match(x)))return -1;
 if(query.terms.length&&!query.terms.every(t=>haystack.includes(t.toLowerCase())))return -1;
 const ordered=query.query.replace(query.city,'');
 let score=1;
 for(const p of query.wants)if(p.match(x))score+=10;
 if(ordered&&x.title.includes(ordered))score+=10;
 if(x.temporal==='policy')score+=2;
 return score;
}
const statusText:Record<TalentPolicyRecord['temporal'],string>={
 policy:'政策参考 · 申报以官方为准',
 'past-window':'2026 批次 · 申报窗口需核对',
 historical:'历史政策文本 · 现行规则待核'
};
export function TalentPolicySearch({city,query,onCityClick}:{city:string;query:string;onCityClick:(city:string)=>void}){
 const [opened,setOpened]=useState<TalentPolicyRecord|null>(null);
 const [category,setCategory]=useState('全部类型');
 useEffect(()=>setCategory('全部类型'),[city,query]);
 const search=useMemo(()=>parsePolicyQuery(query,city),[query,city]);
 const cityRecords=V51_SEARCH_RECORDS.filter(x=>x.city===search.city);
 const matched=useMemo(()=>V51_SEARCH_RECORDS.map(x=>({item:x,score:rankMatches(x,search)}))
   .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.item),[search]);
 const categories=['全部类型',...new Set(matched.map(x=>x.category))];
 const visible=category==='全部类型'?matched:matched.filter(x=>x.category===category);
 const reset=()=>{setCategory('全部类型');onCityClick(city)};
 return <section className="tps-section" id="ts-policies" aria-labelledby="tps-heading">
  <div className="ts-section-heading"><div>
   <span className="ts-section-kicker">SOURCE TIERS / 政府原文与公开资料分级</span>
   <h2 id="tps-heading">{search.city} · 真实人才政策查询</h2>
   <p>政府原始政策与媒体公开资料分层收录，可按城市、学历、补贴和住房关键词检索；转载不等于政府原文。</p>
  </div><span className="ts-sample-label">静态政策索引 · 非实时申报系统</span></div>
  <div className="tps-summary"><div><FileSearch size={20}/><span><b>{query?'搜索结果':'已收录政策'}</b><small>{search.city} · {visible.length} 条匹配政策 / {cityRecords.length} 条已收录 · 核验整理 {TALENT_POLICY_REVIEW_DATE}</small></span></div>
   {query&&<button type="button" onClick={reset}><FilterX size={15}/> 清除搜索</button>}
  </div>
  {cityRecords.length>0&&<div className="tps-filters" aria-label="政策类别筛选">{categories.map(t=><button type="button" key={t} onClick={()=>setCategory(t)} className={category===t?'active':''} aria-pressed={category===t}>{t}</button>)}</div>}
  {!cityRecords.length?<div className="tps-empty"><MapPin size={27}/><strong>{search.city}尚未收录已核验政策</strong><p>目前首批已核验杭州、深圳、青岛、上海、北京、济南。不会拿其他城市的政策冒充查询结果，后续逐步扩充。</p></div>:
   !visible.length?<div className="tps-empty"><FileSearch size={27}/><strong>没有找到符合此搜索条件的政策</strong><p>你可以尝试简化关键词，例如“{search.city}住房”“{search.city}硕士”或“{search.city}落户”。</p></div>:
   <div className="tps-results">{visible.map(x=><article key={x.id} className="tps-item">
     <div className="tps-item-top"><span className="tps-category">{x.category}</span><span className={'tps-status '+(x.temporal==='policy'?'':'tps-warning')}>{talentSourceKind(x.sourceUrl)==='secondary'?'公开资料转载 · 政府原文待核验':statusText[x.temporal]}</span></div>
     <h3>{x.title}{x.district&&<small> · {x.district}</small>}</h3><p className="tps-summary-text">{x.summary}</p>
     <div className="tps-benefit"><span>政策待遇 / 保障</span><strong>{x.benefit}</strong></div>
     <div className="tps-source-line"><ShieldCheck size={14}/> {talentSourceKind(x.sourceUrl)==='secondary'?'转载来源待政府核验':x.department} · {x.published} 发布/文件日期</div>
     <div className="tps-actions"><button type="button" onClick={()=>setOpened(x)}>资格与办理流程 <ArrowRight size={16}/></button><a href={x.sourceUrl} target="_blank" rel="noopener noreferrer">{talentSourceKind(x.sourceUrl)==='government'?'政府原文':'查看公开资料转载'} <ExternalLink size={14}/></a></div>
   </article>)}</div>}
  <p className="tps-disclaimer"><ShieldCheck size={15}/> 搜索只在已收录政府文件及明确标注的待核验公开资料中进行，不是实时全网检索；政策可能调整，金额、资格、申报期限及开放房源均以主管部门最新发布和审核为准。</p>
  {opened&&<div className="tps-dialog-backdrop" role="presentation" onMouseDown={()=>setOpened(null)}><section className="tps-dialog" role="dialog" aria-modal="true" aria-label={opened.title} onMouseDown={e=>e.stopPropagation()}>
   <button type="button" aria-label="关闭政策详情" className="tps-close" onClick={()=>setOpened(null)}><X size={20}/></button>
   <span className="ts-section-kicker">{opened.city} · {opened.category} · {talentSourceKind(opened.sourceUrl)==='government'?'政府来源':'媒体转载 · 原文待核验'}</span><h2>{opened.title}</h2><span className="tps-dialog-status">{statusText[opened.temporal]}</span>
   <h3>政策待遇</h3><p>{opened.benefit}</p><h3>适用条件</h3><p>{opened.eligibility}</p><h3>如何办理</h3><p>{opened.application}</p><h3>来源与核验</h3><p>{opened.department} · 发布/文件日期 {opened.published} · HHBA 整理日期 {TALENT_POLICY_REVIEW_DATE}</p>
   <div className="tps-dialog-warning">政策可能涉及社保、户籍、学历认证、人才认定、申请时效等限制。HHBA 不判断个人最终资格，不保证批次仍开放或有空余房源。</div>
   <div className="tps-dialog-links"><a href={opened.sourceUrl} target="_blank" rel="noopener noreferrer">{talentSourceKind(opened.sourceUrl)==='government'?'官方政策原文':'公开资料来源（非官方原文）'} <ExternalLink size={15}/></a>{opened.applicationUrl&&<a href={opened.applicationUrl} target="_blank" rel="noopener noreferrer">官方办理说明/入口 <ArrowUpRight size={15}/></a>}</div>
  </section></div>}
 </section>;
}