import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const src=readFileSync(new URL("./index.tsx",import.meta.url),"utf8");

test("preserves original job marketplace and not a link directory",()=>{
 assert.match(src,/function firstPageJobCards\(rows:Job\[\]\)/);
 assert.match(src,/if\(u\.pathname==="\/api\/jobs\/page"\)/);
 assert.match(src,/function start\(\)/);
 assert.match(src,/id="jobs"/);
 assert.doesNotMatch(src,/id="employer-directory"/);
});
test("OpenAI and existing mainland job datasets retained",()=>{
 for(const target of ['company:"OpenAI",slug:"openai"','domesticObserved:Job[]','meituanCompact','additionalDomesticJobs'])
  assert.ok(src.includes(target),"Missing existing data source: "+target);
});
test("Cursor and Mercor listed as real Ashby feeds",()=>{
 for(const brand of ["Cursor","Mercor"]){
  const slug=brand.toLowerCase();
  assert.ok(src.includes('{platform:"ashby",company:"'+brand+'",slug:"'+slug+'"}'));
  assert.ok(src.includes('"'+brand+'":"'+(brand==="Cursor"?"cursor.com":"mercor.com")+'"'));
 }
});
test("ATS configuration contains no duplicate platform and slug",()=>{
 const block=src.slice(src.indexOf("const boards:Board[]=["),src.indexOf("const esc="));
 const pairs=[...block.matchAll(/\{platform:"(greenhouse|ashby|lever)",company:"[^"]+",slug:"([^"]+)"\}/g)].map(m=>m[1]+"/"+m[2]);
 assert.ok(pairs.length>=36,"Expected preexisting 34 boards plus 2 additions");
 assert.equal(new Set(pairs).size,pairs.length);
});
test("search mapping, fail-safe retry, and health probes remain wired",()=>{
 for(const marker of ["const companyZh=\u0024{JSON.stringify(companyZh)};","const domesticEmployers=new Set(","HHBA_HOME_LIST_RESTORED","HHBA_DOMESTIC_SEARCH_SELFTEST","HHBA_SEARCH_KEYWORD_E2E",'id="retry-search"']){
  assert.ok(src.includes(marker),"Missing search guard: "+marker);
 }
});
test("links remain restricted to supported official ATS hosts",()=>{
 for(const host of ["job-boards.greenhouse.io","jobs.ashbyhq.com","jobs.lever.co"])
  assert.ok(src.includes(host));
 assert.ok(src.includes("const safe=urlOK(url,board.slug,board.platform)"));
});