import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeResearchDecision} from './fixtures/retired-research-decisions.mjs';

const resume='负责汽车经销商培训、区域业务分析和数字化项目运营，有真实销售过程管理经验。';
const first={id:'j1',title:'星海汽车有限公司 区域渠道督导 上海 招聘',
 url:'https://careers.xinghai-cn.com/jobs/channel-supervisor-2026',
 source:'星海汽车有限公司',summary:'星海汽车有限公司招聘区域渠道督导，工作地点上海，负责门店销售流程复盘与经销商培训。',
 content:'',availability:{status:'UNKNOWN'}};
const adjacent={id:'j1',title:'北辰数字有限公司 项目运营 杭州 招聘',
 url:'https://careers.beichen-cn.com/jobs/project-operation-2026',
 source:'北辰数字有限公司',summary:'北辰数字有限公司招聘项目运营，工作地点杭州，负责跨部门项目协同和数字产品交付。',
 content:'',availability:{status:'UNKNOWN'}};
const jobOf=hit=>({
 id:'search-'+hit.id,company:hit.source,title:hit.title.replace(hit.source+' ',''),
 title_zh:hit.title,location:hit.url.includes('beichen')?'杭州':'上海',
 official_url:hit.url,match_score:81,score_basis:'简历中记录的实际项目与公开岗位的运营方向相关',
 recommendation_reason:'简历中有渠道运营、项目协调和数据复盘经历，与公开岗位的职责方向存在可解释的联系，具体条件尚需核实。'
});
test('AI action normalizer rejects invented URLs, IDs, PII queries and duplicates',()=>{
 const out=normalizeResearchDecision({actions:[
  {type:'fetch',candidate_ids:['j1','j666','j1']},
  {type:'search',queries:['医药物流 企业项目运营 官方招聘','test@example.com 公司招聘',
   'https://fake.test/jobs/123','医药物流 企业项目运营 官方招聘']},
  {type:'finish'}
 ],shortlist_ids:['j666','j1','j1'],rationale:'read sources'},[first],[]);
 assert.deepEqual(out.fetchIds,['j1']);
 assert.deepEqual(out.queries,['医药物流 企业项目运营 官方招聘']);
 assert.deepEqual(out.shortlistIds,['j1']);
 assert.equal(out.finish,true);
 assert.equal('url' in out,false);
});
test('the real candidate route defaults to model-owned loop and preserves authenticated Word flow',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const word=readFileSync(new URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 assert.match(word,/jobContextForAI/);
 assert.match(route,/v4Match\(fetch,v4JobProvider\(env\)/);
 assert.match(route,/officialOnly:true,curated:true/);
 assert.match(route,/sessionOfBearer\(db,request,Date\.now\(\)\)/);
 assert.match(route,/redactForModel\(raw\.trim\(\),Infinity\)/);
 assert.doesNotMatch(route,/runAgentOwnedMainlandMatch|HHBA_MATCH_DEEPSEEK_KEY/);
});

