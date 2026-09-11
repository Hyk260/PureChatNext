#!/usr/bin/env bash
# 临时用公网 IP 启动：监听 0.0.0.0，APP_URL 用公网 IP。
# 正式上线请改用：APP_URL=https://chat.example.com ./install.sh
# （并把 APP_BIND_ADDRESS 改回 127.0.0.1，由 Nginx 反代）
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "请直接执行 ./start-ip.sh（需要 bash），不要用 sh start-ip.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/docker-compose/deploy/docker-compose.yml" ]]; then
  ROOT="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
  echo "找不到 docker-compose.yml。请在离线包根目录执行，例如 /opt/purechat" >&2
  exit 1
fi

INSTALL="$ROOT/install.sh"
COMPOSE_FILE="$ROOT/docker-compose/deploy/docker-compose.yml"
[[ -x "$INSTALL" ]] || INSTALL="$ROOT/docker-compose/deploy/install.sh"
[[ -x "$INSTALL" ]] || { echo "找不到 install.sh" >&2; exit 1; }

detect_public_ip() {
  local ip=""
  local url
  for url in \
    'http://metadata.tencentyun.com/latest/meta-data/public-ipv4' \
    'http://10.255.2.5/latest/meta-data/public-ipv4' \
    'http://100.100.100.200/latest/meta-data/eipv4' \
    'https://api.ip.sb/ip' \
    'https://ifconfig.me/ip' \
    'https://icanhazip.com'
  do
    ip="$(curl -4 -fsS --max-time 3 "$url" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      printf '%s' "$ip"
      return 0
    fi
  done
  return 1
}

# 旧离线包 compose 写死 127.0.0.1 时就地改成可读 APP_BIND_ADDRESS
ensure_bind_in_compose() {
  if grep -q 'APP_BIND_ADDRESS' "$COMPOSE_FILE"; then
    return 0
  fi
  if grep -qE "127\.0\.0\.1:\$\{APP_PORT:-3210\}:3210" "$COMPOSE_FILE"; then
    echo "检测到旧版 compose，正在改写端口绑定为 APP_BIND_ADDRESS …"
    sed -i.bak -E \
      "s|'127\.0\.0\.1:\$\{APP_PORT:-3210\}:3210'|'\$\{APP_BIND_ADDRESS:-127.0.0.1\}:\$\{APP_PORT:-3210\}:3210'|" \
      "$COMPOSE_FILE"
  fi
  if ! grep -q 'APP_BIND_ADDRESS' "$COMPOSE_FILE"; then
    echo "❌ 无法改写 $COMPOSE_FILE 的端口绑定，请手动把 127.0.0.1 换成 \${APP_BIND_ADDRESS:-127.0.0.1}" >&2
    exit 1
  fi
}

PORT="${APP_PORT:-3210}"
PUBLIC_IP="${PUBLIC_IP:-}"
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(detect_public_ip || true)"
fi
if [[ -z "$PUBLIC_IP" ]]; then
  echo "无法自动探测公网 IP。请手动指定，例如：" >&2
  echo "  PUBLIC_IP=1.2.3.4 sudo ./start-ip.sh" >&2
  exit 1
fi

ensure_bind_in_compose

APP_URL="http://${PUBLIC_IP}:${PORT}"
echo "将以公网 IP 临时启动（无 HTTPS）：$APP_URL"
echo "请在云厂商安全组放行 TCP ${PORT}。"
echo "⚠️  仅供临时调试；正式环境请改用域名 + 反代，并把绑定改回 127.0.0.1。"
echo

export APP_URL
export APP_BIND_ADDRESS=0.0.0.0
exec "$INSTALL"
