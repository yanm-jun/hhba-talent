import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeApplicationRecord} from '../application-history.mjs';
const t=Date.parse('2026-11-07T02:00:00.000Z');
const item={company:'虚构企业',position:'校招设计师',applicationUrl:'https://jobs.example.invalid/apply/777?gh_jid=9876',status:'pending',evidenceKind:'none',synced:false};
test('redirected receipt upgrades exactly one recent pending record, preserves original ATS URL',()=>{
 const before=mergeApplicationRecord([],item,t);
 const newer=mergeApplicationRecord(before,{...item,applicationUrl:'https://jobs.example.invalid/receipt/ok',status:'confirmed',evidenceKind:'success_notice'},t+40000);
 assert.equal(newer.length,1);
 assert.equal(newer[0].status,'confirmed');
 assert.equal(newer[0].applicationUrl,item.applicationUrl);
 assert.equal(newer[0].recordedAt,before[0].recordedAt);
 assert.equal(newer[0].synced,false);
 const late=mergeApplicationRecord(before,{...item,applicationUrl:'https://jobs.example.invalid/receipt/ok',status:'confirmed',evidenceKind:'success_notice'},t+360000);
 assert.equal(late.length,2,'six-minute-old attempt must not be merged');
});
test('no ambiguous or cross-role merge, no downgrade of a confirmed receipt',()=>{
 const pending=mergeApplicationRecord([],item,t);
 const different=mergeApplicationRecord(pending,{...item,position:'另一个岗位',applicationUrl:'https://jobs.example.invalid/receipt',status:'confirmed',evidenceKind:'success_notice'},t+1000);
 assert.equal(different.length,2);
 const once=mergeApplicationRecord(pending,{...item,status:'confirmed',evidenceKind:'success_notice'},t+1000);
 assert.equal(mergeApplicationRecord(once,item,t+2000)[0].status,'confirmed');
 const twoPending=[...pending,{...item,applicationUrl:'https://jobs.example.invalid/apply/999',recordedAt:new Date(t).toISOString()}];
 assert.equal(mergeApplicationRecord(twoPending,{...item,applicationUrl:'https://jobs.example.invalid/receipt',status:'confirmed',evidenceKind:'success_notice'},t+1000).length,3,'ambiguous pending matches cannot be merged');
});
