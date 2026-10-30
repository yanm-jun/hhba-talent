import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Clock3,FileText,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {Link} from '../router';
import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from '../data/talentPolicyRecords';
import './talentJinanPolicyPreview.css';

const selectedIds=['qd-rent-25','sd-qingdao-2026-free-housing','qd-home-25','qd-start-25','qd-laoshan-202610'] as const;
const policies=selectedIds.map(id=>TALENT_POLICY_RECORDS.find(p=>p.id===id)).filter((p):p is TalentPolicyRecord=>Boolean(p));
const tabs=[['all','全部政策'],['住房补贴','住房补贴'],['免租金住宿','免租金住宿'],['购房安家','购房安家'],['就业创业','就业创业'],['人才住房','区域配租']] as const;
type Kind=typeof tabs[number][0];
const summaries:Record<string,{category:Kind;benefit:string;unit:string;detail:string;condition:string;status:string;guide?:string}>={
 'qd-rent-25':{category:'住房补贴',benefit:'¥500—1,200',unit:'／月 · 最长36个月',detail:'本科500元、硕士800元、博士1200元/月，具体按本人学历、就业与政策条件审核。',condition:'毕业年限 · 青岛户籍（另有例外） · 在青就业创业与参保',status:'政策依据有效期至2027年3月，个别受理状态以平台为准',guide:'housing'},
 'sd-qingdao-2026-free-housing':{category:'免租金住宿',benefit:'最长12个月',unit:'按求职与就业状态计算',detail:'来青求职累计最多6个月；在青就业创业后可按规定合并计算，最长12个月，须有可选房源。',condition:'毕业3年内（含毕业学年） · 认证与选房 · 区分求职和就业参保',status:'2026年新规已施行 · 房源与预约实时核实',guide:'stay'},
 'qd-home-25':{category:'购房安家',benefit:'¥10万／15万',unit:'一次性 · 分硕博',detail:'在青创新创业落户并购买唯一商品住宅，符合条件硕士10万元、博士15万元。',condition:'硕士35周岁以下／博士40周岁以下 · 在青创业就业落户 · 唯一住房',status:'申请情况与补贴互斥规则待官方核验'},
 'qd-start-25':{category:'就业创业',benefit:'¥2,000／1.2万',unit:'一次性 · 分创业主体',detail:'首次创办个体工商户最高2000元；符合条件的小微企业首次创业补贴1.2万元。',condition:'符合毕业生等群体要求 · 经营满一年 · 按创业类别缴纳社保',status:'按当期申报通知核验'},
 'qd-laoshan-202610':{category:'人才住房',benefit:'492套',unit:'2026年10月公告规模',detail:'崂山区午山馨苑及海逸公馆当期公布492套；公告数量不等于当前空房。',condition:'崂山区租赁型人才住房准入 · 单位与个人申请时间限制',status:'区级限时批次 · 单位/个人截止时间须核对'}
};
const guidePath=(p:TalentPolicyRecord)=>'/talent-service/policy-guide-preview/qingdao/'+summaries[p.id].guide;
function PolicyCard({p}:{p:TalentPolicyRecord}){
 const x=summaries[p.id];
 return <article className="jpp-card">
  <div className="jpp-card-meta"><span className="jpp-type">{x.category}</span><span className="jpp-state"><Clock3 size={12}/>{x.status}</span></div>
  <h3>{p.title}</h3>
  <div className="jpp-benefit"><span className="jpp-benefit-label">主要待遇 / 规模</span>
   <div className="jpp-amount"><strong>{x.benefit}</strong><span>{x.unit}</span></div><p>{x.detail}</p>
  </div>
  <div className="jpp-condition"><span>核心条件</span><p>{x.condition}</p></div>
  <div className="jpp-card-bottom">
   <div className="jpp-source"><span>{p.published.slice(0,4)}年资料</span><span>·</span><span>原文可核对</span></div>
   <div className="jpp-links"><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">政策原文 <ArrowUpRight size={13}/></a>
    <Link to={x.guide?guidePath(p):'/talent-service/policy/'+encodeURIComponent(p.id)}>{x.guide?'完整办理指南':'查看政策详情'} <ArrowRight size={14}/></Link></div>
  </div>
 </article>;
}
export function TalentQingdaoPolicyPreview(){
 const [filter,setFilter]=useState<Kind>('all');
 const displayed=useMemo(()=>policies.filter(p=>filter==='all'||summaries[p.id].category===filter),[filter]);
 return <main className="jpp-page">
  <nav className="jpp-breadcrumb"><Link to="/talent-service">人才服务</Link><span>›</span>
   <Link to="/talent-service/city/%E9%9D%92%E5%B2%9B">青岛市</Link><span>›</span>新版政策列表</nav>
  <header className="jpp-heading"><div><span className="jpp-eyebrow">HHBA · 山东省第二城 / V3样板复用</span><h1>青岛市人才政策</h1>
   <p>分类快速查找待遇，进入详情看清申报步骤。精选5项不同政策，不将重复转载计算为新增项目。</p></div>
   <Link className="jpp-old-link" to="/talent-service/list/policies/%E9%9D%92%E5%B2%9B"><ArrowLeft size={14}/> 对比旧版列表</Link>
  </header>
  <div className="jpp-overview"><div><strong>{policies.length}</strong><span>精选不同事项</span></div>
   <div><strong>2</strong><span>完整办事指南</span></div><div><strong>5</strong><span>类别可筛选</span></div>
   <p><ShieldCheck size={16}/> 历史公告规模、补贴上限不代表本人能领或当前有房源。</p></div>
  <section className="jpp-filter-panel" aria-label="青岛人才政策分类"><div className="jpp-filter-title"><SlidersHorizontal size={16}/><strong>政策分类</strong><span>点击选择，不用逐张翻看</span></div>
   <div className="jpp-filter-buttons">{tabs.map(([id,label])=><button type="button" key={id} className={filter===id?'selected':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
  </section>
  {displayed.length?<section className="jpp-group"><div className="jpp-group-header"><div><h2>政策与办事事项</h2><p>每项只保留关键待遇、限制和来源；具体手续进入详情查看</p></div><span>{displayed.length} 条</span></div>
   <div className="jpp-grid">{displayed.map(p=><PolicyCard key={p.id} p={p}/>)}</div></section>:
   <div className="jpp-empty"><FileText size={20}/><p>该分类暂时没有已核验资料。</p><button type="button" onClick={()=>setFilter('all')}>查看全部</button></div>}
  <aside className="jpp-notice"><ShieldCheck size={18}/><div><strong>青岛市单城样板 · 主线开发</strong><p>住房补贴和2026年免租住宿已分别建立详细办理指南。安家费、创业补贴和崂山批次保留原始详情；不假装全部政策已经完成逐项审批核验。当前页面不改首页或其他城市。</p></div></aside>
  <footer className="jpp-footer"><span>HHBA · 让劳动更有尊严，让商业更有温度</span><Link to="/talent-service/city/%E9%9D%92%E5%B2%9B">返回青岛人才服务 <ArrowRight size={14}/></Link></footer>
 </main>;
}
