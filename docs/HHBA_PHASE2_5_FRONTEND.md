# Phase 2.5 前端

## 页面

- `/`：已保留的双入口首页。
- `/auth`：注册、登录和来源页恢复。
- `/workspace`：登录后的个人工作区与退出。
- `/candidate`：私密简历选择与认证后上传。
- `/candidate/resume/:resumeId`：本地解析、失败状态和受控重试入口。
- `/candidate/review`：显示待确认字段并保存草稿。
- `/candidate/profile`：确认、公开分享授权、发布及撤回。
- `/employer`：需求输入、组织创建/选择和私密草稿列表。

## 前端安全边界

- 会话仅使用 HttpOnly Cookie；CSRF token 仅保留在运行时内存。
- 所有 API 请求显式 `credentials: include`，写请求通过统一 Client 自动携带 CSRF header。
- `next` 仅接受站内绝对路径，拒绝 `//` 开头的开放重定向。
- 未登录文件只留在内存；企业输入草稿仅留在当前浏览器 `sessionStorage`，不会发送到服务端。

## 实际浏览器观察

在 `http://127.0.0.1:3000/` 实际检查：首页、`/candidate`、`/employer` 视觉和路由正常。浏览器截图由当前 Codex 会话呈现；浏览器自动化不提供受控的本地文件落盘接口，因此未伪造“已保存的截图路径”。
