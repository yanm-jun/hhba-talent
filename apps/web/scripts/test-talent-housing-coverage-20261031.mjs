import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const src=n=>readFileSync(path.join(here,'../src/data',n),'utf8');
const raw=src('talentHousingCoverageFix20261031.ts');
const match=raw.match(/TALENT_HOUSING_COVERAGE_FIX_20261031:TalentHousingRecord\[\]=([\s\S]*);\s*$/);
assert.ok(match,'missing housing source JSON');
const housing=JSON.parse(match[1]);
const expected=['广州','佛山','惠州','肇庆','揭阳','汕尾','湛江','茂名','阳江','韶关','河源'];
assert.equal(housing.length,11);
assert.deepEqual(new Set(housing.map(r=>r.city)),new Set(expected));
assert.equal(new Set(housing.map(r=>r.id)).size,housing.length);
assert.ok(src('talentHousingRecords.ts').includes('...TALENT_HOUSING_COVERAGE_FIX_20261031'),'housing records not wired into national search');
for(const h of housing){
  assert.equal(h.kind,'program',h.id+' cannot masquerade as an independently verified vacant apartment');
  assert.equal(h.reviewedAt,'2026-10-31');
  assert.ok(new URL(h.sourceUrl).hostname.endsWith('.gov.cn'),h.id+' no government evidence');
  assert.ok(h.steps.length>=4,h.id+' too few application steps');
  assert.ok(h.eligibility&&h.address&&h.units&&h.rent&&h.statusNote,h.id+' missing fields');
  assert.ok(/(不等于|非实时|待核实|未公开)/.test(h.statusNote),h.id+' live inventory must not be claimed');
  assert.ok(/申报(入口|渠道).*?(未公开|待核|未公布)/.test(h.statusNote)||h.applyUrl,h.id+' need portal qualification');
}
const routes=readFileSync(path.join(here,'../src/pages/TalentServiceRoutes.tsx'),'utf8');
assert.ok(routes.includes('const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city===match.name)'),'city hub must use national housing records');
assert.ok(routes.includes("const resultHomes=TALENT_HOUSING_RECORDS.filter(p=>p.city===city"),'housing list must use national housing records');
// Other four were already research-only: do not silently promote secondary-source leads as A/B government verified housing projects.
const research=src('talentHousingResearch.ts');
assert.ok(research.includes('HEZE_HOUSING_RESEARCH_LEADS')&&research.includes('XINGTAI_HOUSING_RESEARCH_LEADS'),'retain research-only leads');
assert.ok(research.includes('"city": "日照"')&&research.includes('"city": "聊城"'),'retain housing leads for the other two cities');
console.log('PASS housing-gap audit: 11 Guangdong empty entrances filled with government-source programs, four other cities continue to display openly labeled research leads, no fabricated vacancy claims');
