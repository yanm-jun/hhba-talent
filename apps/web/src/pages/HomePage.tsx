import { ArrowUpRight, BriefcaseBusiness, UsersRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import { navigate } from '../router';
import type { User } from '../services/api';

function EntryCard({ kind, title, body, footer }: { kind: 'candidate' | 'employer'; title: string; body: string; footer: string }) {
  const Icon = kind === 'candidate' ? BriefcaseBusiness : UsersRound;
  return <button className="entry-card" onClick={() => navigate(kind === 'candidate' ? '/candidate' : '/employer')}><span className="entry-icon"><Icon size={23} /></span><strong>{title}</strong><small>{body}</small><span className="entry-footer">{footer}<ArrowUpRight size={15} /></span></button>;
}
export function HomePage({ user }: { user: User | null }) { return <Shell user={user}><section className="home-hero"><h1>让机会与人才，找到彼此。</h1><p>你来到这里，是为了什么？</p></section><section className="entry-grid" aria-label="选择使用入口"><EntryCard kind="candidate" title="我要找工作" body="上传简历，展示你的能力，发现新的职业机会。" footer="进入求职端" /><EntryCard kind="employer" title="我要招人才" body="告诉 AI 你的需求，快速理解合适的人才能力。" footer="进入企业端" /></section><p className="home-note">HHBA 首页目标结构示意</p></Shell>; }
