import {ArrowUpRight,MapPin,ShieldAlert,FileSearch} from 'lucide-react';
import {TALENT_HOUSING_RESEARCH_LEADS,type TalentHousingResearchLead} from '../../data/talentHousingResearch.ts';
import {LIAOCHENG_POLICY_RECORDS} from '../../data/liaochengPolicyRecords.ts';

/** Shared nationwide research panel. Leads are NOT certified housing records. */
export function housingResearchLeads(city:string,query=''):TalentHousingResearchLead[]{
 const words=query.replace(city,'').trim().replace(/住房|人才公寓|人才安居|公寓|人才|日照/g,'').trim();
 return TALENT_HOUSING_RESEARCH_LEADS.filter(p=>p.city===city&&(!words||(p.title+p.district+p.address+p.eligibility).includes(words)));
}
/** Secondary-source historical housing policies are research only, never formal A/B records. */
export function housingPolicyResearch(city:string,query=''){
 const q=query.replace(city,'').trim().replace(/人才安居|人才|住房|公寓/g,'').trim();
 return LIAOCHENG_POLICY_RECORDS.filter(x=>x.city===city&&(!q||(x.title+x.summary+x.benefit+x.eligibility).includes(q)));
}
export function UnifiedTalentHousingResearch({city,query}:{city:string;query?:string}){
 const leads=housingResearchLeads(city,query);
 const history=housingPolicyResearch(city,query);
 if(!leads.length&&!history.length)return null;
 return <>
 {leads.length>0&&<section className="ts-sub-section" aria-label="待核验人才公寓线索">
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
 </section>}
 {history.length>0&&<section className="ts-sub-section" aria-label="聊城历史人才安居政策参考">
  <div className="ts-sub-section-heading"><h2>历史住房支持政策 · 不能直接申领</h2><span>{history.length}条 · C级历史参考</span></div>
  <p className="ts-housing-inventory-note"><ShieldAlert size={15}/> 下列为历史人才住房、购房奖励资料，来源为政策转载，不等于当前仍可申领。任何实际办理需核对聊城人社与住建部门现行正式公告。</p>
  <div className="ts-sub-grid">{history.map(data=><article key={data.id} className="ts-sub-tile">
   <div className="ts-sub-tile-top"><span>{data.category}</span><small>历史政策 · C级</small></div>
   <h3>{data.title}</h3>
   <p>{data.benefit}</p><p className="ts-housing-inventory-note">{data.eligibility}</p>
   <p className="ts-housing-inventory-note">{data.reviewNote}</p>
   <details><summary><FileSearch size={15}/> 查看历史办理流程和材料核对</summary>
    <ol>{data.applicationSteps?.map((step,i)=><li key={i}>{step}</li>)}</ol>
    <p>材料参考：{data.materials?.join('；')}</p>
   </details>
   <footer><small>{data.sourceName} · 发布 {data.published} · 复核 {data.reviewedAt}</small>
    <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">查看历史政策转载 <ArrowUpRight size={15}/></a></footer>
  </article>)}</div>
 </section>}
 </>;
}
