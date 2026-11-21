import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {inspectOriginalDocxStrict,editOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';

const source='负责门店运营及日常数据整理工作';
const modified='负责门店运营及区域业务数据整理';
const samples=[];
for(const label of ['small','medium','large']){
 const bytes=new Uint8Array(readFileSync('/tmp/hhba-word-cpu/'+label+'.docx'));
 if(bytes.length>3*1024*1024)throw Error('Benchmark fixture violates 3MB upload bound: '+label);
 const digest=createHash('sha256').update(bytes).digest('hex');
 const runs=[];
 for(let n=0;n<4;n++){
  const t0=performance.now(),cpu0=process.cpuUsage();
  const inspection=await inspectOriginalDocxStrict(bytes);
  if(!inspection.editable_text.includes(source))throw Error('Fixture lacks unique text');
  const edited=await editOriginalDocxStrict(bytes,[{original:source,text:modified}],{allowExpansion:true});
  const editedHash=createHash('sha256').update(edited).digest('hex');
  const cpu=process.cpuUsage(cpu0);
  if(editedHash===digest||edited.length>3*1024*1024)throw Error('Invalid edited DOCX: '+label);
  runs.push({wallMs:+(performance.now()-t0).toFixed(2),cpuMs:+((cpu.user+cpu.system)/1000).toFixed(2)});
 }
 const sorted=[...runs].sort((a,b)=>a.cpuMs-b.cpuMs);
 samples.push({label,sourceKB:Math.round(bytes.length/1024),
  medianCpuMs:sorted[2].cpuMs,worstCpuMs:sorted[3].cpuMs,
  medianWallMs:+[...runs].sort((a,b)=>a.wallMs-b.wallMs)[2].wallMs,iterations:runs.length});
}
const near=samples.find(x=>x.label==='large');
console.log('HHBA_LOCAL_DOCX_CPU_BENCHMARK',JSON.stringify({samples,
 caveat:'Node process CPU on GitHub runner, not production Cloudflare isolate CPU or D1/R2 overhead',
 reviewRequired:near.medianCpuMs>=10}));
