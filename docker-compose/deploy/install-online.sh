#!/usr/bin/env bash
# PureChatNext 云服务器在线安装入口：拉取编排文件并从 GHCR 拉镜像，无需本机 docker:pack。
#
# 一条命令（把 APP_URL 换成你的 HTTPS 地址）：
#   curl -fsSL https://raw.githubusercontent.com/Hyk260/PureChatNext/main/docker-compose/deploy/install-online.sh \
#     | sudo APP_URL=https://chat.example.com bash
#
# 或克隆/解压仓库后：
#   sudo APP_URL=https://chat.example.com ./docker-compose/deploy/install-online.sh
#
# 可选环境变量：
#   PURECHAT_HOME     安装目录，默认 /opt/purechat
#   PURECHAT_REF      Git 引用（分支/tag/sha），默认 main；发版后可改为 v0.2.5
#   PURECHAT_REPO     GitHub owner/repo，默认 Hyk260/PureChatNext
#   PURECHAT_REFRESH  设为 1 时强制按 PURECHAT_REF 重新下载编排（保留 .env）
#   PURECHAT_IMAGE    应用镜像，默认 ghcr.io/hyk260/purechat-next:latest
#   PURECHAT_VERSION  未设 PURECHAT_IMAGE 时的 tag
#   APP_URL / APP_BIND_ADDRESS / APP_PORT  同 install.sh
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "请使用 bash 执行（curl … | bash，或 ./install-online.sh）" >&2
  exit 1
fi

PURECHAT_HOME="${PURECHAT_HOME:-/opt/purechat}"
PURECHAT_REPO="${PURECHAT_REPO:-Hyk260/PureChatNext}"
PURECHAT_REF="${PURECHAT_REF:-main}"
RAW_BASE="https://raw.githubusercontent.com/${PURECHAT_REPO}/${PURECHAT_REF}"

die() {
  echo "❌ $*" >&2
  exit 1
}

have_stack() {
  local root="$1"
  [[ -f "$root/docker-compose/deploy/docker-compose.yml" \
    && -f "$root/docker-compose/deploy/docker-compose.online.yml" \
    && -f "$root/docker-compose/deploy/.env.example" \
    && -f "$root/docker-compose/deploy/install.sh" \
    && -d "$root/docker-compose/deploy/profiles" ]]
}

fetch() {
  local url="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$dest" "$url"
  else
    die "需要 curl 或 wget 以下载安装文件"
  fi
  [[ -s "$dest" ]] || die "下载失败或文件为空：$url"
}

bootstrap_stack() {
  local dest="$1"
  echo "从 ${PURECHAT_REPO}@${PURECHAT_REF} 下载在线安装文件 → $dest"
  mkdir -p "$dest/docker-compose/deploy/profiles"

  local paths=(
    docker-compose/deploy/docker-compose.yml
    docker-compose/deploy/docker-compose.online.yml
    docker-compose/deploy/.env.example
    docker-compose/deploy/profiles/2g.env
    docker-compose/deploy/install.sh
    docker-compose/deploy/install-online.sh
    docker-compose/deploy/start-ip.sh
  )
  local rel
  for rel in "${paths[@]}"; do
    echo "  · $rel"
    fetch "${RAW_BASE}/${rel}" "$dest/${rel}"
  done

  cp "$dest/docker-compose/deploy/install.sh" "$dest/install.sh"
  cp "$dest/docker-compose/deploy/install-online.sh" "$dest/install-online.sh"
  cp "$dest/docker-compose/deploy/start-ip.sh" "$dest/start-ip.sh"
  chmod 755 "$dest/install.sh" "$dest/install-online.sh" "$dest/start-ip.sh" \
    "$dest/docker-compose/deploy/install.sh" \
    "$dest/docker-compose/deploy/install-online.sh" \
    "$dest/docker-compose/deploy/start-ip.sh"
  echo "✅ 安装文件已就绪"
}

# 若在仓库或已安装目录内执行，优先用本地文件；curl|bash 则引导到 PURECHAT_HOME。
# PURECHAT_REFRESH=1 时强制按 PURECHAT_REF 重新下载编排（保留已有 .env）。
resolve_root() {
  local here=""
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$here/docker-compose.yml" ]]; then
      here="$(cd "$here/../.." && pwd)"
    fi
    if have_stack "$here" && [[ "${PURECHAT_REFRESH:-}" != "1" ]]; then
      printf '%s' "$here"
      return
    fi
  fi
  if have_stack "$PURECHAT_HOME" && [[ "${PURECHAT_REFRESH:-}" != "1" ]]; then
    printf '%s' "$PURECHAT_HOME"
    return
  fi
  bootstrap_stack "$PURECHAT_HOME"
  printf '%s' "$PURECHAT_HOME"
}

ROOT="$(resolve_root)"
INSTALL="$ROOT/install.sh"
[[ -x "$INSTALL" ]] || INSTALL="$ROOT/docker-compose/deploy/install.sh"
[[ -f "$INSTALL" ]] || die "找不到 install.sh（$ROOT）"

export PURECHAT_IMAGE="${PURECHAT_IMAGE:-ghcr.io/hyk260/purechat-next:${PURECHAT_VERSION:-latest}}"

echo "安装目录：$ROOT"
echo "应用镜像：$PURECHAT_IMAGE"
echo

# 透传参数；默认强制 online，避免误用残缺离线包
exec bash "$INSTALL" --online "$@"
