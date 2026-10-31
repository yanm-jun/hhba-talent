import {ArrowLeft,ArrowUpRight,ExternalLink,FileText,Info,ShieldCheck} from 'lucide-react';
import {Link} from '../../router';
import type {TalentPolicyRecord} from '../../data/talentPolicyRecords';
import type {TalentHousingRecord} from '../../data/talentHousingRecords';
import {assessPolicy,assessHousing} from '../../data/talentQuality';
import '../../styles/talent-jinan-guide-preview.css';

function Panel({title,children}:{title:string;children:React.ReactNode}){
 return <section className="jgd-panel"><div className="jgd-section-heading"><span className="jgd-section-icon"><FileText size={18}/></span><div><h2>{title}</h2></div></div>{children}</section>;
}
const fullGuide=(id:string)=>({
 'zjk-2026-shuobo-doctor':'/talent-service/policy-guide-preview/zhangjiakou/shuobo',
 'zjk-2026-shuobo-hospital':'/talent-service/policy-guide-preview/zhangjiakou/shuobo',
 'zjk-2024-highpark-apartment':'/talent-service/policy-guide-preview/zhangjiakou/park',
 'zjk-2024-highpark-office':'/talent-service/policy-guide-preview/zhangjiakou/park',
 'xt-2026-talent-purchase':'/talent-service/policy-guide-preview/xingtai/purchase',
 'xt-2026-talent-rental':'/talent-service/policy-guide-preview/xingtai/rental',
 'ts-youth-2024-base':'/talent-service/policy-guide-preview/tangshan/youth',
 'ts-undergraduate-2024-archive':'/talent-service/policy-guide-preview/tangshan/youth',
 'ts-home-2024-base':'/talent-service/policy-guide-preview/tangshan/purchase',
 'ts-hightech-rent-2023':'/talent-service/policy-guide-preview/tangshan/housing',
 'bz-2026-home-closed':'/talent-service/policy-guide-preview/binzhou/purchase',
 'bz-2026-living-archived':'/talent-service/policy-guide-preview/binzhou/living',
 'sd-jining-2026-introduction':'/talent-service/policy-guide-preview/jining/youth',
 'sjz-2026-bcard-rent':'/talent-service/policy-guide-preview/shijiazhuang/rent',
 'sjz-2026-bcard-home':'/talent-service/policy-guide-preview/shijiazhuang/home',
 'sjz-2026-graduate-settle':'/talent-service/policy-guide-preview/shijiazhuang/settlement',
 'sjz-2026-bcard-eligibility':'/talent-service/policy-guide-preview/shijiazhuang/rent',
 'sd-heze-2026-startup':'/talent-service/policy-guide-preview/heze/startup',
 'jn-maincity-rent-2026':'/talent-service/policy-guide-preview/jining/rent',
 'sd-dongying-talent-2026':'/talent-service/policy-guide-preview/dongying/transition',
 'sd-jinan-2026-talent-living':'/talent-service/policy-guide-preview/jinan',
 'zb-2026-living-reviewed':'/talent-service/policy-guide-preview/zibo/living',
 'ta-2026-living-guide':'/talent-service/policy-guide-preview/taian/living',
 'ta-2026-first-home-guide':'/talent-service/policy-guide-preview/taian/purchase',
 'ta-2026-rent-relief':'/talent-service/policy-guide-preview/taian/housing',
 'zb-2026-purchase-reviewed':'/talent-service/policy-guide-preview/zibo/purchase',
 'qd-rent-25':'/talent-service/policy-guide-preview/qingdao/housing',
 'sd-qingdao-2026-free-housing':'/talent-service/policy-guide-preview/qingdao/stay',
 'qd-laoshan-202610':'/talent-service/policy-guide-preview/qingdao/laoshan',
 'sd-yantai-2026-youth-living':'/talent-service/policy-guide-preview/yantai/living',
 'sd-yantai-2026-purchase':'/talent-service/policy-guide-preview/yantai/home'
} as Record<string,string>)[id];

