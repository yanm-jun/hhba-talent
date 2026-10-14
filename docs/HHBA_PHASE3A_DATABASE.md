# HHBA Phase 3A 数据库与索引

迁移：`20261014_phase3a_talent_search`，仅新增表，不修改既有历史迁移。

## 表

`candidate_search_projections` 是派生投影，不是第二份人才主数据。它从 `profiles`、确认版本、已授权 `profile_projects`/`profile_service_intents` 和 `consents` 构建，只保存：展示名、能力标题/摘要、规范化技能/行业/地区/合作方式、本人填写的工作年限、已授权项目摘要、版本及索引时间。

它不保存原始简历、解析原文证据、电话、邮箱、微信、地址或身份证信息。

`talent_search_usages` 持久化每日组织成员计数，唯一键为 `(organization_id, user_id, usage_date)`。

## 同步与删除规则

确认档案或开启企业检索授权会同步投影；保存草稿、替换明细、应用解析草稿或关闭授权会删除投影。查询额外实时检查 `profiles.status IN ('confirmed','published')` 和 `consents.enterprise_search=true`，因此即使投影残留也不能被返回。

管理员可调用受保护的重建接口恢复可用性；重建失败只造成漏检，不会扩大访问范围。

## 中文检索

技能、行业、地区和合作方式使用规范化分隔字段进行参数化精确匹配；能力标题和摘要使用转义后的 `ILIKE`。PostgreSQL 启用 `pg_trgm`，为搜索文本及四个结构化文本列建立 GIN trigram 索引。没有把 PostgreSQL 的英文 FTS 声称为中文分词，也没有启用 pgvector 查询。

当前明确同义词仅三组：经销商运营/汽车门店运营、销售培训/销售人员培训、新能源车销售/新能源汽车销售。规则不改写用户原始档案，匹配理由标明扩展命中。
