import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jobResearchDossier} from '../src/services/jobResearchDossier.mjs';

const candidate={
 id:'candidate-1',company:'测试企业',title:'区域运营',location:'济南',
 official_url:'https://careers.example.com/jobs/1',
 match_score:null,reference_score:0,matched:[],not_evidenced:[],
 jd_research:{facts:[],inference:'',unknowns:[]}
};

test('unverified candidate stays pending: neither a link nor preliminary model score proves research',()=>{
 const dossier=jobResearchDossier({...candidate,match_score:94,reference_score:99,matched:['团队管理']});
 assert.equal(dossier.finished,0);
 assert.deepEqual(dossier.stages.map(s=>s.state),['pending','pending','pending','pending']);
 assert.match(dossier.stages[0].summary,/归属仍待独立确认/);
 assert.equal(dossier.reportFinished,false);
});

test('official JD and employer evidence can arrive before any trustworthy matching score',()=>{
 const dossier=jobResearchDossier({...candidate,source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',evidence_excerpt:'真实公开岗位职责原文'});
 assert.equal(dossier.finished,2);
 assert.deepEqual(dossier.stages.map(s=>s.state),['complete','complete','pending','pending']);
 assert.match(dossier.stages[1].summary,/完整官方 JD/);
});

test('AI reference JD is never represented as an official employer requirement',()=>{
 const dossier=jobResearchDossier({...candidate,reference_vacancy_verified:true,reference_jd_kind:'AI_GENERATED_REFERENCE',reference_jd:'基于职业方向整理的求职准备参考资料',evidence_score_status:'AI_REFERENCE_JD_SCORED',match_score:73});
 assert.deepEqual(dossier.stages.map(s=>s.state),['complete','reference','reference','pending']);
 assert.equal(dossier.finished,3);
 assert.match(dossier.stages[1].summary,/不代表企业真实招聘要求/);
 assert.equal(dossier.officialJd,false);
});

test('complete grounded report lights four evidence stages and exposes a real comparison count',()=>{
 const dossier=jobResearchDossier({...candidate,source_type:'站外官方招聘',jd_source_status:'VERIFIED_JD',evidence_excerpt:'官方完整岗位要求',score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',match_score:85,report_status:'COMPLETE',research_detail:{comparisons:[{requirement:'工作经验',resume_evidence:'区域运营',analysis:'有实际经历',status:'supported'}],strengths:'真实经验'}});
 assert.equal(dossier.finished,4);
 assert.equal(dossier.reportFinished,true);
 assert.deepEqual(dossier.stages.map(s=>s.state),['complete','complete','complete','complete']);
 assert.equal(dossier.stages[2].count,1);
});

test('unavailable or declined report must not be represented as completed',()=>{
 for(const report_status of ['UNAVAILABLE','DECLINED']){
  const dossier=jobResearchDossier({...candidate,report_status,reference_score:92});
  assert.equal(dossier.stages[3].state,'attention');
  assert.notEqual(dossier.stages[3].label,'深度报告完成');
  assert.equal(dossier.finished,0);
 }
});

test('report-first workspace only presents complete reports while retaining research evidence',()=>{
 const modal=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const first=readFileSync(new URL('../src/components/ReportFirstMatchExperience.tsx',import.meta.url),'utf8');
 const dossier=readFileSync(new URL('../src/components/JobResearchDossier.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/styles/report-first-experience.css',import.meta.url),'utf8');
 assert.match(modal,/<ReportFirstMatchExperience/);
 assert.match(first,/const fullReport=/);
 assert.match(first,/job\.report_status==='COMPLETE'/);
 assert.match(first,/firstDelivered\.current=true;setView\('reports'\)/);
 assert.match(first,/岗位详情/);
 assert.match(first,/reference_jd\|\|current\.evidence_excerpt/);
 assert.match(first,/isVerifiedMatchReport\(current\)/,'unverified references may be read but must not unlock formal optimization');
 assert.match(first,/招聘信息待核实/);
 assert.match(dossier,/data-research-stage=\{stage\.id\}/);
 assert.match(css,/max-width:640px/);
});
