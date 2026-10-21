import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, FileUser, MapPin, Search, Sparkles, UserRound } from 'lucide-react';
import { Shell } from '../components/Shell';
import {useDemoAccount} from '../services/demoAccount';
import { Link, navigate } from '../router';
import { trackEvent } from '../services/engagement';
import { api, employerApiReady, type User } from '../services/api';
import {
  listJobs, officialStatus, localizedCompany, localizedLocation, localizedTitle,
  type LiveJob, type LiveFilters
} from '../services/liveRecruitment';
import '../styles/candidate-dashboard.css';

const initialFilters:LiveFilters={
  q:'',company:'',country:'',remote:false,recruitment_type:'',
  location_country:'',city:'',education:'',experience:''
};

/**
 * "我要应聘" is already a user decision. Land directly in their job workspace,
 * rather than showing another directory of feature-entry cards.
 */
export function CandidateDashboardPage({user}:{user:User|null}){
  const demo=useDemoAccount();
  const [query,setQuery]=useState('');
  const [jobs,setJobs]=useState<LiveJob[]>([]);
  const [asOf,setAsOf]=useState('');
  const [jobsBusy,setJobsBusy]=useState(true);
  const [jobsError,setJobsError]=useState('');
  const [reload,setReload]=useState(0);
  const [hasProfile,setHasProfile]=useState(false);

  useEffect(()=>{
    if(!employerApiReady||!user)return;
    let active=true;
    api.profile().then(result=>{
      if(active)setHasProfile(!!result.profile && ['confirmed','published'].includes(result.profile.status));
    }).catch(()=>undefined);
    return()=>{active=false};
  },[user]);

  useEffect(()=>{
    const controller=new AbortController();
    setJobsBusy(true);setJobsError('');
    listJobs(initialFilters,0,controller.signal)
      .then(data=>{
        if(controller.signal.aborted)return;
        setAsOf(data.updated);
        setJobs(data.jobs.filter(job=>officialStatus(job,data.updated)==='recent').slice(0,4));
      })
      .catch(error=>{
        if(!controller.signal.aborted){setJobs([]);setJobsError(error instanceof Error?error.message:'岗位读取失败');}
      })
      .finally(()=>{if(!controller.signal.aborted)setJobsBusy(false)});
    return()=>controller.abort();
  },[reload]);

  function submitSearch(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const term=query.trim().slice(0,100);
    if(term)trackEvent('job_search','/candidate/jobs');
    navigate('/candidate/jobs'+(term?'?q='+encodeURIComponent(term):''));
  }

  const profileStatus=!employerApiReady?(demo?'演示账户':'可体验模拟账户'):!user?'未登录':hasProfile?'已建立':'待完善';
  const canManageProfile=employerApiReady && !!user;

  return <Shell user={user}>
    <section className="candidate-dashboard" aria-label="HHBA 求职中心">
      <div className="candidate-dashboard-trail">
        <Link to="/">首页</Link><span aria-hidden="true">/</span><strong>求职中心</strong>
      </div>
      <header className="candidate-dashboard-intro">
        <h1>找到适合你的工作</h1>
        <p>从真实招聘岗位出发，建立自己的求职计划。</p>
      </header>

      <form className="candidate-dashboard-search" role="search" onSubmit={submitSearch}>
        <Search size={19} aria-hidden="true"/>
        <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
          maxLength={100} aria-label="搜索岗位、公司或工作地点"
          placeholder="搜索岗位、公司或工作地点"/>
        <button type="submit" aria-label="搜索职位"><span>搜索职位</span><ArrowRight size={17}/></button>
      </form>

      <section className="candidate-dashboard-profile" aria-labelledby="candidate-profile-title">
        <div className="candidate-dashboard-profile-top">
          <div className="candidate-dashboard-heading">
            <FileUser size={19} aria-hidden="true"/>
            <h2 id="candidate-profile-title">我的求职档案</h2>
          </div>
          <span className="candidate-dashboard-status">{profileStatus}</span>
        </div>
        <p>{!employerApiReady?'模拟账户可以先编辑个人资料与求职偏好；真实简历上传尚未开放。':
          hasProfile?'你的求职资料已建立，可继续查看与完善。':
          '上传或完善简历，之后可获得更符合个人能力的职位推荐。'}</p>
        {employerApiReady?
          <Link className="candidate-dashboard-profile-action"
            to={canManageProfile&&hasProfile?'/candidate/profile':'/candidate/resume/new'}>
            {hasProfile?'查看我的求职档案':'完善我的简历'} <ArrowRight size={15}/>
          </Link>:
          <Link className="candidate-dashboard-profile-action" to={demo?'/candidate/account/profile':'/candidate/register'}>{demo?'编辑演示资料':'创建模拟账户'} <ArrowRight size={15}/></Link>}
      </section>

      <div className="candidate-dashboard-quick-grid" aria-label="求职工具">
        <Link className="candidate-dashboard-quick" to="/candidate/saved"><BriefcaseBusiness size={20} aria-hidden="true"/><strong>我的收藏</strong><small>查看本设备已收藏的真实职位</small></Link>
        <Link className="candidate-dashboard-quick" to="/candidate/account"><UserRound size={20} aria-hidden="true"/><strong>个人中心</strong><small>管理收藏与访问统计隐私选项</small></Link>
        {employerApiReady?
          <Link className="candidate-dashboard-quick" to="/candidate/my-applications">
            <BriefcaseBusiness size={20} aria-hidden="true"/><strong>我的申请</strong>
            <small>查看申请记录与处理进度</small>
          </Link>:
          <div className="candidate-dashboard-quick candidate-dashboard-quick-muted">
            <BriefcaseBusiness size={20} aria-hidden="true"/><strong>我的申请</strong>
            <small>账户服务接入后开放</small>
          </div>}
        <Link className="candidate-dashboard-quick" to="/candidate/match">
          <Sparkles size={20} aria-hidden="true"/><strong>职位匹配</strong>
          <small>按简历与能力发现工作机会</small>
        </Link>
      </div>

      <section className="candidate-dashboard-openings" aria-labelledby="candidate-openings-title">
        <div className="candidate-dashboard-section-head">
          <h2 id="candidate-openings-title">适合探索的职位</h2>
          <Link to="/candidate/jobs">查看全部 <ArrowRight size={16}/></Link>
        </div>
        {jobsBusy?<p className="candidate-dashboard-job-state" role="status">正在读取真实招聘岗位…</p>:
         jobsError?<div className="candidate-dashboard-job-state" role="alert">
            <p>{jobsError}</p>
            <button type="button" onClick={()=>setReload(n=>n+1)}>重新加载职位</button>
          </div>:
         jobs.length?
          <div className="candidate-dashboard-job-list">
            {jobs.map(job=><Link className="candidate-dashboard-job" to={'/candidate/jobs/'+encodeURIComponent(job.id)} key={job.id}>
              <span className="candidate-dashboard-job-main">
                <strong>{localizedTitle(job,'zh')}</strong>
                <small>{localizedCompany(job,'zh')} <span aria-hidden="true">·</span> <MapPin size={13} aria-hidden="true"/>{localizedLocation(job,'zh')}
                  {job.remote===true?' · 远程':''}</small>
              </span>
              <span className="candidate-dashboard-job-action">查看岗位 <ArrowRight size={15}/></span>
            </Link>)}
          </div>:
          <p className="candidate-dashboard-job-state">暂时没有通过近期来源核验的职位。<Link to="/candidate/jobs">进入招聘市场搜索</Link></p>}
        <p className="candidate-dashboard-source-note">
          <UserRound size={14} aria-hidden="true"/>
          仅展示近期核验的官方招聘来源，是否仍可投递以企业官网为准。可直接浏览职位，无需先上传简历。
        </p>
        {asOf && <p className="candidate-dashboard-updated">岗位来源更新：{asOf.slice(0,10)}</p>}
      </section>
    </section>
  </Shell>;
}
