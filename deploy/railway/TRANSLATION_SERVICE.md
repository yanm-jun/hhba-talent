# HHBA 专业机器翻译服务（运行中的公测）

**当前选择**：LibreTranslate/Argos Translate 私有容器，不接入 DeepSeek/OpenAI 等生成式翻译模型。机器翻译不等于人工审核，术语校正不等于获得用人单位授权。

运行拓扑：
- 公开 HHBA Railway Function（名称 hhba-live-jobs-preview）
- 私有 LibreTranslate 翻译服务（Railway 原占位服务 hhba-jobs-api，现使用 Docker 镜像 libretranslate/libretranslate:latest，内部端点名 hhba-translator）
- 已挂载 /data 500MB SQLite 翻译缓存

内部连接：`HHBA_TRANSLATOR_URL=http://hhba-translator.railway.internal:5000`，仅 Railway 内部可访问。引擎需要 `PORT=5000`、`LT_HOST=0.0.0.0`、`LT_PORT=5000`、`LT_LOAD_ONLY=en,zh`，不创建公网域名。

翻译过程：
1. 从 6 个公开 ATS 招聘板获取真实职位元数据，保存职位 ID 和官方链接。
2. 已有 SQLite 译名直接复用。没有的职位先由中文术语词库提供**未审核的临时显示译名**，随后低速批量调用内部机器翻译引擎。
3. 按原始英文标题 SHA-256 缓存机器译名，不重复翻译相同标题。遇到失败回退到明确标记的词库译名，不编造。
4. 标题译后修正专有职级（Staff/Senior）和职类术语；4 个空中云汇典型岗位有明确 QA 标准。仍需持续人工质检更多岗位。
5. 用户切换中文/English，站内保留一份对应官方原始职位。双语搜索维护中文查询对应的英文关键词。
6. JD 原文及中文译文涉及相应展示、翻译和转载许可。只有 Operator 在持久化目录放入 `/data/hhba-jd-rights.json`，并且提供不同审核人/发布人、原始文本版本哈希和 `/data/grants` 书面证据，才允许按原始版本缓存并返回机器译文；没有授权不生成也不显示。该目录目前没有上传许可证，因此中文 JD 并未公开上线。

注意：这是一份 Railway Function 的**运行代码快照**，提交 GitHub 不自动同步 Railway。云端仍需通过 Railway update_function_source_code 发布。用户可访问：
https://hhba-live-jobs-preview-production.up.railway.app/

已知限制：LibreTranslate 机器译名仍可能生硬；批量翻译耗 CPU、可能产生 Railway 运行费用，并非免费无限使用。完整 HHBA React 网站未接入 Railway GitHub Private Repo 授权，目前运行的是独立公测版。
