// Feature-branch-only build entry. Uses the REAL frontend component and
// a purely fictional candidate. Never reach AI, user vault or recruiters.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CandidateResumeStage} from '../src/components/CandidateResumeStage';
const sample=[
 '个人信息','虚构用户','求职方向：区域门店督导 / 运营管理',
 '工作经历','演示企业 · 门店运营支持',
 '协助整理门店日常工作记录与客户预约信息。',
 '跟进团队日常沟通及任务安排，帮助同事同步反馈。',
 '项目经历','参与店内活动的记录整理，协助复盘活动过程。',
 '教育经历','示例大学 · 示例专业',
 '专业技能','文档整理 · 沟通协调 · 运营信息汇总'
].join('\n');
createRoot(document.getElementById('stage')!).render(
 <CandidateResumeStage text={sample} fileName="虚构简历样稿.docx"/>
);
