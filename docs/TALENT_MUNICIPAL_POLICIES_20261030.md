# HHBA 四个直辖市政策专题：首批官方核验记录

核验日期：2026-10-30。本批次只更新政策数据库和政策列表/详情信息层级。首页定稿版、人才公寓图片与全国地级市范围均不动。

## 北京（增加2条）
- bj-jobseeker-grant：毕业学年符合困难情形，北京地区院校统一申报，1000元，2024年文件标注现行有效。原文 https://rsj.beijing.gov.cn/xxgk/2024zcwj/202407/t20240730_3762777.html
- bj-flex-insurance：离校两年内未就业毕业生灵活就业社保补贴资格认定制度，具体补贴核准金额待按经办细则确认。原文 https://rsj.beijing.gov.cn/xxgk/2024zcwj/202410/t20241009_3914906.html

## 天津（增加3条）
- tj-2027-jobseek-grant：2027届规定困难毕业生一次性求职补贴3000元，**2026-10-31当届截止**，非普发。原文 https://www.tj.gov.cn/zwgk/zfxxgkzl/fdzdgknr/zdmsxx220316/jy_157359/zcwj_157391/202610/t20261009_7390207.html
- tj-grad-business-loan：最高30万元创业担保贷款属于需偿还贷款，非直接拨付；创业租房支持最长24个月。原文 https://www.tj.gov.cn/zwgk/szfwj/tjsrmzfbgt/202502/t20250206_6851248.html
- tj-graduate-flex-insurance：天津人社公开服务说明涉及灵活就业毕业生养老600元/月、医疗200元/月，两项合并800元/月；**历史政策具体日期与当前受理标准待复核**，在页面保守标记。官方服务资料 https://publicservices.hrss.tj.gov.cn/ecdomain/framework/zcydt/fbbafimfopkibboikmfajfanojgaanpa/fadgmmdgopkjbboikmfajfanojgaanpa.do?disp_template=ccnjmfhhefpibbodjemcncephdmpjlhn&fileid=2676&isfloat=1&kbms=1&moduleIDPage=fadgmmdgopkjbboikmfajfanojgaanpa&siteIDPage=zcydt

## 上海（增加3条）
- sh-2026-jobseek-grant：2026届困难毕业生一次性求职补贴1000元，非全体应届生普发。
- sh-2026-flex-insurance：毕业两年内符合条件灵活就业人员按下限计算的社保费50%，最多24个月。
- sh-2026-first-startup：**上海户籍**、毕业两年内且符合运营和参保条件的首次创业者，8000元。
- 2026届官方文件 https://www.shanghai.gov.cn/gwk/search/content/519721f4f0a5447fa39a305111871a4a
- 虹口区办理指南 https://www.shanghai.gov.cn/nw17239/20260922/41b7ec596c9745d38a7323d353b93768.html

## 重庆（增加3条）
- cq-2026-jobseek：2026年市政府就业政策中困难毕业生一次性求职补贴800元。
- cq-2026-shortage-job：35周岁及以下人员在规定制造业/生产性服务业紧缺岗位就业、连续参保满一年等条件，一次性6000元。
- 2026市级信息 https://www.cq.gov.cn/ywdt/jrcq/202608/t20260811_15916612.html
- cq-2025-twelve-counties：2025年12县本科1000/硕士2000/博士3000元/月、最长3年；**原文件认定截止2025-12-31**，不把2025旧通知作为2026开放申报依据。原文 https://rlsbj.cq.gov.cn/zwgk_182/zcjd/jycy/202511/t20251104_15137757.html

## 重要数据规则
1. 金额必须同时写适用对象及所需参保/学历/区县条件，禁止展示成无条件“到城市就可领”。
2. 2027届、2026届各属于不同年度批次，不得混用申报日期。截止日期过后卡片自动提示过期。
3. 区域专项仅适用于特定区县，高新区等政策不能说成“全重庆普发”。
4. 官网文件公开不能证明申请窗口仍开放；真实受理、落户批准及房源均由政府办理部门确定。
5. 数据源在 `apps/web/src/data/talentPolicyRecords.ts`，CI 使用 `node scripts/audit-talent-service.mjs` 验证关键字段；仅做静态校验，不是实时同步。
