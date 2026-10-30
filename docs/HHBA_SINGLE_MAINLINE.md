# HHBA 单一主线开发约定（2026-10-30）

## 唯一权威入口
- 仓库：`yanm-jun/hhba-talent`
- 分支：`main`
- GitHub Pages 静态站：`https://yanm-jun.github.io/hhba-talent/`
- 所有经审核的企业、资料、岗位方向、Logo、企业照片、人才政策、求职者端、雇主端和后台预览，都从此分支构建。
- 绝不把企业详情设计成一家公司一个独立 Pages 子站，也不得从多个长期分支在构建时动态拼接正式发布物。

## V2 资料的唯一真实来源
- 既有企业专属页面：`apps/web/src/pages/*CompactProfilePage.tsx`
- 企业 V2 数据：`apps/web/src/data/employerProfiles/cn-autumn-*.json`
- 通用企业页面：`apps/web/src/pages/UnifiedV2CompanyPage.tsx`
- 统一企业注册和岗位转化：`apps/web/src/services/employerProfiles.ts`、`apps/web/src/services/domesticRebuildJobs.ts`
- 统一岗位搜索：`apps/web/src/components/UnifiedJobMarket.tsx` 与 `apps/web/src/services/liveRecruitment.ts`
- 专业匹配：`apps/web/src/components/CompanyMajorJobs.tsx`
- 本地 Logo / 企业图片：`apps/web/public/images/employer-profiles/<id>/`
- 广之旅三张媒体文件由 `apps/web/scripts/prepare-guangzhilv-media.py` 在主站编译前准备；如来源访问受限，须醒目标注素材不可用，不得用其他企业实景冒充。

## V2 新企业上线必须一次完成
1. 在以上数据目录新增 V2 JSON，保留真实企业名、官方招聘入口与证据来源，不伪造职位实时状态。
2. Logo 和两张独立图片均保存为主站静态资源，引用路径能在 GitHub Pages 的 `/hhba-talent/` 基址下加载。
3. 在原有招聘市场同一个搜索框检索公司中文名、简称、英文名和别名；不增加新的搜索入口。
4. 专业标签切换岗位方向，企业详情使用 `/companies/autumn/cn-autumn-NNN` 路由。
5. 运行 `npm ci`、`node scripts/v2-market-search.contract.test.mjs`、`npm run build`，并在真实 Pages 站点检查检索结果和图片。
6. GitHub Pages 只发布 `main`；阿里云正式环境必须另行明确验收确认，禁止因代码提交自动部署生产。

## 既有成果与边界
- 15 家较早的 V2 专项企业 + 16 家新录入企业（cn-autumn-012 至 cn-autumn-027），总计 31 家开发成果；各家详细验收状态需要独立确认。
- 200 家企业目录是资料发现目录，不等于 200 家均完成 V2 深度介绍。
- 2027 届招聘方向属于来源存档，不等于发布时仍开放投递。
- `apps/admin-preview` 是公开只读的投资人/管理演示资料；真实内部数据库、验证码和商业操作系统不可以直接暴露到 GitHub Pages。
- 只在重要变更充分验收后考虑清理历史分支；不要贸然删原始审查证据。
