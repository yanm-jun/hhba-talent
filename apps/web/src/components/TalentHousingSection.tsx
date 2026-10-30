import {useState} from 'react';
import {ArrowRight,ArrowUpRight,Building2,ExternalLink,MapPin,ShieldCheck,X} from 'lucide-react';
import {TALENT_HOUSING_RECORDS,HOUSING_REVIEW_DATE,type TalentHousingRecord} from '../data/talentHousingRecords';
import '../styles/talent-housing.css';
function getHousingStatus(r:TalentHousingRecord){
 const today=new Date().toISOString().slice(0,10);
 if(r.applicationEnd&&today>r.applicationEnd)return {label:'公告批次已截止',cls:'ended'};
 if(r.applicationEnd&&today<=r.applicationEnd)return {label:'公告申报期内 · 以官方为准',cls:'dated'};
 return {label:r.kind==='program'?'政策入口 · 房源待核验':'项目已核实 · 空房待核验',cls:'unknown'};
}
function matchHousing(record:TalentHousingRecord,query:string,city:string){
 if(record.city!==city)return false;
 const q=query.replace(city,'').replace(/人才|政策|补贴|公寓|住房|租房|安居|保障|什么|申请|在哪|哪里|查询|的|区|市|青年|高校|大学生/g,'').replace(/\s/g,'');
 if(!q)return true;
 return [record.title,record.district,record.address,record.units,record.eligibility,record.rent].join(' ').includes(q);
}
export function TalentHousingSection({city,query,onShowPolicies}:{city:string;query:string;onShowPolicies:()=>void}){
 const [selected,setSelected]=useState<TalentHousingRecord|null>(null);
 const [district,setDistrict]=useState('全部区域');
 const collection=TALENT_HOUSING_RECORDS.filter(r=>r.city===city);
 const matches=collection.filter(r=>matchHousing(r,query,city));
 const districts=['全部区域',...new Set(matches.map(r=>r.district))];
 const actualDistrict=districts.includes(district)?district:'全部区域';
 const shown=matches.filter(r=>actualDistrict==='全部区域'||r.district===actualDistrict);
 return <section className="ts-section real-housing" id="ts-housing" aria-labelledby="real-housing-heading">
  <div className="ts-section-heading"><div><span className="ts-section-kicker">HOUSING / 真实人才安居</span>
   <h2 id="real-housing-heading">{city} · 人才住房项目</h2>
   <p>真实官方项目、地址、房型、费用及办理步骤。项目总房源不代表目前仍有空房。</p></div>
   <span className="ts-sample-label">{collection.length}项已整理 · {HOUSING_REVIEW_DATE} 核验</span>
  </div>
  <div className="real-housing-summary"><Building2 size={18}/><b>政府来源项目索引</b><span>{shown.length} 条匹配</span><small>尚未取得项目照片的合法授权，不使用普通住宅示意图</small></div>
  {matches.length>0&&<div className="real-housing-filters">{districts.map(d=><button type="button" key={d} onClick={()=>setDistrict(d)} className={actualDistrict===d?'active':''} aria-pressed={actualDistrict===d}>{d}</button>)}</div>}
  {shown.length>0?<div className="real-housing-grid">{shown.map(r=>{const s=getHousingStatus(r);return <article className="real-housing-card" key={r.id}>
   <div className="real-housing-head"><span className="real-housing-icon"><Building2 size={21}/></span><div><small>{r.city} · {r.district}</small><h3>{r.title}</h3></div></div>
   <span className={'real-housing-status '+s.cls}>{s.label}</span>
   <p className="real-housing-address"><MapPin size={14}/> {r.address}</p>
   <div className="real-housing-facts"><div><small>批次房源 / 项目情况</small><strong>{r.units}</strong></div><div><small>租金及收费参考</small><strong>{r.rent}</strong></div></div>
   <p className="real-housing-note">{r.statusNote}</p>
   <p className="real-housing-source"><ShieldCheck size={13}/> 官方发布 {r.published} · HHBA 核验 {r.reviewedAt}</p>
   <div className="real-housing-actions"><button type="button" onClick={()=>setSelected(r)}>项目详情与申请步骤 <ArrowRight size={15}/></button><a href={r.sourceUrl} target="_blank" rel="noreferrer noopener">政府原文 <ExternalLink size={14}/></a></div>
  </article>})}</div>:<div className="real-housing-empty"><Building2 size={25}/><b>{city}暂无匹配的已核验公寓项目</b><p>不会拿其他城市公寓或者普通住宅照片填充。可先查看该城市已核实的人才政策。</p><button type="button" onClick={onShowPolicies}>查看人才政策 <ArrowRight size={14}/></button></div>}
  <p className="real-housing-disclaimer"><ShieldCheck size={14}/> 历史公告中的“套数”并非当前剩余房源；新一轮申报状态及资格以住建、人社和项目运营方最新公告为准。</p>
  {selected&&<div className="real-housing-backdrop" role="presentation" onMouseDown={()=>setSelected(null)}><section role="dialog" aria-modal="true" aria-label={selected.title} className="real-housing-modal" onMouseDown={e=>e.stopPropagation()}>
   <button className="real-housing-close" type="button" aria-label="关闭" onClick={()=>setSelected(null)}><X size={18}/></button>
   <span className="ts-section-kicker">{selected.city} · {selected.district}</span><h2>{selected.title}</h2>
   <span className={'real-housing-status '+getHousingStatus(selected).cls}>{getHousingStatus(selected).label}</span>
   <dl><dt>项目地址 / 申请范围</dt><dd>{selected.address}</dd><dt>房源情况</dt><dd>{selected.units}</dd><dt>租金参考</dt><dd>{selected.rent}</dd><dt>申请条件</dt><dd>{selected.eligibility}</dd><dt>申报状态</dt><dd>{selected.statusNote}</dd></dl>
   <h3>官方申请步骤</h3><ol>{selected.steps.map(step=><li key={step}>{step}</li>)}</ol>
   <div className="real-housing-links"><a href={selected.sourceUrl} target="_blank" rel="noreferrer noopener">政府来源 <ExternalLink size={14}/></a>{selected.applyUrl&&<a href={selected.applyUrl} target="_blank" rel="noreferrer noopener">官方申报入口或办事指引 <ArrowUpRight size={14}/></a>}</div>
   <small>发布于 {selected.published} · 核验于 {selected.reviewedAt}；不保证当前有房，不构成批准资格承诺。</small>
  </section></div>}
 </section>;
}