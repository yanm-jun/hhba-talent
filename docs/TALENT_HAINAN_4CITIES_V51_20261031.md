# HHBA · 海南省四城 V5.1资料接入与验收边界（2026-10-31）

## 四个市的真实政府依据
| 城市 | 政策与住房 | 来源 | 状态 |
|---|---|---|---|
| 海口 | 2026年引进人才住房补贴；独立货币补贴住房制度 | https://jdxq.haikou.gov.cn/xinwen/2026/show-11047.html | B级，直达事项入口需核对 |
| 三亚 | 2025年住建局细则、2026年9月人社申领攻略；独立住房制度 | https://zj.sanya.gov.cn/zjjsite/zcjd/202507/18d2f2917ded4aa8bde9545f5df0ab99.shtml ; https://jy.sanya.gov.cn/jyqsite/hygq/202610/de47090ea4324c52992fc882bda092ed.shtml | B级，2026各区曾公布已审核名单，但不等于本批次开放 |
| 三沙 | 省政府2026安居房管理办法第44条，三沙居民及引进人才保障须与其他市县统筹制定细则 | https://jyj.haikou.gov.cn/hksjyj/zcwj/202603/eb3fe4dd21aa4a7dba691c1c2b15cef0.shtml | B级的省级特殊制度，三沙联合细则、承接地、受理入口尚未核实 |
| 儋州 | 2026年修订人才住房保障制度，含洋浦特别规定 | https://www.danzhou.gov.cn/danzhou/xxgk/xzgfxwj/202606/t20260604_4087457.html | B级，2026-07-05施行，旧月份追溯截止12-31而非制度失效 |

## 页面接入
4个城市首页政策和住房指南分开列出，各有 B级资格分支、条件自查、申请材料、分步骤办理、常见问题及政府来源。支持来自政策卡、统一详情、城市首页的点击跳转。未核实事项直接申请入口不呈现为“已开放”。三沙不是自动适用其他市县毕业生落户便利政策。

## 禁止误报
该工作是**四个地级市全部有政府来源政策与独立住房保障数据**，不是四市政策A认证；不能因为省级制度第44条纳入三沙就说三沙人才现金补贴已开放、跨市县联办已可在线申报或已有可租公寓。申请实际是否开放与实时空房仍须逐地核对。

验证命令：
`node --experimental-strip-types scripts/test-hainan-sourced-v51.mjs`
`node --experimental-strip-types scripts/test-hainan-full-v51.mjs`
`node --experimental-strip-types scripts/audit-talent-national-main.mjs`
