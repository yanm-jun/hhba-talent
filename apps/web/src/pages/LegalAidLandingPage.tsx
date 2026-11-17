import {
  ArrowUpRight, BadgeAlert, BookmarkX, Clock3, FileText, HeartPulse,
  LockKeyhole, Scale, ShieldCheck, Wallet, Waypoints
} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/legal-aid-landing.css';

// Public labor-rights knowledge only. Membership purchase, case intake and legal services are not live.
const legalTopics=[
  {title:'拖欠工资',icon:Wallet,slug:'unpaid-wages'},
  {title:'违法辞退与补偿',icon:BookmarkX,slug:'unlawful-dismissal'},
  {title:'加班费与休假',icon:Clock3,slug:'overtime-leave'},
  {title:'劳动合同纠纷',icon:FileText,slug:'labor-contracts'},
  {title:'社会保险争议',icon:ShieldCheck,slug:'social-insurance'},
  {title:'工伤与赔偿',icon:HeartPulse,slug:'work-injury'},
  {title:'调岗降薪',icon:Waypoints,slug:'transfer-paycuts'},
  {title:'灵活用工争议',icon:BadgeAlert,slug:'flexible-work'}
] as const;

export function LegalAidLandingPage({user}:{user:User|null}){
  return <Shell user={user}>
    <main className="hhba-law" id="main-content">
      <section className="hhba-law-panel" aria-labelledby="hhba-law-title">
        <header className="hhba-law-header">
          <div className="hhba-law-brand">
            <span className="hhba-law-brand-logo">HHBA.</span>
            <span className="hhba-law-brand-divider" aria-hidden="true"/>
            <span className="hhba-law-brand-name">劳动权益支持</span>
          </div>
          <div className="hhba-law-header-actions">
            <Link to="/candidate/account/rights" className="hhba-law-intervention-link"><ShieldCheck size={13} aria-hidden="true"/>职场权益中心</Link>
            <Link to="/membership/rules" className="hhba-law-intervention-link">
              <FileText size={13} aria-hidden="true"/>会员服务完整规则
            </Link>
            <Link to="/candidate/account/legal-aid/intervention" className="hhba-law-intervention-link">
              <ShieldCheck size={13} aria-hidden="true"/>查看服务筹备说明
            </Link>
            <Link to="/candidate/account" className="hhba-law-back">
              返回个人中心 <ArrowUpRight size={12} aria-hidden="true"/>
            </Link>
          </div>
        </header>

        <div className="hhba-law-body">
          <div className="hhba-law-intro">
            <Scale size={24} strokeWidth={2.2} aria-hidden="true"/>
            <h1 id="hhba-law-title">遇到劳动问题？</h1>
            <p>了解合法权益、证据准备与处理方向。若希望了解每月企业监测与职业权益服务，可进入职场权益中心；付费会员与个案受理目前尚未开放。</p>
          </div>

          <div className="hhba-law-question-preview" aria-label="未来的问题描述功能，当前尚未开放">
            <span>例如：公司三个月没有发工资，我该怎么办？</span>
            <span className="hhba-law-question-locked"><LockKeyhole size={12} aria-hidden="true"/> 功能筹备中</span>
          </div>

          <section className="hhba-law-topics" aria-label="劳动权益知识专题">
            <h2>劳动权益问题专题 · 8 类</h2>
            <div className="hhba-law-topic-grid">
              {legalTopics.map(({title,icon:Icon,slug})=><Link to={'/candidate/account/legal-aid/'+slug} className="hhba-law-topic" key={slug}>
                <Icon className="hhba-law-topic-icon" size={15} strokeWidth={1.65} aria-hidden="true"/>
                <span>{title}</span>
                <ArrowUpRight className="hhba-law-topic-arrow" size={12} strokeWidth={1.7} aria-hidden="true"/>
              </Link>)}
            </div>
          </section>
        </div>

        <footer className="hhba-law-footer">
          8 类劳动权益知识与公开案例已开放查询 · 会员服务、个案受理和证据提交尚未开放
        </footer>
      </section>
    </main>
  </Shell>;
}
