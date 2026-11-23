import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeDeepSearchInstructions,nativeDeepSearchSources,
 groundedNativeJobAnswer,runNativeDeepSearchJobs,NATIVE_DEEPSEARCH_VERSION}
 from '../functions/_lib/native-deepsearch-job-research.js';

const OFFICIAL='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const FOREIGN='https://job-boards.greenhouse.io/example/jobs/1234567';
const BOARD='https://www.zhipin.com/job_detail/1234567';
const INVENTED='https://careers.invented-company.cn/jobs/not-in-search';
const sourceItem={type:'web_search_call',id:'deep-1',status:'completed',kind:'deep_search',
 action:{type:'search',queries:['上海 区域督导 企业官方招聘'],
 sources:[
  {type:'url',url:OFFICIAL,title:'腾讯 销售运营主管 上海 社会招聘',
   site_name:'腾讯招聘',snippet:'工作地点上海；岗位职责包括销售运营、渠道管理，要求数据分析能力。'},
  {type:'url',url:FOREIGN,title:'Regional supervisor Shanghai',site_name:'Jobs'},
  {type:'url',url:BOARD,title:'区域督导岗位',site_name:'招聘平台'}
 ]}};
const row=(url=OFFICIAL)=>({company:'腾讯',title:'销售运营主管',location:'上海',
 reason:'简历有汽车门店销售管理和运营数据复盘的真实经历，工作地点上海符合意向，仍需要核对岗位最低工作年限和行业要求。',
 job_basis:'负责业务运营、渠道分析及合作团队协作；至少需要核对年限及技术要求。',
 score_basis:'简历里有销售漏斗管理和门店运营经历，对照职位职责相关，尚需核对具体年限。',
 match_score:84,url});
const modelResponse=(jobs=[row()])=>({
 status:'completed',output:[sourceItem,
  {type:'web_search_call',id:'deep-2',status:'completed',kind:'deep_search',
   action:{type:'open_page',url:OFFICIAL},page:{url:OFFICIAL,title:'腾讯招聘'}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs})}]}],
 usage:{server_tool_use:{tool_search:3,tool_fetch:2}}
});
const asSse=(messages)=>new Response(messages.map(({type,...rest})=>
 'event: '+type+'\ndata: '+JSON.stringify({type,...rest})+'\n\n').join(''),{
 headers:{'Content-Type':'text/event-stream'},status:200});

test('native deep research uses official DeepSeek Flash high-thinking web tools and honors geographic expansion',()=>{
 const prompt=nativeDeepSearchInstructions(10);
 assert.match(prompt,/上海/);assert.match(prompt,/苏州/);
 assert.match(prompt,/全国/);assert.match(prompt,/简历/);
 assert.match(prompt,/Greenhouse/);assert.match(prompt,/不许.*杜撰/);
});

test('only completed native provider search sources are eligible, not the model or an open-page URL by itself',()=>{
 const fake={type:'web_search_call',status:'completed',kind:'deep_search',
  action:{type:'open_page',url:INVENTED},page:{url:INVENTED}};
 assert.deepEqual(nativeDeepSearchSources([fake]),[]);
 assert.deepEqual(nativeDeepSearchSources([sourceItem]).map(x=>x.url),[OFFICIAL]);
 const parsed=groundedNativeJobAnswer(modelResponse([row(),row(INVENTED),
  row(FOREIGN),row(BOARD)]),10);
 assert.deepEqual(parsed.matches.map(x=>x.official_url),[OFFICIAL]);
 assert.equal(parsed.matches[0].match_score,null,'model score never replaces independent JD/evidence score');
 assert.equal(parsed.matches[0].source_status,'SOURCE_SEARCH_PREVIEW');
 assert.equal(parsed.matches[0].research_anchor.url,OFFICIAL);
 assert.equal(parsed.matches[0].jd_source_status,undefined);
});

test('a real streaming native deep-search session forwards tool progress and source leads but not raw CV or fake links',async()=>{
 const stages=[],activity=[],leads=[];
 const response=modelResponse([row(),row(INVENTED)]);
 const sse=asSse([
  {type:'response.created',response:{status:'in_progress'}},
  {type:'response.web_search_call.searching',output_index:0},
  {type:'response.output_item.done',item:sourceItem},
  {type:'response.output_item.done',item:response.output[1]},
  {type:'response.completed',response}
 ]);
 const result=await runNativeDeepSearchJobs('test-key',
  '已脱敏的门店运营简历，善于渠道督导和销售数据分析。','区域督导',10,{
   onProgress:x=>stages.push(x),
   onActivity:x=>activity.push(x),
   onSources:(jobs,closed,urls)=>leads.push({jobs,closed,urls})
  },{
   fetcher:async(url,req)=>{
    assert.equal(url,'https://api.deepseek.com/responses');
    const payload=JSON.parse(req.body);
    assert.equal(payload.model,'deepseek-flash');
    assert.deepEqual(payload.reasoning,{effort:'high'});
    assert.deepEqual(payload.tools,[{type:'deepseek_web_search'},{type:'deepseek_read_url'}]);
    assert.equal(payload.stream,true);
    assert.deepEqual(payload.safety_check,{level:'high'});
    assert.ok(payload.input.includes('区域督导'));
    return sse;
   }
  });
 assert.equal(result.diagnostic.mode,NATIVE_DEEPSEARCH_VERSION);
 assert.equal(result.diagnostic.searches,3);
 assert.equal(result.diagnostic.page_reads,2);
 assert.equal(result.diagnostic.provider_items,1,'only mainland employer sources counted');
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,OFFICIAL);
 assert.equal(result.matches[0].match_score,null);
 assert.ok(stages.includes('searching')&&stages.includes('reading')&&stages.includes('writing'));
 assert.deepEqual(leads.map(x=>x.urls),[[OFFICIAL]]);
 assert.ok(activity.every(x=>!JSON.stringify(x).includes('已脱敏的门店运营简历')));
});

test('missing native Search calls or a provider failure cannot present model-invented job links',async()=>{
 const noSearch={status:'completed',
  output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({jobs:[row()]})}]}],
  usage:{server_tool_use:{tool_search:0,tool_fetch:0}}};
 await assert.rejects(runNativeDeepSearchJobs('test-key','简历','督导',10,{},{
  fetcher:async()=>asSse([{type:'response.completed',response:noSearch}])
 }),e=>e.code==='AI_EMPLOYER_JOBS_NOT_FOUND');
 await assert.rejects(runNativeDeepSearchJobs('test-key','简历','督导',10,{},{
  fetcher:async()=>asSse([{type:'response.failed',response:{status:'failed',error:{code:'server_error'}}}])
 }),e=>e.code==='AI_NATIVE_DEEPSEARCH_FAILED');
});

test('native deep-search selectable in same UI and safely wired into authenticated existing JD/history pipeline',()=>{
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const transport=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(route,/runNativeDeepSearchJobs/);
 assert.match(route,/options\.search_engine==='deepseek_native'/);
 assert.match(route,/createMatchJdReview/);
 assert.match(route,/domesticResearchPass/);
 assert.match(route,/withSavedHistory/);
 assert.match(route,/EXPLICIT_AI_SHARING_CONSENT_REQUIRED/);
 assert.match(page,/DeepSeek 原生深度搜索 · 试用/);
 assert.match(transport,/search_engine:opts\.search_engine/);
 assert.match(route,/HHBA_DEEPSEEK_NATIVE_TRIAL_ENABLED/);
});
