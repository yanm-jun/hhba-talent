import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256Hex} from '../functions/_lib/real-auth.js';
import {stampV4JobLocator,v4VerifiedJobLocator,locateV4ClaimCandidate} from '../functions/_lib/v4-job-locator.js';
const key='a'.repeat(64);
const source=(id,url)=>({company:'模拟真实企业 '+id,title:'区域督导',employer_proof_url:url,requirements:'区域管理'});
const rows=()=>Array.from({length:500},(_,i)=>{const url='https://careers.synthetic.cn/opening/'+(i+1);return [url,source(i,url)];});
const digest=url=>sha256Hex('HHBA_V4_JOB_WORK:'+key+':'+url);
test('one encrypted private locator serves 500 independent JD claims without rewriting candidate evidence',async()=>{
 const cp={phase:'research',rows:rows(),matches:[],round:7};
 const indexed=await stampV4JobLocator(cp,key);
 assert.notEqual(indexed,cp);assert.equal(cp.jobLocator,undefined);
 assert.equal(indexed.jobLocator.keys.length,500);
 assert.equal(indexed.rows,cp.rows,'index does not clone candidate objects');
 assert.equal(await v4VerifiedJobLocator(indexed,key),indexed.jobLocator.keys);
 assert.equal(JSON.stringify(indexed.jobLocator).includes('careers.synthetic.cn'),false,'locator has only keyed hashes and positional indices');
 for(const i of [0,42,251,499]){
  const match=await locateV4ClaimCandidate(indexed,key,await digest(cp.rows[i][0]));
  assert.equal(match.url,cp.rows[i][0]);assert.equal(match.index,i);assert.equal(match.source,cp.rows[i][1]);
 }
 assert.equal(await stampV4JobLocator(indexed,key),indexed,'unchanged URL set never rehashes all jobs');
});
test('stale or corrupted encrypted locator is discarded and original keyed verification remains authoritative',async()=>{
 const base={rows:rows()};const indexed=await stampV4JobLocator(base,key);
 const replaced='https://careers.synthetic.cn/new-refreshed-job';
 const changed={...indexed,rows:indexed.rows.map((r,i)=>i===321?[replaced,source(321,replaced)]:r)};
 assert.equal(await v4VerifiedJobLocator(changed,key),null,'different candidate set invalidates index signature');
 const found=await locateV4ClaimCandidate(changed,key,await digest(replaced));
 assert.equal(found.index,321,'legacy scan still finds a newly revised candidate');
 const corrupt={...indexed,jobLocator:{...indexed.jobLocator,keys:indexed.jobLocator.keys.map((k,i)=>i===321?'f'.repeat(64):k)}};
 assert.equal((await locateV4ClaimCandidate(corrupt,key,await digest(indexed.rows[321][0]))).index,321,'bad positional hint cannot redirect a job claim');
 assert.equal(await locateV4ClaimCandidate(indexed,key,'f'.repeat(64)),null);
 assert.equal(await stampV4JobLocator(changed,key)!==changed,true,'new checkpoint refreshes locator after vacancy list changes');
});
test('missing and invalid private indexes remain strictly optional',async()=>{
 assert.equal(await stampV4JobLocator({rows:[]},'invalid').then(x=>x.rows.length),0);
 assert.equal(await locateV4ClaimCandidate({rows:[['https://careers.synthetic.cn/one',{}]]},key,await digest('https://careers.synthetic.cn/one')).then(x=>x.index),0);
 assert.equal(await locateV4ClaimCandidate({rows:[]},key,await digest('https://careers.synthetic.cn/missing')),null);
});
