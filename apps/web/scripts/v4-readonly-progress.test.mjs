import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');

test('read-only job progress uses authenticated candidate session and active generation',()=>{
 assert.ok(route.includes("['/resume','/ocr','/progress'].includes(suffix)"));
 const entry=route.indexOf("if(suffix==='/progress'){");
 const end=route.indexOf("if(activeTaskRoute){",entry);
 assert.ok(entry>0&&end>entry);
 const block=route.slice(entry,end);
 assert.ok(block.includes('assertSessionTaskActive(env,session,body.task_id,body.generation)'));
 assert.ok(block.includes('researchTaskKey(env,session,task)'));
 assert.ok(block.includes('readMatchProgress(env,taskKey)'));
 assert.ok(block.includes('normalizeV4RecoveryView'));
 assert.ok(block.includes('pendingManagedView(env,{managed:true,taskKey}'));
 assert.ok(block.includes("return reply({status:'CHECK_DRIVER'})"));
 for(const unsafe of ['tryScheduleBackgroundMatch(','leaseMatchTask(','v4Match(','v4Provider(','saveMatchTask(','events(']){
  assert.ok(!block.includes(unsafe),'no mutations or AI calls in read-only endpoint: '+unsafe);
 }
 assert.ok(route.indexOf('sessionOfBearer(db,request,Date.now())')<entry);
 assert.ok(route.indexOf("candidate?.role!=='candidate'")<entry);
 assert.ok(route.indexOf("request.headers.get('Origin')!==origin")<entry);
 assert.ok(route.includes("suffix==='/progress'&&text.length>4096"));
});

test('routine polling omits resume text but recovers via original driver on errors or completion',()=>{
 assert.ok(client.includes("const route=readOnly?'/progress':'/resume'"));
 const start=client.indexOf('const requestBody=readOnly?');
 const end=client.indexOf('const response:Response=await fetch(EFFECTIVE_API+route',start);
 assert.ok(start>0&&end>start);
 const request=client.slice(start,end);
 const readOnlyPart=request.slice(0,request.indexOf(':\n   {resume_id:'));
 assert.ok(readOnlyPart.includes('task_id:task?.id'));
 assert.ok(readOnlyPart.includes('job_cursor:completedCursor'));
 assert.ok(readOnlyPart.includes('progress_stamp:lastDeliveryStamp'));
 assert.ok(!readOnlyPart.includes('text:cleaned'),'private CV never resent in routine poll');
 assert.ok(client.includes("readOnly&&data.status==='CHECK_DRIVER'"));
 assert.ok(client.includes('if(readOnly&&!response.ok)'));
 assert.ok(client.includes('if(!readOnly)checkDriverAt=Date.now()+30000'),'must periodically revalidate driver without disabling recovery');
 assert.ok(client.includes('progressOnly=false;checkDriverAt=0;await reconnect()'),'network reconnect resumes authoritative task');
 assert.ok(client.includes('liveCandidates.snapshot(completed.jobs)'),'independent completed JD deltas still merge into saved results');
 assert.ok(client.includes('if(data.status===\'FAILED\')throw new MatchError'),'terminal failures still stop client');
});

test('full progress reconnect and evidence revisions retain previously verified job delivery',()=>{
 const completed=readFileSync(new URL('../functions/_lib/v4-independent-job-delivery.js',import.meta.url),'utf8');
 assert.ok(completed.includes('saved.revision!==record.revision'));
 assert.ok(completed.includes('saved.source_url!==found.url'));
 assert.ok(completed.includes('read(env,taskKey)'),'only when completed jobs are found');
 assert.ok(completed.includes('v4CompactProgress(progress,body.progress_stamp)')===false,'view compaction must remain controlled by the authorized route');
});
