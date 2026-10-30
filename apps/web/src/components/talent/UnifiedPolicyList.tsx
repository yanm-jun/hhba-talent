import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Clock3,FileText,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Link} from '../../router';
import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from '../../data/talentPolicyRecords';
import {assessPolicy} from '../../data/talentQuality';
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
    <Link to={route}>{item.detailPath?'完整办事指南':'查看政策资料'} <ArrowRight size={14}/></Link></div>
  </div>
 </article>;
}
/** Fallback coverage for all existing cities; avoids inventing benefit amounts or eligibility. */
export function buildCityPolicyConfig(city:string):CityPolicyConfig{
 const rows=TALENT_POLICY_RECORDS.filter(p=>p.city===city);
 const clip=(value:string,max:number)=>value.length<=max?value:value.slice(0,max-1).replace(/[，,、;\s]+$/,'')+'…';
 return {
  city,subtitle:'全国统一V3列表。按已核验资料检索真实政策；待遇和资格请在详情及原文中核对。',
  notes:'仅济南、青岛等已逐条复核的事项展示明确政策金额；其余城市按原始资料摘要展示，完整办事指南正在逐条补充。',
  tiles:rows.map(p=>({
   id:p.id,category:p.category==='购房补贴'?'购房安家':p.category,
   amount:'按政策类别核定',unit:'以官方条件为准',
   description:clip(p.benefit,112),condition:clip(p.eligibility,92),
   status:'基础资料 · 申领状态待核验'
  }))
 };
}

export function UnifiedPolicyList({config}:{config:CityPolicyConfig}){
 const [category,setCategory]=useState('all');
 const entries=useMemo(()=>config.tiles.map(tile=>({tile,record:TALENT_POLICY_RECORDS.find(p=>p.id===tile.id)})).filter((x):x is {tile:PolicyTile;record:TalentPolicyRecord}=>Boolean(x.record&&x.record.city===config.city)),[config]);
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
