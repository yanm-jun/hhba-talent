import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=(file)=>readFileSync(new URL(file,import.meta.url),'utf8');
const app=read('../src/main.tsx');
const home=read('../src/pages/HomePage.tsx');
const auth=read('../src/pages/PhoneAuthPage.tsx');
const emailAuth=read('../src/pages/AuthPage.tsx');
const match=read('../src/pages/CandidateMatchPage.tsx');

test('signed-in users render standalone match page BEFORE workspace route selection',()=>{
 const direct="if(route==='/candidate/match')return <Shell user={user}><MatchWorkspaceSlot/></Shell>;";
 const workbench='const isCandidateWorkspaceRoute=';
 assert.equal(app.split(direct).length-1,1,'exactly one direct match route');
 assert.ok(app.indexOf(direct)<app.indexOf(workbench),'direct match route precedes workbench routing');
 const grouped=app.slice(app.indexOf(workbench),app.indexOf("if(user?.account_types?.includes('candidate')&&isCandidateWorkspaceRoute)"));
 assert.doesNotMatch(grouped,/route==='\/candidate\/match'/,'match must not be grouped under dashboard');
 assert.match(app,/route==='\/candidate\/account\/match'/,
  'a separate account match URL must remain inside the candidate workspace');
 assert.match(app,/match:section==='match'\?<MatchWorkspaceSlot\/>:null/,
  'only the workspace route shares the matcher inside personal center');
});

test('home CTA skips dashboard when signed-in and preserves /candidate/match after sign-in',()=>{
 assert.match(home,/开始智能匹配/);
 assert.match(home,/user\?\.account_types\?\.includes\('candidate'\)\?'\/candidate\/match':'\/candidate\/login\?next=%2Fcandidate%2Fmatch'/);
 assert.match(auth,/requested === '\/candidate\/match'/);
 assert.match(auth,/navigate\(safeNext\)/);
 assert.match(auth,/\?next=%2Fcandidate%2Fmatch/);
 assert.match(emailAuth,/next==='\/candidate\/match'/);
 assert.match(emailAuth,/navigate\(safeNext\)/);
 assert.match(match,/to="\/candidate\/login\?next=%2Fcandidate%2Fmatch"/);
});

test('the match page keeps its original upload, consent and AI search flow',()=>{
 assert.match(match,/id="hhba-ai-resume"/);
 assert.match(match,/type="file"/);
 assert.match(match,/checked=\{consent\}/);
 assert.match(match,/submitExtractedResumeText/);
 assert.match(app,/if\(route==='\/candidate\/account'\)/);
});

test('homepage and workspace use one matching component but distinct presentation routes',()=>{
 const center=read('../src/pages/PersonalCenterPage.tsx');
 const vault=read('../src/components/PrivateResumeVault.tsx');
 const history=read('../src/components/CandidateMatchHistory.tsx');
 const styles=read('../src/styles/resume-match.css');
 assert.match(app,/if\(route==='\/candidate\/match'\)return <Shell user=\{user\}><MatchWorkspaceSlot\/><\/Shell>/);
 assert.match(app,/route==='\/candidate\/account\/match'\?'match'/);
 assert.match(app,/match:section==='match'\?<MatchWorkspaceSlot\/>:null/);
 assert.match(center,/label:'智能岗位匹配',path:'\/candidate\/account\/match'/);
 assert.match(center,/if\(id==='match'\)return '\/candidate\/account\/match'/);
 assert.match(center,/hasVisited\(key\)/,'already opened workspace panels remain mounted');
 assert.match(center,/aria-hidden=\{inactive\}/,'inactive panels are not visible');
 assert.match(center,/className="hhba-account-sidebar"/);
 assert.match(center,/className="hhba-account-content"/);
 assert.match(match,/embedded=\{embedded\|\|hosted\}/,'the shell only disappears when embedded');
 assert.match(match,/className=\{embedded\?'hhba-ai-page hhba-ai-page-embedded':'hhba-ai-page'\}/);
 assert.match(match,/!embedded&&<nav className="hhba-ai-breadcrumb"/);
 assert.match(styles,/\.hhba-ai-page-embedded \.hhba-ai-layout\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(styles,/\.hhba-ai-page-embedded \.hhba-ai-aside\{display:none\}/);
 assert.match(vault,/\/candidate\/account\/match\?resume=/);
 assert.match(history,/\/candidate\/account\/match/);
 assert.ok(auth.includes("requested === '/candidate/account/match'"),'phone authentication must accept the exact workspace destination');
 assert.ok(emailAuth.includes("next==='/candidate/account/match'"),'email authentication must retain the workspace destination');
 assert.ok(app.includes("navigate('/candidate/login?next=%2Fcandidate%2Faccount%2Fmatch')"),'expired workspace session must return to the match panel after login');
 assert.doesNotMatch(vault,/\/candidate\/match/);
 assert.doesNotMatch(history,/\/candidate\/match/);
});

test('one session-owned portal survives route changes without duplicating the matcher',()=>{
 const host=read('../src/components/MatchWorkspaceHost.tsx');
 assert.match(app,/return <MatchWorkspaceHost key=\{String\(user\?\.id\|\|'guest'\)\+': '\+sessionEpoch\}/.source.includes("unused")?/never/:/return <MatchWorkspaceHost key=/);
 assert.equal((app.match(/<CandidateMatchPage user=/g)||[]).length,1);
 assert.match(app,/workspace=\{<CandidateMatchPage user=\{user\} embedded=\{route!=='\/candidate\/match'\} hosted hostRoute=\{route\}\/>\}/);
 assert.match(host,/createPortal\(<Suspense fallback=\{fallback\}>\{workspace\}<\/Suspense>,container\)/);
 assert.match(host,/node.appendChild\(container\)/);
 assert.match(host,/if\(container.parentNode===node\)container.remove\(\)/);
 assert.match(match,/if\(taskOpen.current\|\|controller.current\)/);
 assert.match(match,/taskFailed=\{taskFailure\}/);
});
