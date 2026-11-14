# HHBA 企业招聘图书馆 Excel 一键导入（2026-11-12）

## 位置与格式
沿用现有 HHBA 管理后台 /admin-preview/ → 「企业招聘图书馆」→ 「上传 Excel / CSV」，保留现有 17 个行业馆与 D1 企业资料表。

Excel 首张工作表使用表头：行业馆、企业名称、招聘网址。
行业馆填写中文名或行业 ID；若文件只有企业名称和招聘网址两列，则须在界面选择默认行业。
支持 .xlsx / UTF-8 .csv；不支持 .xls；文件最大 10 MB、最多 50,000 行。
Excel 公式不执行也不接受；请输入网址文本值，不在导入时调用 AI 猜测企业行业。

## 上传流程
1. Excel 由管理员本地浏览器解析，不把完整文件传至服务器或第三方。
2. 在本地验证企业名称、行业馆、HTTPS 完整网址，按行业+网址过滤文件内重复。
3. 每批最多 100 条，1,000 条为 10 批，3,800 条为 38 批。
4. 每个 API 请求对 100 条做两次定向查询（每次最多 60 URL），并将写入分成最多四组、每组 25 条，以 db.batch 方式处理且保留审计日志。
5. API 响应区分本次新增 inserted、同一次上传重试已提交的 replayed、库内重复 duplicates；前端成功数为 inserted + replayed。
6. 页面持续展示总记录、成功、重复、失败、待处理及当前批次；格式错误支持下载失败清单，意外失败暂停并允许安全重试，D1 超额立即暂停。
7. 成功=新增的行业馆招聘记录，不等于全库不同招聘网址总数；同一官网可被多个企业或行业共享。
8. 完成全部批次后才重新获取一次行业统计；不针对每批执行全库计数。

## 安全边界
- 原有 Cloudflare Access RS256 JWT、管理员邮箱白名单、单源校验和专用请求头不变。
- 仍写入 HHBA_METRICS_DB 中的 hhba_industry_employer_links，待复核标记与管理员审计保留。
- 上传 UUID 用于断线重试计数，批次导入去重并记录来源；原始 Excel 不写入 R2。
- 防过大 ZIP 压缩文件与 Excel 公式注入；拒绝非 HTTPS URL。
- 不修改首页、原用户统计与融资展示界面。

## 上线前置条件
1. 在预览 D1 运行 apps/web/d1/0020_recruitment_library_audit.sql，创建审计表与索引。
2. 仅经 Cloudflare Access 授权后，在隔离预览环境以脱敏样本验证导入、重试与 D1 查询次数。
3. 在用户验收后才合并 main、对生产数据库应用迁移并部署 hhba.work；本开发 PR 不直接更改正式库。

## 检查
node --test apps/web/scripts/admin-library-excel.test.mjs apps/web/scripts/admin-recruitment-library.test.mjs

node --check apps/admin-preview/library-file-import.js

node --check apps/admin-preview/library-file-ui.js

node --check apps/web/functions/admin-preview/api/library.js
