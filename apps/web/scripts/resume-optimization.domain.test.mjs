import test from 'node:test';
import assert from 'node:assert/strict';
import {applySuggestion,compareScores} from '../src/services/targetedResumeOptimization.ts';
const version={id:'original',targetJobId:'job-1',
 blocks:[{id:'experience-0',section:'experience',text:'负责门店日常运营'}],
 acceptedSuggestionIds:[]};
const suggestion={id:'a',blockId:'experience-0',action:'replace',
 original:'负责门店日常运营',proposed:'负责门店日常运营与线索跟进',
 rationale:'明确原文表达',jobRequirement:'门店运营',evidenceStatus:'needs_user_confirmation'};
test('no third-party suggestion can be filled without user confirmation',()=>{
 assert.throws(()=>applySuggestion(version,suggestion,false),/USER_CONFIRMATION_REQUIRED/);
 assert.deepEqual(version.acceptedSuggestionIds,[]);
 const next=applySuggestion(version,suggestion,true);
 assert.equal(next.blocks[0].text,'负责门店日常运营与线索跟进');
 assert.equal(version.blocks[0].text,'负责门店日常运营');
 assert.equal(next.acceptedSuggestionIds.length,1);
});
test('AI cannot fill a request for missing experience by itself',()=>{
 const request={...suggestion,action:'request_evidence'};
 assert.throws(()=>applySuggestion(version,request,true),/USER_EVIDENCE_REQUIRED/);
 const userFact={...request,action:'append',proposed:'我真实参与过客户预约跟进'};
 const filled=applySuggestion(version,userFact,true);
 assert.match(filled.blocks[0].text,/客户预约跟进/);
 assert.ok(filled.blocks[0].text.includes('\n'));
});
test('stale AI suggestions cannot overwrite edited text',()=>{
 const latest={...version,blocks:[{...version.blocks[0],text:'已经修改'}]};
 assert.throws(()=>applySuggestion(latest,suggestion,true),/STALE_OR_INVALID_SUGGESTION/);
});
test('qualification score increases are flagged without new evidence',()=>{
 const before={presentation:40,evidenceCoverage:30,qualifications:30,missingRequired:[],explanation:'before'};
 const after={...before,presentation:60,evidenceCoverage:55,qualifications:40};
 assert.equal(compareScores(before,after).warning,'QUALIFICATION_CHANGE_REQUIRES_NEW_VERIFIED_EVIDENCE');
});
