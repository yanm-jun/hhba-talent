// Development-only synthetic QA. Actual React matcher, dialog and host;
// only the network boundary and surrounding route contents are simulated.
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {MatchWorkspaceHost,MatchWorkspaceSlot,isMatchWorkspaceRoute} from '../src/components/MatchWorkspaceHost';
import {CandidateMatchPage} from '../src/pages/CandidateMatchPage';
import {navigate,useRoute,Link} from '../src/router';
import type {User} from '../src/services/api';
import '../src/styles.css';

const audit={requests:0,aborted:0,finished:0};
const profile={education:null,education_evidence:null,experience_years:2,experience_evidence:null,skills:[],target_roles:['运营督导'],warnings:[],summary:'虚构测试资料'};
let complete:((fail?:boolean)=>void)|undefined;
Object.assign(window,{qaAudit:audit,qaComplete:(fail=false)=>complete?.(fail)});
const realFetch=window.fetch.bind(window);
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
window.fetch=async (input,init)=>{
 const url=String(input);
 if(url==='/api/resumes')return reply({kind:'HHBA_PRIVATE_RESUME_VAULT_V1',items:[]});
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
function Harness(){
 const route=useRoute();const [session,setSession]=useState('a');
 return <MatchWorkspaceHost key={session} route={route} workspace={<CandidateMatchPage user={user} embedded={route!=='/candidate/match'} hosted hostRoute={route}/>}>
  <nav aria-label="QA navigation"><Link to="/">测试首页</Link> · <Link to="/companies/library">测试行业馆</Link> · <Link to="/candidate/account/match">测试工作台匹配</Link> · <Link to="/candidate/match">测试独立匹配</Link> · <button onClick={()=>{setSession('b');navigate('/');}}>模拟切换账户</button></nav>
  {isMatchWorkspaceRoute(route)?<main><MatchWorkspaceSlot/></main>:<main data-testid="current-route">{route}</main>}
 </MatchWorkspaceHost>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
