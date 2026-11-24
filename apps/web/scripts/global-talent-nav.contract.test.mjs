import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const shell=readFileSync(new URL('../src/components/Shell.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/experience-navigation.css',import.meta.url),'utf8');
let passed=0;function check(name,fn){fn();passed++;console.log('✓ '+name)}
function nav(){const i=shell.indexOf('<header className="topbar');const j=shell.indexOf('</header>',i);assert.ok(i>=0);assert.ok(j>i);return shell.slice(i,j);}
const header=nav();
check('Top navigation keeps only high-value shortcuts',()=>{
 for(const text of ['海外发展','人才政策','招聘市场','加入我们','个人中心','登录 / 注册'])assert.ok(header.includes(text),text);
 assert.ok(header.includes('<HeaderSiteSearch/>'));
 assert.doesNotMatch(header,/企业招聘导航/);
 assert.doesNotMatch(header,/责任与透明/);
 assert.doesNotMatch(header,/我的收藏/);
});
check('Talent policy and overseas development remain canonical links',()=>{
 assert.equal((shell.match(/function TalentPolicyNavLink\(/g)||[]).length,1);
 assert.ok(shell.includes('to="/talent-service"'));
 assert.ok(shell.includes('to="/study-abroad"'));
 assert.equal((shell.match(/<TalentPolicyNavLink active=/g)||[]).length,1);
});
check('Candidate account remains the personal-center entry',()=>{
 assert.ok(shell.includes('<CandidateAccountDropdown displayName={user?.display_name}/>'));
 assert.ok(shell.includes('to="/auth"'));
});
check('Footer contains the complete categorized navigation',()=>{
 for(const group of ['求职服务','职业机会','劳动者权益','关于汇方','服务与帮助'])assert.ok(shell.includes("title:'"+group+"'"),group);
 for(const path of ['/candidate/match','/candidate/account/resume','/candidate/account/applications','/candidate/account/apply-assistant','/candidate/account/career','/commitment','/vision','/join','/data-use','/membership/rules'])
  assert.ok(shell.includes("['")&&shell.includes(path),path);
 assert.ok(shell.includes('<SiteFooter/>'));
 assert.doesNotMatch(shell,/企业招聘导航|\/companies\/library/);
});
check('Footer is not a second product navigation system',()=>{
 assert.equal((shell.match(/function SiteFooter\(/g)||[]).length,1);
 assert.equal((shell.match(/<SiteFooter\/>/g)||[]).length,1);
});
check('Responsive navigation and footer adapt without hiding the core shortcuts',()=>{
 assert.ok(css.includes('.hhba-site-footer-grid'));
 assert.ok(css.includes('@media(max-width:600px)'));
 assert.ok(css.includes('.hhba-experience-header>nav'));
 assert.ok(css.includes('.hhba-header-site-search'));
});
console.log(JSON.stringify({passed,target:'HHBA global navigation',top:['search','overseas','talent-policy','job-market','join','personal-center'],footer:['job-services','career-opportunities','worker-rights','about','help']}));
