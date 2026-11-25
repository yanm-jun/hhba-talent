# HHBA 云端网申 Phase 2：Cloudflare Browser Run 验证

日期：2026-11-07。仅使用虚构简历与合成表单；无真实招聘官网访问、无用户数据、无支付、无生产部署。

## Cloudflare 实际测试记录

- 云端 Browser Run Quick Action content 接收虚构 HTML 和内联脚本，运行后返回 DOM：6 个字段成功填写、3 个输入项留给人工，未提交申请。
- 独立的 Browser Run Session API 测试：成功创建会话、打开内联测试标签页、列表中找到测试标签并看到 Live View URL 存在，最后主动删除会话。
- 以上是两种**独立接口测试**，不是持续会话内的跨页智能填写。没有测试真实接管、长任务恢复、Cloudflare CDP 操作或招聘系统兼容。

## 可复现代码

- src/cloudflare-browser.mjs：有权限隔离的合成测试客户端；只允许 HHBA 虚构表单；固定 Cloudflare API 地址；不返回原始 Live View URL。
- src/run-cloud.mjs：运行 Session API 与 Quick Action 两种测试；最后自动关闭会话。
- tests/cloudflare-browser.test.mjs：五项模拟接口测试，5/5 通过（Node 22）。

运行：在仓库根目录使用 Node.js 22+ 执行

    node --test experiments/cloud-apply/tests/cloudflare-browser.test.mjs

如在可信任的开发服务器重跑云端测试，私下设置 CLOUDFLARE_ACCOUNT_ID 和 CLOUDFLARE_BROWSER_RUN_TOKEN 环境变量（令牌需 Browser Rendering - Edit 最小权限），然后：

    node experiments/cloud-apply/src/run-cloud.mjs

**绝不**把令牌、登录 Cookie、签名 Live View URL 或简历数据提交到 GitHub 或返回给客户端。

## 下一阶段验收条件

- 在同一个浏览器会话内建立经授权的 CDP/Puppeteer 连接，完成合成多页表单的识别、填写和回读。
- 人工接管必须使用用户级短期鉴权，确认接管和 AI 控制不会同时操作；页面/屏幕录像不得暴露敏感字段。
- 完成浏览器 session 的异常清理、超时及费用测试，并验证云端出口对国内 ATS 的访问策略。
- 由用户验收真实预览后再考虑合并 main；hhba.work 及生产支付目前保持不变。

## 官方资料

https://developers.cloudflare.com/browser-run/get-started/
https://developers.cloudflare.com/browser-run/cdp/session-management/
https://developers.cloudflare.com/browser-run/features/live-view/
https://developers.cloudflare.com/browser-run/limits/
