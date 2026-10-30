import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,CheckCircle2,Clock3,FileText,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Link} from '../router';
import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from '../data/talentPolicyRecords';
import './talentJinanPolicyPreview.css';

const all=TALENT_POLICY_RECORDS.filter(x=>x.city==='济南');
const isHistorical=(p:TalentPolicyRecord)=>p.temporal==='historical'||p.temporal==='past-window'||Boolean(p.deadline&&p.deadline<new Date().toISOString().slice(0,10));
const categories=[
 {id:'all',label:'全部政策'},
 {id:'生活补贴',label:'生活补贴'},
 {id:'购房补贴',label:'购房安家'},
 {id:'交通福利',label:'交通福利'},
 {id:'history',label:'历史政策'}
];
const highlights:Record<string,{title:string;amount:string;unit?:string;note:string;condition:string}>={
 'sd-jinan-2026-talent-living':{
  title:'济南 · 高层次人才生活补贴',
  amount:'¥1,000–5,000',unit:'/月',
  note:'A—E类人才按类别分档，最长3—5年；以上为不同档次的范围',
  condition:'在济就业 · 人才类别认定 · 按要求参保'
 },
 'jn-home-26':{
  title:'济南 · 人才首次购房补贴',
  amount:'房款50%',unit:'分类设上限',
  note:'仅B/C/D类人才按房款比例计算，上限分别为100万/70万/40万元；博士硕士另有分类规定',
  condition:'指定人才类别 · 符合首套购房规定 · 在济工作与参保'
 },
 'jn-graduate-housing':{
  title:'高校毕业生住房与生活补贴（2024版）',
  amount:'¥500–1,500',unit:'/月',
  note:'历史文件分别列有毕业生生活补贴和租房补贴；不是统一按此金额发放',
  condition:'需核对现行学历分类、在济就业与社保资格'
 },
 'jn-transport':{
  title:'泉城人才交通卡（2024版）',
  amount:'公交·地铁',unit:'出行优惠',
  note:'旧版文件涉及部分人才类别和符合要求的在济就业应届毕业生',
  condition:'需核对现行人才类别、办理条件及有效期限'
 }
};
function policyTime(p:TalentPolicyRecord){return p.published.slice(0,4)+'年公开资料'}
function Card({record}:{record:TalentPolicyRecord}){
 const highlight=highlights[record.id];
 const historic=isHistorical(record);
 const title=highlight?.title||record.title;
 const benefit=highlight?.amount||'按政策条件';
 const unit=highlight?.unit||'分档核定';
 const detail=highlight?.note||record.benefit;
 const condition=highlight?.condition||record.eligibility;
 return <article className={'jpp-card'+(historic?' jpp-card-archive':'')}>
  <div className="jpp-card-meta">
   <span className="jpp-type">{record.category==='购房补贴'?'购房安家':record.category}</span>
   <span className={'jpp-state'+(historic?' jpp-state-old':'')}><Clock3 size={12}/>
    {historic?'历史资料 · 现行规则待核对':'政策参考 · 申领状态待核验'}
   </span>
  </div>
  <h3>{title}</h3>
  <div className="jpp-benefit">
   <span className="jpp-benefit-label">主要待遇</span>
   <div className="jpp-amount"><strong>{benefit}</strong><span>{unit}</span></div>
   <p>{detail}</p>
  </div>
  <div className="jpp-condition"><span>核心条件</span><p>{condition}</p></div>
  <div className="jpp-card-bottom">
   <div className="jpp-source"><span>{policyTime(record)}</span><span>·</span><span>来源可查</span></div>
   <div className="jpp-links">
    <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={'查看'+title+'来源原文'}>政府原文 <ArrowUpRight size={13}/></a>
    <Link to={'/talent-service/policy/'+encodeURIComponent(record.id)}>查看详情 <ArrowRight size={14}/></Link>
   </div>
  </div>
 </article>;
}
export function TalentJinanPolicyPreview(){
 const [category,setCategory]=useState('all');
 const sources=useMemo(()=>all.filter(p=>category==='all'||(category==='history'?isHistorical(p):p.category===category)),[category]);
 const fresh=sources.filter(p=>!isHistorical(p)).sort((a,b)=>b.published.localeCompare(a.published));
 const archive=sources.filter(isHistorical).sort((a,b)=>b.published.localeCompare(a.published));
 const currentTotal=all.filter(p=>!isHistorical(p)).length;
 const archiveTotal=all.length-currentTotal;
 return <main className="jpp-page">
  <nav className="jpp-breadcrumb" aria-label="当前位置">
   <Link to="/talent-service">人才服务</Link><span>›</span>
   <Link to="/talent-service/city/%E6%B5%8E%E5%8D%97">济南市</Link><span>›</span>
   <span aria-current="page">政策列表新版样板</span>
  </nav>
  <header className="jpp-heading">
   <div><span className="jpp-eyebrow">HHBA · 政策展示 V3 样板</span><h1>济南市人才政策</h1><p>先看待遇，再看门槛。完整资格、申报材料与政府原文，进入详情查看。</p></div>
   <Link className="jpp-old-link" to="/talent-service/list/policies/%E6%B5%8E%E5%8D%97"><ArrowLeft size={14}/> 对比旧版列表</Link>
  </header>
  <div className="jpp-overview" role="group" aria-label="政策收录情况">
   <div><strong>{all.length}</strong><span>已收录政策</span></div>
   <div><strong>{currentTotal}</strong><span>待核验申领状态</span></div>
   <div><strong>{archiveTotal}</strong><span>历史及截止批次</span></div>
   <p><ShieldCheck size={16}/> 数据来自已收录政府政策资料；“待核验”不等于目前开放申请。</p>
  </div>
  <section className="jpp-filter-panel" aria-label="按政策类别筛选">
   <div className="jpp-filter-title"><SlidersHorizontal size={16}/><strong>政策分类</strong><span>快速找到关心的待遇</span></div>
   <div className="jpp-filter-buttons">
    {categories.map(c=><button key={c.id} type="button" aria-pressed={category===c.id} className={category===c.id?'selected':''} onClick={()=>setCategory(c.id)}>
     {c.label}{c.id==='history'&&<span className="jpp-filter-count">{archiveTotal}</span>}
    </button>)}
   </div>
  </section>
  {fresh.length>0&&<section className="jpp-group" aria-labelledby="jpp-new-heading">
    <div className="jpp-group-header"><div><h2 id="jpp-new-heading">政策参考</h2><p>已收录政府公开资料，具体受理时间和申领资格需向经办部门确认</p></div><span>{fresh.length} 条</span></div>
    <div className="jpp-grid">{fresh.map(p=><Card record={p} key={p.id}/>)}</div>
   </section>}
  {archive.length>0&&<section className="jpp-group jpp-history" aria-labelledby="jpp-old-heading">
    <div className="jpp-group-header"><div><h2 id="jpp-old-heading"><Clock3 size={17}/> 历史政策资料</h2><p>往年政策仅供参考，不视为现行可申领项目</p></div><span>{archive.length} 条</span></div>
    <div className="jpp-grid">{archive.map(p=><Card record={p} key={p.id}/>)}</div>
   </section>}
  {!sources.length&&<div className="jpp-empty"><FileText size={20}/><p>当前分类暂无已收录的济南人才政策。</p><button type="button" onClick={()=>setCategory('all')}>查看全部政策</button></div>}
  <aside className="jpp-notice"><ShieldCheck size={19}/><div><strong>这是单城展示样板，尚未推广至其他城市</strong><p>政策金额仅展示对应政策中的分类待遇或最高限额；不代表资格通过，也不保证正在接受申请。点击“查看详情”会打开现有完整政策信息，政府原文独立可查。</p></div></aside>
  <footer className="jpp-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度</span><Link to="/talent-service/city/%E6%B5%8E%E5%8D%97">返回济南人才服务 <ArrowRight size={14}/></Link></footer>
 </main>;
}
