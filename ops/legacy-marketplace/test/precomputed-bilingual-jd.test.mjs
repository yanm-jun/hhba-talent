import {test} from 'bun:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openJobSyncStore} from '../jd-sync-store.mjs';

const id='greenhouse-anthropic-5391293008';
const job={id,company:'Anthropic',platform:'greenhouse',source:'anthropic',
 url:'https://job-boards.greenhouse.io/anthropic/jobs/5391293008'};
function setup(){
 const root=mkdtempSync(join(tmpdir(),'hhba-bilingual-'));
 const db=openJobSyncStore(join(root,'jd.sqlite'),{root});
 db.catalogSync([job],{complete:true});
 return {root,db,close:()=>{db.close();rmSync(root,{force:true,recursive:true})}};
}
test('not ready with English until EVERY Chinese part is validated',()=>{
 const t=setup();try{
  const original='Responsibilities:\n\n5 years experience at the employer.';
  const hash=createHash('sha256').update(original).digest('hex');
  t.db.sourceVersion(id,hash,2,original);
  const first=t.db.readyDocument(id,job.url);
  assert.ok(first);assert.equal(first.ready,false);
  assert.equal(first.chineseText,null);
  assert.equal(first.originalText,original);
  t.db.saveVerifiedPart(id,hash,0,2,'岗位职责：');
  const partial=t.db.readyDocument(id,job.url);
  assert.equal(partial.ready,false);
  assert.equal(partial.chineseText,null);
  t.db.saveVerifiedPart(id,hash,1,2,'五年相关经验。');
  const full=t.db.readyDocument(id,job.url);
  assert.equal(full.ready,true);
  assert.equal(full.chineseText,'岗位职责：\n\n五年相关经验。');
  assert.equal(full.sourceHash,hash);
 }finally{t.close()}
});
test('changed employer source hash invalidates previous complete translation',()=>{
 const t=setup();try{
  const source='Salary 10 years';const h=createHash('sha256').update(source).digest('hex');
  t.db.sourceVersion(id,h,1,source);
  t.db.saveVerifiedPart(id,h,0,1,'十年经验');
  assert.equal(t.db.readyDocument(id,job.url).ready,true);
  const changed='Salary 12 years';const next=createHash('sha256').update(changed).digest('hex');
  t.db.sourceVersion(id,next,1,changed);
  assert.equal(t.db.readyDocument(id,job.url).ready,false);
  assert.equal(t.db.readyDocument(id,job.url).chineseText,null);
  assert.throws(()=>t.db.sourceVersion(id,next,1,'wrong text'),/HASH_INVALID/);
  assert.equal(t.db.readyDocument(id,'https://bad.example/other'),null);
 }finally{t.close()}
});
test('six exact featured official jobs are explicitly prioritized before ordinary jobs',()=>{
 const t=setup();try{
  t.db.catalogSync([job,{...job,id:'greenhouse-other-100',company:'Other',
   url:'https://job-boards.greenhouse.io/other/jobs/100'}],{complete:true});
  const first=t.db.claim();
  assert.equal(first.id,id);
 }finally{t.close()}
});
