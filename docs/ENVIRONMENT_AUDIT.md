# HHBA 开发环境审计

审计日期：2026-10-13（Asia/Shanghai）。命令仅查询系统状态；未读取密钥内容、未清理文件、未更改全局配置或 Docker 数据位置。

## 主机与存储

| 项目 | 实测结果 | 结论 |
|---|---|---|
| 操作系统 | Windows 11 家庭中文版，10.0.26200，64 位 | 支持 |
| 设备 / CPU | Lenovo 82JK；Intel i5-11400H，6 核 / 12 逻辑处理器 | 适合本地开发 |
| 内存 | 17,023,950,848 bytes（约 15.9 GiB） | 可运行基础栈；Docling 建议按需使用 |
| 固件虚拟化 | `VirtualizationFirmwareEnabled=False`，`VMMonitorModeExtensions=False` | Docker Linux Engine 存在阻塞风险 |
| C: | 375,914,491,904 bytes 总量，159,806,775,296 bytes 可用（约 148.8 GiB） | 足够；HHBA 放在 C: 现有工作区 |
| D: | 133,807,730,688 bytes 总量，58,498,134,016 bytes 可用（约 54.5 GiB） | 可作为将来的新增数据位置，但本轮未使用 |
| WSL | `wsl.exe` 10.0.26100.9278；Ubuntu 与 docker-desktop 为 WSL 2、均停止 | 已具备 WSL2 发行版证据；Windows 可选功能状态因非提升权限无法确认 |

检测命令：`Get-CimInstance Win32_OperatingSystem/Win32_ComputerSystem/Win32_Processor`、`Get-Volume`、`Get-PSDrive`、`wsl --status`、`wsl -l -v`。

## 工具审计

| 工具 | 版本与路径 | 状态 / HHBA 判定 |
|---|---|---|
| PowerShell | 7.6.5 | 可用 |
| Git | 2.55.0，`D:\Git\cmd\git.exe` | 可用 |
| GitHub CLI | 2.88.1，`C:\Program Files\GitHub CLI\gh.exe` | 可用；已认证状态已检查，未输出令牌 |
| Codex CLI | 0.162.0-alpha.17.2 | 可用 |
| VS Code | 1.139.1 | 可用 |
| Cursor | PATH 中未安装 | 非必需 |
| Node.js / npm | v24.15.0 / 11.12.1，`C:\Program Files\nodejs\` | 可用；符合本仓库 Web 骨架范围 |
| pnpm | 11.25.0，Codex runtime fallback 路径 | 可用但不作为本项目锁定工具；Reactive Resume v6 要求 pnpm 12.11.2 |
| Python / pip / uv | 初始 PATH 中均未安装；系统级 3.12 安装修复失败 | 系统 Python 3.12 仍不可用 |
| 项目 Python 3.12 | Python 3.12.14 已复制到受忽略的 `HHBA/.tooling/python312`；`.venv` 基路径已切换到该副本 | 可用；不依赖 Codex 缓存 |
| Docling / MCP | `docling==2.138.0`、`mcp==2.3.0` 已安装在 `.venv` | 可用 |
| Docker CLI / Compose | 29.8.2 / v5.1.3 | 可用 |
| Docker Engine | Docker Desktop 4.95.0，Engine 29.8.2 | 运行正常 |
| PostgreSQL 客户端 | PATH 中未安装 | 非必需（容器内可验证） |

## 环境测试与端口

| 检查 | 结果 |
|---|---|
| `git --version` | 通过 |
| `gh auth status` | 已认证（仅状态检查） |
| `node --version` / `npm --version` / `pnpm --version` | 通过 |
| `python --version` / `py --version` / `pip --version` / `uv --version` | 命令未找到 |
| Python 虚拟环境创建 | 通过：`.venv` 基于项目内 `.tooling/python312` Python 3.12.14 |
| `docker version --format '{{.Server.Version}}'` | 通过：Server 29.8.2 |
| `docker compose version` | 通过 |
| TCP 3000、8000、5432 | 审计时没有监听进程 |
| Web 骨架验收 | `npm install`（官方 registry，24 packages，audit 0 vulnerabilities）与 `npm run build` 通过；Vite 对 `127.0.0.1:3000` 返回 HTTP 200；测试进程随后停止 |
| Compose 文件验收 | `docker compose -f infra/compose.yaml config --quiet` 通过；不需要 Docker daemon |
| API 验收 | `.venv` 的 Python 3.12.14；`pip check` 通过；`GET /healthz` 返回 `ok`；Docling 与 MCP v2 导入成功 |
| 官方 Python 修复尝试 | 已下载并验证 Python Software Foundation 签名的 3.12.10 x64 安装器（SHA-256 `67B5635E80EA51072B87941312D00EC8927C4DB9BA18938F7AD2D27B328B95FB`）；Windows Installer 返回 1618、1601，未视为成功 |
| Docker/数据库验收 | Docker Desktop 4.95.0 已验证；`hhba-postgres-dev` healthy，PostgreSQL 17.8，`vector` 扩展 0.8.1；端口绑定 `127.0.0.1:5432` |

## 资源判断

基础 React + FastAPI + PostgreSQL 开发适配本机。Docling 可运行但不应在 Phase 0 预下载模型：解析大型或扫描 PDF 时会显著占用 CPU、内存和模型缓存；应在 Python 3.12 与 Docker 验收后，以小型样本和按需模型先做基准测试。
