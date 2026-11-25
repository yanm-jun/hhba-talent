import test from 'node:test';
import assert from 'node:assert/strict';
import {v4AcceptResearchDigest,v4RunResearchAction,v4StageResearchCall} from '../functions/_lib/v4-research-tools.js';
import {readPublicHtmlResearch,unchangedPublicHtmlResearch,writePublicHtmlResearch} from '../functions/_lib/v4-public-html-research-cache.js';
import {makeBatchScorer} from '../functions/_lib/v4-batch-scoring.js';
const url='https://careers.company.cn/jobs/123',proof='https://www.company.cn/careers';
const reply=value=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const parse=r=>JSON.parse(r.output[0].content[0].text);
test('compact digest is model supplied, smaller and never replaces original notes',()=>{
 const notes=['招聘证据及待核验事项'.repeat(100)];
 const original=[...notes];
 assert.equal(v4AcceptResearchDigest({research_digest:'已核验来源1，待核验来源2'},'',notes),'已核验来源1，待核验来源2');
 assert.equal(v4AcceptResearchDigest({},'older digest',notes),'');
 assert.equal(v4AcceptResearchDigest({research_digest:notes[0]},'',notes),'');
 assert.deepEqual(notes,original);
});
test('stage digest reduces repeated notes without losing original notes or JD',async()=>{
 const old='已核验公开来源，原始证据仍然保留。'.repeat(150);
 const digest='来源已核验；继续读取岗位正文。';
 const notes=[old],inputs=[];
 const call=async payload=>{
  inputs.push(JSON.parse(payload.input));
  return inputs.length===1?reply({research_digest:digest,research_action:{type:'memory',collection:'notes',cursor:0}}):reply({score:80});
 };
 const result=await v4StageResearchCall(call,{instructions:'研究岗位',input:JSON.stringify({resume_text:'真实简历',job:{full_jd:'完整岗位正文'}})},{parse,resume:'真实简历',jd:'完整岗位正文',taskNotes:notes});
 assert.equal(parse(result).score,80);
 assert.equal(inputs[1].research_digest,digest);
 assert.deepEqual(inputs[1].research_notes,[]);
 assert.equal(inputs[1].job.full_jd,'完整岗位正文');
 assert.ok(JSON.stringify(inputs[1].research_tool_results).includes(old));
 assert.deepEqual(notes,[old]);
});
test('reuse complete static evidence within task; explicit refresh bypasses it',async()=>{
 let calls=0;
 const ledger=[{type:'read_page',mode:'static',url,offset:0,next_offset:null,text:'原始完整正文'}];
 const fetcher=async()=>{calls++;throw Error('network')};
 const opts={collections:{},knownUrls:new Set([url]),ledger,fetcher,budget:256};
 const result=await v4RunResearchAction({type:'read_page',url},opts);
 assert.equal(result.reused_task_evidence,true);assert.equal(result.text,'原始完整正文');assert.equal(calls,0);
 const fresh=await v4RunResearchAction({type:'read_page',url,refresh:true},opts);
 assert.equal(fresh.ok,false);assert.equal(calls,1);
});
test('public HTML cache contains only public verified metadata and rejects any document change',async()=>{
 const storage=new Map();
 const bucket={async put(k,v){storage.set(k,v)},async get(k){return storage.has(k)?{text:async()=>storage.get(k)}:null}};
 const doc={url,plain:'招聘正文开始\n岗位职责及任职要求\n招聘正文结束'};
 const jd={canonical_url:url,company:'公司',title:'运营',location:'北京',full_jd:'岗位职责及任职要求',requirements:'岗位职责及任职要求',proof_method:'V4_EMPLOYER_HTML_JOB',source_confirmed:true,independently_read:true,employer_proof_url:proof,employer_proof_urls:[proof],resume_text:'PRIVATE RESUME',score:88};
 assert.equal(await writePublicHtmlResearch(bucket,doc,jd),true);
 const record=await readPublicHtmlResearch(bucket,url);
 assert.ok(record);
 assert.ok(!JSON.stringify(record).includes('PRIVATE RESUME'));
 assert.equal(record.score,undefined);
 assert.equal(await unchangedPublicHtmlResearch(record,doc),true);
 assert.equal(await unchangedPublicHtmlResearch(record,{...doc,plain:doc.plain+'\n已停止招聘'}),false);
 assert.equal(await unchangedPublicHtmlResearch(record,{...doc,url:proof}),false);
 assert.equal(await writePublicHtmlResearch(bucket,doc,{...jd,source_confirmed:false}),false);
});
test('batch scoring shares one resume and preserves independent fallback',async()=>{
 const resume='真实简历经历',a='甲岗位职责',b='乙岗位职责';let calls=0;
 const scorer=makeBatchScorer({resume,roleHint:'运营',delay:0,parse,call:async payload=>{
  calls++;const input=JSON.parse(payload.input);
  assert.equal(input.resume_text,resume);assert.equal(input.jobs.length,2);
  assert.equal(input.jobs[0].full_jd,a);assert.equal(input.jobs[1].full_jd,b);
  return reply({assessments:[{id:'a',score:83,suitable:true,reason:'真实证据',resume_quote:resume,jd_quote:a},{id:'b',score:80,suitable:true,reason:'错误引文',resume_quote:resume,jd_quote:a}]});
 }});
 const [one,two]=await Promise.all([scorer('a',{full_jd:a}),scorer('b',{full_jd:b})]);
 assert.equal(calls,1);assert.equal(one.score,83);assert.equal(two,null);
});
