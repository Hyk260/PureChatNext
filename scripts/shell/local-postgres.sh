#!/usr/bin/env bash
# 本地 PostgreSQL 控制脚本。
# 用法: bash scripts/shell/local-postgres.sh {start|stop|restart|status|logs [--follow]}

set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

POSTGRES_BIN_DIR="${POSTGRES_BIN_DIR:-/opt/homebrew/opt/postgresql@17/bin}"
POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-/Volumes/MacOs/PostgreSQL/17/data}"
POSTGRES_LOG_DIR="${POSTGRES_LOG_DIR:-/Volumes/MacOs/PostgreSQL/17/log}"
POSTGRES_CONFIG_FILE="${POSTGRES_CONFIG_FILE:-${ROOT}/config/postgresql.local.conf}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_LOG_FILE="${POSTGRES_LOG_FILE:-${POSTGRES_LOG_DIR}/postgresql.log}"

PG_CTL="${POSTGRES_BIN_DIR}/pg_ctl"
PG_ISREADY="${POSTGRES_BIN_DIR}/pg_isready"
POSTGRES="${POSTGRES_BIN_DIR}/postgres"

usage() {
  echo "用法: $0 {start|stop|restart|status|logs [--follow]}" >&2
  exit 64
}

require_binary() {
  if [[ ! -x "$1" ]]; then
    echo "❌ 找不到 PostgreSQL 可执行文件: $1" >&2
    echo "   如果安装在其他位置，请设置 POSTGRES_BIN_DIR。" >&2
    exit 1
  fi
}

require_volume() {
  local relative_path
  local volume_root

  case "$POSTGRES_DATA_DIR" in
    /Volumes/*/*)
      relative_path="${POSTGRES_DATA_DIR#/Volumes/}"
      volume_root="/Volumes/${relative_path%%/*}"
      ;;
    *)
      echo "❌ PostgreSQL 数据目录必须位于已挂载的外置卷: ${POSTGRES_DATA_DIR}" >&2
      exit 1
      ;;
  esac

  if ! mount | grep -Fq "on ${volume_root} ("; then
    echo "❌ PostgreSQL 外置卷未挂载: ${volume_root}" >&2
    exit 1
  fi
}

require_cluster() {
  require_volume

  if [[ ! -f "${POSTGRES_DATA_DIR}/PG_VERSION" ]]; then
    echo "❌ PostgreSQL 数据目录尚未初始化: ${POSTGRES_DATA_DIR}" >&2
    exit 1
  fi
}

require_config() {
  if [[ ! -r "$POSTGRES_CONFIG_FILE" ]]; then
    echo "❌ PostgreSQL 配置文件不可读: ${POSTGRES_CONFIG_FILE}" >&2
    exit 1
  fi
}

is_running() {
  "$PG_CTL" -D "$POSTGRES_DATA_DIR" status >/dev/null 2>&1
}

start_postgres() {
  require_binary "$POSTGRES"
  require_binary "$PG_CTL"
  require_binary "$PG_ISREADY"
  require_cluster
  require_config

  if is_running; then
    echo "✅ PostgreSQL 已在运行: postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}"
    "$PG_ISREADY" -h "$POSTGRES_HOST" -p "$POSTGRES_PORT"
    return
  fi

  mkdir -p "$POSTGRES_LOG_DIR"
  chmod 700 "$POSTGRES_LOG_DIR"

  echo "⏳ 正在启动 PostgreSQL..."
  "$PG_CTL" \
    -D "$POSTGRES_DATA_DIR" \
    -l "$POSTGRES_LOG_FILE" \
    -o "-c config_file=${POSTGRES_CONFIG_FILE}" \
    -t 30 \
    -w start
  "$PG_ISREADY" -h "$POSTGRES_HOST" -p "$POSTGRES_PORT"
  echo "✅ PostgreSQL 已启动"
  echo "   数据目录: ${POSTGRES_DATA_DIR}"
  echo "   日志文件: ${POSTGRES_LOG_FILE}"
}

stop_postgres() {
  require_binary "$PG_CTL"
  require_cluster

  if ! is_running; then
    echo "ℹ️ PostgreSQL 已停止: postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}"
    return
  fi

  echo "⏳ 正在停止 PostgreSQL..."
  "$PG_CTL" -D "$POSTGRES_DATA_DIR" -m fast -t 30 -w stop
  echo "✅ PostgreSQL 已停止"
}

restart_postgres() {
  stop_postgres
  start_postgres
}

status_postgres() {
  require_binary "$PG_CTL"
  require_binary "$PG_ISREADY"
  require_cluster

  if is_running; then
    echo "✅ PostgreSQL 正在运行"
    "$PG_CTL" -D "$POSTGRES_DATA_DIR" status
    "$PG_ISREADY" -h "$POSTGRES_HOST" -p "$POSTGRES_PORT"
    echo "   配置文件: ${POSTGRES_CONFIG_FILE}"
    echo "   数据目录: ${POSTGRES_DATA_DIR}"
    echo "   日志文件: ${POSTGRES_LOG_FILE}"
  else
    echo "⏹ PostgreSQL 未运行: postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}"
    exit 3
  fi
}

show_logs() {
  require_volume

  if [[ ! -f "$POSTGRES_LOG_FILE" ]]; then
    echo "❌ PostgreSQL 日志文件尚不存在: ${POSTGRES_LOG_FILE}" >&2
    exit 1
  fi

  if [[ "${1:-}" == "--follow" ]]; then
    tail -n 100 -f "$POSTGRES_LOG_FILE"
  else
    tail -n 100 "$POSTGRES_LOG_FILE"
  fi
}

case "${1:-}" in
  start)
    start_postgres
    ;;
  stop)
    stop_postgres
    ;;
  restart)
    restart_postgres
    ;;
  status)
    status_postgres
    ;;
  logs)
    show_logs "${2:-}"
    ;;
  *)
    usage
    ;;
esac
