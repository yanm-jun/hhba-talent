# HHBA V2 第93—95家企业证据、时效与素材审核（2026-11-03）

- 基准主线：main `6f8c6b7362d6fa655c9e2f02ffb137a3f15a5e3e`
- 分支：`feature/employers-093-095-v2`，仅用于审查；禁止覆盖正式 GitHub Pages。
- 93 中国华能：12条按中国华能官方2027届所属单位公告核对的具体岗位名称，均为**原秋招历史记录**，官方招聘首页显示报名已截止。具体二级单位工作地未拆分之处绝不虚构精确城市。来源：
  - https://zhaopin.chng.com.cn/Home/
  - https://zhaopin.chng.com.cn/CampusRecruit?positionId=2000957
  - https://zhaopin.chng.com.cn/CampusRecruit?aId=2000093
  - https://zhaopin.chng.com.cn/CampusRecruit?aId=2000056
  - https://zhaopin.chng.com.cn/CampusRecruit?aId=2000137
- 94 中国大唐：9条**公开集团招聘类别 / 专项方向**，均明显标为“非具体JD”，不能当成9个拥有独立JD和岗位ID的实时空缺。2027第一批2026-09-22至10-31，已截止。官方公告：
  - https://gs.china-cdt.com/cdtgs/xwzx/jtxw/2026/9/I1552059660066881536.html
  - https://zhaopin.china-cdt.com/zpgg_xyzp.html
- 95 广发银行：14条按2027届公开校园招聘公告分总行/分行/信用卡中心/广银理财的分类方向，**非具体JD**。总行2026-10-15截止，分支机构2026-11-15截止；后者是否仍开放需以官网具体岗位为准。
  - https://jobs.tiangong.edu.cn/correcruit/content/id/56228.html
  - https://career.nankai.edu.cn/correcruit/content/id/118874.html
  - https://www.cgbchina.com.cn/career/job_notice2.jsp

## 风险与禁用

1. 不把企业招聘首页、招聘方向、已经截止的项目当成当前可投递岗位。所有记录 `currentOpenVerified:false`。
2. 展示的华能二级单位为具体岗位原始证据来源；岗位 ID 为 HHBA 内容 ID，不冒充官方独立职位编号。
3. 所有已查到的图片均为**历史实景图片来源**，不代表2026年底公司现状。图片只用在隔离的 PR 审核预览；**商业转载使用许可未取得，正式发布前需获得授权或换为获许可图片**。
4. 构建中仅在 HTTPS 原图能够取得、通过尺寸与哈希检查时替换非实景 SVG；否则保留明确标为“非实景”的编辑占位，绝不伪称为企业实拍。
5. 不更改首页、个人中心、真实账户、招聘市场旧记录和人才政策。
