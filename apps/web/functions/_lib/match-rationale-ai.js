// One optional, bounded batch explanation call for already-ranked domestic jobs.
// The model cannot invent a resume fact, rank jobs or change eligibility.
// No raw resume, name, contact information or user ID is sent to this call.
import {relevantWorkEvidence} from './resume-work-evidence.js';

const safeText=(x,max=100)=>typeof x==='string'?x.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';
const UNPROVEN=/(?:保证录用|录用成功率|百分百|100%|一定能|肯定能|完全胜任|绝对适合|已经担任|拥有\d+年|独立主导|独立负责|精通|领先于|完美符合|无需面试)/i;
function candidateEvidence(profile,matches){
 const quotes=Array.isArray(profile?.work_evidence)?profile.work_evidence:[];
 return (Array.isArray(matches)?matches:[]).slice(0,10).map(job=>({
  id:safeText(job.id,180),title:safeText(job.title,95),
  related:relevantWorkEvidence(quotes,job,2),
  skills:(Array.isArray(job.required_skills)?job.required_skills:[])
   .filter(x=>typeof x==='string').map(x=>safeText(x,35)).slice(0,5)
 })).filter(row=>row.id&&row.title&&row.related.length);
}
export async function enrichMatchReasonsWithAI(matches,profile,key,{
 fetcher=fetch,timeoutMs=40000
}={}){
 if(!Array.isArray(matches)||!matches.length)return matches;
 const prepared=candidateEvidence(profile,matches);
 if(!prepared.length||typeof key!=='string'||key.length<16)return matches;
 const system=[
  '你是中国大陆求职平台 HHBA 的简历证据解释员。只返回合法 JSON。',
  '输入只有已经通过原文核对的简历事例、岗位名称和已知技能。',
  '为每个岗位选择最相关的一个事例索引，并写一句自然的因果解释，帮助用户理解为什么值得考虑该岗位。',
  '不可编造岗位要求、学历、工作城市、任职年限、公司、项目成果或在招状态。',
  '不能把参与、协助说成独立负责或领导，不能将求职意向说成已有经历。',
  '不可承诺面试、录用或成功率。岗位信息不足时，只说经历与岗位方向有联系。',
  '输出示例：{"items":[{"id":"role-1","selected_index":0,"connection":"这段政策申报与跨部门协调实践，能帮助理解政府事务岗位的常见协作场景。"}]}。',
  '如果不能找到合理的联系，省略该岗位。每条 connection 控制在 25-85 个中文字符，不要引用个人姓名。'
 ].join(' ');
 const payload={jobs:prepared.map(row=>({
  id:row.id,title:row.title,
  examples:row.related.map((e,i)=>({index:i,quote:e.quote})),
  known_skill_requirements:row.skills
 }))};
 let response;
 try{
  response=await fetcher('https://api.deepseek.com/chat/completions',{
   method:'POST',redirect:'manual',cache:'no-store',
   signal:AbortSignal.timeout(timeoutMs),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},
    response_format:{type:'json_object'},temperature:0.25,max_tokens:2000,
    stream:false,messages:[{role:'system',content:system},
     {role:'user',content:JSON.stringify(payload)}]})
  });
 }catch{return matches;}
 if(!response.ok)return matches;
 let text;
 try{
  const result=await response.json();
  text=result?.choices?.[0]?.message?.content;
 }catch{return matches;}
 if(typeof text!=='string'||text.length>16000)return matches;
 let rows;
 try{rows=JSON.parse(text)?.items;}catch{return matches;}
 if(!Array.isArray(rows)||rows.length>12)return matches;
 const byId=new Map(prepared.map(x=>[x.id,x]));
 const generated=new Map();
 for(const row of rows){
  if(typeof row?.id!=='string'||generated.has(row.id))continue;
  const found=byId.get(row.id);
  if(!found||!Number.isInteger(row.selected_index)||row.selected_index<0||
   row.selected_index>=found.related.length)continue;
  const note=safeText(row.connection,150);
  if(note.length<15||note.length>115||UNPROVEN.test(note)||/https?:|@|1[3-9]\d{9}/i.test(note))continue;
  // Numeric impact must be in the verbatim excerpt, not supplied by the LLM.
  if(/\d/.test(note)&&![...note.matchAll(/\d+(?:\.\d+)?/g)].every(
   m=>found.related[row.selected_index].quote.includes(m[0])))continue;
  const proof=found.related[row.selected_index];
  const summary='简历记载「'+proof.quote+'」；'+note;
  generated.set(row.id,summary);
 }
 if(!generated.size)return matches;
 return matches.map(job=>{
  const summary=generated.get(job.id);
  if(!summary)return job;
  const current=job.why_recommended||{summary:'',evidence:[],to_check:[]};
  return {...job,why_recommended:{
   ...current,summary,
   evidence:[summary,...(current.evidence||[]).filter(x=>x!==summary)].slice(0,3),
   source:'AI_WITH_VERBATIM_RESUME_EVIDENCE'
  }};
 });
}
