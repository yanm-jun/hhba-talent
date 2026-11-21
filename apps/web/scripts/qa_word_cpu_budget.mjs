import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectOriginalDocxStrict,editOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';

const source='负责门店运营及日常数据整理工作';
const modified='负责门店运营及区域业务数据整理';
function compressedParts(bytes){
 const view=Buffer.from(bytes),out=new Map();
 let tail=-1;
 for(let i=view.length-22;i>=Math.max(0,view.length-65557);i--)
  if(view.readUInt32LE(i)===0x06054b50&&
    i+22+view.readUInt16LE(i+20)===view.length){tail=i;break;}
 assert.ok(tail>=0,'ZIP central directory missing');
 const n=view.readUInt16LE(tail+10);
 let pos=view.readUInt32LE(tail+16);
 for(let i=0;i<n;i++){
  assert.equal(view.readUInt32LE(pos),0x02014b50);
  const packed=view.readUInt32LE(pos+20);
  const nameLen=view.readUInt16LE(pos+28);
  const extraLen=view.readUInt16LE(pos+30),commentLen=view.readUInt16LE(pos+32);
  const name=view.subarray(pos+46,pos+46+nameLen).toString('utf8');
  const off=view.readUInt32LE(pos+42);
  assert.equal(view.readUInt32LE(off),0x04034b50);
  const data=off+30+view.readUInt16LE(off+26)+view.readUInt16LE(off+28);
  out.set(name,view.subarray(data,data+packed));
  pos+=46+nameLen+extraLen+commentLen;
 }
 return out;
}
const samples=[];
for(const label of ['small','medium','large']){
 const bytes=new Uint8Array(readFileSync('/tmp/hhba-word-cpu/'+label+'.docx'));
 if(bytes.length>3*1024*1024)throw Error('Benchmark fixture violates 3MB upload bound: '+label);
 const digest=createHash('sha256').update(bytes).digest('hex');
 const runs=[];
 let lastEdited=null;
 for(let n=0;n<4;n++){
  const t0=performance.now(),cpu0=process.cpuUsage();
  const inspection=await inspectOriginalDocxStrict(bytes);
  if(!inspection.editable_text.includes(source))throw Error('Fixture lacks unique text');
  const edited=await editOriginalDocxStrict(bytes,[{original:source,text:modified}],{allowExpansion:true});
  const editedHash=createHash('sha256').update(edited).digest('hex');
  const cpu=process.cpuUsage(cpu0);
  if(editedHash===digest||edited.length>3*1024*1024)throw Error('Invalid edited DOCX: '+label);
  lastEdited=edited;
  runs.push({wallMs:+(performance.now()-t0).toFixed(2),cpuMs:+((cpu.user+cpu.system)/1000).toFixed(2)});
 }
 // Offline independent byte-level proof for each unchanged OOXML ZIP entry,
 // including the large, incompressible embedded photo. Excluded from the
 // measured Worker hot path, which relies on repack()'s exact slice copying.
 const before=compressedParts(bytes),after=compressedParts(lastEdited);
 assert.equal(after.size,before.size,label+' ZIP member count');
 for(const [name,compressed] of before){
  assert.ok(after.has(name),'missing original ZIP part: '+name);
  if(name!=='word/document.xml')
   assert.deepEqual(after.get(name),compressed,'compressed bytes changed: '+name);
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
