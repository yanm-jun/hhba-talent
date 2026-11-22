import test from 'node:test';
import assert from 'node:assert/strict';
import {jobResearchQuality} from '../functions/_lib/agent-quality-metrics.js';

test('quality counters describe actual evidence and never call candidate links verified',()=>{
 const quality=jobResearchQuality([
  {id:'a',jd_source_status:'VERIFIED_JD',match_score:91,
   evidence_reason_status:'AI_INDIVIDUAL_ANALYSIS',availability_status:'OPEN_LISTED'},
  {id:'b',evidence_status:'PARTIAL_SOURCE',match_score:80,
   evidence_reason_status:'AI_INDIVIDUAL_ANALYSIS',availability_status:'UNKNOWN'},
  {id:'c',evidence_status:'SEARCH_SNIPPET_ONLY',match_score:63,
   evidence_score_status:'AI_DIRECTION_REFERENCE_SCORED',availability_status:'UNKNOWN'},
  {id:'d',evidence_status:'INSUFFICIENT_EVIDENCE',match_score:null}
 ],{searches:8,agent_decisions:3,checkpoint_restored:true,
   score_feedback:{feedback_rounds:1,feedback_refined_jobs:1}});
 assert.equal(quality.shortlisted,4);
 assert.equal(quality.scored,3);
 assert.equal(quality.verified_full_jds,1);
 assert.equal(quality.source_evidence,2);
 assert.equal(quality.direction_reference_scores,1);
 assert.equal(quality.score_coverage_pct,75);
 assert.equal(quality.evidence_coverage_pct,50);
 assert.equal(quality.feedback_refined_jobs,1);
 assert.equal(quality.agent_checkpoint_recovered,true);
 assert.equal(quality.label,'single_run_descriptive_not_ground_truth');
 assert.ok(!('accuracy' in quality));
});
test('empty report does not claim 100% success',()=>{
 const quality=jobResearchQuality([]);
 assert.equal(quality.shortlisted,0);
 assert.equal(quality.score_coverage_pct,null);
 assert.equal(quality.reason_coverage_pct,null);
});
test('unsupported numeric scores are counted explicitly instead of hidden',()=>{
 const metric=jobResearchQuality([{evidence_status:'INSUFFICIENT_EVIDENCE',
  match_score:90}]);
 assert.equal(metric.unsupported_scores,1);
});
