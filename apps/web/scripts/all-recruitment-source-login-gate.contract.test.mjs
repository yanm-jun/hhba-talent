import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const {recruitmentTarget,rememberRecruitment,pendingRecruitment,clearPendingRecruitment}=await import('../src/services/recruitmentOutbound.ts');
const citics=JSON.parse(readFileSync(new URL('../src/data/domesticCiticsSecuritiesRoles20261029.json',import.meta.url),'utf8'));
const mk=(url,label,flag)=>({
 href:url,target:'_blank',textContent:label,title:'',getAttribute:()=>null,
 dataset:flag?{hhbaRecruitmentOutbound:'true'}:{}
});
test('reported university original-posting link is always login gated',()=>{
 const screen=source('components/UnifiedJobMarket.tsx');
 assert.match(screen,/data-hhba-recruitment-outbound="true" href=\{job\.evidenceUrl\}/,
  'screenshot: source URL must carry explicit outbound marker');
 assert.equal(citics.jobs.length,5);
 for(const job of citics.jobs){
  assert.equal(recruitmentTarget(mk(job.sourceUrl,'查看高校平台原始职位公告',true)),job.sourceUrl,
   'missing login capture for '+job.id);
 }
});
test('historical China employer evidence and source links share gate',()=>{
 const files=[
  ['components/DomesticAutumnMarket.tsx',/href=\{job\.sourceUrl\} data-hhba-recruitment-outbound="true"/],
  ['pages/AutumnCompanyProfilePage.tsx',/href=\{safeUrl\(j\.sourceUrl\)!\}[^>]*data-hhba-recruitment-outbound="true"/],
  ['pages/DomesticCompanyPage.tsx',/data-hhba-recruitment-outbound="true" href=\{recruitment\.evidenceUrl\}/],
 ];
 for(const [p,re] of files)assert.match(source(p),re,'unguarded recruitment source: '+p);
 const company=source('pages/DomesticCompanyPage.tsx');
 assert.match(company,/<a href=\{httpsLink\(article\?\.officialSource/,'ordinary company source remains browseable');
 assert(!company.includes('<a data-hhba-recruitment-outbound="true" href={article.industryEvidenceUrl}'),
  'ordinary product and company citations must not be gated');
});
test('policy only gates recruitment sources, never photo or corporate citations',()=>{
 const shouldBlock=[
  ['https://jdjyw.jlu.edu.cn/mportal/recruit/details?id=123','查看高校平台原始职位公告'],
  ['https://www.career.zju.edu.cn/jyxt/sczp/zpztgl/ckZpgwXq.zf?zpxxbh=123','查看高校平台原始职位公告'],
  ['https://company.example.org/notice','招聘入口核验依据'],
  ['https://company.example.org/graduate','高校岗位招聘公告'],
  ['https://jobs.example.org/start','查看招聘官网']
 ];
 for(const [u,label] of shouldBlock)assert.equal(recruitmentTarget(mk(u,label)),u,label);
 for(const [u,label] of [
  ['https://company.example.org/info','企业公开资料'],
  ['https://company.example.org/team','人物身份来源'],
  ['https://company.example.org/images','图片来源'],
  ['https://company.example.org/history','官方历史资料'],
  ['https://company.example.org/safety','查看防诈骗提示']
 ])assert.equal(recruitmentTarget(mk(u,label)),null,label);
});
test('malformed explicit destinations fail closed without untrusted open-redirect',()=>{
 for(const u of ['http://example.org/jobs','javascript:alert(1)',
  'https://localhost/jobs','https://example.org:9443/jobs',
  'https://hahr.hazq.com:8083/another','https://x@jobs.example.org/apply'])
  assert.equal(recruitmentTarget(mk(u,'官方招聘',true)),null,u);
 const huaan='https://hahr.hazq.com:8083/eip4ha-hyapp/recruitment';
 assert.equal(recruitmentTarget(mk(huaan,'官方招聘',true)),huaan);
 const shell=source('components/Shell.tsx');
 assert(shell.includes("if(!destination&&anchor.dataset.hhbaRecruitmentOutbound==='true')"));
 assert(shell.includes('event.preventDefault();event.stopPropagation();return;'));
 assert(shell.includes('onClickCapture={guardRecruitmentClick}'));
 assert(shell.includes('onAuxClickCapture={guardRecruitmentClick}'));
 assert(shell.includes('onContextMenuCapture={guardRecruitmentContextMenu}'));
});
test('original university URL survives registration redirect and never directly auto-opens',()=>{
 const saved=new Map();
 globalThis.sessionStorage={setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k)||null,removeItem:k=>saved.delete(k)};
 const url=citics.jobs[0].sourceUrl;
 assert.equal(rememberRecruitment(url,'查看高校平台原始职位公告',
  '/candidate/jobs/cn-v2-citics-shanghai-branch-trainee'),true);
 assert.equal(pendingRecruitment()?.url,url);
 assert.equal(pendingRecruitment()?.origin,'/candidate/jobs/cn-v2-citics-shanghai-branch-trainee');
 const continuation=source('pages/OfficialRecruitmentContinuePage.tsx');
 const shell=source('components/Shell.tsx');
 assert(shell.includes("navigate('/candidate/register?next=%2Fcandidate%2Fofficial-outbound')"));
 assert(continuation.includes("const signed=accountBackendReady&&!!user?.account_types?.includes('candidate')"));
 assert(continuation.includes('!accountBackendReady?<><h2>正式账户服务尚未开通'));
 assert(continuation.includes('href={saved.url}'));
 assert(continuation.includes('onClick={()=>clearPendingRecruitment()}'));
 assert(!continuation.includes('window.open('));
 assert(shell.includes('verifiedCandidate=hasCandidate&&(employerApiReady||realAuthReady)'));
 clearPendingRecruitment();
 assert.equal(pendingRecruitment(),null);
});
console.log('ALL_RECRUITMENT_SOURCES_LOGIN_GATE_REGRESSION_OK');
