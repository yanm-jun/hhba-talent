import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResumeDocument,normalizeResumeDocumentDetails,readableResumeDocument} from '../src/services/resumeDocument.ts';

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
