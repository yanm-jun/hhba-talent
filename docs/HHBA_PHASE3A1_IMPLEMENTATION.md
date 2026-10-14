# HHBA Phase 3A.1 前端实现记录

## 本轮修改

- `apps/web/src/pages/CandidatePages.tsx`
  - 重构当前导出的 `ReviewPage` 与 `ProfilePage` 的交互层；保留既有 API、认证和授权模型。
  - 新增结构化字段编辑、工作年限边界校验、未保存编辑取消确认、可读的保存失败提示。
  - 新增四个独立状态卡、服务端企业投影预览、公开名片直达链接，以及发布/撤回双确认。
- `apps/web/src/styles/phase31-candidate.css`
  - 增加编辑分区、状态卡、授权卡、企业预览和手机断点样式。
- `apps/api/app/main.py`
  - 修复检索分页顺序：SQL 中先按稳定排序分页，移除对每一页 Python 结果的二次排序，避免跨页重复候选人。
- `apps/api/tests/test_phase3a1_search_hardening.py`
  - 新增 305 个合成授权候选人的分页回归，验证第 1、2、10 页均为独立的 10 项且存在后续页。

## 真实验证

执行：

```powershell
cd apps/web; npm run build
cd apps/api; .\.venv\Scripts\python.exe -m pytest tests/test_phase3a_search.py tests/test_frontend_ux_contract.py tests/test_phase3a1_search_hardening.py -q
Invoke-WebRequest http://127.0.0.1:8003/healthz
```

结果：Web build 成功；上述 pytest 为 **10 passed**；API `/healthz` 返回 `{"status":"ok","phase":"1"}`。所有数据均为合成验收账户或测试 fixture。

## 非目标

未改动首页双入口，未开发企业搜索结果、站内联系、Agent/MCP 或外部模型调用。
