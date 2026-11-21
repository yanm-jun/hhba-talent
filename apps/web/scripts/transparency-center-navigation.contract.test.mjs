import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const wall=read('pages/TransparencyPage.tsx');
const main=read('main.tsx');
const shell=read('components/Shell.tsx');
const css=read('styles/commitment-wall.css');
const gallery=read('data/commitmentGallery.ts');

test('public commitment wall is canonical and retired finance URLs are safely redirected',()=>{
 assert.ok(main.includes("route==='/commitment'"));
 assert.ok(main.includes("route.startsWith('/transparency/')"));
 assert.ok(wall.includes("navigate('/commitment')"));
 assert.ok(shell.includes("['我们的坚持','/commitment']"));
 assert.ok(!shell.includes('责任与透明'));
 assert.ok(!main.includes("return <TransparencyFundsPage"));
 assert.ok(!main.includes("return <TransparencyReportsPage"));
});

test('public brand page does not promise financial distribution or invent real cases',()=>{
 for(const term of ['每一份职业选择','劳动权益','尚未开放','commitmentGallery.map'])assert.ok(wall.includes(term),term);
 for(const term of ['workerDemoTotals','workerDemoCurrency','60%','40%','资金池','财务报告'])assert.ok(!wall.includes(term),term);
 assert.match(gallery,/src:''/);
 assert.match(gallery,/licensed\/owned/);
});

test('editorial wall supports mobile layout, photo enlargement and reduced motion',()=>{
 assert.match(wall,/role="dialog"/);
 assert.match(wall,/aria-modal="true"/);
 assert.match(wall,/event\.key==='Escape'/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(max-width:430px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
});
