import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openJobSyncStore} from './jd-sync-store.mjs';
const hash=character=>character.repeat(64);
const entries=[
 {id:'greenhouse-airtable-100',platform:'greenhouse',source:'airtable',url:'https://job-boards.greenhouse.io/airtable/jobs/100',company:'Airtable'},
 {id:'ashby-deepgram-aaa',platform:'ashby',source:'deepgram',url:'https://jobs.ashbyhq.com/deepgram/aaa',company:'Deepgram'},
 {id:'lever-spotify-abc',platform:'lever',source:'spotify',url:'https://jobs.lever.co/spotify/abc',company:'Spotify'}
];
function setup(t){
 const root=mkdtempSync(join(tmpdir(),'hhba-sync-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 let tick=Date.UTC(2026,9,19);
 const store=openJobSyncStore(join(root,'queue.sqlite'),{now:()=>tick,root});
 return {store,root,now:()=>tick,move:n=>tick+=n};
}
test('only exact overseas ATS IDs and valid HTTPS source enter queue',t=>{
 const {store}=setup(t);
 const added=store.catalogSync([...entries,{id:'INVALID',platform:'ashby',url:'http://example.com',company:'Bad'},{...entries[0],id:'ashby-deepgram-aaa',url:'https://bad.com'}],{complete:true});
 assert.equal(added.discovered,3);
 assert.equal(store.coverage().total_current,3);
 assert.equal(store.coverage().complete,0);
 store.close();
});
test('hash versioning, encrypted/private volume namespace and durable recovery',t=>{
 const {store,root}=setup(t);
 store.catalogSync(entries,{complete:true});
 assert.equal(store.sourceVersion(entries[0].id,hash('a'),2).source_changed,true);
 assert.deepEqual(store.saveVerifiedPart(entries[0].id,hash('a'),0,2,'岗位职责：完成系统开发'),{done:1,total:2,complete:false});
 assert.equal(store.cachedPart(entries[0].id,hash('a'),0,2),'岗位职责：完成系统开发');
 assert.equal(store.coverage().complete,0);
 const finished=store.saveVerifiedPart(entries[0].id,hash('a'),1,2,'任职要求：熟练掌握软件工程与测试');
 assert.equal(finished.complete,true);
 assert.equal(store.coverage().complete,1);
 store.close();
 const reopened=openJobSyncStore(join(root,'queue.sqlite'),{root});
 assert.equal(reopened.coverage().complete,1);
 assert.equal(reopened.cachedPart(entries[0].id,hash('a'),0,2),'岗位职责：完成系统开发');
 assert.equal(reopened.sourceVersion(entries[0].id,hash('b'),3).source_changed,true);
 assert.equal(reopened.coverage().complete,0);
 assert.equal(reopened.cachedPart(entries[0].id,hash('a'),0,2),null);
 assert.equal(reopened.metadata(entries[0].id).done,0);
 reopened.close();
});
test('official feeds can fail without removing existing jobs; complete changed feed marks missing removed',t=>{
 const {store}=setup(t);
 store.catalogSync(entries,{complete:true});
 store.catalogSync(entries.slice(0,1),{complete:false});
 assert.equal(store.coverage().total_current,3);
 store.catalogSync(entries.slice(0,1),{complete:true});
 assert.equal(store.coverage().total_current,1);
 assert.equal(store.coverage().states.REMOVED,2);
 store.close();
});
test('worker leases, retries, progression and expires old segments',t=>{
 const {store,move}=setup(t);
 store.catalogSync(entries.slice(0,1),{complete:true});
 const claimed=store.claim();
 assert.equal(claimed.id,entries[0].id);
 assert.equal(store.claim(),null,'cannot claim a currently leased job twice');
 store.sourceVersion(entries[0].id,hash('c'),2);
 store.saveVerifiedPart(entries[0].id,hash('c'),0,2,'第一个翻译段落');
 assert.equal(store.claim(),null,'translated segment should not prematurely release active job lease');
 store.release(entries[0].id);
 const again=store.claim();
 assert.equal(again.id,entries[0].id);
 store.fail(entries[0].id,'UPSTREAM_HTTP_429');
 assert.equal(store.claim(),null);
 move(13*3600_000);
 assert.equal(store.claim().id,entries[0].id);
 store.sourceVersion(entries[0].id,hash('c'),2);
 store.saveVerifiedPart(entries[0].id,hash('c'),1,2,'第二个翻译段落');
 assert.equal(store.coverage().complete,1);
 move(31*86400_000);
 store.cleanup();
 assert.equal(store.coverage().complete,0,'expired 30 day translations must not remain COMPLETE');
 store.close();
});
test('source version mismatch, missing JD parts or invalid text fail closed',t=>{
 const {store}=setup(t);
 store.catalogSync(entries.slice(0,1),{complete:true});
 assert.throws(()=>store.sourceVersion(entries[0].id,'bad',2),/INVALID_SOURCE_HASH/);
 store.sourceVersion(entries[0].id,hash('e'),2);
 assert.throws(()=>store.saveVerifiedPart(entries[0].id,hash('f'),0,2,'错误译文'),/SOURCE_VERSION_CHANGED/);
 assert.throws(()=>store.saveVerifiedPart(entries[0].id,hash('e'),0,2,'Hello world'),/INVALID_TRANSLATION/);
 assert.throws(()=>store.saveVerifiedPart(entries[0].id,hash('e'),2,2,'错误译文'),/INVALID_JD_PART/);
 assert.equal(store.coverage().complete,0);
 store.close();
});


test('completed official JD is rechecked after seven days without retranslating when the source hash is unchanged',t=>{
 const {store,move}=setup(t);
 store.catalogSync(entries.slice(0,1),{complete:true});
 const id=entries[0].id;
 store.sourceVersion(id,hash('a'),1);
 store.saveVerifiedPart(id,hash('a'),0,1,'任职要求：软件研发经验');
 assert.equal(store.coverage().complete,1);
 assert.equal(store.claim(),null,'recent fully checked JD should not consume queue');
 move(8*86400000);
 const recheck=store.claim();
 assert.equal(recheck.id,id);
 const refreshed=store.sourceVersion(id,hash('a'),1);
 assert.equal(refreshed.complete,true);
 assert.equal(refreshed.source_changed,false);
 assert.equal(store.cachedPart(id,hash('a'),0,1),'任职要求：软件研发经验');
 assert.equal(store.coverage().complete,1);
 assert.equal(store.claim(),null,'recheck must reset the timer rather than looping');
 store.close();
});
test('failed unchanged official JD is not silently retried forever after exhaustion',t=>{
 const {store,move}=setup(t);
 store.catalogSync(entries.slice(0,1),{complete:true});
 const id=entries[0].id;
 store.sourceVersion(id,hash('b'),1);
 for(let attempt=0;attempt<12;attempt++){
  const job=store.claim();
  assert.equal(job?.id,id,'claim must work for attempt '+attempt);
  store.sourceVersion(id,hash('b'),1);
  store.fail(id,'translation_incomplete');
  move(13*3600000);
 }
 assert.equal(store.metadata(id).state,'NEEDS_REVIEW');
 assert.equal(store.claim(),null,'no infinite retries against failing translator');
 store.close();
});
