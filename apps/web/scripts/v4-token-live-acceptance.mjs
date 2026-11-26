// Live synthetic test only. No real job/person data, no secrets, no model output logged.
import {v4Provider,v4Call,v4ParseJson} from '../functions/_lib/simple-match-v4.js';
import {batchScoringPayload,collectBatchAssessments} from '../functions/_lib/v4-batch-scoring.js';
const provider=v4Provider(process.env);
if(!provider){console.log('HHBA_TOKEN_LIVE_QA: NOT_CONFIGURED');process.exitCode=2;}
else {
 const resume='虚构测试：负责门店日常运营，使用 Excel 汇总每周销售数据。协助培训新人。';
 const items=[{id:'a',job:{company:'虚构公司甲',title:'运营',location:'上海',full_jd:'负责销售数据汇总，熟悉 Excel。'}},{id:'b',job:{company:'虚构公司乙',title:'培训',location:'上海',full_jd:'负责新员工培训，记录培训反馈。'}}];
 const all=[];
 try{
  for(const group of [[items[0]],[items[1]],items]){
   const payload=batchScoringPayload(group,resume,'运营');
   // This fixture is fictional; no web lookup is useful or appropriate.
   delete payload.tools;delete payload.tool_choice;delete payload.include;
   let requestedEffort;
   const r=await v4Call(async(url,opts)=>{requestedEffort=JSON.parse(opts.body).reasoning?.effort;return fetch(url,opts);},provider,payload,{stage:'score'});
   const accepted=r.status==='completed'?collectBatchAssessments(v4ParseJson(r),group,resume):new Map();
   const u=r.usage;
   const valid=Number.isSafeInteger(u?.input_tokens)&&Number.isSafeInteger(u?.output_tokens)&&Number.isSafeInteger(u?.total_tokens);
   console.log(JSON.stringify({fixture:'synthetic',batch_size:group.length,requested_effort:requestedEffort,accepted:accepted.size,usage_present:valid,input_tokens:valid?u.input_tokens:null,output_tokens:valid?u.output_tokens:null,total_tokens:valid?u.total_tokens:null}));
   if(requestedEffort!=='medium'||accepted.size!==group.length||!valid)throw Error('QA_LIVE_TOKEN_VALIDATION_FAILED');
   all.push(u);
  }
  console.log(JSON.stringify({status:'PASS_SYNTHETIC',single_total:all[0].total_tokens+all[1].total_tokens,batch_total:all[2].total_tokens,single_input:all[0].input_tokens+all[1].input_tokens,batch_input:all[2].input_tokens,scope:'TWO_SYNTHETIC_JDS_NOT_PRODUCTION_500'}));
 }catch(e){const code=String(e?.code||e?.message||'');console.log('HHBA_TOKEN_LIVE_QA: '+(/^(?:AI_|QA_)[A-Z0-9_]+$/.test(code)?code:'UNEXPECTED_ERROR'));process.exitCode=1;}
}
