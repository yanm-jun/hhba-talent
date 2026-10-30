import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const shell=readFileSync(new URL('../src/components/Shell.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const router=readFileSync(new URL('../src/router.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/experience-navigation.css',import.meta.url),'utf8');
let passed=0;function check(name,fn){fn();passed++;console.log('✓ '+name)}
function nav(start,end){let i=shell.indexOf(start);assert.ok(i>=0,start);let j=shell.indexOf(end,i+start.length);assert.ok(j>i,end);return shell.slice(i,j)}
const publicNav=nav("experience==='public'?<nav","</nav>:experience==='candidate'?");
const candidateNav=nav("experience==='candidate'?<nav",'</nav>:<nav aria-label="企业招聘与治理导航">');
const employerNav=nav('<nav aria-label="企业招聘与治理导航">','</nav>}');
check('One canonical talent policy link points to the real talent service route',()=>{
 assert.equal((shell.match(/function TalentPolicyNavLink\(/g)||[]).length,1);
 assert.ok(shell.includes('to="/talent-service"'));
 assert.ok(shell.includes('>人才政策</Link>'));
 assert.equal((shell.match(/<TalentPolicyNavLink active=/g)||[]).length,3);
});
check('Public and candidate headers show talent policy ahead of recruitment market',()=>{
 for(const n of [publicNav,candidateNav])assert.ok(n.indexOf('<TalentPolicyNavLink')<n.indexOf('to="/candidate/jobs"'));
});
check('Employer menu also includes the same link without losing its existing tools',()=>{
 assert.ok(employerNav.includes('<TalentPolicyNavLink'));
 for(const path of ['/employer/start','/employer/hub','/employer/workspace','/employer/growth','/candidate/jobs'])assert.ok(employerNav.includes('to="'+path+'"'));
});
check('Saved jobs, company discovery and candidate sign-in remain intact',()=>{
 for(const path of ['/companies/discover','/candidate/saved','/auth'])assert.ok(candidateNav.includes('to="'+path+'"'));
});
check('Talent service pages and in-app navigation remain registered',()=>{
 assert.ok(app.includes("route==='/talent-service'"));
 assert.ok(app.includes("route.startsWith('/talent-service/')"));
 assert.ok(shell.includes("aria-current={active?'page':undefined}"));
 assert.ok(router.includes('navigate(to,{scrollY:restoreScrollY,restoreMarketState})'));
});
check('Responsive navigation remains visible on mobile',()=>{
 assert.ok(css.includes('flex-wrap:wrap'));
 assert.ok(css.includes('.hhba-experience-header>nav'));
 assert.ok(!css.includes('.hhba-talent-policy-nav{display:none'));
});
console.log(JSON.stringify({passed,target:'/talent-service',menus:['public','candidate','employer']}));
