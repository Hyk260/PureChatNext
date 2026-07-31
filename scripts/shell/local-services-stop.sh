#!/usr/bin/env bash
# 关机或拔出外置 SSD 前，统一停止 PureChatNext 本地持久化服务。

set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
failed=0

echo "⏳ 正在停止本地 Redis..."
if ! bash "$ROOT/scripts/shell/local-redis.sh" stop; then
  echo "❌ Redis 停止失败" >&2
  failed=1
fi

echo "⏳ 正在停止本地 PostgreSQL..."
if ! bash "$ROOT/scripts/shell/local-postgres.sh" stop; then
  echo "❌ PostgreSQL 停止失败" >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  echo "❌ 部分本地服务未能正常停止，请检查上方错误。" >&2
  exit 1
fi

echo "✅ Redis 与 PostgreSQL 均已停止，可以安全关机或拔出外置 SSD。"
