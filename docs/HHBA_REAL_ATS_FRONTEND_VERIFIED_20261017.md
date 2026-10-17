# HHBA｜真实 ATS 岗位首次进入原首页及统一招聘市场（2026-10-17）

## 已经实际验证的结果（非设计稿）

**实际证据：**GitHub Actions [39023849565](https://github.com/yanm-jun/hhba-talent/actions/runs/39023849565)，基于 `apps/web/src/pages/HomePage.tsx` 的原 HHBA React 前端，而不是招聘引擎的另一个 HTML 页面。

- 从 Greenhouse、Ashby、Lever 三家 ATS 的 **6 个公开企业 Job Board JSON API** 读取，2026-10-17 测试批次的**事实级岗位元数据 464 条**。
- 真实企业包括：Greenhouse、Canonical、Ashby、Airwallex、Spotify 和 Palantir Technologies。
- 通过 HHBA **同一域名反向代理**的 `/recruitment/api/v1/marketplace`、`/recruitment/api/v1/jobs` 和 `/recruitment/api/v1/jobs/{id}` 读取；前端没有硬编码职位、企业、城市、JD 或官方 URL。
- React 首页保留 HHBA.、原来的“让机会与人才，找到彼此。”、两个入口“我要找工作”“我要招人才”；首页下面只有**一个统一招聘市场**，没有独立的中国/海外岗位库。
- 真实浏览器 Chromium 在 1440x900 桌面和 390x844 手机视口对实际接口做搜索、查询、筛选、详情跳转，并成功产出真数据截图。
- 截图来自 `hhba-real-ats-homepage-desktop-mobile` Artifact，有 `hhba-real-desktop-first.png`、`hhba-real-desktop-full.png`、`hhba-real-desktop-search.png`、`hhba-real-mobile-full.png`、`hhba-real-mobile-filtered.png`。

## 数据真实性边界

`scripts/real_ats_preview.py` 的6个来源是工程人员指定的公共 ATS Board 列表；网络调用只读公开 JSON，**没有爬取第三方中介网站，没有招聘网站登录或 Cookie，也没有发送简历**。

仅保存内存中的：
- 企业名称、职位标题、地点、原生岗位 ID 的稳定摘要、来源 ATS 及企业官网托管的原始 HTTPS 详情 URL；
- API 返回的时间信息和本次观察时间；
- 尽可能保守的实习分类，其余未知保持 UNKNOWN。

**不存储、复制或发布完整 JD 文本；不保存原始 API JSON；不把任何候选发布链接当作已经人工核实可投递。**页面显示“官网核对 · 投递未确认”。

本次真实岗位数**464条不是全球岗位存量、不是31万目标已完成、也不是全部真实在招状态已核验**。本轮每来源最多取前100条，Lever 只读第一页，可能有部分岗位缺失；来源板是否为公司官网引用、完整翻译再版权利及进一步公开使用许可，还需运营审核。

这套 `real_ats_preview.py` 只用于**本地或 GitHub 隔离 staging**，绑定 127.0.0.1。不能不经检查就放在互联网生产端。完整海外 ATS 导入和长期增量同步仍需经过 `hhba-recruitment-engine` 的来源审批/哈希签名/增量管线，再进入真实服务器。

## 可执行本地真实数据前端

需要 Python 3.12、Node 22、且网络能够访问上述六家 ATS 的公开 JSON API。

先在 `hhba-talent` 仓库的项目根目录启动真实 ATS 只读预览服务：

```bash
python scripts/real_ats_preview.py --host 127.0.0.1 --port 8765
```

这一步打印“真实从官方 ATS API 读取到多少条”及每个来源是否成功，不采用假岗位兜底。

另开终端执行：

```bash
cd apps/web
npm ci
npm run dev
```

打开 `http://127.0.0.1:3000`，Vite 将 `/recruitment/api/` 代理至 8765。原人才后端默认为 8003；若未启动，游客可能看到用户会话恢复警告，但原首页和真实岗位市场仍可作为匿名预览使用。**无论何种情况不上传个人资料到 ATS 服务。**

## 下一阶段必须做的真实产品工作

1. 在用户认可当前前端效果后，停止新增模拟测试岗位，新增来源主体核验与元数据许可审核后，把此批实际 ATS 岗位经审查纳入 `hhba-recruitment-engine` 主索引，并完善各公司的多页增量，不以首100条当全量；
2. 把该招聘引擎的持久数据库与 `hhba-talent` 网关真正同源部署，配置备份、失败重试及可追溯来源状态；当前 GitHub Actions/本地 Preview **不是公网部署**；
3. 国内官方岗位从现有已准入主库展示到同一个市场，同时补齐更多官方国内职位源；
4. 原岗位职责与任职要求的显示/翻译必须以企业源码许可及完成质量核对为前提。暂未获授权的不抄全文、不用模型杜撰 JD。

最后：目前截图来自实时公开 ATS API 的数据，不是合成职位；但**不能将展示了真实历史/本次观察记录等同为“实时在招已核验可投递”**。
