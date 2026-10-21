#!/usr/bin/env bash
# HHBA SQLite 恢复 —— 把 backup-sqlite.sh 的产物恢复到目标 STATE_DIR。
# 安全纪律：
#   1. 恢复前必须先停 hhba-web（docker compose stop hhba-web），脚本只警告不代停；
#   2. 目标目录现有库先改名为 <name>.pre-restore-<stamp> 保留，绝不直接删除；
#   3. 每个恢复的库先在临时副本上跑 integrity_check，通过才落位；
#   4. -wal/-shm 残留文件一并改名保留，避免新库配上旧 WAL。
#
# 用法: ./restore-sqlite.sh <BACKUP_DIR> [STATE_DIR]
set -euo pipefail

BACKUP_DIR="${1:?usage: restore-sqlite.sh <BACKUP_DIR> [STATE_DIR]}"
STATE_DIR="${2:-/sync-state}"
STAMP="$(date +%Y%m%d-%H%M%S)"

command -v sqlite3 >/dev/null 2>&1 || { echo "ERROR: sqlite3 not found" >&2; exit 1; }
[ -d "${BACKUP_DIR}/sqlite" ] || { echo "ERROR: ${BACKUP_DIR}/sqlite not found" >&2; exit 1; }
mkdir -p "${STATE_DIR}"

echo "WARNING: 请确认 hhba-web 已停止写入（docker compose stop hhba-web）。继续恢复: ${BACKUP_DIR} -> ${STATE_DIR}"

for dst in "${BACKUP_DIR}/sqlite"/*.sqlite; do
  [ -e "${dst}" ] || continue
  name="$(basename "${dst}")"
  check_copy="$(mktemp)"
  cp "${dst}" "${check_copy}"
  integrity="$(sqlite3 "${check_copy}" 'PRAGMA integrity_check;' | head -n 1)"
  rm -f "${check_copy}"
  [ "${integrity}" = "ok" ] || { echo "ERROR: backup ${name} integrity_check=${integrity}, abort" >&2; exit 1; }
  target="${STATE_DIR}/${name}"
  if [ -f "${target}" ]; then
    mv "${target}" "${target}.pre-restore-${STAMP}"
    for suffix in -wal -shm; do
      [ -f "${target}${suffix}" ] && mv "${target}${suffix}" "${target}${suffix}.pre-restore-${STAMP}"
    done
  fi
  cp "${dst}" "${target}"
  echo "restored ${name} rows_check=$(sqlite3 "${target}" 'PRAGMA quick_check;' | head -n 1)"
done

if [ -f "${BACKUP_DIR}/public-index.tar.gz" ]; then
  if [ -d "${STATE_DIR}/public-index" ]; then
    mv "${STATE_DIR}/public-index" "${STATE_DIR}/public-index.pre-restore-${STAMP}"
  fi
  tar -xzf "${BACKUP_DIR}/public-index.tar.gz" -C "${STATE_DIR}"
  echo "restored public-index/"
fi

echo "restore_ok target=${STATE_DIR} (pre-restore copies kept with suffix .pre-restore-${STAMP})"
