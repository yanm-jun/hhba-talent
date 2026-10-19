# HHBA 招聘市场选项式筛选 V0.1

- 保持首页两个角色入口和下方单一招聘市场。
- 完整的中国内地31个省级节点以及其城市、区县采用 cn-division 2026 开源目录 (MIT) 快照；港澳台暂单列，省市区细分待来源审定。
- 海外国家列表取 ISO 3166 alpha-2，中文名由浏览器 Intl.DisplayNames 生成；州省与城市目前手工填写后对官方原始地点字段筛选，并非宣称世界行政区全量联动。
- 职业分类18个根类及每类示例细类；根类后端基于职位标题关键词映射，细类按标题文字命中；不臆造职位专业分类。
- 招聘类型、学历、工作方式均可组合，实际 API 参数 country/province/city/district/occupation/recruitment_type/education/work_mode/q。
- 只返回正式数据引擎已通过官方来源和公开资格检查的岗位，未审核的ATS数据仅本地预览；不存在无数据时硬编码的假岗位。
- 来源及许可证：https://github.com/kk-418/cn-division/blob/main/LICENSE 。世界 ISO alpha-2 代码列表基于 ISO 3166 标准标识，未包含第三方招聘平台的受保护内容。
- 未完成：海外州省城市的完整权威目录，职业标准代码映射（国标/ISCO/ESCO），岗位标签的数据治理与人工QA，生产部署及实时可投验证。
