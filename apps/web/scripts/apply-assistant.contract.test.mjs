import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('国内网申助手提供独立入口，不破坏旧个人中心路由',()=>{
 const main=read('src/main.tsx');
 assert.match(main,/CandidateApplyAssistantPage/);
 assert.match(main,/route==='\/candidate\/apply-assistant'/);
 assert.match(main,/route==='\/candidate\/account'/);
 assert.match(read('src/pages/CandidateDashboardPage.tsx'),/to="\/candidate\/apply-assistant"/);
 assert.match(read('src/pages/PersonalCenterPage.tsx'),/to="\/candidate\/apply-assistant"/);
});
test('页面只进行本地个人资料管理，不虚构跨端同步',()=>{
 const page=read('src/pages/CandidateApplyAssistantPage.tsx');
 assert.match(page,/localStorage.setItem/);assert.match(page,/localStorage.removeItem/);
 assert.match(page,/hhba-apply-profile-v1/);
 assert.match(page,/不会自动同步/);
 assert.doesNotMatch(page,/fetch\(/);
 assert.match(page,/当前版本可能需要人工处理/);
});

test('唯一商业模式: HHBA 统一 AI 服务, UI 不开放自带 API Key',()=>{
 const page=read('src/pages/CandidateApplyAssistantPage.tsx');
 assert.match(page,/¥0.30/);assert.match(page,/不需要用户配置 API Key/);
 assert.match(page,/目前仍是内测，不收取费用/);
 assert.doesNotMatch(page,/使用自己的 DeepSeek/);
});
