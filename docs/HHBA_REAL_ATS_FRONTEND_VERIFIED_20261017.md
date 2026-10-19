# HHBA｜原首页接入真实 ATS 来源的联调说明（2026-10-17）

## 目标与当前边界

## 最新真实浏览器验收（2026-10-17）

- 工作流：https://github.com/yanm-jun/hhba-talent/actions/runs/39026807028
- 真实 ATS 快照共 **1,279 条**：Greenhouse 19、Canonical 309、Ashby 63、Airwallex 496、Spotify 82、Palantir Technologies 310。
- 浏览器验收：3/3 测试通过，覆盖真实 API、桌面首页、手机搜索和岗位详情；没有合成职位作为 fallback。
- 截图包 Artifact 名称：hhba-real-ats-homepage-desktop-mobile；包含 hhba-real-desktop-first.png、hhba-real-desktop-full.png、hhba-real-desktop-search.png、hhba-real-mobile-full.png、hhba-real-mobile-filtered.png。
- 此次 CI 的 domestic_public_rows 为 0，因为 CI Runner 无权克隆私有引擎仓库且没有国内主库挂载；没有用虚构国内岗位补齐。若本机启动真实引擎 API，可通过 --domestic-api 将通过公开展示门禁的国内记录合入同一预览市场。
- 六个 ATS board 均未获自动发布批准；当前可核验已开放投递的岗位数为 0。预览仅用于内部验收，不是公网发布。


保留原 HHBA React 首页、两个入口“我要找工作 / 我要招人才”，首页下方只保留一个统一岗位市场。前端通过同一个 /recruitment/api/v1/marketplace、/recruitment/api/v1/jobs 和 /recruitment/api/v1/jobs/{id} API 读取数据。

本仓库内的 vendor/hhba-recruitment-engine/ 是从上游 yanm-jun/hhba-recruitment-engine@d8e6f1d54c4e014b66f79dbd47965d43a9c64db2 同步的固定版本适配器快照，只用于 CI 和本地内部验收。它不是两个仓库自动同步的机制；升级上游时，必须显式同步并复核版本。

## 真实来源如何进入前端

当前链路不再由 scripts/real_ats_preview.py 自己采集 ATS。它只读取现有招聘引擎采集器生成的 SHA-256 绑定快照。实际采集器为：

- vendor/hhba-recruitment-engine/hhba_pipeline/global_ats.py
- vendor/hhba-recruitment-engine/hhba_pipeline/global_ats_jd.py
- vendor/hhba-recruitment-engine/hhba_pipeline/global_ats_jd_sections.py
- vendor/hhba-recruitment-engine/scripts/stage_global_ats.py
- 来源注册表：vendor/hhba-recruitment-engine/data/ats/global_boards_seed.json

采集器使用 Greenhouse、Ashby、Lever 的公开 JSON 接口；Greenhouse/Ashby 读取其返回的完整公开列表，Lever 使用分页读取。它只将必要元数据和 JD 指纹/字段检测状态写入隔离快照，不持久化完整 JD。采集器的源站列表仍是有限的六个试点 board，不等于全平台所有企业。

## 本地运行真实数据预览

前提：Python 3.12、Node 22，当前网络可访问 ATS 官方公开 JSON 接口。

### 1. 采集真实公开岗位元数据到仓库外

在 hhba-talent 根目录运行：

```bash
python vendor/hhba-recruitment-engine/scripts/stage_global_ats.py \
  --registry vendor/hhba-recruitment-engine/data/ats/global_boards_seed.json \
  --output-dir ../hhba-ats-stage-20261017 \
  --execute-network --max-boards 6 --pause-seconds 1
```

必须使用全新、位于 Git 仓库外的输出目录。若任何来源失败，检查实际报告；不得手工补造职位，也不得将失败来源当作空职位列表。

### 2. （可选）让内部预览同时读取现有国内岗位索引

若你本机已克隆并运行 hhba-recruitment-engine，先在引擎仓库运行其原有服务：

```bash
python scripts/serve_jobs_api.py --master data/jobs_master.jsonl --host 127.0.0.1 --port 8766
```

这会从现有国内主库提供其通过公开展示门禁的岗位记录。保持该终端运行。

### 3. 启动内部 ATS 预览 API

回到 hhba-talent 根目录：

```bash
python scripts/real_ats_preview.py \
  --stage-dir ../hhba-ats-stage-20261017 \
  --domestic-api http://127.0.0.1:8766 \
  --host 127.0.0.1 --port 8765
```

若尚未运行国内引擎，可省略 --domestic-api；预览只显示真实 ATS 来源岗位，不会拿虚构国内岗位填充。

### 4. 启动原 React 前端

另开终端：

```bash
cd apps/web
npm ci
npm run dev
```

打开 http://127.0.0.1:3000。Vite 将 /recruitment/api/ 代理至 127.0.0.1:8765，桌面端、手机端、岗位搜索与详情共用同一市场。

## 内部预览的安全边界

- 预览服务只允许绑定环回 IP（127.0.0.1 / ::1），不能暴露公网。
- 所有未经人工审核的 ATS 记录会明确标注“内部验收数据 · 来源归属与发布权限待审核”；前端只允许在本机预览时显示这类记录。
- 所有 ATS 岗位的 current_application_verified=false、application_url=null。用户只能打开官方详情页面核对，不能显示为已确认投递入口。
- 预览服务检查 manifest、SHA-256、完整快照、ATS 域名、board slug 和字段白名单；不接受完整 JD、翻译文本或申请人信息。
- 预览模式不等于发布授权，也不等于企业身份已独立核实。任何真实浏览器截图只能证明页面显示了实际 API 快照，不能证明所有岗位今天仍开放。
- CI 的隔离运行器无法访问私有的引擎仓库，因此使用固定版本的适配器快照；需要把国内主库与 ATS 预览合并时，请按上述本机步骤启动原有引擎 API。

## 正式发布必须使用原招聘引擎，不得使用预览服务器

上游 hhba-recruitment-engine 已有正式的人工审批桥接：hhba_pipeline/global_ats_market.py 与 JobSearchIndex.from_jsonl(..., global_ats_dir=..., global_ats_approvals=...)。它会校验来源审批、SHA-256、快照完整性与时效；未审批来源不会进入正式公开索引。

正式服务应在完成公司 board 归属和元数据使用条件审核后，使用上游 scripts/serve_jobs_api.py 的 --global-ats-dir 与 --global-ats-approvals 参数。不能把内部预览 API 当作生产服务，也不能自动替六个来源签发发布许可。

## 下一步

1. 让上游引擎中的采集、隔离快照、来源人工审核和公开索引形成可持续增量流程；
2. 把通过审核的 ATS 元数据接入原有国内主库的同一 JobSearchIndex，而不是增加中国/海外两个市场；
3. 继续扩大企业 board 目录和覆盖量，做增量去重、下架识别、错误重试和备份恢复；
4. 对完整 JD 的职责/任职要求提取、中文翻译与公开展示单独建立权利准入和人工 QA。在没有相应授权时，不复制或发布完整 JD 翻译；
5. 只有在实际服务器、持久数据库、权限、监控和合规审查都完成后，才能称为正式上线。
