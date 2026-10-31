import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Clock3,FileText,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Link} from '../../router';
import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from '../../data/talentPolicyRecords';
import {assessPolicy} from '../../data/talentQuality';
import {XINGTAI_POLICY_RESEARCH_RECORDS} from '../../data/xingtaiPolicyResearch';
const V51_POLICY_DISPLAY_RECORDS=[...TALENT_POLICY_RECORDS,...XINGTAI_POLICY_RESEARCH_RECORDS];
import '../../pages/talentJinanPolicyPreview.css';

export type PolicyTile={id:string;category:string;amount:string;unit:string;description:string;condition:string;status?:string;detailPath?:string};
export type CityPolicyConfig={city:string;tiles:PolicyTile[];subtitle?:string;notes?:string;legacyLink?:string};
const historical=(record:TalentPolicyRecord)=>assessPolicy(record).grade==='C';
function Tile({item,record}:{item:PolicyTile;record:TalentPolicyRecord}){
 const quality=assessPolicy(record);const archive=quality.grade==='C';
 const route=item.detailPath||'/talent-service/policy/'+encodeURIComponent(item.id);
 return <article className={'jpp-card'+(archive?' jpp-card-archive':'')}>
  <div className="jpp-card-meta"><span className="jpp-type">{item.category}</span>
   <span className={'jpp-state'+(archive?' jpp-state-old':'')}><Clock3 size={12}/>{archive?'历史资料 · 当前资格待核查':item.status||quality.label}</span>
  </div>
  <h3>{record.title}</h3>
  <div className="jpp-benefit"><span className="jpp-benefit-label">主要待遇／住房规模</span><div className="jpp-amount"><strong>{item.amount}</strong><span>{item.unit}</span></div><p>{item.description}</p></div>
  <div className="jpp-condition"><span>核心条件</span><p>{item.condition}</p></div>
  <div className="jpp-card-bottom"><div className="jpp-source"><span>{record.published.slice(0,4)}年资料</span><span>·</span><span>来源可查</span></div>
   <div className="jpp-links"><a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={'打开'+record.title+'原文'}>{quality.sourceKind==='government'?'政府政策原文':'公开资料来源'} <ArrowUpRight size={13}/></a>
    <Link to={route}>{item.detailPath?(quality.grade==='A'?'完整办事指南':'查看分步办理指南'):'查看政策资料'} <ArrowRight size={14}/></Link></div>
  </div>
 </article>;
}
/** Fallback coverage for all existing cities; avoids inventing benefit amounts or eligibility. */
export function buildCityPolicyConfig(city:string):CityPolicyConfig{
 const rows=V51_POLICY_DISPLAY_RECORDS.filter(p=>p.city===city);
 const clip=(value:string,max:number)=>value.length<=max?value:value.slice(0,max-1).replace(/[，,、;\s]+$/,'')+'…';
 return {
  city,subtitle:'全国统一V5.1标准。按已收录政策核对来源、待遇、资格和办理流程；基础资料不代表当前可申领。',
  notes:'正式政府原文和媒体转载分别标识；非政府一手资料仅作为待核验参考，不可当做官方现行申报依据。',
  tiles:rows.map(p=>({
   id:p.id,category:p.category==='购房补贴'?'购房安家':p.category,
   amount:p.headlineAmount||(p.city==='烟台'&&p.id==='sd-yantai-2026-youth-living'?'¥6,000—36,000':p.city==='烟台'&&p.id==='sd-yantai-2026-purchase'?'最高¥260,000':'按政策类别核定'),unit:p.headlineUnit||(p.city==='烟台'&&p.id==='sd-yantai-2026-youth-living'?'每年 · 分类核定':p.city==='烟台'&&p.id==='sd-yantai-2026-purchase'?'一次性 · 房款30%封顶':'以官方条件为准'),
   description:clip(p.benefit,112),condition:clip(p.eligibility,92),
   status:XINGTAI_POLICY_RESEARCH_RECORDS.some(r=>r.id===p.id)?'公开资料转载 · 政府原始文件待核验':p.id==='ly-apartment-26'?'2026年租赁公寓批次已截止':'基础资料 · 申领状态待核验',detailPath:p.id==='tj-v51-haihe-2026'?'/talent-service/policy-guide-preview/tianjin/haihe':p.id==='tj-v51-2025-policy-housing'?'/talent-service/policy-guide-preview/tianjin/apartment':p.id==='tj-v51-protected-rental'?'/talent-service/policy-guide-preview/tianjin/rental':p.id==='tj-v51-public-rental-2025'?'/talent-service/policy-guide-preview/tianjin/public':p.id==='tj-v51-entrepreneur-loan'?'/talent-service/policy-guide-preview/tianjin/startup':p.id==='tj-2027-jobseek-grant'?'/talent-service/policy-guide-preview/tianjin/grant':p.id==='sh-2025-talent-introduction'?'/talent-service/policy-guide-preview/shanghai/talent-introduction':p.id==='sh-2025-residence-to-hukou'?'/talent-service/policy-guide-preview/shanghai/residence-hukou':p.id==='sh-2026-rental-city-system'?'/talent-service/policy-guide-preview/shanghai/protected-rental':p.id==='sh-2026-jingan-youth-subsidy'?'/talent-service/policy-guide-preview/shanghai/jingan-youth':p.id==='sh-2026-yangpu-youth-subsidy'?'/talent-service/policy-guide-preview/shanghai/yangpu-youth':p.id==='sh-2026-baoshan-youth-subsidy'?'/talent-service/policy-guide-preview/shanghai/baoshan-youth':p.id==='sh-2026-hukou'?'/talent-service/policy-guide-preview/shanghai/graduate-hukou':p.id==='sh-xuhui-rent'?'/talent-service/policy-guide-preview/shanghai/xuhui-youth':p.id==='sh-pudong-housing'?'/talent-service/policy-guide-preview/shanghai/protected-rental':p.id==='sh-2026-first-startup'?'/talent-service/policy-guide-preview/shanghai/first-startup':p.id==='sh-2026-jobseek-grant'?'/talent-service/policy-guide-preview/shanghai/job-seeker':p.id==='sh-2026-flex-insurance'?'/talent-service/policy-guide-preview/shanghai/flex-social':p.id==='bj-2025-public-rental-qualification'?'/talent-service/policy-guide-preview/beijing/public-rental':p.id==='bj-2025-market-rent-subsidy'?'/talent-service/policy-guide-preview/beijing/market-rent':p.id==='bj-2021-graduate-introduction-settlement'?'/talent-service/policy-guide-preview/beijing/graduate-settlement':p.id==='bj-2026-haidian-youth-housing'?'/talent-service/policy-guide-preview/beijing/haidian':p.id==='bj-2026-may-graduate-housing'?'/talent-service/policy-guide-preview/beijing/youth-housing':p.id==='bj-jobseeker-grant'?'/talent-service/policy-guide-preview/beijing/job-grant':p.id==='bj-flex-insurance'?'/talent-service/policy-guide-preview/beijing/flex-social':p.id==='bj-youth-rental-2026'?'/talent-service/policy-guide-preview/beijing/youth-housing':p.id==='bj-chaoyang-2026'?'/talent-service/policy-guide-preview/beijing/youth-housing':p.id==='hs-2024-graduate-settlement'?'/talent-service/policy-guide-preview/hengshui/graduate':p.id==='hs-2024-card-rent'||p.id==='hs-2024-card-home'?'/talent-service/policy-guide-preview/hengshui/rent-buy':p.id==='hs-2024-apartment-support'?'/talent-service/policy-guide-preview/hengshui/apartment':p.id==='hs-2024-skill-awards'?'/talent-service/policy-guide-preview/hengshui/skill':p.id==='zjk-2026-shuobo-doctor'||p.id==='zjk-2026-shuobo-hospital'?'/talent-service/policy-guide-preview/zhangjiakou/shuobo':p.id==='zjk-2024-highpark-apartment'||p.id==='zjk-2024-highpark-office'?'/talent-service/policy-guide-preview/zhangjiakou/park':p.id==='xt-2026-talent-purchase'?'/talent-service/policy-guide-preview/xingtai/purchase':p.id==='xt-2026-talent-rental'?'/talent-service/policy-guide-preview/xingtai/rental':p.id==='ts-youth-2024-base'||p.id==='ts-undergraduate-2024-archive'?'/talent-service/policy-guide-preview/tangshan/youth':p.id==='ts-home-2024-base'?'/talent-service/policy-guide-preview/tangshan/purchase':p.id==='ts-hightech-rent-2023'?'/talent-service/policy-guide-preview/tangshan/housing':p.id==='sjz-2026-bcard-rent'?'/talent-service/policy-guide-preview/shijiazhuang/rent':p.id==='sjz-2026-bcard-home'?'/talent-service/policy-guide-preview/shijiazhuang/home':p.id==='sjz-2026-graduate-settle'?'/talent-service/policy-guide-preview/shijiazhuang/settlement':p.id==='sjz-2026-bcard-eligibility'?'/talent-service/policy-guide-preview/shijiazhuang/rent':p.id==='sd-heze-2026-startup'?'/talent-service/policy-guide-preview/heze/startup':p.id==='bz-2026-home-closed'?'/talent-service/policy-guide-preview/binzhou/purchase':p.id==='bz-2026-living-archived'?'/talent-service/policy-guide-preview/binzhou/living':p.id==='sd-jining-2026-introduction'?'/talent-service/policy-guide-preview/jining/youth':p.id==='jn-maincity-rent-2026'?'/talent-service/policy-guide-preview/jining/rent':p.id==='ta-2026-living-guide'?'/talent-service/policy-guide-preview/taian/living':p.id==='ta-2026-first-home-guide'?'/talent-service/policy-guide-preview/taian/purchase':p.id==='ta-2026-rent-relief'?'/talent-service/policy-guide-preview/taian/housing':p.id==='sd-dongying-talent-2026'?'/talent-service/policy-guide-preview/dongying/transition':p.id==='zb-2026-living-reviewed'?'/talent-service/policy-guide-preview/zibo/living':p.id==='zb-2026-purchase-reviewed'?'/talent-service/policy-guide-preview/zibo/purchase':p.id==='ly-youth-allowance-2026'?'/talent-service/policy-guide-preview/linyi/living':p.id==='sd-yantai-2026-youth-living'?'/talent-service/policy-guide-preview/yantai/living':p.id==='sd-yantai-2026-purchase'?'/talent-service/policy-guide-preview/yantai/home':undefined
  }))
 };
}

