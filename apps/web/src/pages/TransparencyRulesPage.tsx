import {ArrowRight,FileCheck2,ShieldCheck,Scale} from 'lucide-react';
import {TransparencyFrame} from './TransparencyFrame';
import {Link} from '../router';
import type {User} from '../services/api';

export function TransparencyRulesPage({user}:{user:User|null}){
 return <TransparencyFrame user={user} section="公开制度与监督" title="公开制度与监督" description="明确分配依据、披露边界和纠错原则；承诺与实际财务结果分别记录。">
  <section id="financial-allocation" className="hhba-v5-content-section" aria-labelledby="v5-allocation-title">
   <div className="hhba-v5-section-label"><span>01 / ALLOCATION RULE</span><h2 id="v5-allocation-title">可分配利润 60 / 40 原则</h2></div>
   <div className="hhba-v5-allocation"><div><strong>60%</strong><b>企业发展部分</b><p>用于持续经营、产品建设、团队激励和依法合规的经营者收益。</p></div><div><strong>40%</strong><b>劳动者权益帮扶池</b><p>按公开的服务及审批规则，用于符合条件的劳动者权益支持。</p></div></div>
   <div className="hhba-v5-terms">
    <h3>计算及适用范围</h3><p>上述比例以依法核算并履行必要程序后确定的<strong>可分配利润</strong>为基础，不按每笔订单、营业收入或用户付款直接分成。</p>
    <p>“应计提金额”“实际入池金额”“已发生支出”“期末结余”须分别核算。没有依法确定的可分配利润时，不虚构计提或实际划拨。</p>
    <p>劳动者权益帮扶不是保险产品、不构成保险赔付或个人可提现资金账户。</p>
    <Link to="/transparency/reports">查阅正式财务报告 <ArrowRight size={15}/></Link>
   </div>
  </section>
  <section id="public-policy-monitor" className="hhba-v5-content-section" aria-labelledby="v5-monitor-title">
   <div className="hhba-v5-section-label"><span>02 / TRANSPARENCY</span><h2 id="v5-monitor-title">公开审核与监督</h2></div>
   <div className="hhba-v5-rule-rows">
    <article><FileCheck2 size={19}/><div><h3>先审核，后公开</h3><p>真实案件必须取得适当授权，进行事实核验、隐私检查和发布审批；财务支出需核验原始凭据、用途及对应已发布月报。</p></div></article>
    <article><ShieldCheck size={19}/><div><h3>保护个人与工作信息</h3><p>姓名、证件号码、完整劳动合同、银行账号和律师保密沟通等不得默认对外公开，只披露被授权且必要的脱敏内容。</p></div></article>
    <article><Scale size={19}/><div><h3>修订和可追溯</h3><p>月报发布后如需更正，应记录修订原因和历史版本。未经审核、已撤回或无法核验的材料不得作为公开成果展示。</p></div></article>
   </div>
   <Link className="hhba-v5-text-link" to="/transparency/cases">查看已审核的案例公开档案 <ArrowRight size={15}/></Link>
  </section>
  <section id="responsibility-support" className="hhba-v5-content-section" aria-labelledby="v5-capital-title">
   <div className="hhba-v5-section-label"><span>03 / ADDITIONAL DISCLOSURE</span><h2 id="v5-capital-title">个人资金支持说明</h2></div>
   <details className="hhba-v5-disclosure">
    <summary>查看运营方披露的个人投资支持及独立性说明 <ArrowRight size={17}/></summary>
    <div><strong>¥600,000</strong><p>HHBA 经营方自主披露：已获得个人投资者提供的人民币 60 万元资金支持，用于平台建设。上述金额及资金性质尚未经独立第三方鉴证。</p>
    <p>该笔资金不属于投资人任职机构或任何 ESG 基金的机构投资，不代表相关机构与 HHBA 存在投资、认证或背书关系。个人投资资金与营业收入、可分配利润分别核算，不直接参与 60/40 利润分配。</p>
    <p>劳动者权益帮扶是 HHBA 自主经营承诺，不代表任何基金或 ESG 机构的官方认证。投资人身份与协议细节未经授权不公开。</p></div>
   </details>
  </section>
  <footer className="hhba-v5-rules-end"><Link to="/membership/rules">阅读会员与劳动权益服务完整规则 <ArrowRight size={15}/></Link></footer>
 </TransparencyFrame>;
}