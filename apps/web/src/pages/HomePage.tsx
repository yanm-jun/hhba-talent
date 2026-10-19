import { ArrowUpRight, BriefcaseBusiness, UsersRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import { UnifiedJobMarket } from '../components/UnifiedJobMarket';
import { navigate } from '../router';
import type { User } from '../services/api';

function EntryCard({ kind, title, body, footer }: { kind: 'candidate' | 'employer'; title: string; body: string; footer: string }) {
  const Icon = kind === 'candidate' ? BriefcaseBusiness : UsersRound;
  return <button className="entry-card" onClick={() => navigate(kind === 'candidate' ? '/candidate' : '/recruiter/register')}><span className="entry-icon"><Icon size={23} /></span><strong>{title}</strong><small>{body}</small><span className="entry-footer">{footer}<ArrowUpRight size={15} /></span></button>;
}
export function HomePage({ user }: { user: User | null }) { return <Shell user={user}><section className="home-hero"><h1>让机会与人才，找到彼此。</h1><p>你来到这里，是为了什么？</p></section><section className="entry-grid" aria-label="选择使用入口"><EntryCard kind="candidate" title="我要应聘" body="搜索国内外企业官方岗位，按关键词、城市和招聘类型筛选，直接查看企业招聘信息，无需先上传简历。" footer="进入统一岗位市场" /><EntryCard kind="employer" title="我要招人" body="描述用人需求，完成企业与经办人认证后，再使用经过授权的人才检索功能。" footer="进入招聘方入口" /></section><UnifiedJobMarket compact/></Shell>; }
