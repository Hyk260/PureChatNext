#!/usr/bin/env bash
# 本地 Redis 控制脚本。
# 用法: bash scripts/shell/local-redis.sh {start|stop|restart|status}
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

DATA_DIR="${PURECHAT_REDIS_DATA_DIR:-/Volumes/MacOs/RedisData}"
CONFIG_FILE="${PURECHAT_REDIS_CONFIG:-$ROOT/config/redis.local.conf}"
REDIS_HOST="${PURECHAT_REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${PURECHAT_REDIS_PORT:-6379}"
PID_FILE="$DATA_DIR/redis.pid"
LOG_FILE="$DATA_DIR/redis.log"

resolve_binary() {
  local name="$1"
  local homebrew_path="/opt/homebrew/opt/redis/bin/$name"

  if [[ -x "$homebrew_path" ]]; then
    printf '%s\n' "$homebrew_path"
    return
  fi

  command -v "$name" 2>/dev/null || true
}

REDIS_SERVER="$(resolve_binary redis-server)"
REDIS_CLI="$(resolve_binary redis-cli)"

fail() {
  echo "❌ $*" >&2
  exit 1
}

redis_cli() {
  "$REDIS_CLI" -h "$REDIS_HOST" -p "$REDIS_PORT" --raw "$@"
}

redis_is_ready() {
  [[ -n "$REDIS_CLI" ]] && [[ "$(redis_cli PING 2>/dev/null || true)" == "PONG" ]]
}

normalize_path() {
  local path="$1"
  if [[ -d "$path" ]]; then
    (cd "$path" && pwd -P)
  else
    printf '%s\n' "${path%/}"
  fi
}

config_value() {
  redis_cli CONFIG GET "$1" 2>/dev/null | tail -n 1
}

info_value() {
  local section="$1"
  local key="$2"
  redis_cli INFO "$section" 2>/dev/null | tr -d '\r' | awk -F: -v key="$key" '$1 == key { print $2; exit }'
}

assert_managed_instance() {
  local actual_dir
  actual_dir="$(config_value dir)"

  if [[ "$(normalize_path "$actual_dir")" != "$(normalize_path "$DATA_DIR")" ]]; then
    echo "❌ 端口 $REDIS_PORT 上的 Redis 不属于 PureChatNext。" >&2
    echo "   期望数据目录: $DATA_DIR" >&2
    echo "   实际数据目录: ${actual_dir:-unknown}" >&2
    exit 2
  fi
}

mounted_volume_for_data_dir() {
  local relative volume_name
  case "$DATA_DIR" in
    /Volumes/*/*)
      relative="${DATA_DIR#/Volumes/}"
      volume_name="${relative%%/*}"
      printf '/Volumes/%s\n' "$volume_name"
      ;;
  esac
}

ensure_data_dir() {
  local volume
  volume="$(mounted_volume_for_data_dir)"

  if [[ -n "$volume" ]] && ! mount | grep -F " on $volume (" >/dev/null; then
    fail "外置卷未挂载: $volume"
  fi

  mkdir -p "$DATA_DIR"
  [[ -d "$DATA_DIR" ]] || fail "Redis 数据目录不存在: $DATA_DIR"
  [[ -w "$DATA_DIR" ]] || fail "Redis 数据目录不可写: $DATA_DIR"
}

ensure_prerequisites() {
  [[ -n "$REDIS_SERVER" && -x "$REDIS_SERVER" ]] || fail "找不到 redis-server，请先安装 Homebrew Redis"
  [[ -n "$REDIS_CLI" && -x "$REDIS_CLI" ]] || fail "找不到 redis-cli，请先安装 Homebrew Redis"
  [[ -r "$CONFIG_FILE" ]] || fail "Redis 配置文件不可读: $CONFIG_FILE"
  [[ "$REDIS_PORT" =~ ^[0-9]+$ ]] || fail "Redis 端口无效: $REDIS_PORT"
  ensure_data_dir
}

port_is_listening() {
  command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$REDIS_PORT" -sTCP:LISTEN 2>/dev/null | grep -q .
}

start_redis() {
  ensure_prerequisites

  if redis_is_ready; then
    assert_managed_instance
    echo "✅ Redis 已在运行: redis://$REDIS_HOST:$REDIS_PORT"
    return
  fi

  if port_is_listening; then
    fail "端口 $REDIS_PORT 已被其他进程占用"
  fi

  "$REDIS_SERVER" "$CONFIG_FILE" \
    --daemonize yes \
    --dir "$DATA_DIR" \
    --pidfile "$PID_FILE" \
    --logfile "$LOG_FILE" \
    --port "$REDIS_PORT"

  for _ in {1..50}; do
    if redis_is_ready; then
      assert_managed_instance
      echo "✅ Redis 已启动: redis://$REDIS_HOST:$REDIS_PORT"
      echo "   数据目录: $DATA_DIR"
      echo "   日志文件: $LOG_FILE"
      return
    fi
    sleep 0.1
  done

  echo "❌ Redis 启动失败，最近日志：" >&2
  tail -n 20 "$LOG_FILE" 2>/dev/null >&2 || true
  exit 1
}

stop_redis() {
  [[ -n "$REDIS_CLI" && -x "$REDIS_CLI" ]] || fail "找不到 redis-cli，请先安装 Homebrew Redis"

  if ! redis_is_ready; then
    echo "ℹ️ Redis 已停止: redis://$REDIS_HOST:$REDIS_PORT"
    return
  fi

  assert_managed_instance
  redis_cli SHUTDOWN >/dev/null

  for _ in {1..50}; do
    if ! redis_is_ready; then
      echo "✅ Redis 已停止"
      return
    fi
    sleep 0.1
  done

  fail "Redis 未能在 5 秒内停止"
}

status_redis() {
  [[ -n "$REDIS_CLI" && -x "$REDIS_CLI" ]] || fail "找不到 redis-cli，请先安装 Homebrew Redis"

  if ! redis_is_ready; then
    echo "⏹ Redis 未运行: redis://$REDIS_HOST:$REDIS_PORT"
    return 1
  fi

  assert_managed_instance

  echo "✅ Redis 正在运行"
  echo "   地址: redis://$REDIS_HOST:$REDIS_PORT"
  echo "   版本: $(info_value server redis_version)"
  echo "   PID: $(info_value server process_id)"
  echo "   bind: $(config_value bind)"
  echo "   数据目录: $(config_value dir)"
  echo "   maxmemory: $(config_value maxmemory) bytes"
  echo "   淘汰策略: $(config_value maxmemory-policy)"
  echo "   AOF: $(config_value appendonly), fsync=$(config_value appendfsync)"
  echo "   日志文件: $LOG_FILE"
}

usage() {
  echo "用法: $0 {start|stop|restart|status}" >&2
  exit 2
}

case "${1:-}" in
  start)
    start_redis
    ;;
  stop)
    stop_redis
    ;;
  restart)
    stop_redis
    start_redis
    ;;
  status)
    status_redis
    ;;
  *)
    usage
    ;;
esac
