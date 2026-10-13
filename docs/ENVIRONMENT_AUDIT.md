# HHBA 开发环境审计报告（Phase 0 · 阶段 A）

> **检测范围声明（必读）**：本报告所有检测均在 **Hatch 沙盒 Linux 虚拟机**（Ubuntu 24.04）
> 上执行，**不是用户真实电脑，也不是用户的云电脑**。沙盒无法访问用户本机的 C 盘、
> 已安装软件与开发环境。用户可在自己电脑上运行 `scripts/audit.sh`（只读脚本）
> 得到同口径的本机审计结果。
>
> 审计时间：2026-10-13 18:31 CST｜审计方式：只读命令，未修改任何系统配置

## A. 操作系统与硬件

| 项目 | 检测结果 | 说明 |
|---|---|---|
| 操作系统 | Ubuntu 24.04.5 LTS (Noble Numbat)，内核 7.0.0-39-generic | `cat /etc/os-release` |
| CPU 架构 | x86_64 | `lscpu` |
| CPU 型号/核心 | AMD EPYC 9D25，2 核（单路单线程） | `nproc` = 2 |
| 内存 | 共 7.7G，**可用仅约 332M（已用 7.4G）** | `free -h`；**内存是主要瓶颈** |
| 硬件虚拟化 | 虚拟化类型 full（KVM 客户机）；CPU 无 vmx/svm 标志 | 无嵌套虚拟化；Docker Desktop 类方案不可用，但 Linux 原生 Docker Engine 不需要嵌套虚拟化 |
| WSL2 | 不适用（本机即 Linux） | — |
| 磁盘 /home/hatch | btrfs 100G，已用 3.1G，**可用 96G** | `df -h`；空间充足，HHBA 项目与依赖缓存放此处 |
| 磁盘 /（overlay） | 7.5G，可用约 7.5G | 根分区较小，避免在此放项目文件 |
| /tmp | 512M tmpfs | 仅放临时文件 |
| C 盘 | 不适用（Linux 无盘符概念） | 用户本机请用 `scripts/audit.sh` 自查 |

**结论**：磁盘充足（96G），CPU 2 核够用，**内存是硬瓶颈**（可用 <0.5G），
不适合在本沙盒运行 Docling 等重型模型推理。

## B. 开发软件清单

| 软件 | 版本 | 安装路径 | 运行状态 | 满足 HHBA 要求 | 备注 |
|---|---|---|---|---|---|
| Git | 2.43.0 | /usr/bin/git | 正常 | ✅ | 版本满足 |
| GitHub CLI (gh) | 2.102.0 | /usr/bin/gh | 正常，**未登录** | ⚠️ 可选 | Phase 0 不推送远程，仅记录状态 |
| Codex CLI | 0.149.0 | /opt/hatch-image/bin/codex | 正常 | ✅ | — |
| VS Code / Cursor | 未安装 | — | — | ⚠️ 可选 | 编辑器由用户本机决定 |
| Node.js | v24.20.0 | /usr/bin/node | 正常 | ✅ | 满足 Vite 6+（需 Node 18+） |
| npm | 10.9.4 | /opt/hatch-image/bin/npm | 正常 | ✅ | — |
| pnpm | 未安装 | — | — | ⚠️ 可选 | 可用 npm 代替 |
| Python | 3.12.3 | /usr/bin/python3 | 正常 | ✅ | 符合选型 Python 3.12 |
| pip | 24.0 | /usr/bin/pip | 正常 | ✅ | venv 内安装需走代理，已验证可用 |
| uv | 未安装 | — | — | ⚠️ 可选 | 可用 venv+pip 代替 |
| Docker Engine | ✅ 29.9.0（静态包，沙盒实测可装；容器无法启动，见 §D） | 沙盒内核限制，见下 |
| Docker Compose | 未安装 | — | — | ❌ 缺失 | 同上 |
| PostgreSQL 客户端 (psql) | 未安装 | — | — | ⚠️ 可选 | 可用容器内/驱动连接代替 |
| make/curl/wget | 均已安装 | /usr/bin | 正常 | ✅ | — |

## C. 环境检查

| 检查项 | 结果 |
|---|---|
| Git 正常执行 | ✅ `git --version` 正常 |
| GitHub 认证状态 | 未登录（`gh auth status`）；Phase 0 不推送，仅记录 |
| Node/npm/pnpm 工作状态 | ✅ node/npm 正常；pnpm 未安装 |
| Python 虚拟环境创建 | ✅ `python3 -m venv` 实测成功 |
| Docker Engine 运行 | ❌ 未安装，无法运行容器 |
| Docker Compose 可用 | ❌ 未安装 |
| PostgreSQL＋pgvector 验证 | ✅ 已通过（见 §D） |
| 端口 3000/8000/5432/6379/7700 | ✅ 均空闲（`ss -tln`） |
| 版本冲突 | 未发现明显冲突 |
| 是否适合运行 Docling | ❌ 本沙盒内存不足（可用 332M）；Docling 需数 GB 内存＋模型下载，**延迟到用户电脑评估** |
| 瓶颈 | 内存（7.4/7.7G 已用）；磁盘/CPU 无瓶颈 |

## D. 本机约束（沿用既有实测结论）

- 出站仅走 HTTP 代理，直连外网不通；`pip install` 走代理可用。
- 无 GPU；现代神经网络 TTS/大模型推理不可在本机跑。
- `/tmp` 为 512M tmpfs，大文件放 `~/workspace`。
- 本沙盒不触碰用户真实电脑的任何文件、软件与 Docker 数据（也无权访问）。

## E. 补充验证（2026-10-13，用户要求"直接解决"后追加）

- 沙盒无 Docker，改用 apt（Ubuntu 官方源）在本机安装 PostgreSQL 16.2＋pgvector 0.6.0
  进行验证（绕过 Docker 缺失；生产 compose 仍锁定 `pgvector/pgvector:pg16` v0.8.7，
  两者 SQL 兼容）。
- 验证结果：集群监听 127.0.0.1:5432；`CREATE EXTENSION vector` 成功；
  `infra/initdb/01-init.sql` 真实执行通过（含 `vector(1536)` 列）；
  余弦距离检索实测正确（相同向量 0.0000、相似 0.0061、正交 1.0000）。
- 验证后已停止集群（`pg_ctlcluster 16 main stop`），需用时再起。测试库 `hhba_dev` 保留。
