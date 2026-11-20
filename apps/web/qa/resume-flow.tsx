// DEV-ONLY browser QA fixture. Vite's production build has one entry (index.html),
// so /qa/resume-flow.html is not deployed. Never use real credentials or CV data.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CandidateMatchNativeDialog} from '../src/components/CandidateMatchNativeDialog';
import type {MatchResponse} from '../src/services/resumeMatch';
import {REAL_AUTH_TOKEN_KEY} from '../src/services/realAuth';
import type {PrivateResume} from '../src/services/privateResumes';

const nativeWord=new URLSearchParams(location.search).has('word');
const scoringFixture=new URLSearchParams(location.search).has('score');
const fullWriterQA=new URLSearchParams(location.search).has('full');
const long=new URLSearchParams(location.search).has('long');
const truncated=new URLSearchParams(location.search).has('truncated');
const sourceText=nativeWord&&fullWriterQA?
 'ORIGINAL WORD RESUME'+Array.from({length:8},(_,i)=>
  '\n\n虚构经历段落'+(i+1)+'：实际参与门店运营记录和日常业务协作。').join(''):
 nativeWord?'ORIGINAL WORD RESUME':truncated?'这是完全虚构的超长简历测试文字，不能把丢失的内容导出成完整简历。'.repeat(1200):long?Array.from({length:12},(_,i)=>
 '第'+(i+1)+'段：在虚构的测试项目中记录运营流程与客户问题。'.repeat(18)
).join('\n\n'):'曾参与测试门店的运营记录整理与客户预约协调。\n\n独立整理每周工作进度并协助团队沟通。';
const mockJob={
 id:scoringFixture?'lever-qa-synthetic':'qa-search-fixture-1',
 company:'虚构测试企业',title:'门店运营助理',
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
const nativeResume:PrivateResume={id:'11111111-2222-4333-8444-555555555555',
 name:'虚构原样式简历.docx',
 type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 size:2048,createdAt:'2026-11-20T00:00:00Z'};
const wordRevisions=['ORIGINAL WORD RESUME'];
let wordRevision=0;
function pdfFor(text:string){
 const stream='BT /F1 18 Tf 45 760 Td ('+text.replace(/[()\\]/g,'')+') Tj ET';
 const parts=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'
 ];
 let out='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<parts.length;i++){offsets.push(out.length);out+=(i+1)+' 0 obj\n'+parts[i]+'\nendobj\n';}
 const pointer=out.length;out+='xref\n0 6\n0000000000 65535 f \n';
 for(const start of offsets.slice(1))out+=String(start).padStart(10,'0')+' 00000 n \n';
 return new TextEncoder().encode(out+'trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n'+pointer+'\n%%EOF');
}
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
 if(u.pathname==='/api/resume-word'&&nativeWord){
  const action=u.searchParams.get('action');
  if(method==='POST'){
   const payload=JSON.parse(String(init?.body||'{}'));
   if(payload.expected_revision!==wordRevision)
    return respond({ok:false,error:'WORD_REVISION_CONFLICT'},409);
   if(payload.action==='edit'){
    if(payload.original!==wordRevisions[wordRevision])
     return respond({ok:false,error:'WORD_EDIT_AMBIGUOUS'},422);
    wordRevisions.splice(wordRevision+1);wordRevisions.push(payload.text);wordRevision++;
   }else wordRevision+=payload.action==='undo'?-1:1;
   return respond({ok:true,saved:wordRevision>0,revision:wordRevision,
    total_revisions:wordRevisions.length-1,page_count:1});
  }
  if(action==='status')return respond({ok:true,enabled:true});
  if(action==='inspect')return respond({ok:true,revision:wordRevision,
   total_revisions:wordRevisions.length-1,max_revisions:8,
   editable_text:[wordRevisions[wordRevision]],
   history:wordRevisions.slice(1).map((text,i)=>({
    revision:i+1,original:wordRevisions[i],text,
    updated_at:'2026-11-20T00:00:00Z',page_count:1
   })),
   saved:wordRevision?{original:wordRevisions[wordRevision-1],
    text:wordRevisions[wordRevision],updated_at:'2026-11-20T00:00:00Z'}:null});
  if(action==='preview'||action==='edited-preview'||action==='download-pdf'){
   const bytes=pdfFor(action==='preview'?wordRevisions[0]:wordRevisions[wordRevision]);
   return Promise.resolve(new Response(bytes,{status:200,
    headers:{'Content-Type':'application/pdf'}}));
  }
 }
 if(u.pathname==='/api/resume-rewrite'){
  if(method==='GET')return respond({ok:true,kind:'HHBA_WHOLE_RESUME_REWRITE_V1',
   enabled:true,configured:true,mode:'full_document_draft',requires_user_approval:true});
  const input=JSON.parse(String(init?.body||'{}'));
  if(!input.consent_ai)return respond({error:'AI_CONSENT_REQUIRED'},400);
  const rewritten=input.blocks.map((b:{id:string;section:string;text:string})=>({
   blockId:b.id,section:b.section,original:b.text,
   proposed:b.text==='ORIGINAL WORD RESUME'?'REWRITTEN WORD RESUME':
    b.text+' 已明确工作过程与业务协作。',
   changed:true,evidenceQuotes:[b.text.slice(0,Math.min(20,b.text.length))],
   rationale:'合成岗位定向改写，仅用于本地测试。',
   jobRequirements:['运营过程记录'],
   status:'needs_user_confirmation'
  }));
  return respond({ok:true,kind:'HHBA_WHOLE_RESUME_REWRITE_V1',
   provider:'synthetic-mock',reviewer:'synthetic-review',
   autonomy:{enabled:true,rounds:3,stop_reason:'model_finished',needs_more_work:false,
    tools_used:[
     {action:'inspect_source',sections:[input.blocks[0].id],accepted:1},
     {action:'rewrite_sections',sections:[input.blocks[0].id],accepted:1},
     {action:'finish',sections:[],accepted:0}
    ]},
   blocks:rewritten,
   recommended_order:input.blocks.map((b:{id:string})=>b.id).reverse(),
   questions:[{
    blockId:input.blocks[0].id,question:'是否参与过跨区域门店支持？请提供真实范围。',
    reason:'原简历尚未提供相关事实。',status:'user_input_needed'
   }],warnings:[],
   coverage:{source_blocks:input.blocks.length,analyzed_blocks:rewritten.length,
    proposed_rewrites:rewritten.length,held_for_review:0},
   disclaimer:'合成 QA 测试，不代表真实岗位或用户'});
 }
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
 if(u.pathname==='/api/resume-reassess'){
  if(method==='GET')return respond({kind:'HHBA_RESUME_REASSESS_V2',enabled:scoringFixture,
   ranking_version:'HHBA_MATCH_RANKING_V2',scope:'AUDITED_MAINLAND_ATS_ONLY'});
  if(!scoringFixture)return respond({error:'AUDITED_JOB_NOT_AVAILABLE'},422);
  const body=JSON.parse(String(init?.body||'{}'));
  const oldText=body.before_blocks?.map((x:{text:string})=>x.text).join(' ');
  const savedText=body.after_blocks?.map((x:{text:string})=>x.text).join(' ');
  if(oldText!=='ORIGINAL WORD RESUME'||savedText!==wordRevisions[wordRevision]||
   wordRevision<1||!body.confirm_real||!body.consent_reassessment)
   return respond({error:'INVALID_REASSESSMENT_INPUT'},400);
  return respond({ok:true,kind:'HHBA_RESUME_REASSESS_V2',
   job_id:'lever-qa-synthetic',verified_job_title:'门店运营助理',
   verified_company:'虚构测试企业',job_snapshot_updated_at:'2026-11-20',
   ranking_version:'HHBA_MATCH_RANKING_V2',supported:true,
   original_score:68,updated_score:70,delta:2,
   important_notice:'此评分为自动化验收的虚构结果，不代表真实职位'});
 }
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
 <CandidateMatchNativeDialog result={result} sourceText={sourceText}
  sourceResume={nativeWord?nativeResume:undefined}
  accountScope={nativeWord?'qa-user':undefined}
  onClose={()=>{}}/>
);
