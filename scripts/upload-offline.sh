#!/usr/bin/env bash
# 本机一键上传 dist/docker-offline/purechat-next-offline.tar。
# 只跑在打包机器上，不要放进离线包，也不要写进应用 .env / packages/env。
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "请直接执行 bash scripts/upload-offline.sh，不要用 sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_TAR="$ROOT/dist/docker-offline/purechat-next-offline.tar"
DEFAULT_ENV_FILE="$ROOT/docker-compose/deploy/upload.env"
LEGACY_ENV_FILE="$ROOT/docker-compose/deploy/.upload.env"
DEFAULT_REMOTE_TAR="/opt/purechat-next-offline.tar"
DEFAULT_HOME="/opt/purechat"

LOCAL_TAR="$DEFAULT_TAR"
ENV_FILE="$DEFAULT_ENV_FILE"
EXTRACT=0
UP=0
DRY_RUN=0
CLI_HOST=""
CLI_USER=""
CLI_PORT=""
key_tmp=""

usage() {
  cat <<'EOF'
用法:
  pnpm docker:upload
  pnpm docker:upload -- --extract
  pnpm docker:upload -- --up
  bash scripts/upload-offline.sh --dry-run

把 SSH 连接信息写到环境变量，或复制：
  docker-compose/deploy/upload.env.example
  → docker-compose/deploy/upload.env

环境变量（当前 shell 优先于 upload.env）:
  PURECHAT_SSH_HOST          必填，IP 或域名；也可用 user@host
  PURECHAT_SSH_USER         默认 root
  PURECHAT_SSH_PORT         默认 22
  PURECHAT_SSH_KEY_FILE     私钥文件路径（推荐）
  PURECHAT_SSH_KEY          私钥全文（PEM / OpenSSH）
  PURECHAT_REMOTE_TAR      远端 tar 路径。root 默认 /opt/purechat-next-offline.tar；非 root 默认 /tmp
  PURECHAT_HOME             解压目录，默认 /opt/purechat
  PURECHAT_SSH_STRICT_HOST_KEY_CHECKING  默认 accept-new
  PURECHAT_SSH_EXTRA_OPTS   额外 ssh 参数，例：-J bastion

选项:
  --file PATH       本地离线包（默认 dist/docker-offline/purechat-next-offline.tar）
  --env-file PATH   连接配置文件（默认 docker-compose/deploy/upload.env）
  --host HOST       覆盖 PURECHAT_SSH_HOST
  --user USER       覆盖 PURECHAT_SSH_USER
  --port PORT       覆盖 PURECHAT_SSH_PORT
  --extract         上传后解压到 PURECHAT_HOME（不覆盖已有 .env）
  --up              解压后执行 ./install.sh up（升级；服务器上须已有 .env）
  --dry-run         只打印将执行的命令
  -h, --help        显示帮助

私钥优先顺序：-- 已加载的 PURECHAT_SSH_KEY_FILE → PURECHAT_SSH_KEY → ssh-agent。
带口令的私钥请先 ssh-add，不要把口令写进环境变量。
EOF
}

die() {
  echo "❌ $*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$key_tmp" && -f "$key_tmp" ]]; then
    rm -f "$key_tmp"
  fi
}

trap cleanup EXIT INT TERM

need_value() {
  [[ $# -ge 2 && "$2" != -* ]] || die "请给 $1 指定值"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      ;;
    --extract)
      EXTRACT=1
      shift
      ;;
    --up)
      EXTRACT=1
      UP=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --file)
      need_value "$@"
      LOCAL_TAR="$2"
      shift 2
      ;;
    --file=*)
      LOCAL_TAR="${1#*=}"
      shift
      ;;
    --env-file)
      need_value "$@"
      ENV_FILE="$2"
      shift
      ;;
    --env-file=*)
      ENV_FILE="${1#*=}"
      shift
      ;;
    --host)
      need_value "$@"
      CLI_HOST="$2"
      shift 2
      ;;
    --host=*)
      CLI_HOST="${1#*=}"
      shift
      ;;
    --user)
      need_value "$@"
      CLI_USER="$2"
      shift 2
      ;;
    --user=*)
      CLI_USER="${1#*=}"
      shift
      ;;
    --port)
      need_value "$@"
      CLI_PORT="$2"
      shift 2
      ;;
    --port=*)
      CLI_PORT="${1#*=}"
      shift
      ;;
    *)
      die "未知参数 $1"$'\n'"$(usage)"
      ;;
  esac
