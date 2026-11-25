// One synthetic, real-provider acceptance on the designated preview branch.
 // No applicant data, credential, source URL or model output is logged.
 // The 300s deadline is the test's SLA, not an application/model limit.
import {v4Match,v4JobProvider} from '../functions/_lib/simple-match-v4.js';
import {qualifiedReport} from '../functions/_lib/v4-curated-reports.js';
const label='HHBA_V4_JOINT_LIVE_QA=';
const provider=v4JobProvider(process.env);
if(!provider||provider.kind==='gemini'||process.env.HHBA_V4_JOB_PROVIDER!=='openai'){
 console.log(label+JSON.stringify({status:'BLOCKED_OPENAI_CONFIGURATION'}));process.exit(1);
}
const started=Date.now(),deadline=300000,controller=new AbortController();
let discovered=0,concrete=0,completed=0,steps=0,requests=0,modelRequests=0,peakStepRequests=0,stepRequests=0,firstReportMs=null,phase='preparing',final=null,reported=false;
const timings={};
const mark=p=>{if(!Object.hasOwn(timings,p))timings[p]=Date.now()-started;phase=p;};
const emit=(status,extra={})=>{
 if(reported)return;reported=true;
 console.log(label+JSON.stringify({status,execution:'node_preview_build_not_worker_runtime',provider:'openai',elapsed_ms:Date.now()-started,phase,discovered,concrete,completed_reports:completed,first_report_ms:firstReportMs,steps,requests,model_requests:modelRequests,peak_step_fetch_requests:peakStepRequests,phase_first_seen_ms:timings,...extra}));
};
const timeout=setTimeout(()=>{controller.abort();emit('TARGET_TIMEOUT');process.exit(1);},deadline);
const resume='合成测试简历：负责汽车经销商渠道运营、区域销售督导、团队培训、销售数据分析、项目管理和客户服务；参与门店流程优化与跨区域协作。';
const fetcher=async(url,opts)=>{
 requests++;stepRequests++;peakStepRequests=Math.max(peakStepRequests,stepRequests);
 if(String(url).endsWith('/responses'))modelRequests++;
 return fetch(url,{...opts,signal:opts?.signal?AbortSignal.any([opts.signal,controller.signal]):controller.signal});
};
const opts={signal:controller.signal,env:{HHBA_MATCH_V4_READY:'1'},curated:true,officialOnly:true,stepMode:true,parallelResearch:true,
 onProgress:mark,onResearch:r=>{discovered=Math.max(discovered,r?.discovered||0);concrete=Math.max(concrete,r?.concrete_count||0);},
 onPartial:jobs=>{const count=jobs.filter(qualifiedReport).length;completed=Math.max(completed,count);if(count&&firstReportMs===null)firstReportMs=Date.now()-started;}};
try{
 let checkpoint=null;
 do{
  stepRequests=0;steps++;
  final=await v4Match(fetcher,provider,resume,'中国大陆，全国；区域销售督导、汽车渠道运营及相关运营岗位',{...opts,checkpoint});
  checkpoint=final.checkpoint;
  if(checkpoint){discovered=Math.max(discovered,checkpoint.rows?.length||0);const n=(checkpoint.matches||checkpoint.priorState?.matches||[]).filter(qualifiedReport).length;completed=Math.max(completed,n);if(n&&firstReportMs===null)firstReportMs=Date.now()-started;}
 }while(final.status==='CONTINUE');
 const jobs=final.matches||[],stats=final.research_report||{};
 discovered=Math.max(discovered,stats.discovered||0);concrete=Math.max(concrete,stats.concrete_count||0);completed=jobs.length;
 const quality=jobs.every(j=>qualifiedReport(j)&&j.research_detail?.comparisons?.length>0);
 const passed=final.status==='COMPLETE'&&final.native_search?.stage==='complete'&&concrete>=500&&jobs.length===50&&quality&&Date.now()-started<=deadline;
 emit(passed?'PASS':'INCOMPLETE',{final_reports:jobs.length,structural_quality_passed:quality,worker_pressure_verified:false,native_stage:final.native_search?.stage||null});
 if(!passed)process.exitCode=1;
}catch(e){emit(controller.signal.aborted?'TARGET_TIMEOUT':'ERROR',{error_code:typeof e?.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'JOINT_QA_FAILED'});process.exitCode=1;}
finally{clearTimeout(timeout);}
