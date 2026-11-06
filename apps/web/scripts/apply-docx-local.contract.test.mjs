import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {extractDocxText,wordXmlToText,inferProfileFromText} from '../src/services/docxProfile.mjs';
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>姓名：测试求职者</w:t></w:r></w:p>
<w:p><w:r><w:t>邮箱：demo@example.invalid</w:t></w:r></w:p>
<w:p><w:r><w:t>毕业院校：示例大学</w:t></w:r></w:p>
<w:p><w:r><w:t>最高学历：本科</w:t></w:r></w:p>
<w:p><w:r><w:t>工作经历</w:t></w:r></w:p>
<w:p><w:r><w:t>2024年 在示例企业开展客户服务</w:t></w:r></w:p>
</w:body></w:document>`;
function zipSingleDocx(content){
 const name=Buffer.from('word/document.xml');
 const plain=Buffer.from(content,'utf8'),packed=deflateRawSync(plain);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
 local.writeUInt16LE(8,8);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(plain.length,22);
 local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);
 central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);
 central.writeUInt32LE(packed.length,20);central.writeUInt32LE(plain.length,24);
 central.writeUInt16LE(name.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+name.length,12);
 end.writeUInt32LE(local.length+name.length+packed.length,16);
 const bytes=Buffer.concat([local,name,packed,central,name,end]);
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
test('DOCX local extraction handles actual raw-deflate ZIP and Chinese text',async()=>{
 const text=await extractDocxText(zipSingleDocx(xml));
 assert.ok(text.includes('姓名：测试求职者'));
 assert.ok(text.includes('示例大学'));
 const p=inferProfileFromText(text);
 assert.equal(p.fullName,'测试求职者');
 assert.equal(p.email,'demo@example.invalid');
 assert.equal(p.school,'示例大学');
 assert.equal(p.education,'本科');
 assert.equal(p.experience,'2024年 在示例企业开展客户服务');
 assert.equal(p.degree,'');
 assert.equal(p.phone,'');
});
test('unsupported or malicious input fails closed',async()=>{
 await assert.rejects(extractDocxText(new ArrayBuffer(100)),/DOCX/);
 assert.throws(()=>wordXmlToText('<!DOCTYPE evil><w:document><w:body/></w:document>'),/XML/);
 assert.throws(()=>wordXmlToText('<root><p>Hello</p></root>'),/DOCX/);
 const p=inferProfileFromText('身份证号码：123456789012345678\n政治面貌：未披露');
 assert.equal(p.fullName,'');
 assert.equal(p.phone,'');
 assert.equal(p.education,'');
});
test('website processing cannot claim PDF support and requires explicit review',()=>{
 const ui=readFileSync(new URL('../src/components/ApplyResumeSync.tsx',import.meta.url),'utf8');
 assert.ok(ui.includes('PDF 自动提取尚未通过安全和准确性验收'));
 assert.ok(ui.includes('fetchPrivateResumeForLocalReview'));
 assert.ok(ui.includes('extractDocxText(bytes)'));
 assert.ok(ui.includes('checked={reviewed}')&&ui.includes('checked={consent}'));
 assert.ok(ui.includes('prepareApplyProfileSync(selectedFile.id,profile,true)'));
});