export function UnifiedPolicyList({config}:{config:CityPolicyConfig}){
 const [category,setCategory]=useState('all');
 const entries=useMemo(()=>config.tiles.map(tile=>({tile,record:V51_POLICY_DISPLAY_RECORDS.find(p=>p.id===tile.id)})).filter((x):x is {tile:PolicyTile;record:TalentPolicyRecord}=>Boolean(x.record&&x.record.city===config.city)),[config]);
 const archives=entries.filter(x=>historical(x.record));
 const groups=['all',...new Set(entries.map(x=>x.tile.category)),'history'];
 const filtered=entries.filter(x=>category==='all'||(category==='history'?historical(x.record):x.tile.category===category));
 const fresh=filtered.filter(x=>!historical(x.record));
 const old=filtered.filter(x=>historical(x.record));
 return <main className="jpp-page">
   <nav className="jpp-breadcrumb" aria-label="当前位置"><Link to="/talent-service">人才服务</Link><span>›</span><Link to={'/talent-service/city/'+encodeURIComponent(config.city)}>{config.city}市</Link><span>›</span>政策列表</nav>
   <header className="jpp-heading"><div><span className="jpp-eyebrow">HHBA · 全国统一政策展示标准</span><h1>{config.city}市人才政策</h1><p>{config.subtitle||'政策卡片看重点，完整条件与办理指南进入详情查看。'}</p></div>
    <Link className="jpp-old-link" to={config.legacyLink||'/talent-service/list/policies/'+encodeURIComponent(config.city)}><ArrowLeft size={14}/> 对照原始资料</Link></header>
   <div className="jpp-overview" role="group" aria-label="政策资料覆盖"><div><strong>{entries.length}</strong><span>独立政策事项</span></div><div><strong>{fresh.length}</strong><span>资料待核对申领状态</span></div><div><strong>{archives.length}</strong><span>历史资料</span></div><p><ShieldCheck size={16}/> 收录不代表申请资格已通过，也不表示当前正在受理。</p></div>
   <section className="jpp-filter-panel" aria-label="按政策类别筛选"><div className="jpp-filter-title"><SlidersHorizontal size={16}/><strong>政策分类</strong><span>按类别快速切换</span></div>
    <div className="jpp-filter-buttons">{groups.map(id=><button type="button" key={id} aria-pressed={category===id} className={category===id?'selected':''} onClick={()=>setCategory(id)}>
     {id==='all'?'全部政策':id==='history'?'历史政策':id}{id==='history'&&<span className="jpp-filter-count">{archives.length}</span>}</button>)}</div></section>
   {!!fresh.length&&<section className="jpp-group"><div className="jpp-group-header"><div><h2>政策参考</h2><p>按政策内容展示，并非经办平台实时受理列表</p></div><span>{fresh.length}条</span></div>
    <div className="jpp-grid">{fresh.map(x=><Tile key={x.tile.id} item={x.tile} record={x.record}/>)}</div></section>}
   {!!old.length&&<section className="jpp-group jpp-history"><div className="jpp-group-header"><div><h2><Clock3 size={17}/> 历史政策资料</h2><p>不把历史政策当作现行开放项目</p></div><span>{old.length}条</span></div>
    <div className="jpp-grid">{old.map(x=><Tile key={x.tile.id} item={x.tile} record={x.record}/>)}</div></section>}
   {!filtered.length&&<div className="jpp-empty"><FileText size={20}/><p>此分类暂时没有可核实的已收录事项。</p><button onClick={()=>setCategory('all')} type="button">查看全部政策</button></div>}
   <aside className="jpp-notice"><ShieldCheck size={18}/><div><strong>统一模板 · 政策内容分别核验</strong><p>{config.notes||'所有政策按真实来源与适用对象归档，历史批次、发放主体及住房空房状态必须以官方当期信息为准。'}</p></div></aside>
   <footer className="jpp-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度</span><Link to={'/talent-service/city/'+encodeURIComponent(config.city)}>返回{config.city}人才服务 <ArrowRight size={14}/></Link></footer>
 </main>;
}
