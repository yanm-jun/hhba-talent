# 汇方职场 HHBA

**让机会与人才，找到彼此。**

**正式官网：<https://hhba.work/>**  
**公开岗位：<https://hhba.work/candidate/jobs/>**  
**人才政策与城市安居：<https://hhba.work/talent-service/>**  
**寒假实习：<https://hhba.work/winter-internship/>**

汇方职场（HHBA）是面向求职者的职业机会与人才服务平台。当前重点围绕**中国大陆招聘岗位、企业信息、简历智能匹配、国内实习以及各地人才政策**提供公开浏览和求职辅助能力；留学与海外发展内容是独立的信息板块。

平台展示企业招聘资料时，优先引导用户前往企业自己的招聘官网或官方申请系统。是否正在招聘、招聘条件、政策有效期等，始终以企业和主管部门的官方公告为准。

## 网站与搜索引擎

- 官方域名：<https://hhba.work/>
- 站点地图：<https://hhba.work/sitemap.xml>
- 搜索引擎规则：<https://hhba.work/robots.txt>
- 公开品牌：**汇方职场 HHBA**（网站与项目均使用此名称）

本仓库是汇方职场 HHBA 的开发代码库，并非第三方招聘网站或政府政策发布机构。站点公开内容可供搜索引擎发现；账号、个人简历与后台内容不作为公开搜索资源。

## 技术结构

- `apps/web/`：React + TypeScript + Vite 网站及 Cloudflare Pages 构建入口
- `apps/web/functions/`：Cloudflare Pages Functions
- `apps/web/scripts/`：数据发布、招聘资料核验、静态页面及搜索引擎索引构建
- `apps/browser-extension/`：浏览器网申助手相关代码
- `apps/admin-preview/`：后台管理预览
- `docs/`：开发记录、设计和验收文档

## 项目说明

功能以 **<https://hhba.work/>** 实际上线版本为准。仓库包含部分尚在开发或测试阶段的能力，不能将代码存在等同于产品正式上线。用户隐私、简历数据、账号与权限不应暴露在公开网页或搜索索引中。

---

汇方职场 · HHBA · 让机会与人才，找到彼此。