done

# 已 export 的值优先于配置文件
PRESERVE_HOST="${PURECHAT_SSH_HOST-}"
PRESERVE_USER="${PURECHAT_SSH_USER-}"
PRESERVE_PORT="${PURECHAT_SSH_PORT-}"
PRESERVE_KEY_FILE="${PURECHAT_SSH_KEY_FILE-}"
PRESERVE_KEY="${PURECHAT_SSH_KEY-}"
PRESERVE_REMOTE_TAR="${PURECHAT_REMOTE_TAR-}"
PRESERVE_HOME="${PURECHAT_HOME-}"
PRESERVE_STRICT="${PURECHAT_SSH_STRICT_HOST_KEY_CHECKING-}"
PRESERVE_EXTRA="${PURECHAT_SSH_EXTRA_OPTS-}"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

if [[ "$ENV_FILE" == "$DEFAULT_ENV_FILE" ]]; then
  if [[ -f "$DEFAULT_ENV_FILE" ]]; then
    ENV_FILE="$DEFAULT_ENV_FILE"
  elif [[ -f "$LEGACY_ENV_FILE" ]]; then
    ENV_FILE="$LEGACY_ENV_FILE"
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  load_env_file "$ENV_FILE"
  echo "读取配置：${ENV_FILE}"
elif [[ "$ENV_FILE" != "$DEFAULT_ENV_FILE" && "$ENV_FILE" != "$LEGACY_ENV_FILE" ]]; then
  die "找不到 --env-file ${ENV_FILE}"
fi

restore_if_set() {
  local name="$1"
  local preserved="$2"
  if [[ -n "$preserved" ]]; then
    printf -v "$name" '%s' "$preserved"
    export "$name"
  fi
}

restore_if_set PURECHAT_SSH_HOST "$PRESERVE_HOST"
restore_if_set PURECHAT_SSH_USER "$PRESERVE_USER"
restore_if_set PURECHAT_SSH_PORT "$PRESERVE_PORT"
restore_if_set PURECHAT_SSH_KEY_FILE "$PRESERVE_KEY_FILE"
restore_if_set PURECHAT_SSH_KEY "$PRESERVE_KEY"
restore_if_set PURECHAT_REMOTE_TAR "$PRESERVE_REMOTE_TAR"
restore_if_set PURECHAT_HOME "$PRESERVE_HOME"
restore_if_set PURECHAT_SSH_STRICT_HOST_KEY_CHECKING "$PRESERVE_STRICT"
restore_if_set PURECHAT_SSH_EXTRA_OPTS "$PRESERVE_EXTRA"

[[ -n "$CLI_HOST" ]] && PURECHAT_SSH_HOST="$CLI_HOST"
[[ -n "$CLI_USER" ]] && PURECHAT_SSH_USER="$CLI_USER"
[[ -n "$CLI_PORT" ]] && PURECHAT_SSH_PORT="$CLI_PORT"

if [[ -z "${PURECHAT_SSH_HOST:-}" ]]; then
  die "未设置 PURECHAT_SSH_HOST。请 export，或复制 docker-compose/deploy/upload.env.example 为 upload.env"
fi

if [[ "$PURECHAT_SSH_HOST" == *@* ]]; then
  if [[ -z "${PURECHAT_SSH_USER:-}" ]]; then
    PURECHAT_SSH_USER="${PURECHAT_SSH_HOST%@*}"
  fi
  PURECHAT_SSH_HOST="${PURECHAT_SSH_HOST##*@}"
fi

PURECHAT_SSH_USER="${PURECHAT_SSH_USER:-root}"
PURECHAT_SSH_PORT="${PURECHAT_SSH_PORT:-22}"
PURECHAT_HOME="${PURECHAT_HOME:-$DEFAULT_HOME}"
STRICT="${PURECHAT_SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"

if [[ -z "${PURECHAT_REMOTE_TAR:-}" ]]; then
  if [[ "$PURECHAT_SSH_USER" == "root" ]]; then
    PURECHAT_REMOTE_TAR="$DEFAULT_REMOTE_TAR"
  else
    PURECHAT_REMOTE_TAR="/tmp/purechat-next-offline.tar"
  fi
fi

