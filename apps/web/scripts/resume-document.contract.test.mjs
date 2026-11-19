import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResumeDocument,normalizeResumeDocumentDetails,readableResumeDocument,sourceResumeBlocks,sourceResumeOmittedCharacters,structuredResumeOmittedCharacters} from '../src/services/resumeDocument.ts';

const profile={
 education:'BACHELOR',education_evidence:'临沂大学 本科',
 experience_years:2,experience_evidence:'2024-2026',
 skills:[{name:'门店管理',evidence:'负责日常门店销售管理'}],
 target_roles:['区域督导'],
 experiences:[{role:'区域督导',organization:'示例公司',period:'2024-2026',evidence:'负责区域门店运营'}],
 warnings:[]
};
const original=[{id:'experience-0',section:'experience',text:'负责区域门店运营'},
 {id:'skill-0',section:'skills',text:'负责日常门店销售管理'}];
const fields={fullName:'李示例',headline:'区域督导',phone:'',email:'',location:'山东',
 summary:'统筹日常经营',educationDetails:'营销管理方向'};
test('printable document reflects accepted wording but does not change source profile',()=>{
 const changed=[{...original[0],text:'统筹区域门店运营'},original[1]];
 const document=buildResumeDocument(profile,changed,fields);
 assert.equal(document.experiences[0].details,'统筹区域门店运营');
 assert.equal(document.experiences[0].organization,'示例公司');
 assert.equal(document.education.length,2);
 assert.equal(document.skills.length,1);
 assert.equal(profile.experiences[0].evidence,'负责区域门店运营');
 assert.equal(readableResumeDocument(document),true);
});
test('unknown personal details must be filled manually, not fabricated',()=>{
 const doc=buildResumeDocument(profile,original,normalizeResumeDocumentDetails({}));
 assert.equal(doc.details.fullName,'');
 assert.equal(doc.details.phone,'');
 assert.equal(readableResumeDocument(doc),false);
});
test('print details are bounded and ignore untrusted extra fields',()=>{
 const got=normalizeResumeDocumentDetails({fullName:' x '.repeat(150),email:'a@example.test',
  secret:'must not enter printable output'});
 assert.ok(got.fullName.length<=80);
 assert.equal(got.email,'a@example.test');
 assert.equal(Object.hasOwn(got,'secret'),false);
});

test('partial profile never crashes the printable document view',()=>{
 const doc=buildResumeDocument({...profile,experiences:undefined,skills:undefined},[],fields);
 assert.equal(doc.experiences.length,0);
 assert.equal(doc.skills.length,0);
 assert.equal(doc.education.length,2);
});

test('source-only search-first resume stays explicitly unstructured without invented job titles',()=>{
 const raw='个人简介：有多年的真实经历。\n\n工作内容：做过区域运营与客户联络。';
 const blocks=sourceResumeBlocks(raw);
 assert.ok(blocks.length>0);
 assert.equal(blocks[0].section,'summary');
 assert.equal(blocks[0].id,'source-0');
 const doc=buildResumeDocument({...profile,experiences:[],skills:[]},blocks,fields);
 assert.equal(doc.experiences.length,0);
 assert.ok(doc.sourceParagraphs.join(' ').includes('区域运营'));
 assert.equal(readableResumeDocument(doc),true);
});
test('local source paragraphs are bounded for browser editing',()=>{
 const chunks=sourceResumeBlocks('真实的简历经历'.repeat(4000));
 assert.ok(chunks.length<=12);
 assert.ok(chunks.every(x=>x.text.length<=1400));
 assert.deepEqual(sourceResumeBlocks(''),[]);
});

test('source extraction reports omitted resume characters rather than silently exporting a partial CV',()=>{
 const short='真实运营经历。\n\n曾经参与客户沟通。';
 assert.equal(sourceResumeOmittedCharacters(short,sourceResumeBlocks(short)),0);
 const long='第十三段及以后不能丢失。'.repeat(2200);
 const blocks=sourceResumeBlocks(long);
 assert.equal(blocks.length,12);
 const omitted=sourceResumeOmittedCharacters(long,blocks);
 assert.ok(omitted>0,'truncated source characters must be reported');
 assert.ok(omitted<long.replace(/\s/gu,'').length,'existing excerpts remain available for editing');
 assert.equal(sourceResumeOmittedCharacters('',[]),0);
});


test('structured resumes detect overflow beyond the printable 12 experience rows',()=>{
 const extensive={...profile,experiences:Array.from({length:13},(_,i)=>({
  role:'实际工作岗位'+i,organization:'测试单位',period:'2024',evidence:'参与实际门店运营'+i
 }))};
 assert.ok(structuredResumeOmittedCharacters(extensive)>0);
 assert.equal(buildResumeDocument(extensive,[],fields).experiences.length,12);
 assert.equal(structuredResumeOmittedCharacters(profile),0);
});
test('structured resumes detect a cut-off paragraph and education evidence',()=>{
 const text='真实工作经历'.repeat(280);
 const extensive={...profile,experiences:[{...profile.experiences[0],evidence:text}],
  education_evidence:'学历证明'.repeat(90)};
 const omitted=structuredResumeOmittedCharacters(extensive);
 assert.ok(omitted>0);
 assert.ok(omitted>=text.slice(1600).length);
 assert.ok(omitted<text.length);
});
