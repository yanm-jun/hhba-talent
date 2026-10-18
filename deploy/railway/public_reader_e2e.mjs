import test from 'node:test';
import assert from 'node:assert/strict';

const base='https://hhba-live-jobs-preview-production.up.railway.app';
const timeout=milliseconds=>AbortSignal.timeout(milliseconds);

test('real public HHBA listing opens Chinese reader and translates a live JD section',async()=>{
 const listing=await fetch(base+'/api/jobs',{signal:timeout(25000)});
 assert.equal(listing.status,200,'public listing endpoint must respond');
 const data=await listing.json();
 const rows=data.jobs||[];
 const job=rows.find(x=>x.company==='Airwallex'&&x.platform==='ashby'&&
   String(x.title).includes('Staff Data Scientist'));
 assert.ok(job,'expected public official-source sample posting');
 const detail=await fetch(base+'/jobs/'+encodeURIComponent(job.id),{signal:timeout(25000)});
 assert.equal(detail.status,200,'same job should open on HHBA');
 const html=await detail.text();
 assert.match(html,/id="jd-zh"/);
 assert.match(html,/id="jd-en"/);
 assert.match(html,/id="personal-reader"/);
 assert.match(html,/id="translated-paragraphs"/);
 assert.match(html,/重新尝试翻译/);
 assert.ok(html.includes('data-job="'+job.id+'"'),'reader ID must be original listed job ID');
 const re=new RegExp('id="personal-reader" data-job="'+job.id+'" data-hash="([a-f0-9]{64})"');
 const match=html.match(re);
 assert.ok(match,'JD source hash must be in reader attributes');
 const sourceHash=match[1];
 const body=await fetch(base+'/api/jobs/'+encodeURIComponent(job.id)+'/translate-part',{
  method:'POST',
  headers:{'Content-Type':'application/json','Origin':base},
  body:JSON.stringify({part:0,sourceHash}),
  signal:timeout(90000)
 });
 const result=await body.json();
 assert.equal(body.status,200,JSON.stringify(result).slice(0,200));
 assert.equal(result.jobId,job.id);
 assert.equal(result.sourceHash,sourceHash);
 assert.equal(result.part,0);
 assert.ok(result.total>1);
 assert.match(result.text,/[\u3400-\u9fff]/);
 assert.equal(result.mode,'private_reading_translation');
 assert.doesNotMatch(result.text,/【关键信息核对：以下英文原文数字未全部保留】/);
 assert.doesNotMatch(html,/class="reader-original"/,'English must not be embedded in Chinese reading panel');
 assert.match(html,/id="show-original-english"/);
 assert.match(html,/id="numeric-risk"/);
});
