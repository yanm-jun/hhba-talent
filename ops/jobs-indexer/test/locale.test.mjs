import test from "node:test";
import assert from "node:assert/strict";
import {localizeJob} from "../locale.mjs";
import {parseJobQuery,matchesJobQuery} from "../query.mjs";

test("Chinese labels are readable without altering the official original",()=>{
 const job={id:"a",title:"Senior Software Engineer",location:"Singapore",url:"https://jobs.ashbyhq.com/example/id",company:"Example"};
 const zh=localizeJob(job);
 assert.equal(zh.titleZh,"高级软件工程师");
 assert.equal(zh.locationZh,"新加坡");
 assert.equal(zh.title,"Senior Software Engineer");
 assert.equal(zh.url,job.url);
 assert.equal(zh.titleTranslationStatus,"rules");
});
test("Places can include location suffixes and remote tags",()=>{
 const job=localizeJob({title:"Sales Account Executive",location:"Remote - US",company:"A"});
 assert.equal(job.titleZh,"销售客户经理");
 assert.equal(job.locationZh,"远程 · 美国");
 const ny=localizeJob({title:"Data Scientist",location:"New York, NY",company:"A"});
 assert.equal(ny.locationZh,"纽约 · 纽约州");
});
test("Unrecognized English must not leak into the default Chinese display",()=>{
 const job=localizeJob({title:"Mystery Galactic Astronaut",location:"Unlistedopolis",company:"A"});
 assert.equal(job.titleZh,"职位名称待翻译");
 assert.equal(job.locationZh,"工作地点待翻译");
 assert.equal(job.titleTranslationStatus,"needs-review");
 assert.equal(job.title,"Mystery Galactic Astronaut");
});
test("Chinese location and English source both remain accessible",()=>{
 const job=localizeJob({title:"高级工程师",location:"北京",company:"A"});
 assert.equal(job.titleZh,"高级工程师");
 assert.equal(job.locationZh,"北京");
 assert.equal(job.titleTranslationStatus,"original");
});
test("Chinese queries map into official English metadata",()=>{
 const sg=parseJobQuery("新加坡软件工程师");
 assert.ok(matchesJobQuery({title:"Senior Software Engineer",location:"Singapore",remote:false},sg));
 assert.ok(!matchesJobQuery({title:"Sales Manager",location:"Singapore",remote:false},sg));
 const us=parseJobQuery("美国销售");
 assert.ok(matchesJobQuery({title:"Sales Manager",location:"New York, NY",remote:false},us));
 assert.ok(!matchesJobQuery({title:"Sales Manager",location:"Singapore",remote:false},us));
});
test("Remote eligibility and missing education remain conservative",()=>{
 const q=parseJobQuery("不限学历的远程工作");
 assert.equal(q.degreeUnknown,true);
 assert.ok(q.warnings.length>0);
 assert.ok(matchesJobQuery({title:"Software Engineer",location:"Remote",remote:true},q));
 assert.ok(!matchesJobQuery({title:"Software Engineer",location:"Remote",remote:null},q));
});
