// Stage scheduling only: immutable snapshots and a single private checkpoint.
// Stage Workflows never receive a resume, URL, user identity or AI response.
// The existing D1 task lease remains the serialization/fencing authority.
import {pendingVerification} from './v4-research-pipeline.js';
import {eligibleCuratedScore,qualifiedReport} from './v4-curated-reports.js';
import {sha256Hex} from './real-auth.js';
export const STAGE_LANES=Object.freeze(['discovery','verification','reporting']);
export const isV4StageLane=v=>STAGE_LANES.includes(v);
export const stagedV4WorkflowsEnabled=env=>env?.HHBA_V4_STAGE_WORKFLOWS==='1'&&typeof env?.HHBA_MATCH_BACKGROUND?.fetch==='function';
export function v4CheckpointLane(cp){
 if(cp?.phase==='verification')return 'verification';
 if(cp?.phase==='reporting')return 'reporting';
 if(cp?.phase==='research'&&!cp.backfillSignature&&cp.liveDeliveryTurn!=='search'){
  const pending=pendingVerification(cp).length>0;
  const earlier=cp.priorState?.matches||[];
  const reports=earlier.some(j=>eligibleCuratedScore(j)&&!qualifiedReport(j)&&(!j.report_status||j.report_status==='RETRY_PENDING'));
  if(pending||reports)return 'verification';
 }
 return 'discovery';
}
export async function stageWorkflowSignal(env,ticket,{lane,finish=false}={}){
 if((!finish&&!stagedV4WorkflowsEnabled(env)||finish&&typeof env?.HHBA_MATCH_BACKGROUND?.fetch!=='function')||typeof ticket!=='string'||! /^[a-f0-9]{64}$/.test(ticket)||!finish&&!isV4StageLane(lane))return false;
 const instance=await sha256Hex('hhba-workflow-instance:'+ticket);
 try{
  const result=await env.HHBA_MATCH_BACKGROUND.fetch('https://hhba-internal.invalid/'+(finish?'finish':'wake'),{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instance,...(!finish?{lane}:{})})
  });
  if(!result.ok)return false;
  return (await result.json().catch(()=>null))?.ok===true;
 }catch{console.warn('HHBA_V4_STAGE_SIGNAL_UNAVAILABLE');return false;}
}
