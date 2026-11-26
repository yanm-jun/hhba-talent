import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('V4 replaces the hybrid/native trial while keeping authentic JD and history gates',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/saveMatchHistory/);
 assert.match(route,/v4Match\(fetch,v4JobProvider\(env\)/);
 assert.match(route,/officialOnly:true,curated:true/);
 assert.doesNotMatch(route,/runHybridMainlandJobResearch|runAgentOwnedMainlandMatch/);
});
