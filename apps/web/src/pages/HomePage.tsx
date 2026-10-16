import { ArrowUpRight, BriefcaseBusiness, UsersRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import { RecruitmentMarketplace } from '../components/RecruitmentMarketplace';
import { navigate } from '../router';
import type { User } from '../services/api';

function EntryCard({ kind, title, body, footer }: { kind: 'candidate' | 'employer'; title: string; body: string; footer: string }) {
  const Icon = kind === 'candidate' ? BriefcaseBusiness : UsersRound;
  return <button className="entry-card" onClick={() => navigate(kind === 'candidate' ? '/candidate' : '/recruiter/register')}><span className="entry-icon"><Icon size={23} /></span><strong>{title}</strong><small>{body}</small><span className="entry-footer">{footer}<ArrowUpRight size={15} /></span></button>;
}
export function HomePage({ user }: { user: User | null }) { return <Shell user={user}><section className="home-hero"><h1>让机会与人才，找到彼此。</h1><p>你来到这里，是为了什么？</p></section><section className="entry-grid" aria-label="选择使用入口"><EntryCard kind="candidate" title="我要应聘" body="搜索企业官方岗位、筛选校招社招实习；也可以上传简历，建立自己的能力档案。" footer="进入应聘端" /><EntryCard kind="employer" title="我要招人" body="发布人才需求，完成企业与经办人审核后检索获得授权的人才档案。" footer="进入招聘方入口" /></section><RecruitmentMarketplace/></Shell>; }
