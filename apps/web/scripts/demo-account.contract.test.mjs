import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const base=new URL('../src/',import.meta.url);
const source=path=>readFileSync(new URL(path,base),'utf8');
test('candidate routes only expose genuine PNVS sign-in and authenticated workbench',()=>{
 const main=source('main.tsx');
 const login=source('pages/PhoneAuthPage.tsx');
 assert.ok(main.includes("route==='/auth')return <AuthChoicePage/>"));
 assert.ok(main.includes('PhoneAuthPage'));
 assert.match(main,/realAuth\.me\(\)/);
 assert.match(main,/realAuthToUser\(me\)/);
 assert.match(main,/route==='\/candidate'\)return user\?\.account_types\?\.includes\('candidate'\)/);
 assert.match(login,/candidate \? '\/candidate\/account'/);
 assert.doesNotMatch(main,/DemoAuthPage|CandidateDashboardPage/);
});
test('retired mock user system can no longer write fake accounts to local storage',()=>{
 const main=source('main.tsx');
 assert.equal(existsSync(new URL('services/demoAccount.ts',base)),false);
 assert.equal(existsSync(new URL('pages/DemoAuthPage.tsx',base)),false);
 assert.equal(existsSync(new URL('pages/CandidateDashboardPage.tsx',base)),false);
 assert.match(main,/localStorage\.removeItem\('hhba\.demo\.candidate\.v1'\)/);
 const shell=source('components/Shell.tsx');
 const account=source('pages/PersonalCenterPage.tsx');
 assert.doesNotMatch(shell,/useDemoAccount|demoModeEnabled|exitDemoAccount/);
 assert.doesNotMatch(account,/useDemoAccount|updateDemoAccount|createDemoAccount|模拟账户|模拟登录|模拟注册/);
});
test('original workbench has real account profile, isolated favorites and transparent unavailable services',()=>{
 const account=source('pages/PersonalCenterPage.tsx');
 const saved=source('services/savedJobs.ts');
 assert.match(account,/getCandidateWorkspaceProfile\(\)/);
 assert.match(account,/saveCandidateWorkspaceProfile\(/);
 assert.match(account,/saveCandidateWorkspacePreferences\(/);
 assert.match(saved,/HHBA_ACCOUNT_SAVED_JOBS_V1/);
 assert.match(account,/真实投递接口尚未接通/);
 assert.match(account,/私有简历服务尚未接通|真实简历功能尚未开放/);
 assert.match(account,/className="hhba-account-tool-card"/);
 assert.match(account,/className="hhba-account-tool-copy"/);
});
test('workbench layout remains consistent across desktop and mobile',()=>{
 const sourceCss=source('styles/demo-account.css');
 assert.match(sourceCss,/\.hhba-account-tool-copy\{[^}]*display:flex;flex-direction:column;[^}]*min-width:0;/);
 assert.match(sourceCss,/\.hhba-account-tool-grid>a\.hhba-account-tool-card\{[^}]*grid-template-columns:20px minmax\(0,1fr\) 15px;/);
 assert.ok(sourceCss.includes('min-height:88px'));
 assert.ok(sourceCss.includes('.hhba-account-tool-grid{grid-template-columns:1fr}'));
 assert.ok(!sourceCss.includes('grid-template-rows:auto auto'));
 const page=source('pages/PersonalCenterPage.tsx');
 assert.ok(page.includes("import '../styles/demo-account.css';"),'preserve original workbench layout styles');
});
