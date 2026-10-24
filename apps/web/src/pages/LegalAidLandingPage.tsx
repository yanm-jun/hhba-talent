import {
  ArrowUpRight, BadgeAlert, BookmarkX, Clock3, FileText, HeartPulse,
  LockKeyhole, Scale, ShieldCheck, Wallet, Waypoints
} from 'lucide-react';
import {Shell} from '../components/Shell';
import {Link} from '../router';
import type {User} from '../services/api';
import '../styles/legal-aid-landing.css';

// Static UI only: the legal assistance service has not launched.
// No uploads, case intake, submissions, legal advice, or employer data transfer.
const legalTopics=[
  {title:'拖欠工资',icon:Wallet},
  {title:'违法辞退与补偿',icon:BookmarkX},
  {title:'加班费与休假',icon:Clock3},
  {title:'劳动合同纠纷',icon:FileText},
  {title:'社会保险争议',icon:ShieldCheck},
  {title:'工伤与赔偿',icon:HeartPulse},
  {title:'调岗降薪',icon:Waypoints},
  {title:'灵活用工争议',icon:BadgeAlert}
] as const;

export function LegalAidLandingPage({user}:{user:User|null}){
  return <Shell user={user}>
    <main className="hhba-law" id="main-content">
      <section className="hhba-law-panel" aria-labelledby="hhba-law-title">
        <header className="hhba-law-header">
          <div className="hhba-law-brand">
            <span className="hhba-law-brand-logo">HHBA.</span>
            <span className="hhba-law-brand-divider" aria-hidden="true"/>
            <span className="hhba-law-brand-name">法律援助</span>
          </div>
          <Link to="/candidate/account" className="hhba-law-back">
            返回个人中心 <ArrowUpRight size={12} aria-hidden="true"/>
          </Link>
        </header>

        <div className="hhba-law-body">
          <div className="hhba-law-intro">
            <Scale size={24} strokeWidth={2.2} aria-hidden="true"/>
            <h1 id="hhba-law-title">遇到劳动问题？</h1>
            <p>了解自己的合法权益，找到解决问题的方向。</p>
          </div>

          <div className="hhba-law-question-preview" aria-label="未来的问题描述功能，当前尚未开放">
            <span>例如：公司三个月没有发工资，我该怎么办？</span>
            <span className="hhba-law-question-locked"><LockKeyhole size={12} aria-hidden="true"/> 功能筹备中</span>
          </div>

          <section className="hhba-law-topics" aria-label="未来支持的劳动权益问题类型">
            <h2>未来支持的劳动权益问题</h2>
            <div className="hhba-law-topic-grid">
              {legalTopics.map(({title,icon:Icon})=><div className="hhba-law-topic" key={title}>
                <Icon className="hhba-law-topic-icon" size={15} strokeWidth={1.65} aria-hidden="true"/>
                <span>{title}</span>
                <ArrowUpRight className="hhba-law-topic-arrow" size={12} strokeWidth={1.7} aria-hidden="true"/>
              </div>)}
            </div>
          </section>
        </div>

        <footer className="hhba-law-footer">
          服务尚未开放 · 暂不接受案件及证据材料
        </footer>
      </section>
    </main>
  </Shell>;
}
