# HHBA 职位详情 V0.5：审核通过才显示完整岗位职责与人才要求

与原本同一招聘市场和页面路由共用。完整 JD 不放在 React bundle 或合成 job list 数据里。

1. 打开岗位列表 /candidate/jobs；点击单条岗位进入 /candidate/jobs/{job_id}。
2. 招聘引擎公共详情 API 只有在权利方许可、来源/身份绑定、原文证据和人工准确性审核全部通过后，才携带 `jd_publication_status: APPROVED_FOR_DISPLAY`、`approved_jd`。
3. React 只把审批后的职责、任职要求，以及有来源依据的学历、经验、技能渲染为纯文本；显示审核日期、权利方和原始企业职位链接，不使用 dangerouslySetInnerHTML。
4. 没有审核、权利已过期、JD 片段不完整、内测 ATS 预览或无官方详情 URL，显示“暂不可公开展示”和官方核验链接；不能杜撰任职要求。
5. 自动化浏览器使用明确标记的 SYNTHETIC TEST FIXTURE 演示允许/拒绝两个分支；截图不能当真实获授权岗位截图。
6. 不对真实岗位自动签发发布许可。真实内容发布前须由运营/法务持有具体书面使用权限、审核凭据，服务器开启 `--jd-registry` 并维持安全的外部文件系统。

审核规范详见招聘引擎 `docs/HHBA_APPROVED_JD_PUBLICATION.md`。