export function UnifiedTalentRecordDetail({policy,housing}:{policy?:TalentPolicyRecord;housing?:TalentHousingRecord}){
 const item=policy||housing;
 if(!item)return null;
 const quality=policy?assessPolicy(policy):assessHousing(housing!);
 const application=policy?.applicationUrl||housing?.applyUrl;
 const route=policy?'/talent-service/list/policies/':'/talent-service/list/housing/';
 const housingGuide=housing&&['sjz-2026-talent-574','sjz-2026-affordable-rental','sjz-2026-public-rental-yishui','sjz-2026-public-rental-tanan','sjz-2026-public-rental-shenghe'].includes(housing.id)?'/talent-service/policy-guide-preview/shijiazhuang/housing':housing&&['ta-2026-city-affordable-rental','ta-2026-new-worker-public-rent'].includes(housing.id)?'/talent-service/policy-guide-preview/taian/housing':housing&&['zb-zichuan-shuian-202606','zb-zichuan-yuting-202606'].includes(housing.id)?'/talent-service/policy-guide-preview/zibo/housing':undefined;
 const link=policy?fullGuide(policy.id):housingGuide;
 return <main className="jgd-page">
  <nav className="jgd-breadcrumb"><Link to="/talent-service">人才服务</Link><span>›</span><Link to={'/talent-service/city/'+encodeURIComponent(item.city)}>{item.city}</Link><span>›</span>{policy?'人才政策':housing?.housingCategory||'人才住房'}</nav>
  <header className="jgd-hero"><div className="jgd-hero-text"><span className="jgd-kicker">HHBA / 全国统一政策详情标准</span><h1>{item.title}</h1><p>{policy?.summary||housing?.statusNote}</p>
   <div className="jgd-tags"><span>{quality.label}</span><span>官方资料日期 {item.published}</span><span>不代表当前申请成功或有实时房源</span></div></div>
   <div className="jgd-hero-aside"><span>支持方向</span><strong style={{fontSize:20}}>{policy?.category||'人才住房'}</strong><small>{policy?'待遇金额和具体资格请查看下方完整说明':'房源租金和入住要求请查看下方完整说明'}</small><span>按官方资格与实际审核认定</span></div>
  </header>
  {link&&<div className="jgd-tip"><ShieldCheck size={16}/><p>这项资料已核对详细流程，可查看分类资格、材料、办事步骤和常见问题。正式A级认证另须经过独立V5.1验收；历史住房批次不可作为当前申报依据。 <Link to={link}>打开详细办事指南 <ArrowUpRight size={13}/></Link></p></div>}
  <div style={{marginTop:22}}>
   {policy?<><Panel title="01 政策待遇与适用人群"><p>{policy.benefit}</p>{policy.targetGroup&&<p>面向对象：{policy.targetGroup}</p>}{policy.payoutTo&&<p>扶持主体：{policy.payoutTo==='用人单位'?'用人单位（并非个人现金补贴）':policy.payoutTo==='非现金贷款'?'贷款，需还款':policy.payoutTo==='住房折扣'?'指定房源的购房优惠':policy.payoutTo}</p>}</Panel>
    <Panel title="02 具体申请条件"><p>{policy.eligibility}</p>{policy.deadline&&<p>当前记录的申请截止日期：{policy.deadline}（请核验是否有新的批次）。</p>}</Panel>
    <Panel title="03 办理流程与审核"><p>{policy.application}</p>
     {policy.applicationSteps?.length?<ol>{policy.applicationSteps.map((s,i)=><li key={i} style={{lineHeight:1.9,marginBottom:9}}>{s}</li>)}</ol>:<p className="jgd-mutedsmall">当前尚未收录可核验的详细步骤，不得将简短描述冒充完整办事指南；请查看官方原文。</p>}</Panel>
    <Panel title="04 申请材料与注意事项">{policy.materials?.length?<ul>{policy.materials.map((s,i)=><li key={i} style={{lineHeight:1.9,marginBottom:9}}>{s}</li>)}</ul>:<p className="jgd-mutedsmall">官方材料清单尚待逐项核实，请通过正式政府办理渠道查询。</p>}
     {policy.reviewNote&&<p>特别提醒：{policy.reviewNote}</p>}</Panel></>:
    <><Panel title="01 住房位置、规模与费用"><p>项目地址：{housing?.address}</p><p>公告房源：{housing?.units}</p><p>租金：{housing?.rent}</p><p>状态：{housing?.statusNote}</p></Panel>
    <Panel title="02 住房资格、截止日期"><p>{housing?.eligibility}</p>{housing?.applicationEnd&&<p>公告批次截止日期：{housing.applicationEnd}（不等于实时有空房）。</p>}</Panel>
    <Panel title="03 选房及签约步骤"><ol>{housing?.steps.map((s,i)=><li key={i} style={{lineHeight:1.9,marginBottom:9}}>{s}</li>)}</ol></Panel>
    <Panel title="04 咨询与项目限制">{housing?.contactPhone?<p>公开咨询电话：<a href={'tel:'+housing.contactPhone}>{housing.contactPhone}</a>（接通情况未核验）</p>:<p>公开咨询电话尚未确认，应核对官方原文。</p>}</Panel></>}
   <Panel title="05 官方原文与办理渠道"><div className="jgd-portal"><div><strong>{quality.sourceKind==='government'?'政府政策原文':'公开资料来源 · 非政府一手出处'}</strong><span>公开时间：{item.published}</span><small>本站仅提供政策信息，不收集个人身份证、学历证明或银行卡材料。</small></div>
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{quality.sourceKind==='government'?'查看官方原文':'核对参考来源'} <ExternalLink size={14}/></a></div>
    {application?<div className="jgd-portal" style={{marginTop:12}}><div><strong>相关政府办理系统</strong><span>实际受理状态须以政府系统确认。</span></div><a href={application} target="_blank" rel="noopener noreferrer">查看办理平台 <ExternalLink size={14}/></a></div>:
    <p className="jgd-portal-warning">独立申报入口待核验，政府介绍页不等于已经开放申请。</p>}</Panel>
   <Panel title="06 信息完整度与补全情况"><p>当前等级：<strong>{quality.grade} · {quality.label}</strong></p>
    {quality.missing.length?<><p>以下事项尚需从主管部门进一步核实：</p><ul>{quality.missing.map(s=><li key={s} style={{lineHeight:1.9}}>{s}</li>)}</ul></>:<p>结构化字段较齐全，办理资格与受理情况仍以政府最新通知为准。</p>}
    <div className="jgd-tip"><Info size={16}/><p>A是已建立详细指南，B为基础资料，C为历史或截止批次，D为来源不可信。缺少的官方条件必须标为待核验，不能编造。</p></div></Panel>
  </div>
  <footer className="jgd-footer"><Link to={route+encodeURIComponent(item.city)}><ArrowLeft size={14}/> 返回{item.city}{policy?'政策':'住房'}列表</Link><span>HHBA · 统一页面模板，真实数据单独核验</span></footer>
 </main>;
}
