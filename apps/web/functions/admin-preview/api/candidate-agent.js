// HHBA single-owner Agent Skills management API. ONLY standalone admin.hhba.work.
// Password cookie is checked again by the route, even behind root middleware.
import {verifyPasswordAdmin,authJson,authError,hasOrigin,isConsoleHost}
 from '../../_lib/console-password.js';
import {
 readAgentPolicy,changeAgentPolicy,readAnonymousAgentRunSummary
} from '../../_lib/candidate-agent-policy.js';

const error=(code,status=400)=>authError(code,status);
async function gate(request,env){
 if(!isConsoleHost(request)||env?.HHBA_ADMIN_CONSOLE_ENABLED!=='1')
   return {error:error('ADMIN_HOST_REQUIRED',403)};
 const identity=await verifyPasswordAdmin(request,env);
 if(!identity.ok)return {error:error(identity.code,identity.status)};
 if(typeof env?.HHBA_PNVS_AUTH_DB?.prepare!=='function')
   return {error:error('CANDIDATE_DATABASE_NOT_BOUND',503)};
 return {db:env.HHBA_PNVS_AUTH_DB};
}
export async function onRequestGet({request,env}){
 const access=await gate(request,env);
 if(access.error)return access.error;
 const params=new URL(request.url).searchParams;
 if([...params.keys()].some(k=>k!=='runs'))return error('INVALID_QUERY',400);
 const policy=await readAgentPolicy(access.db);
 if(!policy.configured)return error('AGENT_POLICY_NOT_READY',503);
 let runs=null,runDataStatus='not_requested';
 if(params.get('runs')==='1'){
  try{runs=await readAnonymousAgentRunSummary(access.db);runDataStatus='collected';}
  catch{runDataStatus='unavailable';}
 }else if(params.has('runs'))return error('INVALID_QUERY',400);
 return authJson({ok:true,kind:'HHBA_ADMIN_AGENT_POLICY_V1',policy,
  runtime_notice:'管理后台的配置仅为许可：正式求职服务还需独立环境开关、模型密钥与用户授权。',
  run_data_status:runDataStatus,runs});
}
export async function onRequestPost({request,env}){
 const access=await gate(request,env);
 if(access.error)return access.error;
 if(!hasOrigin(request)||request.headers.get('X-HHBA-AGENT-ADMIN')!=='1')
   return error('ORIGIN_REQUIRED',403);
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>1500)return error('BODY_TOO_LARGE',413);
 let payload;
 try{
  const body=await request.text();
  if(body.length>1500)throw Error('BODY_TOO_LARGE');
  payload=JSON.parse(body);
 }catch{return error('INVALID_REQUEST',400);}
 try{
  const policy=await changeAgentPolicy(access.db,payload);
  return authJson({ok:true,kind:'HHBA_ADMIN_AGENT_POLICY_V1',policy});
 }catch(e){
  const code=e?.message;
  if(code==='AGENT_POLICY_INVALID')return error(code,400);
  if(code==='AGENT_POLICY_CONFLICT')return error(code,409);
  // Treat failed auditing as an operational block, never claim success.
  console.warn('HHBA_AGENT_POLICY_SAVE_FAILED',
   code==='AGENT_POLICY_AUDIT_FAILED'?'AUDIT_UNAVAILABLE':'DB_UNAVAILABLE');
  return error('AGENT_POLICY_WRITE_UNAVAILABLE',503);
 }
}
export async function onRequest({request,...context}){
 if(request.method==='GET')return onRequestGet({request,...context});
 if(request.method==='POST')return onRequestPost({request,...context});
 return error('METHOD_NOT_ALLOWED',405);
}
