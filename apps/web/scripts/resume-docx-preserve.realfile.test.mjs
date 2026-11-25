import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {editOriginalDocxStrict,inspectOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';

// The preceding Python test builds a genuine two-page Chinese DOCX using
// python-docx, preserving table, embedded chart, header, footer and font data.
// This runs the SAME pure JS OOXML patcher used by Cloudflare and the browser.
// Fixture contains only synthetic identities and accomplishments.
const fixture=process.env.HHBA_REAL_WORD_QA_OUTPUT||
 '/tmp/hhba-real-word-ci';
const original=new Uint8Array(readFileSync(fixture+'/original-real-cjk.docx'));
const OLD='负责门店运营及日常数据整理工作';
const NEW='负责门店运营及业务数据整理';

function members(bytes){
 const view=Buffer.from(bytes);
 let end=-1;
 for(let i=view.length-22;i>=Math.max(0,view.length-65557);i--){
  if(view.readUInt32LE(i)===0x06054b50&&i+22+view.readUInt16LE(i+20)===view.length){
   end=i;break;
  }
 }
 assert.ok(end>=0,'OOXML central directory exists');
 const count=view.readUInt16LE(end+10);
 let p=view.readUInt32LE(end+16);
 const result=new Map();
 for(let i=0;i<count;i++){
  assert.equal(view.readUInt32LE(p),0x02014b50,'valid central record');
  const method=view.readUInt16LE(p+10),crc=view.readUInt32LE(p+16);
  const packed=view.readUInt32LE(p+20),size=view.readUInt32LE(p+24);
  const nameLen=view.readUInt16LE(p+28),extra=view.readUInt16LE(p+30),
   comment=view.readUInt16LE(p+32),offset=view.readUInt32LE(p+42);
  const name=view.subarray(p+46,p+46+nameLen).toString('utf8');
  assert.equal(view.readUInt32LE(offset),0x04034b50);
  const start=offset+30+view.readUInt16LE(offset+26)+view.readUInt16LE(offset+28);
  const data=view.subarray(start,start+packed);
  result.set(name,{data,method,crc,packed,size,
   xml:()=>method===8?inflateRawSync(data).toString('utf8'):
    data.toString('utf8')});
  p+=46+nameLen+extra+comment;
 }
 return result;
}
test('real deflated Chinese DOCX is editable without Word server',async()=>{
 const before=members(original);
 const originalPart=before.get('word/document.xml');
 assert.equal(originalPart.method,8,'fixture must exercise genuine ZIP deflate');
 assert.ok(originalPart.xml().includes(OLD));
 assert.ok(before.has('word/media/image1.png'),'image must be present in source');
 assert.ok([...before.keys()].some(s=>s.startsWith('word/header')));
 assert.ok([...before.keys()].some(s=>s.startsWith('word/footer')));
 const inspected=await inspectOriginalDocxStrict(original);
 assert.ok(inspected.editable_text.includes(OLD));
 const changed=await editOriginalDocxStrict(original,[{original:OLD,text:NEW}]);
 assert.notDeepEqual(changed,original);
 const after=members(changed);
 assert.equal(after.size,before.size,'no DOCX parts added or removed');
 assert.ok(after.get('word/document.xml').xml().includes(NEW));
 assert.ok(!after.get('word/document.xml').xml().includes(OLD));
 for(const [name,entry] of before){
  const next=after.get(name);
  assert.ok(next,'part must remain: '+name);
  if(name==='word/document.xml')continue;
  assert.equal(next.method,entry.method,name+' compression unchanged');
  assert.equal(next.crc,entry.crc,name+' CRC unchanged');
  assert.deepEqual(next.data,entry.data,name+' compressed bytes unchanged');
 }
 const revised=await inspectOriginalDocxStrict(changed);
 assert.ok(revised.editable_text.includes(NEW));
 assert.ok(!revised.editable_text.includes(OLD));
});
test('genuine compressed DOCX enforces safe shortening/unique target restrictions',async()=>{
 await assert.rejects(
  editOriginalDocxStrict(original,[{original:OLD,text:OLD+'追加太多的新词内容'}]),
  /WORD_EDIT_TOO_LONG/);
 await assert.rejects(
  editOriginalDocxStrict(original,[{original:'并不存在的工作经历',text:'修改'}]),
  /WORD_EDIT_AMBIGUOUS/);
});


test('actual JS-expanded DOCX renders in LibreOffice and keeps all new text, without forcing same-page geometry',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hhba-word-pagination-'));
 try{
  const lines=['虚构测试新增工作内容','虚构测试新增沟通事项'];
  const edited=await editOriginalDocxStrict(original,[{original:OLD,text:OLD+'\n'+lines.join('\n')}],{allowExpansion:true});
  const source=join(dir,'expanded.docx');writeFileSync(source,edited);
  execFileSync('libreoffice',['-env:UserInstallation='+pathToFileURL(join(dir,'profile')).href,'--headless','--convert-to','pdf','--outdir',dir,source],{timeout:65000});
  const pdf=join(dir,'expanded.pdf'),info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'}),text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'}).replace(/\s/g,'');
  assert.ok(Number(info.match(/Pages:\s+(\d+)/)?.[1])>=2);
  for(const line of [OLD,...lines])assert.ok(text.includes(line));
  // Exact pagination is measured, not promised or enforced as an AI limit.
  console.log('HHBA_SYNTHETIC_LIBREOFFICE_EXPANSION='+JSON.stringify({pages:Number(info.match(/Pages:\s+(\d+)/)?.[1]),text_verified:true}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
