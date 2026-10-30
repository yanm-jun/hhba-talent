# HHBA 企业生产线 V1（数据驱动）

## 目标与边界
这次整改不改变已上线的 GitHub Pages 首页与阿里云。**一家公司 = 一份 JSON + 三张各自独立的原图**；新公司不再增加 `main.tsx` 路由判断、不改搜索或 Logo 映射、不改固定的岗位总数字段。保留人审核招聘信息、页面验收后再上线的规则。

## 目录结构
- `apps/web/src/data/employerProfiles/cn-autumn-NNN.json`：一份企业档案与全部有来源岗位
- `apps/web/public/images/employer-profiles/cn-autumn-NNN/`：Logo、两张单独的图片
- `apps/web/src/pages/ConfiguredEmployerProfilePage.tsx`：所有新企业共用的四段式模板
- `apps/web/src/services/employerProfiles.ts`：自动发现 JSON / Logo / 企业别名 / 可控岗位链接
- `apps/web/scripts/employer-factory-check.mjs`：上线前批量检测身份、图片、链接、来源与唯一性
- `apps/web/scripts/employer-intake.mjs`：把新公司的 JSON 和三张图片一次复制到正确目录

### 新公司唯一操作
1. 核实企业与原始秋招名录的 ID、中文名称一致；核实 Logo、两张展示图归属。
2. 准备 JSON（参照 `cn-autumn-011.json`），录入名称、英文别名、业务模块、招聘主体与来源。只有明确职位名称和来源的岗位才能写进 `jobs`，无法确认时使用空数组。
3. 运行：
   ```bash
   cd apps/web
   node scripts/employer-intake.mjs --profile /local/cn-autumn-012.json --logo /local/logo.png --photo1 /local/building.jpg --photo2 /local/interior.jpg
   node scripts/employer-factory-check.mjs
   npm run build
   ```
4. 单独开一个 GitHub 预览进行 **桌面 + 移动端、Logo、单字搜索、岗位专业切换、站内详情、图片不跳第三方** 的验收；验收确认前不合并到 `main`、不动阿里云。

### 约束
- 不继承集团的招聘职位给子公司，不臆造具体岗位。
- 所有招聘链接必须 HTTPS，岗位地址必须在该企业已标记招聘来源的**同一域名**，展示第三方来源时应在 `evidenceUrl` 写明并区分岗位现状。
- 当前招聘状态一律不标成已核实在招，除非另行建立持续审查流程。
- 3 张图片物理上独立；同名和无效图片文件会被校验拒绝。
- 旧版 15 家仍采用原数据；泊寓页面切换至通用组件作为回归试点，原有两条岗位继续读取既有经审核数据。
- `main` 或既有 Pages 预览有变化时，预览发布必须验证当前基准，冲突时中断，**不得回退旧首页**。

### 什么算做成功？
- 增加一个新公司的 JSON + 三张图，编译后自动拥有页面、单汉字搜索、Logo、专业匹配和明确来源的站内岗位详情。
- 既有 15 家和 160 条旧岗位保持不变。
- 运行检查只需维护每家数据，不能手改全站岗位总数或手写搜索别名/Logo 映射。
