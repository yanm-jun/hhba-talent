import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialLink,normalize,validateBoards,endpoint,isTalentPool} from "../catalog.mjs";
const registry=JSON.parse(readFileSync(new URL("../boards.json",import.meta.url),"utf8"));
test("board registry retains baseline 36 and has new candidates",()=>{
 assert.equal(registry.boards.length,40);
 assert.equal(validateBoards(registry.boards).length,40);
 assert.ok(registry.boards.some(b=>b.company==="OpenAI"&&b.platform==="ashby"));
 assert.ok(registry.boards.some(b=>b.company==="Form Energy"));
});
test("host allowlist rejects dangerous, non-official, and misattributed URLs",()=>{
 const b={platform:"ashby",company:"Cursor",slug:"cursor"};
 assert.equal(officialLink("https://jobs.ashbyhq.com/cursor/123",b),"https://jobs.ashbyhq.com/cursor/123");
 assert.equal(officialLink("https://evil.example/cursor/123",b),null);
 assert.equal(officialLink("javascript:alert(1)",b),null);
 assert.equal(officialLink("https://jobs.ashbyhq.com/other/123",b),null);
 assert.equal(officialLink("https://user:secret@jobs.ashbyhq.com/cursor/123",b),null);
});
test("normalize only accepts official per-position links",()=>{
 const b={platform:"greenhouse",company:"AlphaSights",slug:"alphasights",website:"alphasights.com"};
 const a=normalize(b,{id:123,title:"Analyst",location:{name:"Singapore"},absolute_url:"https://job-boards.greenhouse.io/alphasights/jobs/123"});
 assert.equal(a?.company,"AlphaSights");assert.equal(a?.location,"Singapore");
 assert.equal(a?.url,"https://job-boards.greenhouse.io/alphasights/jobs/123");
 assert.equal(normalize(b,{id:999,title:"Fake",absolute_url:"https://evil.example"}),null);
});
test("source URLs are native read-only job APIs",()=>{
 for(const b of registry.boards)assert.ok(endpoint(b).startsWith("https://"));
});

test("talent pool placeholders are not counted as specific jobs",()=>{
 assert.equal(isTalentPool("Don't see the job you're looking for?"),true);
 assert.equal(isTalentPool("General Application"),true);
 assert.equal(isTalentPool("Open Application"),true);
 assert.equal(isTalentPool("Senior Software Engineer"),false);
 assert.equal(isTalentPool("Marketing Intern"),false);
});
