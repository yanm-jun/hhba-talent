import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Search} from 'lucide-react';
import {Link} from '../router';
import {Shell} from './Shell';
import type {User} from '../services/api';
import {ca2026Categories,caOfficialNoc2026,caProvinceEntries,caNocCategorySource,type CaNocEntry} from '../data/overseasCanadaOccupations';
import {caOfficial,caVerifiedOn} from '../data/overseasCanada';
import '../styles/overseas-occupation.css';
import '../styles/overseas-canada.css';
export type CanadaOccupationTrack='express'|'pnp';
const trackLabel=(track:CanadaOccupationTrack)=>track==='express'?'2026 EE职业类别与NOC':'11省及地区PNP官方目录';
const pathway=(track:CanadaOccupationTrack)=>track==='express'?'/study-abroad/canada/pathway/ca-express-categories':'/study-abroad/canada/pathway/ca-pnp-express';
const entryId=(x:CaNocEntry)=>x.group+'-'+x.code;
export const caOccupationUrl=(track:CanadaOccupationTrack,id:string)=>'/study-abroad/canada/occupation/'+track+'/'+id;
export function CanadaOccupationDirectory({track}:{track:CanadaOccupationTrack}){
 const [q,setQ]=useState(''),[group,setGroup]=useState('全部');
 const options=['全部',...ca2026Categories.filter(x=>x.key!=='french').map(x=>x.name)];
 const records=useMemo(()=>caOfficialNoc2026.filter(x=>(group==='全部'||ca2026Categories.find(c=>c.key===x.group)?.name===group)&&[x.code,x.name,x.english,x.group,String(x.teer)].join(' ').toLowerCase().includes(q.toLowerCase().trim())),[q,group]);
 const provinces=useMemo(()=>caProvinceEntries.filter(x=>[x.name,x.capital,x.example].join(' ').toLowerCase().includes(q.toLowerCase().trim())),[q]);
 return <section className="hhba-occupation-browser hhba-canada-occupation-browser" id="hhba-overseas-occupation-directory" aria-label={'加拿大'+trackLabel(track)}>
  <header className="hhba-occupation-browser-heading"><span className="hhba-occupation-eyebrow">IRCC联邦及省政府2026真实资料 · {caVerifiedOn}</span>
   <h2>{track==='express'?'到底哪些具体职业在2026加拿大类别邀请名单里？':'哪个加拿大省份可以研究PNP？'}</h2>
   <p>{track==='express'?'这是IRCC官方职业名称、五位NOC、TEER及2026分类的可查证示例。同一个NOC在一般类别和加拿大经验专门类别里，要求的工作地点不同。':'列出11个有省提名项目的省与地区，每项直达真实政府stream说明；魁北克和努纳武特没有一般PNP。'}</p>
   <p className="hhba-occupation-browser-limit">目前整理 {track==='express'?caOfficialNoc2026.length:caProvinceEntries.length} 项信息。不是实时招聘、不代表所有职业或省移民通道完整开放，更不能保证直接拿永久居民。</p>
  </header>
  <label className="hhba-occupation-search"><Search size={18}/><span className="hhba-occupation-sr-only">搜索加拿大职业或省份</span>
   <input aria-label={track==='express'?'搜索加拿大NOC职业':'搜索加拿大PNP省份'} value={q} onChange={e=>setQ(e.target.value)} placeholder={track==='express'?'搜索机械工程师、31301、汽车维修、幼儿教育…':'搜索安大略、BC、阿尔伯塔、曼尼托巴…'}/>
  </label>
  {track==='express'&&<><div className="hhba-occupation-filters" role="group" aria-label="2026 EE职业类别">{options.map(x=><button key={x} type="button" className={group===x?'is-active':''} aria-pressed={group===x} onClick={()=>setGroup(x)}>{x}</button>)}</div>
   <p className="hhba-canada-french-note"><strong>法语类别没有统一NOC名单：</strong>通常要听说读写均达NCLC7，并先满足FSW、CEC或FST之一。医生、高管、研究等专门类别通常必须具备加拿大工作经历。</p></>}
  <div className="hhba-occupation-result-summary" aria-live="polite">匹配 {track==='express'?records.length:provinces.length} 项{track==='express'?'官方NOC记录':'省/地区入口'}</div>
  <div className="hhba-occupation-results">
   {track==='express'?records.map(x=><Link className="hhba-occupation-result" key={entryId(x)} to={caOccupationUrl('express',entryId(x))}>
    <div className="hhba-occupation-result-main"><strong>{x.name} · NOC {x.code}</strong><span>{x.english}</span><small>{ca2026Categories.find(c=>c.key===x.group)?.name} · TEER {x.teer}</small></div>
    <div className="hhba-occupation-result-summary-text">{x.experience.slice(0,94)}</div><ArrowRight size={17}/></Link>)
   :provinces.map(x=><Link className="hhba-occupation-result" key={x.id} to={caOccupationUrl('pnp',x.id)}>
    <div className="hhba-occupation-result-main"><strong>{x.name}</strong><span>{x.capital}</span><small>省政府真实项目入口</small></div>
    <div className="hhba-occupation-result-summary-text">{x.example}</div><ArrowRight size={17}/></Link>)}
   {!(track==='express'?records.length:provinces.length)&&<p className="hhba-occupation-no-results">未匹配目录中的示例；这不是职业禁入清单，请回到官方完整资料查询。</p>}
  </div>
  <a className="hhba-occupation-government-link" href={track==='express'?caOfficial.category:caOfficial.pnp} target="_blank" rel="noopener noreferrer">加拿大政府原始类别与省提名政策 <ExternalLink size={14}/></a>
 </section>;
}
function Section({n,title,children}:{n:number;title:string;children:React.ReactNode}){return <section className="hhba-occupation-detail-section" id={'caocc-'+n}><h2><span>{String(n).padStart(2,'0')}</span>{title}</h2>{children}</section>;}
export function CanadaOccupationDetailPage({user,track,id}:{user:User|null;track:CanadaOccupationTrack;id:string}){
 const occupation=track==='express'?caOfficialNoc2026.find(x=>entryId(x)===id):undefined;
 const province=track==='pnp'?caProvinceEntries.find(x=>x.id===id):undefined;
 const category=occupation?ca2026Categories.find(x=>x.key===occupation.group):undefined;
 const title=occupation?.name||province?.name||'未找到';
 const names=occupation?['NOC具体所属分类','怎么核对真正工作职责','近3年经验及地点','语言和EE基础资格','是否需要省级执照','材料具体准备什么','2026年11月新规则','一步步申请','官方原始资料']:
  ['省提名具体是什么','该省实际适用哪些stream','真实雇主是否必须','语言学历职业门槛','省及联邦费用','正式材料清单','申请流程怎么走','2026开放状态注意','省和联邦官网'];
 return <Shell user={user}><main className="hhba-overseas hhba-occupation-detail-page hhba-canada-occupation-detail"><div className="hhba-overseas-container hhba-occupation-detail-container">
  <nav className="hhba-occupation-breadcrumb"><Link to="/study-abroad">海外发展</Link><span>/</span><Link to="/study-abroad/country/canada">加拿大</Link><span>/</span><Link to={pathway(track)}>{trackLabel(track)}</Link><span>/</span><strong>{title}</strong></nav>
  {!occupation&&!province?<div className="hhba-occupation-missing"><h1>尚未整理此项</h1><p>目录不全等于不合格，请到官方职业及省份数据库查看。</p><a href={caOfficial.noc} target="_blank" rel="noopener noreferrer">官方NOC查询 <ExternalLink size={14}/></a></div>:<>
   <header className="hhba-occupation-detail-header"><span className="hhba-occupation-eyebrow">加拿大 · {trackLabel(track)} · {caVerifiedOn}核验</span><h1>{title}</h1>
    <p className="hhba-occupation-detail-english">{occupation?occupation.english+' · NOC '+occupation.code+' · TEER '+occupation.teer:province?.capital}</p>
    <p className="hhba-occupation-detail-lede">{occupation?category?.description:province?.example}</p>
    <p className="hhba-occupation-detail-verified">这是政府资料中文索引，不是招聘职位或个人移民批准；资格以当期官方细则为准。</p>
   </header>
   <div className="hhba-occupation-detail-layout"><nav className="hhba-occupation-detail-toc" aria-label="具体资格目录">{names.map((x,i)=><a key={x} href={'#caocc-'+(i+1)}>{i+1}. {x}</a>)}</nav>
    <article className="hhba-occupation-detail-article">
    {occupation?<>
     <Section n={1} title={names[0]}><p>2026年官方类别：<strong>{category?.name}</strong>。政府NOC2021编码：<strong>{occupation.code}</strong>，TEER {occupation.teer}。此职业是否被邀请仍取决于当轮规则和候选人EE资格。</p></Section>
     <Section n={2} title={names[1]}><p>职位的中文称呼不够。应在NOC数据库对照lead statement和main duties，证明实际执行大部分主要职责。</p><p>将真实雇主工作信的岗位任务、工时、薪资及工作地点与NOC {occupation.code}逐项对照，不得编造经历。</p></Section>
     <Section n={3} title={names[2]}><p>{occupation.experience}</p><p>多数普通职业类别要求最近3年同一个列明NOC满12个月有薪经验；“在加医生/高管/研究”需按加拿大工作地点特例审查。</p></Section>
     <Section n={4} title={names[3]}><p>只有已满足FSW、CEC或FST至少一项最低要求者才有资格参与EE类别邀请。FSW常需CLB7；CEC TEER0/1 CLB7、TEER2/3 CLB5；FST语言听说CLB5、读写CLB4。法语类别另查NCLC7四项。</p><p>符合最低条件并不保证有足够CRS分收到ITA。</p></Section>
     <Section n={5} title={names[4]}><p>{occupation.notes}</p><p>医疗、教育、工程与飞行等相关活动可能需要目的省职业执照；移民职业类别不授予职业执照。</p></Section>
     <Section n={6} title={names[5]}><ul><li>雇主真实信函：五位NOC对应职责、真实职位、起止时间、工资与工时</li><li>有薪工作证据：工资单、税务单、社保/加拿大T4等真实资料</li><li>IRCC认可语言成绩、FSW适用的学历ECA，及家庭、体检和警方证明</li><li>如果属于加拿大工作经历专门类别，必须能证明合法在加拿大从事相关NOC工作</li></ul></Section>
     <Section n={7} title={names[6]}><p>2026-11-03 IRCC改变EE工作offer的LMIA要求和高薪职位/加拿大经历CRS评分；雇主专属临时工签仍有独立LMIA规则。旧版“买LMIA增加50/200分”口径不可靠。</p></Section>
     <Section n={8} title={names[7]}><ol><li>到IRCC 2026类别表找到“{occupation.english}”及NOC {occupation.code}</li><li>在NOC系统对照真实岗位职责及经历地点</li><li>按本人条件核对FSW、CEC、FST最低语言、学历与资金条件</li><li>更新个人EE档案，按2026新CRS规则竞争ITA；获邀请后提交正式PR材料</li></ol></Section>
     <Section n={9} title={names[8]}><ul className="hhba-occupation-official-list">{[{name:'IRCC 2026职业类别原表',url:caNocCategorySource},{name:'加拿大NOC职业职责数据库',url:caOfficial.noc},{name:'IRCC FSW/CEC/FST资格',url:caOfficial.express},{name:'2026-11-03 CRS与offer改革',url:caOfficial.reform}].map((x,i)=><li key={i}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.name} <ExternalLink size={14}/></a></li>)}</ul></Section>
    </>:province&&<>
     <Section n={1} title={names[0]}><p>{province.example}</p><p>该省可能有增强型EE与非EE基础型省提名stream。必须核对当期开放、职业和省份定居意愿，不可把省提名当成工作许可证。</p></Section>
     <Section n={2} title={names[1]}><p>目标地区为{province.name}。请进入下方省政府官方网站查看2026真正开放的各个stream、EOI要求、邀请和截止日。不能假设所有招聘岗位都有省提名。</p></Section>
     <Section n={3} title={names[2]}><p>部分stream要求企业正规工作offer、合法经营、最低工资和本地工作经验；有些不要求offer。应按所选stream逐项核查，不购买所谓雇主名额。</p></Section>
     <Section n={4} title={names[3]}><p>需核对目标stream的语言CLB/NCLC、学历/ECA、职业NOC、工作年限及任何受监管职业执照；各省要求与FSW/CEC不同。</p></Section>
     <Section n={5} title={names[4]}><p>省政府申请费取决于具体2026 stream，后续联邦IRCC PR费用、语言、学历评估及生活费另算。不要付私人保过600分费用。</p></Section>
     <Section n={6} title={names[5]}><ul><li>护照、学历、语言考试、真实工作职责与工资证明</li><li>如需要：省内公司正式聘用、工资及雇主资质</li><li>真实定居该省的证据、家庭与资金材料</li><li>省EOI/提名正式证书及IRCC下一阶段申请文件</li></ul></Section>
     <Section n={7} title={names[6]}><ol><li>查{province.name}官网当前有效stream与截止期</li><li>准备stream要求的真实职业、语言、学历、offer和本省联系材料</li><li>按省流程提交EOI/完整申请，收到真正提名后保存证书</li><li>增强型EE提名获确认后可获600 CRS分；非EE基础型PNP则单独走联邦PR流程</li></ol></Section>
     <Section n={8} title={names[7]}><p>省提名stream可能满额、关闭或更换2026优先职业，须在递交前核实真实开放状态。魁北克和努纳武特没有一般PNP；省提名不等于工签或PR自动获批。</p></Section>
     <Section n={9} title={names[8]}><ul className="hhba-occupation-official-list"><li><a href={province.url} target="_blank" rel="noopener noreferrer">{province.name}政府移民政策 <ExternalLink size={14}/></a></li><li><a href={caOfficial.pnp} target="_blank" rel="noopener noreferrer">IRCC全国PNP实际资格 <ExternalLink size={14}/></a></li><li><a href={caOfficial.pnpEE} target="_blank" rel="noopener noreferrer">EE提名增加600 CRS分的条件 <ExternalLink size={14}/></a></li></ul></Section>
    </>}
    <div className="hhba-occupation-important"><strong>切勿购买虚假岗位或省提名</strong><p>本页不提供实时工作招聘和法律保证，所有程序最终由加拿大联邦、省政府或获授权机构独立审查。</p></div>
   </article></div>
   <div className="hhba-occupation-detail-back"><Link to={pathway(track)}><ArrowLeft size={15}/> 返回{trackLabel(track)}完整申请指南</Link></div>
  </>}
 </div></main></Shell>;
}
