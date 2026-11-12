import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {readXlsx,parseDelimited,prepareImport,parseImportFile,planImportBatches,
 industryId,exportFailedCSV} from '../../admin-preview/library-file-import.js';

function packZip(files){
 const locals=[],centers=[];let offset=0;
 for(const [name,source] of Object.entries(files)){
  const nameBytes=Buffer.from(name),body=Buffer.from(source),compressed=deflateRawSync(body);
  const local=Buffer.alloc(30),central=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
  local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(nameBytes.length,26);
  const file=Buffer.concat([local,nameBytes,compressed]);locals.push(file);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
  central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);
  central.writeUInt32LE(body.length,24);central.writeUInt16LE(nameBytes.length,28);
  central.writeUInt32LE(offset,42);centers.push(Buffer.concat([central,nameBytes]));
  offset+=file.length;
 }
 const dir=Buffer.concat(centers),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(centers.length,8);
 end.writeUInt16LE(centers.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 const result=Buffer.concat([...locals,dir,end]);
 return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);
}
function makeXlsx(){
 const cells=arr=>arr.map((x,i)=>'<c r="'+String.fromCharCode(65+i)+arr.line+'" t="s"><v>'+x+'</v></c>').join('');
 const sheet='<worksheet><sheetData>'+
 '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'+
 '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c></row>'+
 '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c><c r="C3" t="s"><v>5</v></c></row>'+
 '<row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4" t="s"><v>6</v></c><c r="C4"><f>HYPERLINK("https://bad.example")</f><v>1</v></c></row>'+
 '</sheetData></worksheet>';
 const strings=['行业馆','企业名称','招聘网址','汽车馆','测试汽车企业','https://jobs.test-company.example/','公式企业'];
 const shared='<sst>'+strings.map(s=>'<si><t>'+s+'</t></si>').join('')+'</sst>';
 const data=packZip({
  'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="企业招聘" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml':shared,
  'xl/worksheets/sheet1.xml':sheet
 });
 return data;
}
test('Excel ZIP shared strings, headers, formulas and duplicate rows work without network',async()=>{
 const result=prepareImport(await readXlsx(makeXlsx()));
 assert.equal(result.total,3);
 assert.equal(result.valid.length,1);
 assert.equal(result.duplicate.length,1);
 assert.equal(result.invalid.length,1);
 assert.match(result.invalid[0].reason,/公式/);
 assert.equal(result.valid[0].enterprise,'测试汽车企业');
 assert.equal(result.valid[0].industry_id,'automotive');
 assert.equal(result.valid[0].recruitment_url,'https://jobs.test-company.example/');
});
test('CSV parser preserves quoted commas, newlines and Excel industry names',()=>{
 const raw='行业馆,企业名称,招聘网址\r\n"互联网与AI馆","北京,研发公司","https://jobs.example.cn"\r\n"金融馆","银行\n创新部","https://banks.example.com/"';
 const rows=parseDelimited(raw);
 assert.equal(rows.length,3);
 const result=prepareImport(rows);
 assert.equal(result.valid.length,2);
 assert.equal(result.valid[0].industry_id,'internet-ai');
 assert.equal(result.valid[0].enterprise,'北京,研发公司');
 assert.equal(result.valid[1].industry_id,'finance');
 assert.equal(result.valid[1].enterprise,'银行\n创新部');
});
test('2-column spreadsheets use selected shelf; no guessing without industry',()=>{
 const raw=parseDelimited('企业名称,招聘网址\n小型制造商,https://careers.factory.example/');
 assert.equal(prepareImport(raw).invalid.length,1);
 assert.equal(prepareImport(raw,{defaultIndustry:'智能制造馆'}).valid[0].industry_id,'manufacturing');
});
test('3,800 eligible rows are planned as exactly 38 batches of 100',()=>{
 const lines=['行业馆,企业名称,招聘网址'];
 for(let i=0;i<3800;i++)lines.push('汽车馆,企业'+i+',https://company'+i+'.example.com/jobs');
 const data=prepareImport(parseDelimited(lines.join('\n')));
 assert.equal(data.total,3800);
 assert.equal(data.valid.length,3800);
 const chunks=planImportBatches(data.valid);
 assert.equal(chunks.length,38);
 assert.ok(chunks.every(b=>b.length===100));
 assert.equal(chunks.reduce((s,b)=>s+b.length,0),3800);
});
test('invalid HTTPS entries and Excel formula cells are rejected; failed CSV escapes formulas',()=>{
 const rows=parseDelimited('行业馆,企业名称,招聘网址\n汽车馆,有效,https://ok.example\n金融馆,非法, javascript:alert(1)\n汽车馆,=CMD,https://another.example');
 const output=prepareImport(rows);
 assert.equal(output.invalid.length,1);
 assert.equal(output.valid.length,2);
 const csv=exportFailedCSV([{line:3,enterprise:'=CMD',reason:'异常'}]);
 assert.match(csv,/'=CMD/);
 assert.equal(industryId('教育科研馆'),'education-research');
});
test('file type and size limits are enforced before parsing',async()=>{
 const tooLarge={name:'large.xlsx',size:11*1024*1024};
 await assert.rejects(parseImportFile(tooLarge),/10 MB/);
 const bad={name:'old.xls',size:10,text:async()=>''};
 await assert.rejects(parseImportFile(bad),/仅支持/);
});
