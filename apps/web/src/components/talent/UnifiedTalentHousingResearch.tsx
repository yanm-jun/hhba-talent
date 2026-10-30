import {ArrowUpRight,MapPin,ShieldAlert,FileSearch} from 'lucide-react';
import {TALENT_HOUSING_RESEARCH_LEADS,type TalentHousingResearchLead} from '../../data/talentHousingResearch.ts';

/** Shared nationwide research panel. Leads are NOT certified housing records. */
export function housingResearchLeads(city:string,query=''):TalentHousingResearchLead[]{
 const words=query.replace(city,'').trim().replace(/住房|人才公寓|人才安居|公寓|人才|日照/g,'').trim();
 return TALENT_HOUSING_RESEARCH_LEADS.filter(p=>p.city===city&&(!words||(p.title+p.district+p.address+p.eligibility).includes(words)));
}
export function UnifiedTalentHousingResearch({city,query}:{city:string;query?:string}){
 const leads=housingResearchLeads(city,query);
 if(!leads.length)return null;
 return <section className="ts-sub-section" aria-label="待核验人才公寓线索">
  <div className="ts-sub-section-heading"><h2>人才公寓 · 待核验项目线索</h2><span>{leads.length}处 · 不计入官方已核实房源</span></div>
  <p className="ts-housing-inventory-note"><ShieldAlert size={15}/> 以下为已找到公开报道、但暂缺可直接核验的主管部门项目原文的线索。仅用于帮助查找办理部门；不代表当前可申请、可入住、项目尚在运营或有实时房源。</p>
  <div className="ts-sub-grid">{leads.map(data=><article key={data.id} className="ts-sub-tile">
   <div className="ts-sub-tile-top"><span>{data.category} · {data.district}</span><small>资料待官方核验 · 非A/B级</small></div>
   <h3>{data.title}</h3>
   <p className="ts-housing-location"><MapPin size={14}/>{data.address}</p>
   <div className="ts-housing-short-facts"><small>历史公开规模与户型</small><p>{data.units}</p><small>租金／待遇参考</small><strong>{data.rent}</strong></div>
   <p className="ts-housing-inventory-note">{data.eligibility}</p>
   <p className="ts-housing-inventory-note">{data.statusNote}</p>
   <details><summary><FileSearch size={15}/> 查看核验与办理步骤</summary>
    <ol>{data.steps.map((x,i)=><li key={i}>{x}</li>)}</ol></details>
   <footer><small>{data.sourceName} · {data.published} · 复核 {data.reviewedAt}</small>
    <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">查看转载／公开报道 <ArrowUpRight size={15}/></a></footer>
  </article>)}</div>
 </section>;
}
