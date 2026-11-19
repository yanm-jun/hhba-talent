// DEV-ONLY browser QA fixture. Vite's production build has one entry (index.html),
// so /qa/resume-flow.html is not deployed. Never use real credentials or CV data.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CandidateMatchNativeDialog} from '../src/components/CandidateMatchNativeDialog';
import type {MatchResponse} from '../src/services/resumeMatch';
import {REAL_AUTH_TOKEN_KEY} from '../src/services/realAuth';

const long=new URLSearchParams(location.search).has('long');
const sourceText=long?Array.from({length:12},(_,i)=>
 '第'+(i+1)+'段：在虚构的测试项目中记录运营流程与客户问题。'.repeat(18)
).join('\n\n'):'曾参与测试门店的运营记录整理与客户预约协调。\n\n独立整理每周工作进度并协助团队沟通。';
const mockJob={
 id:'qa-search-fixture-1',company:'虚构测试企业',title:'门店运营助理',
 title_zh:'门店运营助理',location:'中国大陆·上海',official_url:'https://example.test/jobs/qa',
 platform:'employer',source:'employer',remote:false,reference_score:68,match_score:68,
 matched:['日常运营记录'],not_evidenced:['流程分析'],needs_verification:[],
 requirements_basis:'要求真实的运营记录及沟通协作',score_basis:'已匹配运营基础能力',
 recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE' as const,
 availability_status:'UNKNOWN' as const,recommendation_reason:'示例推荐，不代表真实招聘'
};
const profile={
 education:null,education_evidence:null,experience_years:null,experience_evidence:null,
 skills:[],target_roles:['门店运营'],warnings:[]
};
const result:MatchResponse={status:'COMPLETE',profile,matches:[mockJob],
 matched_official_jobs:0,source:'qa-fixture',scoring:'test-only',privacy:'synthetic',
 disclaimer:'自动化测试用假公司和假岗位，绝不用于实际投递'};
if(import.meta.env.PROD)throw new Error('QA fixture must never be used in production');
window.localStorage.setItem(REAL_AUTH_TOKEN_KEY,'synthetic-browser-qa-token');
const original=window.fetch.bind(window);
const saved:Array<Record<string,unknown>>=[];
function respond(data:unknown,status=200){return Promise.resolve(new Response(JSON.stringify(data),
 {status,headers:{'Content-Type':'application/json'}}));}
window.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const u=new URL(url,location.origin),method=init?.method||'GET';
 if(u.pathname==='/api/resume-optimize'){
  if(method==='GET')return respond({kind:'HHBA_RESUME_OPTIMIZATION_V1',enabled:true,configured:true,
   per_account_daily_limit:3,global_daily_limit:50});
  const body=JSON.parse(String(init?.body||'{}'));
  if(!body.consent_ai)return respond({error:'CONSENT_REQUIRED'},400);
  const block=body.blocks[0];
  return respond({ok:true,kind:'HHBA_RESUME_OPTIMIZATION_V1',provider:'mock',
   suggestions:[{id:'qa-tip',blockId:block.id,action:'replace',original:block.text,
    proposed:block.text+'；同步整理每日服务记录。',rationale:'提升工作过程的清晰度',
    jobRequirement:'运营流程记录',evidenceStatus:'needs_user_confirmation'}]});
 }
 if(u.pathname==='/api/resume-reassess')
  return method==='GET'?respond({kind:'HHBA_RESUME_REASSESS_V2',enabled:false,
   ranking_version:'HHBA_MATCH_RANKING_V2',scope:'AUDITED_MAINLAND_ATS_ONLY'}):
   respond({error:'AUDITED_JOB_NOT_AVAILABLE'},422);
 if(u.pathname==='/api/official-job-verify')
  return method==='GET'?respond({kind:'HHBA_OFFICIAL_JOB_VERIFY_V1',enabled:false,
   daily_account_cap:4,scope:'STRICT_OFFICIAL_EMPLOYER_DETAIL_ONLY'}):
   respond({error:'OFFICIAL_URL_NOT_SUPPORTED'},422);
 if(u.pathname==='/api/resume-versions'){
  if(method==='GET')return respond({ok:true,items:saved});
  if(method==='POST'){
   const data=JSON.parse(String(init?.body||'{}'));
   if(!data.confirmed_real)return respond({error:'INVALID_VERSION'},400);
   saved.unshift({id:'qa-version-'+(saved.length+1),job_id:data.job_id,
    job_title:data.job_title,company:data.company,created_at:new Date().toISOString(),
    version:{blocks:data.blocks,acceptedSuggestionIds:data.accepted_ids,details:data.details}});
   return respond({ok:true,id:saved[0].id,created_at:saved[0].created_at},201);
  }
  if(method==='DELETE'){
   const id=u.searchParams.get('id'),index=saved.findIndex(x=>x.id===id);
   if(index>=0)saved.splice(index,1);
   return respond({ok:true,deleted:index>=0});
  }
 }
 return original(input,init);
}) as typeof window.fetch;
createRoot(document.getElementById('root')!).render(
 <CandidateMatchNativeDialog result={result} sourceText={sourceText} onClose={()=>{}}/>
);
