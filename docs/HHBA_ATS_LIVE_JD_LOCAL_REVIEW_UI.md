# HHBA 本地 ATS 真实 JD 核对界面

本机内部测试：从 Greenhouse、Lever、Ashby **对应真实官方公开 API** 在点击后读取所选岗位的原始全文，并在详情页并列展示能由显式标题区分的岗位职责与任职要求。对于无法区分的章节，仅提供折叠全文，不编造学历和技能。

默认关闭，必须同时打开两个本机开关：

- 招聘引擎 `serve_global_ats_preview.py --enable-internal-jd`
- HHBA React staging 网关 `run_staging_gateway.py --allow-internal-ats-jd`

React 只在 localhost / 127.0.0.1 且 `record_kind=ATS_STAGING_PREVIEW` 下显示按钮；普通职位和公网环境无按钮。网关不允许外部泛化代理、不转发 Cookie 和 Authorization，仅为单条内部 JD 路由透传专用头。部署前必须检查内网暴露风险，**禁止公开设置上述开关**。

点开有真实 JD 但未获转载许可的岗位，可以在本机审核，但不会提升生产公开状态。对未经许可的岗位，生产公开详情继续显示事实元数据及官网链接。

本地集成测试可用 Playwright 模拟正文回包以核实渲染；只有真实 ATS 网络检索报告可称 API 真实验证，不混淆二者。
