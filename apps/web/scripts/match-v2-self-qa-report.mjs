/**
 * HHBA V2 automated diagnostic report.
 * Runs on every relevant PR update. Entirely deterministic: no production data,
 * vendor credentials or paid model requests. Real preflight results are separately
 * written by preview Functions to D1 and are never faked by this CI report.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const suites=[
 'scripts/clean-match-v2-provider-probe-log.contract.test.mjs',
 'scripts/clean-match-v2-provider-check.contract.test.mjs',
 'scripts/clean-match-v2-route.contract.test.mjs',
 'scripts/clean-match-v2-openai.contract.test.mjs',
 'scripts/clean-match-v2-openai-word.contract.test.mjs'
];
const cmd=[...suites];
const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...cmd],{
 cwd:process.cwd(),encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024,
 env:{...process.env,HHBA_MATCH_OPENAI_API_KEY:'',HHBA_AI_OPENAI_API_KEY:''}
});
const tap=(run.stdout||'')+'\n'+(run.stderr||'');
const number=field=>{
 const match=tap.match(new RegExp('^# '+field+'\\s+(\\d+)','m'));
 return match?Number(match[1]):null;
};
const failedNames=tap.split('\n').filter(line=>/^not ok\s+\d+\s+-\s+/.test(line))
 .map(x=>x.replace(/^not ok\s+\d+\s+-\s+/,'').slice(0,150)).slice(0,30);
const passed=run.status===0&&number('fail')===0&&!run.error;
const report={
 kind:'HHBA_MATCH_V2_CI_SELF_QA',schema_version:1,
 timestamp:new Date().toISOString(),
 commit:process.env.GITHUB_SHA||'local',
 branch:process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||'local',
 execution:'AUTOMATIC_CI_MOCK_ONLY',
 real_ai_status:'NOT_RUN_NO_PROVIDER_SECRETS_IN_CI',
 cloudflare_preview_deploy:'NOT_ASSERTED_BY_THIS_RUN',
 completed:passed,
 suites,
 stats:{tests:number('tests'),passed:number('pass'),failed:number('fail'),
  cancelled:number('cancelled')},
 failed_suites:failedNames,
 result:run.error?'PROCESS_ERROR':run.signal?'TIMEOUT':passed?'PASS':'FAIL'
};
const summary=[
 '# HHBA Clean V2 自动诊断日志',
 '',
 '| 维度 | 本次结果 |',
 '|---|---|',
 '| 验收范围 | 模拟 API / 后端合约 / 路由鉴权 / D1 脱敏 / Word |',
 '| 执行方式 | 自动 PR CI，无需用户逐项点击 |',
 '| 自动化测试 | '+(passed?'通过':'失败')+' |',
 '| 测试数量 | '+(report.stats.tests??'未知')+' |',
 '| 通过 / 失败 | '+(report.stats.passed??'—')+' / '+(report.stats.failed??'—')+' |',
 '| **真实中转站连接** | **未测试**（CI 不读取 Cloudflare 密钥） |',
 '| **真实联网岗位与 JD** | **未测试** |',
 '',
 failedNames.length?'失败项：'+failedNames.join('、'):'没有失败的模拟合约检查。',
 '',
 '真实中转站故障阶段、HTTP 状态及耗时由 Preview D1 的',
 '`hhba_match_v2_provider_probes` 保存，不含 Token、真实简历和上游响应正文。',
 '',
 'commit: `'+report.commit+'`'
].join('\n');
const dir=resolve(process.cwd(),'artifacts','match-v2-self-qa');
mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(dir,'report.md'),summary+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const {appendFileSync}=await import('node:fs');
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
}
console.log(JSON.stringify({kind:report.kind,result:report.result,stats:report.stats,
 failed_suites:failedNames,report_path:'artifacts/match-v2-self-qa/report.json'}));
if(!passed){
 console.error(tap.split('\n').slice(-120).join('\n'));
 process.exitCode=1;
}
