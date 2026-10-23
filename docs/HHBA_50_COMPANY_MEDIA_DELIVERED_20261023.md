# HHBA 首批 50 家企业图片｜交付记录（2026-10-23）

**交付范围**：只针对 `apps/web/src/data/domesticComplete50Target.json` 中现有的 50 家企业，补齐真实可显示的 Logo/品牌图和至少一张企业环境或生产相关照片。不改变招聘库与 Railway 生产环境。

## 已交付

- 50/50 家企业对应一张可加载的本地品牌图；不强制 SVG、透明底或高清原图。
- 50/50 家企业对应至少一张可加载的本地照片（总部、办公、工厂、产品或网页截图）；旧可用图片保留。
- 用户上传原始压缩包 182 张图片；检查企业文件夹名称、文件完整性和图片内容后，隔离 11 张明显错配/重叠/归类不当图片。
- 171 张经过初步校对的新媒体：50 张 Logo + 121 张照片。用户图片真实放入 `public/domestic-media/`，自动生成 WebP/PNG 和 `src/data/domesticMediaBundle.json`、`domesticCareerProfiles.json` 关联。
- 原图片所属文件夹名称与 50 家名单**严格相等**；ZIP 和每张导入图片进行 SHA256 校验，防止串企业、文件损坏。
- 原来的企业搜索与国内职位网站被隔离在 GitHub Pages 预览目录 `/ai-company-preview/`；未直接修改 Railway。
- 先前已有 6 张有效旧照片得到保留；媒体清单当前照片总数为 127 张（其中新补 121 张）。

## 使用与检查

- GitHub 开发分支：`feat/ai-company-search-phase1-20261023`
- PR：[63](https://github.com/yanm-jun/hhba-talent/pull/63)
- 预览：[HHBA 企业搜索](https://yanm-jun.github.io/hhba-talent/ai-company-preview/)
- 整包：`apps/web/media-inbox/packed/user50.part01` 到 `user50.part13`
- 导入：`apps/web/scripts/unpack-user-company-archive.py`，再运行 `apps/web/scripts/import-domestic-company-media.mjs`
- 逐项验收：`apps/web/scripts/audit-company-complete-50.mjs`
- **图片交付**和**六项完整企业档案审核**在验收里是两个不同指标，前者应显示 50/50；后者还取决于独立招聘入口、知识来源和严格的商标身份核验。

## 明确边界

- “可展示”不代表已获得所有第三方图片的转载/商用授权；用户提交来源已保存在素材元数据中。
- Logo 已按照企业名称目录、上传图像上的品牌文字进行初步核对；集团和其上市子公司可能共用视觉标志，在没有一手品牌授权材料时不虚称“品牌正式认证”。
- 招聘入口是否属于相同法人与能否直投仍沿用单独的官方招聘审核要求，**不是本次图片任务的障碍，也不因图片齐全而自动算通过**。
- 后续如果发现个别照片与企业实际主体不符，按名称替换，不需要重新跑全部 50 家。
