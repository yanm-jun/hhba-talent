# HHBA V2 江西省11设区市人才政策 V5.1 — 开发证据与验收说明

- 基线 `main`（建立支线时）`bad0de26d857fc3f6dac56e1249e26b03d3dfa9d`。
- 独立分支 `feature/talent-jiangxi`，Draft PR #134；**未获用户授权不合并 `main`，不修改正式 GitHub Pages**。
- 江西省11设区市：南昌、景德镇、萍乡、九江、新余、鹰潭、赣州、吉安、宜春、抚州、上饶。既有行政区划编码无需重复创建。
- 每个城市同时有政策和住房资料；没有住房制度原文的具体人才公寓不杜撰配租资格。
- 人才政策 **46条**：省级2026毕业生基层岗位补贴、学校属地困难毕业生一次性求职补贴、企业吸纳毕业生社保补贴三种制度分别按11市办理地点归集（33条）；另外13条地方或省级属地制度记录。**省级统一标准不是每市额外发放的奖金**。
- 人才住房 **11条**：南昌高新区人才公寓、景德镇住房保障制度、萍乡青年驿站历史服务、九江人才公寓制度、新余人才分类服务、鹰潭省级公租房适用框架、赣州2026配建人才住房申购、吉安公租房适用框架、宜春历史住房保障制度、抚州住房分类、上饶经开区青年驿站。
- 证据分层：鹰潭48套公寓家电采购平台材料与吉安2026最长12个月免费驿站的地方媒体报道 **未进入政府一手认证的住房记录**；鹰潭和吉安住房统一列表为江西省公租房管理办法的适用路径，未证实当地项目当前有房。
- 部分项目为2025—2026历史配租/公告，**公寓建设规模、采购、正式政策制度不等于当月实时余房**；房屋具体地址、价格、直接申报页没有核实就不填虚假内容。
- 统一 V5.1 六模块 B/C 指南（政策摘要、适用对象与资格、真实办理步骤、材料、FAQ及官方来源），46条政策由 `buildJiangxiGuide` 生成；`TALENT_POLICY_RECORDS` / `TALENT_HOUSING_RECORDS` 注册数据，搜索与卡片点击共用原页面。
- 未完成的深度工作：部分地区缺2026本地独立人才公寓项目、当前受理深链及实时房源，不能声称全省A级认证。

## 官方来源抽样
1. [南昌市人社局新人才10条申报细则](https://rsj.nc.gov.cn/ncsrsj/tzgg/202404/1ebcb69c35384162bcba12dc4089b2dc.shtml)
2. [九江市教育局九江人才20条整理](https://jje.jiujiang.gov.cn/zwzx_194/ztzl/rczczl/202603/t20260330_7211518.html)
3. [赣州2026毕业生生活补贴（赣县区政务）](https://www.ganxian.gov.cn/gxqxxgk/c111257/202607/e631c1c27a2841fc8c56ea27dfc2ac06.shtml)
4. [江西省公租房配租管理办法（全南县政府）](https://www.quannan.gov.cn/qnxxxgk/wfgzf/202604/38b5916992fb43ef80767b1dd5d6ea99.shtml)
5. [人社部中国就业网萍乡青年人才驿站](https://chinajob.mohrss.gov.cn/h5/c/2025-09-22/451688.shtml)
6. [赣州中心城区2026人才住房配建项目](https://www.zgq.gov.cn/zgqxxgk/zfbz/202609/5e8b67fe21b943f7a41f97aabbce2dc2.shtml)

## 测试与验收闸门
```bash
cd apps/web
node scripts/test-jiangxi-city-v51.mjs
node --experimental-strip-types scripts/test-talent-city-contract-v51.mjs
node --experimental-strip-types scripts/test-talent-cities.mjs
npm run build
```
工作流 `.github/workflows/hhba-jiangxi-branch-ci.yml` 只生成独立构建 artifact。独立在线可点击预览 URL 尚未获得；**CI 构建通过不等于 GitHub Pages 正式站部署或用户验收**。
