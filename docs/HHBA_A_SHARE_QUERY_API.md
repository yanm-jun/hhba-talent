# 招聘数据查询 API

`GET /healthz`：服务健康检查。

`GET /jobs?q=&city=&status=active&limit=50&offset=0`：仅返回已入库的职位结构化字段、上市主体和来源链接，不返回未经授权的个人信息或原始文档。生产挂载必须接入 HHBA 现有认证、企业审核、审计和限流中间件；本目录 API 不应直接暴露公网。
