import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCareerGraph,
  buildTalentSearchQueryPlan,
} from '../functions/_lib/talent-search-career-graph.js';

const resume = [
  '工作经历',
  '负责全国多家门店的日常运营、巡店检查和整改跟进。',
  '制定销售目标，分析线索转化数据并推动门店改善。',
  '组织销售人员培训，协同区域团队执行市场活动。',
  '跟进经销商渠道运营，维护区域合作关系。',
].join('\n');

test('accepts new occupations not present in a hard-coded career dictionary when evidence is exact', () => {
  const graph = validateCareerGraph([
    {
      role: '连锁零售区域运营负责人',
      role_family: '区域经营管理',
      intent: 'adjacent',
      industries: ['零售', '消费品'],
      search_terms: ['多门店运营', '巡店管理', '区域经营'],
      capabilities: ['销售目标管理', '团队培训'],
      evidence: [
        { quote: '负责全国多家门店的日常运营、巡店检查和整改跟进。', kind: 'responsibility' },
      ],
      rationale: '多门店运营、巡店和整改职责可迁移到连锁零售区域运营。',
    },
  ], resume);

  assert.equal(graph.length, 1);
  assert.equal(graph[0].role, '连锁零售区域运营负责人');
  assert.equal(graph[0].intent, 'adjacent');
  assert.equal(graph[0].evidence_count, 1);
  assert.ok(graph[0].direction_confidence > 0.5);
});

test('rejects unsupported model-invented roles and fabricated resume quotations', () => {
  const graph = validateCareerGraph([
    {
      role: '首席人工智能科学家',
      intent: 'transferable',
      evidence: [
        '负责开发大型语言模型和训练千亿参数神经网络。',
        '发表十篇顶级人工智能论文。',
      ],
    },
    {
      role: '全国连锁零售区域运营总监',
      intent: 'adjacent',
      evidence: ['管理过全国1000家直营门店并负责百亿营收。'],
    },
  ], resume);

  assert.deepEqual(graph, []);
});

test('transferable directions require two independent grounded evidence excerpts', () => {
  const graph = validateCareerGraph([
    {
      role: '消费品渠道运营经理',
      intent: 'transferable',
      industries: ['消费品', '快消'],
      evidence: ['跟进经销商渠道运营，维护区域合作关系。'],
    },
    {
      role: '连锁门店运营经理',
      intent: 'transferable',
      industries: ['零售'],
      evidence: [
        '负责全国多家门店的日常运营、巡店检查和整改跟进。',
        '组织销售人员培训，协同区域团队执行市场活动。',
      ],
    },
  ], resume);

  assert.equal(graph.length, 1);
  assert.equal(graph[0].role, '连锁门店运营经理');
  assert.equal(graph[0].evidence_count, 2);
});

test('evidence matching tolerates PDF whitespace and punctuation differences but still requires a source excerpt', () => {
  const graph = validateCareerGraph([
    {
      role: '区域销售运营经理',
      intent: 'direct',
      evidence: ['负责 全国多家门店的日常运营、巡店检查和整改跟进'],
    },
  ], resume.replaceAll('、', '，').replaceAll('\n', '  '));

  assert.equal(graph.length, 1);
  assert.equal(graph[0].role, '区域销售运营经理');
});

test('rejects personal data, URLs, credentials and malformed role labels', () => {
  const graph = validateCareerGraph([
    {
      role: '张三 13800138000',
      intent: 'direct',
      evidence: ['负责全国多家门店的日常运营、巡店检查和整改跟进。'],
    },
    {
      role: '区域运营经理 https://example.com',
      intent: 'direct',
      evidence: ['负责全国多家门店的日常运营、巡店检查和整改跟进。'],
    },
    {
      role: '区域运营经理',
      intent: 'direct',
      search_terms: ['api_key=sk-123456789'],
      evidence: ['负责全国多家门店的日常运营、巡店检查和整改跟进。'],
    },
  ], resume);

  assert.equal(graph.length, 1);
  assert.equal(graph[0].search_terms.length, 0);
});

test('deduplicates equivalent roles and caps the graph at the requested maximum', () => {
  const proposed = Array.from({ length: 40 }, (_, index) => ({
    role: index < 2 ? '全国区域运营经理' : `新职业方向${index}`,
    intent: 'direct',
    evidence: ['负责全国多家门店的日常运营、巡店检查和整改跟进。'],
  }));

  const graph = validateCareerGraph(proposed, resume, { maxDirections: 12 });
  assert.equal(graph.length, 12);
  assert.equal(graph.filter(item => item.role === '全国区域运营经理').length, 1);
});

test('builds multi-wave query variants for direct, adjacent and transferable directions', () => {
  const graph = validateCareerGraph([
    {
      role: '区域督导',
      intent: 'direct',
      industries: ['汽车', '零售'],
      search_terms: ['门店运营', '巡店管理'],
      capabilities: ['目标管理'],
      evidence: ['负责全国多家门店的日常运营、巡店检查和整改跟进。'],
    },
    {
      role: '连锁零售区域运营经理',
      intent: 'adjacent',
      industries: ['零售'],
      search_terms: ['多门店运营'],
      evidence: ['制定销售目标，分析线索转化数据并推动门店改善。'],
    },
    {
      role: '消费品渠道运营经理',
      intent: 'transferable',
      industries: ['消费品'],
      search_terms: ['经销商管理'],
      evidence: [
        '跟进经销商渠道运营，维护区域合作关系。',
        '组织销售人员培训，协同区域团队执行市场活动。',
      ],
    },
  ], resume);

  const plan = buildTalentSearchQueryPlan(graph, { maxQueries: 24, nationwide: true });
  assert.ok(plan.length >= 6);
  assert.ok(plan.some(item => item.intent === 'direct'));
  assert.ok(plan.some(item => item.intent === 'adjacent'));
  assert.ok(plan.some(item => item.intent === 'transferable'));
  assert.ok(plan.every(item => item.query.includes('招聘')));
  assert.ok(plan.every(item => item.search_scope === 'CN_MAINLAND_NATIONWIDE'));
  assert.ok(plan.every(item => item.query.length <= 128));
  assert.ok(plan.some(item => item.query.includes('全国')));
  assert.ok(plan.every(item => !item.query.includes('负责全国多家门店')));
});

test('query plan contains no fixed employer whitelist or raw resume text', () => {
  const graph = validateCareerGraph([
    {
      role: '企业渠道管理经理',
      intent: 'adjacent',
      industries: ['新能源'],
      search_terms: ['经销商渠道'],
      evidence: ['跟进经销商渠道运营，维护区域合作关系。'],
    },
  ], resume);
  const plan = buildTalentSearchQueryPlan(graph);
  const serialized = JSON.stringify(plan);

  assert.match(serialized, /企业渠道管理经理/);
  assert.match(serialized, /新能源/);
  assert.doesNotMatch(serialized, /careers\.tencent\.com|career\.huawei\.com|zhaopin\.meituan\.com|zhaopin\.jd\.com/);
  assert.doesNotMatch(serialized, /负责全国多家门店的日常运营/);
});

test('empty or insufficient resume evidence produces no career graph', () => {
  assert.deepEqual(validateCareerGraph([{ role: '运营经理', intent: 'direct', evidence: ['负责区域运营管理。'] }], ''), []);
  assert.deepEqual(validateCareerGraph([{ role: '运营经理', intent: 'direct', evidence: ['负责区域运营管理。'] }], '个人简历'), []);
});
