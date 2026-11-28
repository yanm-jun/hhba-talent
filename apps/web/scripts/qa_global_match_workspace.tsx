// Development-only synthetic QA. Actual React matcher, dialog and host;
// only the network boundary and surrounding route contents are simulated.
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {MatchWorkspaceHost,MatchWorkspaceSlot,isMatchWorkspaceRoute} from '../src/components/MatchWorkspaceHost';
import {CandidateMatchPage} from '../src/pages/CandidateMatchPage';
import {ReportFirstMatchExperience} from '../src/components/ReportFirstMatchExperience';
import type {MatchedJob,MatchProfile} from '../src/services/resumeMatch';
import {navigate,useRoute,Link} from '../src/router';
import type {User} from '../src/services/api';
import '../src/styles.css';

const audit={requests:0,aborted:0,finished:0};
const storedResumeId='11111111-1111-4111-8111-111111111111';
const storedResumeName='之前保存的简历.docx';
let storedBytes:Uint8Array|null=null;
let storedHash='';
let duplicateChecks=0,privateUploads=0;
const storedResume=()=>storedBytes?{id:storedResumeId,name:storedResumeName,
 type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 size:storedBytes.byteLength,createdAt:'2026-11-20T08:00:00.000Z'}:null;
Object.assign(window,{
 qaDuplicateAudit:()=>({checks:duplicateChecks,uploads:privateUploads}),
 qaEnableDuplicate:async(encoded:string)=>{
  const decoded=atob(encoded);
  storedBytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',storedBytes));
  storedHash=Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
  window.dispatchEvent(new Event('hhba:private-resumes-changed'));
 }
});
const profile={education:null,education_evidence:null,experience_years:2,experience_evidence:null,skills:[],target_roles:['运营督导'],warnings:[],summary:'虚构测试资料'};
let complete:((fail?:boolean)=>void)|undefined;
Object.assign(window,{qaAudit:audit,qaComplete:(fail=false)=>complete?.(fail)});
const realFetch=window.fetch.bind(window);
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
window.fetch=async (input,init)=>{
 const url=String(input);
 if(url==='/api/resumes/check'){
  duplicateChecks++;
  const check=JSON.parse(String(init?.body||'{}'));
  return reply({kind:'HHBA_PRIVATE_RESUME_DUPLICATE_CHECK_V1',
   existing:storedBytes&&check.sha256===storedHash&&check.size===storedBytes.byteLength?storedResume():null});
 }
 if(url==='/api/resumes'&&init?.method==='POST'){privateUploads++;return reply({error:'UNEXPECTED_PRIVATE_UPLOAD_IN_QA'},500);}
 if(url==='/api/resumes')return reply({kind:'HHBA_PRIVATE_RESUME_VAULT_V1',items:storedResume()?[storedResume()]:[]});
 if(url==='/api/resumes/'+storedResumeId+'/download'&&storedBytes){
  return new Response(new Uint8Array(storedBytes),{headers:{
   'Content-Type':'application/octet-stream','Content-Length':String(storedBytes.byteLength)}});
 }
 if(url.endsWith('/status')&&url.includes('/api/match'))return reply({kind:'HHBA_NATIVE_WEB_MATCH_V1',enabled:true});
 if(url.includes('/api/match')&&url.endsWith('/resume')){
  audit.requests++;
  return new Promise<Response>((resolve,reject)=>{
   const abort=()=>{audit.aborted++;complete=undefined;reject(new DOMException('Aborted','AbortError'));};
   init?.signal?.addEventListener('abort',abort,{once:true});
   complete=(fail=false)=>{
    init?.signal?.removeEventListener('abort',abort);complete=undefined;audit.finished++;
    resolve(fail?reply({error:'AI_PROVIDER_UPSTREAM_ERROR'},502):reply({status:'COMPLETE',profile,matches:[],disclaimer:'合成验收：原任务完成并保留结果',history_status:'EMPTY'}));
   };
  });
 }
 if(url.startsWith('/api/'))return reply({});
 return realFetch(input,init);
};
history.replaceState({},'', '/candidate/match');
localStorage.setItem('hhba_real_auth_token','SYNTHETIC_QA_ONLY');
const user={id:'synthetic-a',display_name:'测试',account_types:['candidate']} as unknown as User;
const malformedCompleteJob={
 official_url:'https://careers.example.test/job/1',company:'虚拟验收企业',title:'区域督导',location:'北京',
 report_status:'COMPLETE',reference_jd:'仅用于验收的 AI 参考岗位详情',
 reference_jd_basis:'根据岗位名称推断，非企业原文',reference_jd_kind:'AI_GENERATED_REFERENCE',
 match_score:82,research_detail:{
  score_explanation:'这份报告有有效的分析摘要，但其他字段可能被模型污染。',
  comparisons:[null,{status:'supported',requirement:'经营分析',analysis:'简历里有运营实例',resume_evidence:'区域督导'},
   {status:'supported',requirement:{object:'invalid'},analysis:'无效要求需忽略'},false],
  extra_sections:[null,{title:'面试准备',content:'准备真实运营案例'},{title:'不应显示',content:{bad:'object'}}],
  strengths:{bad:'object'},risks:['bad']
 }
} as unknown as MatchedJob;
const malformedIncompleteJob={
 official_url:'https://careers.example.test/job/2',company:'虚拟验收企业',title:'数据助理',location:'上海',
 report_status:'COMPLETE',reference_jd:{bad:'object'},
 research_detail:{score_explanation:{bad:'object'},comparisons:null}
} as unknown as MatchedJob;
const malformedProfile={summary:{invalid:'object'},skills:'unexpected-string',
 target_roles:[null,{not:'a role'},'职业转型']} as unknown as MatchProfile;
function Harness(){
 const route=useRoute();const [session,setSession]=useState('a');
 const [showMalformed,setShowMalformed]=useState(false);
 Object.assign(window,{qaShowMalformedReport:()=>setShowMalformed(true)});
 return <MatchWorkspaceHost key={session} route={route} workspace={<CandidateMatchPage user={user} embedded={route!=='/candidate/match'} hosted hostRoute={route}/>}>
  <nav aria-label="QA navigation"><Link to="/">测试首页</Link> · <Link to="/companies/library">测试行业馆</Link> · <Link to="/candidate/account/match">测试工作台匹配</Link> · <Link to="/candidate/match">测试独立匹配</Link> · <button onClick={()=>{setSession('b');navigate('/');}}>模拟切换账户</button></nav>
  {isMatchWorkspaceRoute(route)?<main><MatchWorkspaceSlot/></main>:<main data-testid="current-route">{route}</main>}
  {showMalformed&&<section data-testid="qa-malformed-report">
   <ReportFirstMatchExperience profile={malformedProfile} jobs={[malformedCompleteJob,malformedIncompleteJob]}
    officialJobs={[]} pending={true} progressStage="researching"/>
  </section>}
 </MatchWorkspaceHost>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
