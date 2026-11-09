import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedProfile,redactForModel} from '../functions/_lib/resume-match-core.js';
import {verifiedWorkEvidence,relevantWorkEvidence} from '../functions/_lib/resume-work-evidence.js';
import {sanitizedJobIntent} from '../functions/_lib/domestic-search-fetch.js';
import {classifyOccupation,scoreCandidateFit} from '../functions/_lib/match-ranking.js';
import {whyThisJob} from '../functions/_lib/match-explanation.js';

const governmentText=[
 '求职意向：政府关系 / 政府事务',
 '工作经历：某企业 政府事务协同',
 '参与汽车产业政策研究与政府项目申报，完成政策筛选和申报材料整理，并推动重点项目认定。',
 '协同开展政府调研活动，负责会议材料准备、对接协调和会后事项跟进。',
 '教育经历：某高校，本科学历。'
].join('\n');
const operationsText=[
 '求职意向：区域运营',
 '工作经历：某车企 区域门店督导',
 '负责多家门店运营与销售过程管理，建立从线索到成交的销售漏斗。',
 '推动试驾转化流程优化，辅导销售顾问并通过数据看板复盘经营指标。',
 '教育经历：某高校，本科学历。'
].join('\n');
function governmentProfile(){
 return verifiedProfile({
  education:'BACHELOR',education_evidence:'本科学历',
  experience_years:null,experience_evidence:null,
  target_roles:['政府关系','政府事务专员'],
  skills:[{name:'政策研究',evidence:'参与汽车产业政策研究与政府项目申报'}],
  work_evidence:[
   '参与汽车产业政策研究与政府项目申报，完成政策筛选和申报材料整理，并推动重点项目认定。',
   '协同开展政府调研活动，负责会议材料准备、对接协调和会后事项跟进。'
  ]
 },governmentText);
}
test('real-style government-affairs resume retains exact outcomes and allows GR discovery',()=>{
 const p=governmentProfile();
 assert.equal(p.education,'BACHELOR');
 assert.ok(p.work_evidence.length>=2);
 assert.ok(p.work_evidence.every(q=>governmentText.includes(q)));
 assert.equal(sanitizedJobIntent('政府关系 GR'),'政府关系');
 assert.equal(sanitizedJobIntent('政策研究'),'政策研究');
 assert.equal(classifyOccupation('政府关系专员'),'government-affairs');
 assert.equal(classifyOccupation('政府事务专员'),'government-affairs');
 assert.ok(p.demonstrated_roles.includes('政府事务专员'));
 const position={title:'政府关系专员',location:'杭州',
  minimum_education:'BACHELOR',required_skills:['政策研究'],
  mandatory_skills:[],preferred_skills:[],unclassified_skills:[],
  min_experience_years:null};
 const fit=scoreCandidateFit(p,position,{role_hint:'政府关系'});
 assert.equal(fit.eligible,true);
 const why=whyThisJob(p,position,fit);
 assert.match(why.summary,/参与汽车产业政策研究与政府项目申报/);
 assert.match(why.summary,/政府事务与政策项目/);
 assert.ok(!why.summary.includes('独立负责'));
 assert.ok(why.evidence.some(x=>x.includes('政策研究')));
 assert.ok(!why.evidence.some(x=>x.includes('录用概率')));
});
test('region-store operations are not treated as proof of content marketing',()=>{
 const p=verifiedProfile({education:'BACHELOR',education_evidence:'本科学历',
  skills:[],target_roles:['区域运营'],
  work_evidence:['负责多家门店运营与销售过程管理，建立从线索到成交的销售漏斗。']},
  operationsText);
 assert.equal(sanitizedJobIntent('区域运营'),'区域运营');
 assert.equal(classifyOccupation('区域运营专员'),'regional-operations');
 assert.equal(classifyOccupation('内容运营专员'),'content-operations');
 assert.notEqual(classifyOccupation('区域运营专员'),classifyOccupation('内容运营专员'));
 const job={title:'区域运营专员',location:'上海',
  mandatory_skills:[],required_skills:[],min_experience_years:null,
  minimum_education:null};
 const fit=scoreCandidateFit(p,job,{role_hint:'区域运营'});
 assert.equal(fit.eligible,true);
 assert.match(whyThisJob(p,job,fit).summary,/销售漏斗/);
 const wrong=relevantWorkEvidence(p.work_evidence,{title:'内容运营专员'});
 assert.deepEqual(wrong,[]);
 const unsuitable=scoreCandidateFit(p,{...job,title:'内容运营专员'},
  {role_hint:'区域运营'});
 assert.equal(unsuitable.eligible,false);
});
test('a career goal is not transformed into claimed past experience',()=>{
 const source='求职意向：产品经理\n工作经历：某商家销售顾问\n负责客户接待与成交跟进，提升客户满意度。';
 const p=verifiedProfile({skills:[],target_roles:['产品经理'],work_evidence:[]},source);
 assert.equal(p.demonstrated_roles.includes('产品经理'),false);
 const why=whyThisJob(p,{title:'产品经理',location:'上海'},
  {breakdown:{role:15},matched_required_skills:[]});
 assert.doesNotMatch(why.evidence.join('；'),/做过产品经理|产品经理经历/);
 assert.doesNotMatch(why.evidence.join('；'),/负责产品规划/);
});
test('fabricated wins, private contacts and instructions never enter job reasons',()=>{
 const raw='负责区域业务数据分析和团队带教，完成业务指标改善。\n联系方式：13812345678';
 const offered=[
  '我主导百亿规模项目，独立完成全部成果。',
  '联系方式：13812345678，负责招聘沟通。',
  '负责区域业务数据分析和团队带教，完成业务指标改善。'
 ];
 const clean=redactForModel(raw);
 const evidence=verifiedWorkEvidence(offered,clean);
 assert.ok(evidence.includes('负责区域业务数据分析和团队带教，完成业务指标改善。'));
 assert.ok(!evidence.some(x=>x.includes('13812345678')||x.includes('百亿')));
 assert.ok(!JSON.stringify(evidence).includes('联系方式'));
});
test('AI may omit optional project evidence: exact-text fallback still works',()=>{
 const source='职位意向：政府事务\n参与本地政府调研和产业政策研究，整理专项报告并推动审批流程优化。';
 const p=verifiedProfile({skills:[],target_roles:['政府事务']},source);
 assert.ok(p.work_evidence.length>=1);
 const why=whyThisJob(p,{title:'政府事务专员'},{
  breakdown:{role:13},matched_required_skills:[]});
 assert.match(why.summary,/政府调研/);
});
