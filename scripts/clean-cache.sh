#!/usr/bin/env bash
# 清理 Next.js / Turbopack 本地缓存，释放磁盘与内存压力。
# 用法: pnpm clean
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

targets=(".next" "node_modules/.cache")

if pgrep -f "[n]ext (dev|start)" >/dev/null 2>&1; then
  echo "⚠ 检测到 Next.js 进程仍在运行，建议先 Ctrl+C 停掉再清缓存（否则可能删不干净或立刻重新涨缓存）。"
  echo "  强制结束: pkill -f \"next (dev|start)\" || true"
  echo
fi

freed=0
for path in "${targets[@]}"; do
  if [[ -e "$path" ]]; then
    size="$(du -sk "$path" 2>/dev/null | awk '{print $1}')"
    echo "Removing $path ($(du -sh "$path" 2>/dev/null | awk '{print $1}')) ..."
    rm -rf "$path"
    freed=$((freed + size))
  else
    echo "Skip $path (not found)"
  fi
done

if (( freed > 0 )); then
  # du -sk 单位为 KiB
  mb=$((freed / 1024))
  echo
  echo "✓ 已清理约 ${mb} MB。下次 pnpm dev 会重新冷编译（首次打开页面会稍慢属正常）。"
else
  echo
  echo "✓ 没有可清理的缓存目录。"
fi
