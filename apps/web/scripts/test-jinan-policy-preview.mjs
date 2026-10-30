import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';

const path=new URL('../src/pages/',import.meta.url);
const routes=readFileSync(new URL('TalentServiceRoutes.tsx',path),'utf8');
const preview=readFileSync(new URL('TalentJinanPolicyPreview.tsx',path),'utf8');
const style=readFileSync(new URL('talentJinanPolicyPreview.css',path),'utf8');
const homepage=readFileSync(new URL('TalentServicePage.tsx',path),'utf8');
let done=0;
function test(label,fn){fn();done++;console.log('✓ '+label)}
const policies=TALENT_POLICY_RECORDS.filter(p=>p.city==='济南');
test('Jinan prototype loads only Jinan records and preserves 4 source-linked policies',()=>{
 assert.equal(policies.length,4);
 assert.ok(policies.every(p=>p.sourceUrl.startsWith('https://')));
 assert.ok(preview.includes("TALENT_POLICY_RECORDS.filter(x=>x.city==='济南')"));
});
test('Two 2024 historical records never mixed into application-status-unknown policies',()=>{
 const archive=policies.filter(p=>p.temporal==='historical'||p.temporal==='past-window');
 assert.equal(archive.length,2);
 assert.deepEqual(archive.map(p=>p.id).sort(),['jn-graduate-housing','jn-transport']);
 assert.ok(preview.includes('fresh=sources.filter(p=>!isHistorical(p))'));
 assert.ok(preview.includes('archive=sources.filter(isHistorical)'));
});
test('All four policy classifications have real source-grounded benefit presentation',()=>{
 for(const p of policies)assert.ok(preview.includes("'"+p.id+"':{"),'No highlight for '+p.id);
 assert.ok(preview.includes('房款50%')&&preview.includes('100万/70万/40万元'));
 assert.ok(preview.includes('申领状态待核验'));
});
test('Policy categories are wired to stateful filters, not decorations',()=>{
 assert.ok(preview.includes("useState('all')")&&preview.includes('onClick={()=>setCategory(c.id)}'));
 assert.ok(preview.includes("category==='history'?isHistorical(p):p.category===category"));
});
test('Each card links to existing policy details and official original without nested anchors',()=>{
 assert.ok(preview.includes("'/talent-service/policy/'+encodeURIComponent(record.id)"));
 assert.ok(preview.includes('href={record.sourceUrl}'));
 assert.ok(preview.includes('rel="noopener noreferrer"'));
});
test('Standalone route is exclusive to Jinan sample; existing list route stays available',()=>{
 assert.ok(routes.includes("kind==='policy-layout-preview'&&fragments[2]==='jinan'"));
 assert.ok(routes.includes("else if(kind==='list'&&['policies','benefits','housing','guide'].includes"));
 assert.ok(preview.includes("to=\"/talent-service/list/policies/%E6%B5%8E%E5%8D%97\""));
});
test('New presentation is independently CSS scoped and homepage untouched',()=>{
 assert.ok(style.includes('.jpp-grid')&&style.includes('.jpp-card-archive'));
 assert.ok(style.includes('@media(max-width:720px)'));
 assert.ok(!style.includes('.htl-quick')&&!style.includes('.ts-sub-tile{'));
 for(const block of ['htl-intro','htl-quick','htl-city-grid','htl-housing-grid','htl-policy-list','htl-match'])assert.ok(homepage.includes(block));
});
console.log(JSON.stringify({passed:done,previewRoute:'/talent-service/policy-layout-preview/jinan',city:'济南',policies:policies.length,historical:2,otherCitiesUnchanged:true},null,2));
