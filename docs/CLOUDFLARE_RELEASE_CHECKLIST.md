# HHBA Cloudflare Pages 发布验收清单（2026-11-01）

## 目标与隔离
- 唯一代码主线：`yanm-jun/hhba-talent:main`。
- Cloudflare Pages 项目：`hhba-talent`，网站 `https://hhba-talent.pages.dev`。
- 分支 `feature/cloudflare-media-build-20261101` 独立验证，**未通过并取得明确验收前不得合并**。
- GitHub Pages 保留作为对照，不自动覆盖原有生产站。

## 当前 Cloudflare 构建参数
- 根目录：`apps/web`
- Node：22
- 输出目录：`dist`
- 常规生产（尚未切换）：`npm run build`
- 本专项经批准合并后需要设置的构建命令：
  `python3 -m pip install --quiet pyyaml pillow "fonttools[woff]" brotli && python3 scripts/cloudflare-pages-build.py`
- 若合并完成但未同步 Cloudflare 构建命令，图片、字体、公开岗位文件等仍可能缺失；**这两项必须一起验收**。
- 所有 `VITE_HHBA_*_API_ENABLED` 真实业务开关默认继续关闭；不可为了静态页面部署打开未完成的认证后端。

## 预览验收
1. Cloudflare Preview Deployment 五个阶段的结果均为 `success`。
2. 日志中 `HHBA_CLOUDFLARE_MEDIA_STEPS_OK`、`HHBA_CLOUDFLARE_CAMPUS_MEDIA_OK`、
   `HHBA_CLOUDFLARE_BUILD_VERIFIED` 和 `HHBA_CLOUDFLARE_EMPLOYER_MEDIA_VERIFIED` 必须全部出现。
3. 脚本对全部 `src/data/employerProfiles/cn-autumn-*.json` 逐一校验 Logo 和两张媒体文件的发布路径；缺文件即失败。
4. 查看日志 `EDITORIAL_SVG_PHOTO_SLOTS`。该数值是**明确标示的非实景图槽位**，不能向用户宣称都是真实照片。
5. `/companies/autumn/cn-autumn-034`、`/candidate/jobs`、`/candidate/login`、
   `/recruiter/login`、`/study-abroad`、`/talent-service` 的独立直达和刷新均需核查。
6. 抽查全部 83 份 V2 企业档案中的代表性页面；城市政策/住房的 337 城清单仅代表静态记录总数，不等于逐条政策质量合格。
7. 查看官方岗位索引的来源时间和数量，避免以陈旧快照冒充当前可申请岗位。
8. Cloudflare 的构建根路径为 `/`。Cloudflare **不应该发布** 顶层 `404.html`（保留原生 SPA 回退）；GitHub Pages 保留自己的 `404.html`。
9. 对网页的实际可访问性、图片和移动端布局做浏览器核验；仅有 Cloudflare 构建成功不等于完成浏览器测试。

## 生产发布和回滚
- 先审阅 PR 和预览，再明确批准合并。
- 合并后同步 Cloudflare 构建命令，触发 `main` 生产部署，核验部署 SHA 确实等于合并后的 `main` HEAD。
- Cloudflare 生产部署出现失败/图片缺失时，不立即启用真实登录、不替换 GitHub Pages；应回滚 Cloudflare Pages 至上一个已验证部署并恢复安全构建配置。
- 真实个人/企业账号、简历、认证材料和短信必须由独立受控 API 与数据库处理；严禁把凭据放在 `VITE_` 前端环境变量或公开构建产物中。
