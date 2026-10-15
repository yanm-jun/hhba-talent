# A 股首轮采集运行报告

- 运行范围：SSE/SZSE/BSE 官方公开入口快照
- 实际命令：`apps/api/.venv/Scripts/python.exe -m hhba_data_pipeline.run --scope exchanges --dry-run`
- HTTP：3/3 为 200；失败 0
- 可识别公司行：0（官方页面为动态/查询壳，未伪造公司行）
- 唯一职位：0（尚未访问企业招聘来源）
- 受限/未完成：3 个交易所名录需要进一步确认其官方公开数据请求接口；不能据此声称覆盖
- 输出：`data/a_share/latest_run.json`、交易所 HTML 快照、`data/a_share/listed_companies.csv`

状态：PARTIAL / NOT READY。下一批工作应先完成交易所公开数据适配器和至少 50 家试采，并把每家结果写入 `company_crawl_status`。
