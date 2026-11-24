// Real provider acceptance on wholly fictional data. No candidate account,
// storage mutation, official-source claims, credentials or model text in logs.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {v4Provider} from '../functions/_lib/simple-match-v4.js';
import {optimizeResumeDocument} from '../functions/_lib/resume-optimization-task.js';
import {reassessV4Document} from '../functions/_lib/v4-resume-reassess.js';
import {editOriginalDocxStrict,inspectOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';
import {extractDocxText} from '../src/services/docxProfile.mjs';

const blocks=[
 {id:'a',section:'experience',text:'负责门店日常运营，使用 Excel 汇总每周销售数据并向门店负责人汇报。'},
 {id:'b',section:'experience',text:'协助新员工熟悉客户接待流程，整理培训反馈并跟进待办事项。'},
 {id:'c',section:'skills',text:'具备 Excel 数据整理和跨部门沟通经验。'}
];
const jd={id:'synthetic-only',company:'虚构测试企业',title:'区域运营督导',location:'上海',
 full_jd:'岗位职责：负责门店经营数据分析与运营报告；协助开展人员培训和客户服务流程优化。任职要求：熟悉 Excel 数据分析，具备沟通协调能力。'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const errorCode=error=>{
 const code=String(error?.code||error?.message||'UNKNOWN');
 return /^(?:AI_[A-Z0-9_]+|WORD_[A-Z0-9_]+|QA_[A-Z0-9_]+)$/.test(code)?code:'UNEXPECTED_ERROR';
};
const fail=code=>{throw Error(code)};
function syntheticDocx(){
 const py=[
 'import json,sys,io,zipfile,html',
 'data=json.loads(sys.stdin.read())',
 'w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
 'parts={',
 '"[Content_Types].xml": "<Types xmlns=\\"http://schemas.openxmlformats.org/package/2006/content-types\\"><Default Extension=\\"rels\\" ContentType=\\"application/vnd.openxmlformats-package.relationships+xml\\"/><Default Extension=\\"xml\\" ContentType=\\"application/xml\\"/><Override PartName=\\"/word/document.xml\\" ContentType=\\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\\"/></Types>",',
 '"_rels/.rels":"<Relationships xmlns=\\"http://schemas.openxmlformats.org/package/2006/relationships\\"><Relationship Id=\\"rId1\\" Type=\\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\\" Target=\\"word/document.xml\\"/></Relationships>",',
 '"word/document.xml":"<w:document xmlns:w=\\""+w+"\\"><w:body>"+"".join("<w:p><w:r><w:rPr><w:b/><w:color w:val=\\"123456\\"/><w:sz w:val=\\"24\\"/></w:rPr><w:t>"+html.escape(b["text"],quote=False)+"</w:t></w:r></w:p>" for b in data)+"<w:sectPr/></w:body></w:document>",',
 '"word/styles.xml":"<w:styles xmlns:w=\\""+w+"\\"/>"}',
 'buf=io.BytesIO()',
 'with zipfile.ZipFile(buf,"w",compression=zipfile.ZIP_STORED) as z:',
 ' for k,v in parts.items(): z.writestr(k,v)',
 'sys.stdout.buffer.write(buf.getvalue())'
 ].join('\n');
 return new Uint8Array(execFileSync('python3',['-c',py],{input:JSON.stringify(blocks)}));
}
export async function runSyntheticResumeAcceptance({env,signal,optimize=optimizeResumeDocument,reassess=reassessV4Document,report=()=>{}}){
 const summary={status:'PARTIAL',fixture:'SYNTHETIC_ONLY',provider_mode:'LIVE_CONFIGURED_RELAY',stages:{},layout:'NOT_PIXEL_VERIFIED'};
 let stage='optimization';
 const emit=()=>report({...summary,stages:{...summary.stages}});
 try{
  const job={title:jd.title,requirements:jd.full_jd,verified:true};
  const source=syntheticDocx(),originalHash=digest(source);
  let wanted=blocks.map(b=>b.id),suggestions=new Map();
  // The diagnostic stops at no-progress; this is not a product AI quota.
  while(wanted.length){
   const result=await optimize({env,blocks,context:blocks.map(b=>b.text).join('\n'),job,signal,wanted});
   for(const item of result.suggestions)suggestions.set(item.blockId,item);
   const pending=result.pendingIds;
   if(!Array.isArray(pending)||pending.some(id=>!wanted.includes(id)))fail('QA_INVALID_PENDING');
   summary.stages.optimization={reviewed:blocks.length-pending.length,total:blocks.length,suggestions:suggestions.size};
   emit();
   if(result.pauseReason)fail(result.pauseReason);
   if(pending.length>=wanted.length)fail('QA_NO_PROGRESS');
   wanted=pending;
  }
  const edits=[...suggestions.values()].filter(s=>s.action==='replace'&&s.proposed!==s.original&&s.proposed.trim()&&!/[\r\n\t]/.test(s.proposed));
  if(!edits.length)fail('QA_NO_APPLICABLE_EDIT');
  stage='docx';
  const byId=new Map(edits.map(edit=>[edit.blockId,edit]));
  // Exercise every accepted change, in separate revisions just like the
  // existing Siri editor. A successful first edit must not hide later failures.
  let edited=source;
  const applied=new Map();
  for(const edit of edits){
   const originalBlock=blocks.find(b=>b.id===edit.blockId);
   if(!originalBlock||edit.original!==originalBlock.text)fail('QA_ANCHOR_MISMATCH');
   edited=await editOriginalDocxStrict(edited,[{original:edit.original,text:edit.proposed}],{allowExpansion:true});
   applied.set(edit.blockId,edit.proposed);
   const intermediate=await extractDocxText(new Uint8Array(edited).buffer);
   if(intermediate!==blocks.map(b=>applied.get(b.id)??b.text).join('\n'))fail('QA_DOCX_CONTENT_MISMATCH');
  }
  const beforeText=await extractDocxText(new Uint8Array(source).buffer);
  const afterText=await extractDocxText(new Uint8Array(edited).buffer);
  const expected=blocks.map(b=>byId.get(b.id)?.proposed??b.text).join('\n');
  if(afterText!==expected||digest(source)!==originalHash||digest(edited)===originalHash)fail('QA_DOCX_CONTENT_MISMATCH');
  const inspection=await inspectOriginalDocxStrict(edited);
  if(edits.some(edit=>!inspection.editable_text.includes(edit.proposed)))fail('QA_DOCX_ANCHOR_MISSING');
  summary.stages.docx={structure:'PASS',original_unchanged:true,edited_text_verified:true,applied_edits:applied.size,bytes:edited.length};
  emit();
  stage='reassessment';
  const scores=await reassess({env,jd,beforeBlocks:[{text:beforeText}],afterBlocks:[{text:afterText}],signal});
  if(!scores.supported||!Number.isInteger(scores.original_score)||!Number.isInteger(scores.updated_score)||scores.delta!==scores.updated_score-scores.original_score)fail('QA_SCORE_EVIDENCE_MISSING');
  summary.stages.reassessment={status:'PASS',before:scores.original_score,after:scores.updated_score,delta:scores.delta};
  summary.status='PASS';emit();
 }catch(error){summary.stages[stage]={...summary.stages[stage],status:'FAILED',error:errorCode(error)};emit();}
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const label='HHBA_V4_RESUME_LIVE_QA=';
 const env={...process.env,HHBA_MATCH_V4_READY:'1'};
 if(!v4Provider(env)){
  console.log(label+JSON.stringify({status:'BLOCKED',error:'MISSING_RELAY_KEY'}));process.exitCode=1;
 }else{
  const result=await runSyntheticResumeAcceptance({env,signal:AbortSignal.timeout(360000),
   report:value=>console.log(label+JSON.stringify(value))});
  if(result.status!=='PASS')process.exitCode=1;
 }
}