[[ "$PURECHAT_SSH_PORT" =~ ^[0-9]+$ ]] || die "PURECHAT_SSH_PORT 必须是数字"
[[ "$PURECHAT_REMOTE_TAR" == /* ]] || die "PURECHAT_REMOTE_TAR 必须是绝对路径"
[[ "$PURECHAT_HOME" == /* ]] || die "PURECHAT_HOME 必须是绝对路径"
[[ "$PURECHAT_HOME" != *' '* ]] || die "PURECHAT_HOME 不要包含空格"
if [[ "$PURECHAT_SSH_USER" != "root" && ( "$PURECHAT_REMOTE_TAR" == /opt/* || "$PURECHAT_REMOTE_TAR" == /root/* ) ]]; then
  die "非 root 无法把 tar 写到 ${PURECHAT_REMOTE_TAR}。不要设置 PURECHAT_REMOTE_TAR（默认 /tmp），或改用 root"
fi

if [[ ! -f "$LOCAL_TAR" ]]; then
  die "找不到离线包 ${LOCAL_TAR}。请先运行 pnpm docker:pack"
fi
if [[ ! -s "$LOCAL_TAR" ]]; then
  die "离线包为空：${LOCAL_TAR}"
fi

write_key_file() {
  local raw="$1"
  if [[ "$raw" != *$'\n'* && "$raw" == *'\n'* ]]; then
    raw="$(printf '%b' "$raw")"
  fi
  raw="${raw//$'\r'/}"
  key_tmp="$(mktemp "${TMPDIR:-/tmp}/purechat-ssh.XXXXXX")"
  chmod 600 "$key_tmp"
  printf '%s' "$raw" >"$key_tmp"
  [[ "$raw" == *$'\n' ]] || printf '\n' >>"$key_tmp"
}

IDENTITY_FILE=""
if [[ -n "${PURECHAT_SSH_KEY_FILE:-}" ]]; then
  PURECHAT_SSH_KEY_FILE="${PURECHAT_SSH_KEY_FILE/#\~/$HOME}"
  [[ -f "$PURECHAT_SSH_KEY_FILE" ]] || die "找不到 PURECHAT_SSH_KEY_FILE=$PURECHAT_SSH_KEY_FILE"
  IDENTITY_FILE="$PURECHAT_SSH_KEY_FILE"
elif [[ -n "${PURECHAT_SSH_KEY:-}" ]]; then
  write_key_file "$PURECHAT_SSH_KEY"
  IDENTITY_FILE="$key_tmp"
fi

ssh_opts=(-o BatchMode=yes -o PreferredAuthentications=publickey -o StrictHostKeyChecking="$STRICT")
if [[ -n "$IDENTITY_FILE" ]]; then
  ssh_opts+=(-i "$IDENTITY_FILE" -o IdentitiesOnly=yes)
fi

extra_opts=()
if [[ -n "${PURECHAT_SSH_EXTRA_OPTS:-}" ]]; then
  # shellcheck disable=SC2206
  extra_opts=($PURECHAT_SSH_EXTRA_OPTS)
fi

# 路径已校验为无空格的绝对路径，可直接拼进远端 bash。
# 非 root 用 sudo -n，避免一键脚本卡在密码提示。
remote_bash() {
  local script="$1"
  if [[ "$PURECHAT_SSH_USER" == "root" ]]; then
    printf '%s' "$script"
  else
    printf "sudo -n bash -lc %q" "$script"
  fi
}

join_cmd() {
  local out=""
  local part
  for part in "$@"; do
    out+="$(printf '%q ' "$part")"
  done
  printf '%s' "$out"
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "DRY-RUN: $*"
    return 0
  fi
  "$@"
}

# bash 3.2 + set -u 不能展开空数组
ssh_flags=(-p "$PURECHAT_SSH_PORT" "${ssh_opts[@]}")
scp_flags=(-P "$PURECHAT_SSH_PORT" "${ssh_opts[@]}")
if [[ ${#extra_opts[@]} -gt 0 ]]; then
  ssh_flags+=("${extra_opts[@]}")
  scp_flags+=("${extra_opts[@]}")
fi
ssh_conn=(ssh "${ssh_flags[@]}" "$PURECHAT_SSH_USER@$PURECHAT_SSH_HOST")

rsync_host="$PURECHAT_SSH_HOST"
if [[ "$rsync_host" == *:* && "$rsync_host" != \[* ]]; then
  rsync_host="[$rsync_host]"
fi
REMOTE_SPEC="$PURECHAT_SSH_USER@$rsync_host:$PURECHAT_REMOTE_TAR"

LOCAL_SIZE="$(wc -c <"$LOCAL_TAR" | tr -d '[:space:]')"
echo "本地包：${LOCAL_TAR}（${LOCAL_SIZE} 字节）"
echo "目标：${PURECHAT_SSH_USER}@${PURECHAT_SSH_HOST}:${PURECHAT_SSH_PORT} → ${PURECHAT_REMOTE_TAR}"

if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "检查 SSH…"
  ssh_err="$("${ssh_conn[@]}" true 2>&1)" || {
    echo "$ssh_err" >&2
    if [[ "$ssh_err" == *"Permission denied"* ]]; then
      die "服务器拒绝公钥（不能交互输入密码）。把本机 ~/.ssh/id_ed25519.pub 写入服务器 /root/.ssh/authorized_keys，并在 upload.env 填写 PURECHAT_SSH_KEY_FILE=~/.ssh/id_ed25519。步骤见 docs/self-hosting/platform/1panel.md"
    fi
    die "SSH 失败。请确认安全组放行 ${PURECHAT_SSH_PORT}、账号可用公钥登录，且密钥无口令或已 ssh-add"
  }
fi

ssh_e="$(join_cmd ssh "${ssh_flags[@]}")"
remote_dir="$(dirname "$PURECHAT_REMOTE_TAR")"
run "${ssh_conn[@]}" "$(remote_bash "mkdir -p $remote_dir")"

if command -v rsync >/dev/null 2>&1; then
  echo "使用 rsync 上传…"
  run rsync -aP --partial -e "$ssh_e" "$LOCAL_TAR" "$REMOTE_SPEC" ||
    die "上传失败。请确认 SSH 用户对 $(dirname "$PURECHAT_REMOTE_TAR") 有写权限；非 root 请使用 /tmp"
else
  echo "未找到 rsync，改用 scp…"
  run scp "${scp_flags[@]}" "$LOCAL_TAR" "$PURECHAT_SSH_USER@$PURECHAT_SSH_HOST:$PURECHAT_REMOTE_TAR" ||
    die "上传失败。请确认 SSH 用户对 $(dirname "$PURECHAT_REMOTE_TAR") 有写权限；非 root 请使用 /tmp"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  remote_size="$("${ssh_conn[@]}" "$(remote_bash "wc -c < $PURECHAT_REMOTE_TAR")" | tr -d '[:space:]')"
  [[ "$remote_size" == "$LOCAL_SIZE" ]] || die "远端大小 $remote_size 与本地 $LOCAL_SIZE 不一致"
  echo "✅ 已上传 ${PURECHAT_REMOTE_TAR}"
fi

if [[ "$EXTRACT" -eq 1 ]]; then
  echo "解压到 ${PURECHAT_HOME}…"
  run "${ssh_conn[@]}" "$(remote_bash "mkdir -p $PURECHAT_HOME && tar -xf $PURECHAT_REMOTE_TAR -C $PURECHAT_HOME")"
  echo "✅ 已解压到 ${PURECHAT_HOME}（不会覆盖已有 docker-compose/deploy/.env）"
fi

if [[ "$UP" -eq 1 ]]; then
  echo "执行 install.sh up…"
  run "${ssh_conn[@]}" "$(remote_bash "cd $PURECHAT_HOME && ./install.sh up")"
  echo "✅ 已在服务器执行 install.sh up"
  exit 0
fi

if [[ "$EXTRACT" -eq 0 ]]; then
  echo
  echo "接下来在服务器执行："
  echo "  sudo mkdir -p $PURECHAT_HOME && sudo tar -xf $PURECHAT_REMOTE_TAR -C $PURECHAT_HOME"
  echo "  # 首次安装（把 APP_URL 换成你的 HTTPS 地址）："
  echo "  sudo APP_URL=https://chat.example.com $PURECHAT_HOME/install.sh"
  echo "  # 升级："
  echo "  sudo $PURECHAT_HOME/install.sh up"
  echo
  echo "也可本机一条命令解压 / 升级："
  echo "  pnpm docker:upload -- --extract"
  echo "  pnpm docker:upload -- --up"
fi
