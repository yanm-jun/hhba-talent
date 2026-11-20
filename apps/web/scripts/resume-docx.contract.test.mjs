import test from 'node:test';
import assert from 'node:assert/strict';
import {createResumeDocx} from '../src/services/resumeDocx.ts';
import {buildResumeDocument} from '../src/services/resumeDocument.ts';

// ZIP stores XML entries without compression, enabling a strict package check
// without adding external Word or ZIP dependencies to the application.
function zipEntries(bytes){
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const decoder=new TextDecoder();let at=0;const result={};
 while(at+4<bytes.length && data.getUint32(at,true)===0x04034b50){
  const method=data.getUint16(at+8,true),size=data.getUint32(at+18,true);
  const nameSize=data.getUint16(at+26,true),extraSize=data.getUint16(at+28,true);
  assert.equal(method,0,'DOCX entries must use stored ZIP method');
  const name=decoder.decode(bytes.subarray(at+30,at+30+nameSize));
  const start=at+30+nameSize+extraSize;
  result[name]=decoder.decode(bytes.subarray(start,start+size));
  at=start+size;
 }
 assert.equal(data.getUint32(at,true),0x02014b50,'ZIP central directory must be present');
 return result;
}
const profile={
 education:'BACHELOR',education_evidence:'示例大学 计算机本科',
 experiences:[{role:'运营督导',organization:'虚构门店',period:'2024—2025',evidence:'原始工作描述'}],
 skills:[{name:'办公软件',evidence:'基础操作'}]
};
const details={fullName:'简历测试用户',headline:'区域运营督导',email:'test@example.invalid',
 phone:'',location:'上海',summary:'真实参与门店运营。',educationDetails:''};
test('valid editable DOCX has standard OOXML entries, styles and A4 page layout',()=>{
 const doc=buildResumeDocument(profile,[{id:'experience-0',section:'experience',text:'本人确认改写的运营经历'}],details);
 const bytes=createResumeDocx(doc);
 assert.ok(bytes.length>3000);
 const entries=zipEntries(bytes);
 assert.deepEqual(Object.keys(entries).sort(),[
  '[Content_Types].xml','_rels/.rels','word/_rels/document.xml.rels','word/document.xml','word/styles.xml'
 ].sort());
 const xml=entries['word/document.xml'];
 assert.match(xml,/简历测试用户/);
 assert.match(xml,/本人确认改写的运营经历/);
 assert.doesNotMatch(xml,/原始工作描述|AI 建议|填充到此处/);
 assert.match(xml,/w:pgSz w:w="11906" w:h="16838"/);
 assert.match(entries['word/styles.xml'],/Microsoft YaHei/);
});
test('XML escaping protects ampersands and angle brackets in user source text',()=>{
 const doc=buildResumeDocument({...profile,experiences:[],skills:[]},
  [{id:'source-0',section:'summary',text:'本人真实经历 A&B < C > D\n下一行'}],
  {...details,fullName:'张&李'});
 const xml=zipEntries(createResumeDocx(doc))['word/document.xml'];
 assert.match(xml,/张&amp;李/);
 assert.match(xml,/A&amp;B &lt; C &gt; D/);
 assert.match(xml,/<w:br\/>/);
 assert.doesNotMatch(xml,/AI 建议/);
});
