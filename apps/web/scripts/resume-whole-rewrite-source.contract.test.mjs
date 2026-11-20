import test from 'node:test';
import assert from 'node:assert/strict';
import {completeRewriteSource} from '../src/services/resumeWholeRewriteSource.ts';

const profile={
 education:null,education_evidence:null,experience_years:null,experience_evidence:null,
 skills:[],target_roles:[],experiences:[],warnings:[]
};
test('full AI writer extracts all Chinese headings into actual sections without ASCII word-boundary losses',()=>{
 const text=[
  '个人概述：参与真实区域协作。',
  '工作经历：负责门店客户沟通。',
  '项目经历：整理门店真实业务记录。',
  '教育背景：已完成相关学习。',
  '专业技能：整理运营报表。'
 ].join('\n\n');
 const source=completeRewriteSource(profile,text);
 assert.equal(source.complete,true);
 assert.deepEqual(source.blocks.map(x=>x.section),[
  'summary','experience','projects','education','skills'
 ]);
 assert.equal(source.blocks.map(x=>x.text).join(''),text.replace(/\n\n/g,''));
});
test('whole writer source retains all twenty actual paragraphs, not the legacy twelve-tip limit',()=>{
 const text=Array.from({length:20},(_,i)=>'第 '+i+' 段：实际开展真实测试操作。').join('\n\n');
 const source=completeRewriteSource(profile,text);
 assert.equal(source.complete,true);
 assert.equal(source.blocks.length,20);
 assert.match(source.blocks.at(-1).text,/第 19 段/);
});
test('very long single paragraph is continued in chunks, never silently truncated',()=>{
 const text='中'.repeat(13500);
 const source=completeRewriteSource(profile,text);
 assert.equal(source.blocks.length,4);
 assert.equal(source.blocks.map(x=>x.text).join(''),text);
});
test('over-capacity source fails explicitly instead of pretending to be an entire CV',()=>{
 const text=Array.from({length:98},(_,i)=>'第'+i+'段中文经历。').join('\n\n');
 const source=completeRewriteSource(profile,text);
 assert.equal(source.complete,false);
 assert.equal(source.blocks.length,0);
 assert.match(source.reason,/不能偷偷遗漏/);
});
