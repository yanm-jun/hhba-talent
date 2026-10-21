#!/usr/bin/env bash
# HHBA SQLite 一致性备份 —— 禁止直接 cp 正在 WAL 写入中的库文件（会得到撕裂副本）。
# 每个库用 sqlite3 在线备份 API（.backup）生成一致性快照，完成后做 integrity_check
# 与关键表行数记录，写入 manifest.txt；public-index 目录整体打包并记录 sha256。
#
# 用法: ./backup-sqlite.sh [STATE_DIR] [OUT_DIR]
#   STATE_DIR 默认 /sync-state（Railway 卷挂载点或 ECS 的 hhba_sync_state 卷内路径）
#   OUT_DIR   默认 ./backups/hhba-YYYYmmdd-HHMMSS（相对脚本目录）
set -euo pipefail

STATE_DIR="${1:-/sync-state}"
STAMP="$(date +%Y%m%d-%H%M%S)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${2:-${SCRIPT_DIR}/backups/hhba-${STAMP}}"

command -v sqlite3 >/dev/null 2>&1 || { echo "ERROR: sqlite3 not found" >&2; exit 1; }
[ -d "${STATE_DIR}" ] || { echo "ERROR: STATE_DIR not found: ${STATE_DIR}" >&2; exit 1; }

mkdir -p "${OUT_DIR}/sqlite"
MANIFEST="${OUT_DIR}/manifest.txt"
{
  echo "hhba_backup_stamp=${STAMP}"
  echo "source_dir=${STATE_DIR}"
  echo "created_at=$(date -Iseconds)"
} > "${MANIFEST}"

# 库文件:关键表（用于行数对账；表不存在则记 table_missing，不中断备份）
declare -A KEY_TABLES=(
  ["hhba-engagement.sqlite"]="engagement_events"
  ["hhba-saved.sqlite"]="saved_jobs"
  ["overseas-jd.sqlite"]="jobs"
  ["hhba-translations.sqlite"]="translations"
)

found=0
for db in "${!KEY_TABLES[@]}"; do
  src="${STATE_DIR}/${db}"
  # 翻译缓存历史上位于 /data 而非 /sync-state；调用方可把文件先汇集到 STATE_DIR
  [ -f "${src}" ] || { echo "${db}=missing" >> "${MANIFEST}"; continue; }
  dst="${OUT_DIR}/sqlite/${db}"
  # .backup 走 SQLite 在线备份 API：源库可继续读写，目标是事务一致快照
  sqlite3 "${src}" ".backup '${dst}'"
  integrity="$(sqlite3 "${dst}" 'PRAGMA integrity_check;' | head -n 1)"
  table="${KEY_TABLES[$db]}"
  rows="$(sqlite3 "${dst}" "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo 'table_missing')"
  sha="$(sha256sum "${dst}" | awk '{print $1}')"
  echo "${db} integrity=${integrity} ${table}_rows=${rows} sha256=${sha}" >> "${MANIFEST}"
  [ "${integrity}" = "ok" ] || { echo "ERROR: integrity_check failed for ${db}" >&2; exit 1; }
  found=$((found + 1))
done
[ "${found}" -ge 1 ] || { echo "ERROR: no sqlite databases found in ${STATE_DIR}" >&2; exit 1; }

# 岗位公开索引目录（jobs.json 等）整体打包
if [ -d "${STATE_DIR}/public-index" ]; then
  tar -czf "${OUT_DIR}/public-index.tar.gz" -C "${STATE_DIR}" public-index
  echo "public-index.tar.gz sha256=$(sha256sum "${OUT_DIR}/public-index.tar.gz" | awk '{print $1}')" >> "${MANIFEST}"
  if [ -f "${STATE_DIR}/public-index/jobs.json" ]; then
    echo "public-index jobs.json sha256=$(sha256sum "${STATE_DIR}/public-index/jobs.json" | awk '{print $1}')" >> "${MANIFEST}"
  fi
else
  echo "public-index=missing" >> "${MANIFEST}"
fi

echo "backup_ok dir=${OUT_DIR}"
cat "${MANIFEST}"
