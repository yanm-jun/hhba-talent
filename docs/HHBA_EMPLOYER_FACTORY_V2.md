# HHBA 企业工厂 V2

> 只升级开发流程，不改变现有企业页面视觉、搜索、岗位匹配和正式站。
> V2 可继续读取 V1 的 `schemaVersion: 1` 企业 JSON；无需一次性迁移全部企业。

## 固定输入（单家公司）

- 公司编号：`cn-autumn-019`（必须属于 `domesticAutumnScreenshot20261028.json` 已登记的企业）
- `apps/web/src/data/employerProfiles/cn-autumn-019.json`：公司档案、名称/搜索别名、来源、官方招聘入口、专业需求和来源岗位
- `apps/web/public/images/employer-profiles/cn-autumn-019/logo.png`
- `apps/web/public/images/employer-profiles/cn-autumn-019/photo1.webp`
- `apps/web/public/images/employer-profiles/cn-autumn-019/photo2.webp`
- JSON 的可选 `mediaSources` 包含这三个独立照片的公开 HTTPS 原始网址。**采集脚本验证文件安全，不代替人工核实品牌归属及授权。**

## 一次性通用操作

在 `apps/web` 目录：

```bash
# 图片尚未保存时，读取 JSON 的 mediaSources，下载到本地。旧素材不自动覆盖。
python -m pip install requests Pillow
python scripts/factory-v2-media.py cn-autumn-019

# 所有企业的档案 + 图片 + 岗位来源一致性校验
node scripts/employer-factory-check.mjs
node scripts/factory-v2-validate.mjs cn-autumn-019
node scripts/factory-v2-validate.mjs --all

# 前端统一编译、自动补齐所有企业及岗位的静态深链
export HHBA_GITHUB_PAGES=1
export HHBA_PAGES_BASE=/hhba-talent/preview-factory-v2/
export VITE_HHBA_VERIFIED_SNAPSHOT=1
export VITE_HHBA_OVERSEAS_CURATED_100=1
export VITE_HHBA_DOMESTIC_REBUILD_V2=1
export VITE_HHBA_ACCOUNT_API_ENABLED=0
export VITE_DEMO_ACCOUNT_ENABLED=0
npm ci
npm run build
node scripts/factory-v2-routes.mjs
```

浏览器测试（统一脚本，不再为新公司新建 `.browser.mjs`）：

```bash
npm install --no-save --no-package-lock playwright@1.56.1
npx playwright install chromium
HHBA_GITHUB_PAGES=1 HHBA_PAGES_BASE=/hhba-talent/preview-factory-v2/ npm run preview -- --port 4173
# 另一个终端:
HHBA_EMPLOYER_ID=cn-autumn-019 node scripts/factory-v2-browser.mjs
```

## GitHub Actions / 发布边界

共用流水线：`.github/workflows/hhba-employer-factory-v2.yml`。

- V2 功能分支的相关提交：自动执行**统一校验 + 编译 + 两种屏幕宽度的浏览器验收**，默认只跑 CI，不部署。
- 在 commit message 中明确带 `[preview-v2]`：经 CI 通过后才尝试发布隔离预览。今后也可通过 workflow_dispatch 指定 `employer_id` 和 `publish_preview=true`。
- 发布到固定隔离目录：`/hhba-talent/preview-factory-v2/`。这一个目录即可展示所有已在 V2 分支的公司，不再创建 `preview-xxx` 流水线。
- 发布前需取得 GitHub Pages 已成功发布的基线包、对照当前公开首页，并且仅替换 `preview-factory-v2`。发现基线不一致时**停止发布**，不得强行覆盖。
- 不合并 `main`，不修改阿里云正式环境；上线仍以用户验收为前提。
- 即使发布预览成功，也不宣称未核实岗位“正在招聘”；图片仅为品牌标识或明确标注来源的企业相关业务实景。

## 新旧流程对照

| 工作 | 旧流程 | V2 |
| --- | --- | --- |
| 企业 UI | 已有共用模板 | 不变 |
| 新增企业 | 每家不同脚本和单独预览 | JSON + 三个本地图片 |
| 公司搜索 / 首页 Logo | 共用数据导入 | 自动复用，统一校验 |
| 浏览器测试 | `anker...`, `enn...` 等各写一套 | `factory-v2-browser.mjs` 读取企业 ID |
| 深度链接 | 每家脚本手写岗位链接 | `factory-v2-routes.mjs` 自动生成 |
| Pages | 每家重复部署 YAML | `hhba-employer-factory-v2.yml` 单一工作流 |
| 图片证据 | 每家手写下载程序 | `factory-v2-media.py` 统一格式、HTTPS、哈希和本地副本 |

**不可省略：** 资料真实性、图片版权/归属、招聘主体、岗位日期及人工最终验收。自动化只负责重复性程序工作。
