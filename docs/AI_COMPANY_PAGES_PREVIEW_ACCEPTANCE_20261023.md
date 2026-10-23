# HHBA AI 企业搜索｜免费 GitHub Pages 浏览器验收（2026-10-23）

## 已发布的独立预览

- 企业搜索演示： https://yanm-jun.github.io/hhba-talent/ai-company-preview/
- 原有国内岗位 Pages 根页面： https://yanm-jun.github.io/hhba-talent/
- GitHub Actions 成功运行： https://github.com/yanm-jun/hhba-talent/actions/runs/39896717927
- 隔离开发草稿 PR： https://github.com/yanm-jun/hhba-talent/pull/63

CI `HHBA AI Enterprise GitHub Pages Preview` 最终 `completed / success`；同时把既有国内岗位 Pages 版本构建到根路径、企业搜索新版本发布到 `ai-company-preview/` 子路径，没有部署 Railway。

## 经浏览器验证的交互

1. 桌面端进入预览，能够看到「智能找企业」及「页面预览 · AI 未接入」。
2. 输入包含「汽车」的文字并点击「本地检索企业（非 AI）」，显示真实企业登记记录，包括长城汽车。
3. 点击「原有岗位搜索」，验证真实历史岗位卡片出现；再切回「AI 智能找企业」。
4. 输入 OpenAI，能进入对应企业资料页面。
5. 手机宽度 390px 输入比亚迪，可检索该企业卡片。
6. 不允许用户在本页面提交 API Key 或向公开浏览器暴露密钥；GitHub Pages 无后端，不提供真实 DeepSeek 调用。

## 重要边界

- 该预览是**关键词检索演示，不是 AI 职业匹配。**
- 133 家企业：50 家海外企业介绍 + 83 家国内历史官方招聘入口；其数量不是当前在招企业数量，也不保证每家当前仍然招聘。
- 静态预览无完整登录、收藏、实时岗位验证服务；本页面会明确区分已审核公司资料与历史招聘入口。
- 公共启用 DeepSeek 还需要隐私与安全审查、Key 存储、持久额度控制、模型及多轮成本验证。
- 在线页面发布成功来自 GitHub Pages Actions 成功状态，某些外部网络探测可能访问受限，须以实际用户浏览器打开为最终确认。
