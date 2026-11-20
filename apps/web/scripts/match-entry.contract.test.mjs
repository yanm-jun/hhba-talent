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
 const direct="if(route==='/candidate/match')return <CandidateMatchPage user={user}/>;";
 const workbench='const isCandidateWorkspaceRoute=';
 assert.equal(app.split(direct).length-1,1,'exactly one direct match route');
 assert.ok(app.indexOf(direct)<app.indexOf(workbench),'direct match route precedes workbench routing');
 const grouped=app.slice(app.indexOf(workbench),app.indexOf("if(user?.account_types?.includes('candidate')&&isCandidateWorkspaceRoute)"));
 assert.doesNotMatch(grouped,/route==='\/candidate\/match'/,'match must not be grouped under dashboard');
 assert.match(app,/route==='\/candidate\/account\/match'/,
  'a separate account match URL must remain inside the candidate workspace');
 assert.match(app,/match:<CandidateMatchPage user=\{user\} embedded\/>/,
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
 assert.match(app,/if\(route==='\/candidate\/match'\)return <CandidateMatchPage user=\{user\}\/>/);
 assert.match(app,/route==='\/candidate\/account\/match'\?'match'/);
 assert.match(app,/match:<CandidateMatchPage user=\{user\} embedded\/>/);
 assert.match(center,/label:'智能岗位匹配',path:'\/candidate\/account\/match'/);
 assert.match(center,/if\(id==='match'\)return '\/candidate\/account\/match'/);
 assert.match(center,/hasVisited\(key\)/,'already opened workspace panels remain mounted');
 assert.match(center,/aria-hidden=\{inactive\}/,'inactive panels are not visible');
 assert.match(center,/className="hhba-account-sidebar"/);
 assert.match(center,/className="hhba-account-content"/);
 assert.match(match,/embedded=\{embedded\}/,'the shell only disappears when embedded');
 assert.match(match,/className=\{embedded\?'hhba-ai-page hhba-ai-page-embedded':'hhba-ai-page'\}/);
 assert.match(match,/!embedded&&<nav className="hhba-ai-breadcrumb"/);
 assert.match(styles,/\.hhba-ai-page-embedded \.hhba-ai-layout\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(styles,/\.hhba-ai-page-embedded \.hhba-ai-aside\{display:none\}/);
 assert.match(vault,/\/candidate\/account\/match\?resume=/);
 assert.match(history,/\/candidate\/account\/match/);
 assert.doesNotMatch(vault,/\/candidate\/match/);
 assert.doesNotMatch(history,/\/candidate\/match/);
});
