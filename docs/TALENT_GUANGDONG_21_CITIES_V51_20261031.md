# HHBA V2 广东省21市政策开发实录 — V5.1（2026-10-31）

## 开发边界
- 独立分支：`feature/talent-guangdong`，主线基准：`yanm-jun/hhba-talent@main`。
- 草稿 PR：https://github.com/yanm-jun/hhba-talent/pull/108
- 不修改 `main`、不触发正式 GitHub Pages / 阿里云发布；构建由独立 CI 上传 artifact，尚无可直接点击的隔离预览 URL。
- 所有政府制度与历史申请窗口、登记房源与实时余房、政策原文与实际申报平台严格分开。
- 严格沿用 `UnifiedPolicyList`、`UnifiedPolicyGuide` 和 `UnifiedTalentRecordDetail`；不新增城市级复制页面。

## 政策覆盖
- 广东省21个地级市每市至少1条政府来源基础政策，城市简介分别编写并接入全国检索和城市服务。
- 首批本地政策7条；扩展政策14条；潮州/茂名/梅州3条；省级2026创业资助按属地21条；粤东粤西粤北地区就业补贴按地域12条：**共57条政策数据**。
- 省级就业创业补贴依据：粤人社规〔2026〕20号，原文政府转载 https://www.shantou.gov.cn/stsrlsbj/gkmlpt/content/2/2551/post_2551786.html
- 广东省公共就业服务云平台入口：https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home；平台首页不等于自动受理，需点击具体个人/单位补贴事项。
- 粤东粤西粤北适用城市仅：韶关、汕头、湛江、茂名、梅州、汕尾、河源、阳江、清远、潮州、揭阳、云浮；**不向广州、深圳、珠海、佛山、东莞、中山、惠州、江门、肇庆误推区域就业补贴**。
- 大湾区内地九市适用的港澳青年政策标注广东省共用，不作为单一地级市新增地方待遇。

## 人才安居
- 已核实基础住房记录10条（原2 + 追加8）。有具体地址和历史房源数的分别包括珠海高新区惠景悦来新寓、中山小榄镇银菊花园86幢、云浮高端人才社区。
- 深圳2026年8月人才房、珠海2026年8月批次、中山2026年7月批次、云浮2026年7—9月批次均为历史资料，不能当作实时配租。
- 梅州“免费住宿”最长6个月限先取得“免费创业”空间资格者；未取得者按另一政策申请最长30天。依据：https://www.meizhou.gov.cn/attachment/0/218/218829/2797181.pdf
- 潮州2025公租房保障办法涵盖新就业无房、经认定高层次和紧缺人才，单位统一向住建部门提出书面申请。依据：https://www.chaozhou.gov.cn/attachment/0/553/553667/3943660.pdf
- 江门2026年10月27日在库房源48项目6835套为房票房源库数据，不是实时可售套数。依据：https://www.jiangmen.gov.cn/bmpd/jmszfhcxjsj/zwgk/gztg/content/post_3576290.html

## 页面
- `/talent-service/cities/广东省` 可定位21城（原省份城市入口及搜索逻辑）。
- `/talent-service/city/广州` 等21城主页与省内专属简介、政策列表及住房区统一沿用V5.1组件。
- `/talent-service/list/policies/梅州` 等显示已收录政策及历史分类。
- `/talent-service/policy-guide-preview/guangdong/{policyId}`：每一条广东政策进入共用六模块可交互B/C级说明、资格分支、步骤自查、材料、FAQ和官方来源。
- 住房详情继续统一使用 `/talent-service/housing/{id}`。

## 质量等级与未完成工作
- 全部57条政策使用 `B`/过期 `C` 级基础指南，**不声称任何已获独立A级完整指南认证**。
- 一城至少一条政策，**不等于已全面穷尽该市所有区县、年度补贴、住房项目**；市级深度的继续核实与经办官方申报深链仍需后续质量升级。
- 没有确切政府公告的住房项目与实时空房不造假、不以政府官网首页顶替申请直达入口。
- 尚未完成可在线点击的独立隔离预览站网址，因此不得合并 `main`。
- 每次修改运行 `node scripts/test-guangdong-city-v51.mjs`、`node --experimental-strip-types scripts/test-talent-city-contract-v51.mjs`、`npm run build`；CI脚本见 `.github/workflows/hhba-guangdong-branch-ci.yml`。
