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
 assert.doesNotMatch(app,/match:<CandidateMatchPage user=\{user\} embedded\/>/,
  'match must not mount inside personal center externalSections');
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
