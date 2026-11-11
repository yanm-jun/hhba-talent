# HHBA S4 · DeepSeek 全程主导的官方白名单优先搜索（2026-11-11）

> **定版规则**：不是「HHBA 数据库先匹配职位、DeepSeek 不够再补」，而是「DeepSeek 分析简历 → DeepSeek 优先搜索 HHBA 已核验企业的官网招聘范围 → 若岗位不够适配，再由 DeepSeek 全网搜索 → DeepSeek 综合两轮候选统一排序、生成理由」。企业白名单仅向模型提供真实企业与招聘官网的搜索范围，不替代模型的简历匹配能力。完全不依赖企业私有招聘 API。

## 一、完整执行路径

```text
已授权并脱敏的简历
     |
查询 HHBA 内部已审核来源（企业主体/招聘网址/公开业务标签；不产生岗位匹配分）
     |
已核验来源 >= 1？   否 ──> DeepSeek 全网 Search → Fetch → 模型匹配
     |
     是
     |
[白名单较多时 DeepSeek 自行决定优先搜索哪些企业]
     |
DeepSeek Search 企业已审核网址（site:官方招聘域名/ATS 租户）
     |
代码检查：候选必须落在已审核 EXACT 域名；第三方共享 ATS 要同时符合特定租户路径
     |
DeepSeek Fetch 公开职位详情（能读到时）
     |
DeepSeek 分析/评分/推荐、给出实际岗位与公司
     |
模型推荐少于目标数量或适配评分不足？
     是 ──> DeepSeek 再 Search 全网中国大陆真实岗位
                   | 
               DeepSeek Fetch 公共岗位详情
                   |
               DeepSeek 对两轮候选统一重新排序
     |
DeepSeek 输出官方（或企业专属 ATS）职位候选 + 理由
     |
S2 异步记录新发现网址/企业/岗位为 PENDING
     |
[另一个审核工序查官网归属证据，人工或独立确认后才进入白名单]
```

## 二、S4 代码组成

- `apps/web/functions/_lib/deepseek-reviewed-scope-v1.js`：
  - 读取 Preview D1 独立白名单；只接受 **VERIFIED + 公开企业官网证明网址 + 真实审核人记录 + 未过期** 的条目。白名单默认仅在 `HHBA_AUTH_ROLLOUT=preview` 且 `HHBA_DEEPSEEK_WHITELIST_SEARCH_ENABLED=1` 时生效。
  - 封闭危险网址和招聘聚合站，拒绝不同企业的 ATS 租户冒用。对于共享 ATS 必须配置可核验的企业租户路径，并保留企业官网的证明链接。
  - 单次读取最多 48 家可信企业；超过 4 家时先由 DeepSeek Responses 在公开的公司标签里挑选 4 家优先搜索。此步骤不是本地规则岗位评分器，也不返回用户岗位。
  - 组合 `site:` 查询发送给 DeepSeek Search，网址验证在模型结果到达后执行，避免 `site:` 查询检索到共享 ATS 的其他公司。
- `apps/web/functions/_lib/deepseek-search-match.js`：
  - 白名单最多 4 组 Search 及现有公共详情读取；DeepSeek 负责初步选岗、评分与短理由；数量不足或评估偏低则继续 DeepSeek Search 全网。
  - 扩展后重新交给 DeepSeek 对两轮候选统一比较；过滤公开招聘板、境外岗位、与已核验企业名不一致的职位；用户仍只得到实际网页搜索候选里的原始网址。
  - 其他旧代码路径和原有用户历史记录的保存机制不变。
- `apps/web/functions/api/match-native/[[path]].js`：授权用户简历传入原有流程，仅多带已审核企业公开来源参数；不会在用户页面显示内部白名单。

## 三、审核过的白名单表（与 AI 候选隔离）

`apps/web/d1/0023_deepseek_official_whitelist_v1.sql`：新建 `hhba_reviewed_recruitment_sources`，保存企业显示名称、可选法定主体、企业官网、招聘入口、官方归属证明网址、审核人/审核时间/到期时间、主营与其他业务标签以及 `PENDING / VERIFIED / SUSPENDED / REJECTED` 状态。

