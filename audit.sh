#!/usr/bin/env bash
# HHBA 环境审计脚本（只读，不安装、不修改系统）
# 用法：bash scripts/audit.sh [输出文件]
# 适用：Linux / macOS / Windows(Git Bash)
set -u
OUT="${1:-}"
log(){ echo "$*"; [ -n "$OUT" ] && echo "$*" >> "$OUT"; }

log "===== HHBA 环境审计 $(date '+%Y-%m-%d %H:%M %Z') ====="
log "--- 操作系统 ---"
uname -srm 2>/dev/null | while read -r l; do log "内核: $l"; done
if [ -f /etc/os-release ]; then grep -E "^(NAME|VERSION)=" /etc/os-release | while read -r l; do log "$l"; done; fi
if command -v sw_vers >/dev/null 2>&1; then sw_vers | while read -r l; do log "$l"; done; fi
if command -v wmic >/dev/null 2>&1; then wmic os get Caption,Version 2>/dev/null | head -3 | while read -r l; do log "$l"; done; fi

log "--- CPU / 内存 ---"
command -v nproc >/dev/null 2>&1 && log "CPU核心数: $(nproc)"
command -v lscpu >/dev/null 2>&1 && lscpu 2>/dev/null | grep -E "^(Architecture|Model name)" | while read -r l; do log "$l"; done
command -v sysctl >/dev/null 2>&1 && sysctl -n hw.ncpu 2>/dev/null | while read -r l; do log "CPU核心数(macOS): $l"; done
if command -v free >/dev/null 2>&1; then free -h | head -2 | while read -r l; do log "$l"; done; fi
command -v vm_stat >/dev/null 2>&1 && vm_stat | head -4 | while read -r l; do log "$l"; done

log "--- 磁盘 ---"
df -h 2>/dev/null | head -12 | while read -r l; do log "$l"; done

log "--- 开发软件 ---"
for c in git gh codex node npm pnpm python3 python pip uv docker psql; do
  if command -v "$c" >/dev/null 2>&1; then
    v=$("$c" --version 2>&1 | head -1 | cut -c1-70)
    log "[已安装] $c : $v ($(command -v "$c"))"
  else
    log "[未安装] $c"
  fi
done

log "--- 端口占用(3000/8000/5432) ---"
if command -v ss >/dev/null 2>&1; then
  ss -tln 2>/dev/null | grep -E ":(3000|8000|5432)[^0-9]" | while read -r l; do log "占用: $l"; done || log "目标端口空闲"
elif command -v netstat >/dev/null 2>&1; then
  netstat -tln 2>/dev/null | grep -E ":(3000|8000|5432)[^0-9]" | while read -r l; do log "占用: $l"; done || log "目标端口空闲"
else
  log "无法确认(无ss/netstat)"
fi
log "===== 审计结束（本脚本未做任何修改） ====="
