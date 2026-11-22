import React from 'react';
import {createRoot} from 'react-dom/client';
import {CandidateMatchNativeDialog} from '../src/components/CandidateMatchNativeDialog';
import type {PrivateResume} from '../src/services/privateResumes';
import type {MatchResponse} from '../src/services/resumeMatch';

const resume:PrivateResume={
 id:'11111111-2222-4333-8444-555555555555',
 name:'HHBA-SYNTHETIC-QA.docx',
 type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 size:1000,createdAt:'2026-11-21T00:00:00.000Z'
};
const job={
 id:'role-A',company:'虚构测试企业',title:'虚构运营督导',
 title_zh:'虚构运营督导',location:'上海',
 official_url:'https://jobs.example.org/synthetic-only',
 platform:'EMPLOYER_DOMAIN_CANDIDATE',remote:false,
 reference_score:76,match_score:76,
 jd_version_id:'jd_'+'a'.repeat(32),jd_sha256:'b'.repeat(64),
 jd_source_status:'VERIFIED_JD',jd_score_status:'AI_VERIFIED_JD_SCORED',
 matched:['曾负责门店运营及数据整理'],not_evidenced:[],
 needs_verification:[],score_basis:'合成测试用岗位，不代表真实招聘信息',
 recommendation_reason:'用于验证 Word 优化工作区的显示、编辑和隐私授权',
 availability_status:'UNKNOWN',
 recruitment_source_note:'Synthetic Playwright fixture'
};
const result={
 matches:[job],
 profile:{
  education:'本科',education_evidence:'仅为测试字段',
  experience_years:2,experience_evidence:'负责门店运营和数据整理',
  skills:[{name:'门店运营',evidence:'负责门店运营及日常数据整理工作'}],
  target_roles:['区域运营督导'],
  experiences:[{role:'运营岗位',organization:'虚构测试企业',period:'合成数据',
   evidence:'负责门店运营及日常数据整理工作'}],
  warnings:[]
 }
} as unknown as MatchResponse;
createRoot(document.getElementById('root')!).render(
 <CandidateMatchNativeDialog
  result={result} onClose={()=>{}}
  sourceResume={resume}
  sourceText={'负责门店运营及日常数据整理工作\n门店运营管理\n数据统计'}
  accountScope="hhba-synthetic-word-qa"/>
);
