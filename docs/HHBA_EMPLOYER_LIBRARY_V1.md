# HHBA 企业资源图书馆 · V1（开发草稿）

## 目标与边界

沿用 \`apps/admin-preview\` 原管理后台，不创建第二套用户系统。17个行业馆只提供清晰的“行业 → 企业 → 集团关系 → 招聘来源”导航，给 DeepSeek 搜索提示，**不是企业岗位数据库，更不是招聘官方合作名单**。

## 本次整理结果（来自当前 main 和尚未合并的草稿 PR）

- 主分支已有资料：130条历史审过的招聘入口及90条已记录的集团关联。
- 收集的草稿PR：汽车馆 #333 200条，电子半导体 #336 200条，能源电力 #335/#337 300条，共700条原始候选。
- 归一化结果：882个去重企业实体，130条历史审核招聘入口、685条新候选入口（700条与原库或各批次出现15条重复），354条企业集团关联。部分集团关联仅为招聘系统共享/待核关系。
- 17个馆已建立，**不代表全部馆已导入聊天中收集的100/200/300条名单**；文化传媒、教育科研等馆当前没有从这批仓库来源导入的企业记录，不能假报数量。
- **禁止将 \`collected_unverified\`、集团共用 ATS、历史审核标记解释成当前真实在招。** 同一企业可以跨馆关联，不重复计算为两家企业。

## 文件与数据路径

- \`src/data/employerLibraryCandidateBatches.json\` 保存700条草稿 PR 来源，带每批次原始 tuple / PR 编号。
- \`public/data/employer-library.json\` 前后台共用的轻量检索索引（构建时产生）。
- \`scripts/build-employer-library.mjs\` 从原仓库两份招聘 registry + 90关系 + 700候选批次重建索引，不再手工改 JSON。
- \`functions/_lib/employer-library.js\` 合并只读索引和 D1 管理员补充，给 DeepSeek 输出有限数量的 HTTPS 官方来源搜索线索。 同名企业跨馆导入只增加 related_hall_ids，并保留原主馆、原审核来源与全部招聘入口；拒绝普通第三方招聘平台作为来源。
- \`functions/admin-preview/api/library.js\` 沿用 Cloudflare Access 已签名 JWT / 管理员允许名单；POST 仅同源、最多100条、D1审计入库。
- \`apps/admin-preview\` 原管理后台新“企业资源图书馆”页面，支持17馆切换、集团子公司搜索、分页浏览、批量复制粘贴添加。

## DeepSeek 搜索策略

新索引优先匹配岗位方向、简历中明确的企业及历史审过的站点，选取不同域名；只改变搜索查询的 **最多两个站点提示**，保留至少两个普通全网查询，每次总数不超过4次；必须依赖 DeepSeek Search 返回真实单岗位详情 URL 及证据，不能把门户首页当成岗位。无索引、目录请求失败或匹配不到行业时，继续普通全网搜索。仅 \`employer_portal\` / \`search_candidate\` HTTPS 可作为提示，\`group_shared_candidate\` / \`discovery_candidate\` 不得当作某个子公司的独立招聘入口。

## 部署前必须完成

1. 在主分支或受保护的预览分支验证 \`node --test apps/web/scripts/employer-library.contract.test.mjs\`、现有匹配回归测试、原后台测试。
2. 在既有 **Metrics D1** 执行 \`apps/web/d1/0020_employer_library.sql\`（执行前备份，确认 D1 binding）；否则浏览可用，写入保持关闭。
3. 确认 Cloudflare Access 规则确实覆盖 **/admin-preview 以及子路径**；受保护 POST 的 Origin / JWT / audience / allowlist 必须通过，其他普通访客访问 API 应返回403。
4. 预览环境验收：行业分类、集团关系、跨馆归类、同名去重、100条批量导入、无独立招聘入口的子公司；输入非法 URL 会被拒绝。
5. 只在 CI/预览验收后合并部署 \`main\`，不因合并而绕过已有生产 AI 开关。未迁移或鉴权失败禁止开放写入。

此版只是首轮实际接入：其余聊天窗口中的数百条名单仍需要有原始来源文件或 PR 才能安全归并，不能把数量虚报为已入库。
