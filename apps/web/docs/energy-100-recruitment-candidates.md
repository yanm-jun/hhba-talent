# HHBA 能源电力馆 · 第一批 100 个招聘来源候选（2026-11-11）

**完成：100条不同URL；九个细分区域；独立候选表；Preview-only只读；不会修改现有审核白名单。**

这批仅用于后续 DeepSeek 搜索时规划检索来源，绝不声称100家公司现在都招聘，也不代表100个链接都是可以提交的直达职位。用户正式岗位推荐依旧需要来源归属、具体职位真实性、有效期、实际工作地点等独立核验。

| 分类 | 数量 |
|---|---:|
| 电网运营与输配电 | 3 |
| 发电集团与能源运营 | 12 |
| 核电与核能技术 | 5 |
| 水电与抽水蓄能 | 5 |
| 电力工程、设计与建设 | 20 |
| 光伏与太阳能 | 18 |
| 风电开发与风电装备 | 10 |
| 储能与电池技术 | 15 |
| 电力装备与自动化 | 12 |
| **合计** | **100** |

- 数据：`apps/web/functions/_lib/energy-recruitment-batch-001-100.js`（100条企业名/网址/分类/入口类型/集团归属）。
- 数据库：`apps/web/d1/0029_energy_recruitment_candidate_links_100_v1.sql`，依赖0024行业馆表及已有审核源表；仅打算部署到 Preview D1，不能直接运行生产 D1。
- 内部接口：`apps/web/functions/_lib/energy-candidate-scope-v1.js`，仅 `HHBA_AUTH_ROLLOUT=preview` 时只读返回，标注 `UNVERIFIED` 和 `is_reviewed_whitelist_source=false`。未接入当前对外 API 或正式匹配。
- 类别：`ATS` 企业使用或指向的招聘系统；`CAREERS` 企业官网人才栏目；`NOTICE` 企业发布招聘公告的链接；`DISCOVERY` 企业主站有待继续定位专门招聘页。此类别**不代表核验通过**。
- 有些子公司共用集团招聘系统或集团公告，`parent_group` 追踪关系，而不是虚构子公司独立ATS。金风科技的2条为不同入口，其他企业也可能共享招聘系统。
- 已去重100个完整URL，但是否官网实际归属、能否访问、是否当前有岗位、是否在中国大陆、公告是否已过期，都需要后续逐项核验。

## 核验线索（示例）

国家电网：`https://zhaopin.sgcc.com.cn/`；南方电网：`https://zhaopin.csg.cn/`；中国能建：`https://ceec.iguopin.com/`；明阳集团：`https://mywind.zhiye.com/campus`；三峡集团：`https://www.zhipin.com/dz/sxjt/school`。均可继续从企业发布的2027校招公告追溯，注意不要把猎聘、智联、BOSS的普通聚合页面当作“企业专属入口”；这里只记录找到的企业招聘专项页。

## 禁止误用

1. 不执行正式 D1 迁移、不合并 main、不部署 `hhba.work`。
2. 不开启生产 DeepSeek，不把未经审核的100条写入 `hhba_reviewed_recruitment_sources`。
3. 不把集团首页或过期招聘公告推送成当前实时岗位。
