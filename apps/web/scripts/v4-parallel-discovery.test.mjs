import test from 'node:test';
import assert from 'node:assert/strict';
import {runDiscoveryWave,nextDiscoveryWidth,combineDiscovery,discoveryLaneContext} from '../functions/_lib/v4-parallel-discovery.js';
import {v4Match} from '../functions/_lib/simple-match-v4.js';
const resume='本人负责汽车经销商渠道运营，区域销售督导、团队培训、销售数据分析、项目管理和客户服务。';
const profile={summary:'汽车经销商渠道运营',roles:['区域销售督导','运营管理'],skills:[],facts:[],education:null};
const job=i=>({url:'https://careers.employer'+i+'.cn/jobs/'+i,company:'企业'+i,title:'运营岗位'+i,location:'上海',source_kind:'employer_official'});
const model=(value,urls=[])=>new Response(JSON.stringify({status:'completed',output:[...(urls.length?[{type:'web_search_call',action:{query:'企业官网运营岗位',sources:urls.map(url=>({url}))}}]:[]),{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{headers:{'Content-Type':'application/json'}});
test('actual V4 discovery overlaps three provider calls, deduplicates and preserves all successful lanes',async()=>{
 const provider={key:'synthetic-only',baseUrl:'https://provider.invalid/v1',model:'test'};
 let inFlight=0,peak=0,calls=0;
 const fetcher=async(url,opts)=>{
  const payload=JSON.parse(opts.body),input=JSON.parse(payload.input);
  if(!payload.tools)return model({profile});
  calls++;inFlight++;peak=Math.max(peak,inFlight);
  await new Promise(r=>setTimeout(r,30));
  inFlight--;
  if(input.parallel_lane===2)return new Response('{}',{status:429});
  const jobs=input.parallel_lane?[job(1),job(2),job(3)]:[job(1),job(4)];
  return model({profile,jobs,research_complete:true,completion_reason:'test'},jobs.map(j=>j.url));
 };
 const first=await v4Match(fetcher,provider,resume,'',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true});
 const wave=await v4Match(fetcher,provider,resume,'',{curated:true,officialOnly:true,stepMode:true,parallelResearch:true,checkpoint:first.checkpoint});
 assert.equal(calls,3);assert.equal(peak,3);assert.equal(wave.status,'CONTINUE');
 assert.equal(wave.checkpoint.rows.length,4);assert.equal(wave.checkpoint.discoveryWidth,1);
 assert.equal(wave.checkpoint.diagnostics.PARALLEL_AI_PROVIDER_RATE_LIMITED,1);
 assert.ok(wave.checkpoint.rows.every(([,j])=>!j.match_score));
 assert.equal(wave.checkpoint.toolUrls.length,4);
});
test('coordinator failure retains authentic independent search data and does not mark completion',async()=>{
 const p=await runDiscoveryWave(async()=>{throw Object.assign(Error(),{code:'AI_PROVIDER_UPSTREAM_ERROR'})},async()=>({data:{jobs:[job(1)],research_complete:true,reviewed_sources:[{url:'untrusted'}]},sources:[job(1).url],response:{status:'completed',output:[{type:'web_search_call'}]}}),3);
 const lanes=p.independent.map(x=>x.value);
 const merged=combineDiscovery(null,lanes,{coordinatorFailed:true});
 assert.equal(merged.data.jobs.length,2);assert.equal(merged.data.research_complete,false);assert.equal(merged.data.reviewed_sources,undefined);assert.equal(merged.response.output.length,2);
});
test('width adapts to provider health, no job or search round cap; roles are diversity hints',()=>{
 assert.equal(nextDiscoveryWidth(3,[]),4);assert.equal(nextDiscoveryWidth(6,['AI_PROVIDER_RATE_LIMITED']),3);assert.equal(nextDiscoveryWidth(1,[]),2);
 assert.equal(discoveryLaneContext({profile:{target_roles:['运营','销售']},round:1,lane:2,width:3}).independent_direction_hint,'销售');
});
