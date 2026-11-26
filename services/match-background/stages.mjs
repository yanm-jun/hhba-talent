// Dedicated Workflow instances for each stage; only opaque instance IDs.
export const STAGE_LANES=Object.freeze(['discovery','verification','reporting']);
export const validStageLane=v=>STAGE_LANES.includes(v);
export async function stageWorkflowId(instance,lane){
 if(!/^[a-f0-9]{64}$/.test(instance)||!validStageLane(lane))throw Error('INVALID_STAGE_INSTANCE');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('hhba:v4:stage-instance:'+instance+':'+lane));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