**禁止的错误行为**：

1. DeepSeek Search 结果 `site:company.com` 命中就自动认定该企业官网或职位真在招。
2. 将 `S2 PENDING` 来源、`S3 PROPOSED` 行业标签自动提升成白名单 `VERIFIED`。
3. 认为 ATS 共享域名 `jobs.lever.co` 的所有租户都属于某个已审核企业。
4. 将第三方大众招聘网站作为最终用户的投递入口。
5. 使用企业私有招聘 API、绕过登录和验证码、下载非公开岗位或抓取用户身份资料。
6. 将用户脱敏简历、匹配分、推荐理由存进公共企业资料库。

## 四、首批 Preview 审核来源（2026-11-11）

本轮在线核验公开招聘来源，只在 **Preview D1** 做小规模样本入库，不影响 `hhba.work` 生产数据库：

| 企业 | 企业官网 | 公开招聘网址 | 支持的官方材料 |
| --- | --- | --- | --- |
| 华为 | https://www.huawei.com/ | https://career.huawei.com/ | https://www.huawei.com/cn/contact-us （企业官网「招聘官网」入口） |
| 腾讯 | https://www.tencent.com/ | https://careers.tencent.com/ | https://careers.tencent.com/m/zh-cn/termsservice.html （腾讯自有招聘服务条款声明） |
| 美团 | https://www.meituan.com/ | https://zhaopin.meituan.com/ | https://zhaopin.meituan.com/web/question/social （美团招聘官方常见问题） |

这里验证的是**网站来源的可信度，不是每个职位都在招**。岗位仍按实际公开职位详情页逐条检查，校招/社招、工作城市按具体职位判断。

三条样本都设置审核记录与约 88 天失效时间，过期后不能直接用作优先搜索范围，需要复核。生产环境没有设置任何本阶段自动抓取/白名单开关。

## 五、验收与限制

- CI: `HHBA S4 DeepSeek official whitelist-first search (isolated)` 同时运行 S1/S2/S3/S4 的离线合成测试，不需要 API Key，也不使用真实个人简历。
- D1: `0023` 只迁入独立 Preview DB；Preview 中测试白名单查询与合法性过滤，检查旧 S2/S3 仍能保存新发现为候选。
- Preview 的实际白名单新表已经迁移并写入华为、腾讯、美团 3 个公开证据核对的官方来源；`review_status=VERIFIED` 是企业招聘来源审核，而非岗位仍在招的证明。
- Cloudflare Pages Preview **只启用** `HHBA_DEEPSEEK_WHITELIST_SEARCH_ENABLED=1` 和 `HHBA_KNOWLEDGE_CAPTURE_ENABLED=1`；所有原 Preview env keys、原有 Secret 引用及生产环境 keys 已比对保留。S3 自动业务补全开关仍为 OFF，避免用户浏览时增加额外的背景模型调用。
- DeepSeek 官方 API 文档（https://api-docs.deepseek.com/zh-cn/guides/search/）确认 Search 为 `POST /v1/tools/search`，Fetch 为 `POST /v1/tools/fetch`，查询语法支持 `site:`。实际 DeepSeek 在线搜索、全网补充、SSE 端到端时延与浏览器可见结果，仍需在当前 Preview 完成构建后用获授权的非个人测试资料验收；**不能把离线模拟测试误报为线上 DeepSeek 调用成功**。
- 目前仓库另外两组历史 CI 的失败出现在简历页、首页文案断言，和本分支新增的白名单函数无关。
- 现有 `main`、`hhba.work`、生产 D1 均不改动。PR 先作为 Draft，S1→S2→S3→S4 按顺序验收后才能合并。

## 六、后续扩大规模

初期 3 家示范白名单仅用于验证管线和信任状态。以后逐步按行业批量增加可证明的企业身份/业务/官方招聘来源。DeepSeek 针对用户简历决定先看哪些公司；未覆盖的领域自动回退全网搜索，并将新线索提交候选审核队列。原则上不建立或维护企业私有招聘 API 接口，不做数据库自动投递或保证录用。
