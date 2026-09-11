#!/usr/bin/env bash
# PureChatNext 安装 / 运维入口。服务器不需要 pnpm、bun 或完整仓库。
# 离线：由 `pnpm docker:pack` 拷到离线包根目录；含 images/manifest.txt，禁止 pull/build。
# 在线：由 install-online.sh 引导，或仓库内带 docker-compose.online.yml；从 GHCR 拉应用镜像。
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "请直接执行 ./install.sh（需要 bash），不要用 sh install.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/docker-compose/deploy/docker-compose.yml" ]]; then
  ROOT="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
  echo "找不到 docker-compose.yml。请将离线包完整解压到同一目录，或先运行 install-online.sh。" >&2
  exit 1
fi

DEPLOY_DIR="$ROOT/docker-compose/deploy"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ONLINE_OVERRIDE="$DEPLOY_DIR/docker-compose.online.yml"
ENV_FILE="$DEPLOY_DIR/.env"
ENV_EXAMPLE="$DEPLOY_DIR/.env.example"
PROFILE_DIR="$DEPLOY_DIR/profiles"
MANIFEST="$ROOT/images/manifest.txt"
OFFLINE_OVERRIDE="$DEPLOY_DIR/docker-compose.offline-images.yml"
RUNTIME_OVERRIDE="$DEPLOY_DIR/docker-compose.runtime.yml"
EXT_NET="${PURECHAT_EXT_NETWORK:-purechat-ext}"
DEFAULT_ONLINE_IMAGE_REPO="ghcr.io/hyk260/purechat-next"
PG_APP_USER="purechat"
PG_APP_DB="purechat"
REDIS_APP_USER="purechat"

MODE="" # offline | online
APP_IMAGE=""
APP_IMAGE_RELOADED=0
COMPOSE_UP_ARGS=()

usage() {
  cat <<'EOF'
用法:
  APP_URL=https://chat.example.com ./install.sh
  ./install.sh --app-url "$APP_URL"
  ./install.sh --online                          # 强制在线（拉 GHCR）
  ./start-ip.sh                                  # 临时：公网 IP + 0.0.0.0
  ./install.sh up
  ./install.sh up --force-recreate   # 改完 .env 后必须重建；restart 不会加载新环境变量
  ./install.sh ps
  ./install.sh logs app
  docker exec -T postgresql pg_dump -U purechat -d purechat --format=custom --no-owner

选项:
  --online          强制在线模式（需要 docker-compose.online.yml）
  --offline         强制离线模式（需要 images/manifest.txt）
  --profile NAME    资源档案（默认 2g）
  --app-url URL     写入 APP_URL（已有 .env 时只改这一项；CORS 默认允许该地址）
  --bind ADDRESS    写入 APP_BIND_ADDRESS（默认 127.0.0.1；IP 临时访问用 0.0.0.0）
  -h, --help        显示帮助

环境变量:
  APP_URL             未传 --app-url 时使用（例 https://chat.example.com）
  APP_BIND_ADDRESS    未传 --bind 时使用（例 127.0.0.1 或 0.0.0.0）
  APP_PORT            start-ip.sh / 健康检查端口，默认 3210
  PURECHAT_IMAGE      在线模式应用镜像（默认 ghcr.io/hyk260/purechat-next:latest）
  PURECHAT_VERSION    未设 PURECHAT_IMAGE 时使用的 tag（默认 latest）
  POSTGRES_CONTAINER  系统 PostgreSQL 容器名（默认自动检测 postgresql）
  REDIS_CONTAINER     系统 Redis 容器名（默认自动检测 redis）
  DISABLE_REDIS=1     不连接系统 Redis

离线包须包含 images/manifest.txt；在线安装须能访问 GHCR（或镜像站后的 PURECHAT_IMAGE）。
已存在的 .env 不会被覆盖密钥。离线模式禁止 compose build / pull。
EOF
}

die() {
  echo "❌ $*" >&2
  exit 1
}

resolve_mode() {
  local force="${1:-}"
  if [[ "$force" == "online" ]]; then
    [[ -f "$ONLINE_OVERRIDE" ]] || die "强制 --online 但缺少 $ONLINE_OVERRIDE"
    MODE=online
    return
  fi
  if [[ "$force" == "offline" ]]; then
    [[ -f "$MANIFEST" ]] || die "强制 --offline 但缺少 $MANIFEST"
    MODE=offline
    return
  fi
  if [[ -f "$MANIFEST" ]]; then
    MODE=offline
  elif [[ -f "$ONLINE_OVERRIDE" ]]; then
    MODE=online
  else
    die "未检测到离线包（images/manifest.txt）或在线覆盖（docker-compose.online.yml）。请使用 install-online.sh，或解压完整离线包。"
  fi
}

resolve_app_image() {
  if [[ "$MODE" == "offline" ]]; then
    APP_IMAGE="purechat-next:local"
    return
  fi
  if [[ -n "${PURECHAT_IMAGE:-}" ]]; then
    APP_IMAGE="$PURECHAT_IMAGE"
  elif [[ -f "$ENV_FILE" ]]; then
    APP_IMAGE="$(env_value PURECHAT_IMAGE)"
  fi
  if [[ -z "$APP_IMAGE" ]]; then
    APP_IMAGE="${DEFAULT_ONLINE_IMAGE_REPO}:${PURECHAT_VERSION:-latest}"
  fi
}

compose() {
  local files=(-f "$COMPOSE_FILE")
  if [[ "$MODE" == "online" ]]; then
    files+=(-f "$ONLINE_OVERRIDE")
  elif [[ -f "$OFFLINE_OVERRIDE" ]]; then
    # 离线 load 只有 name:tag，Compose 里的 name@sha256 会找不到；用 override 覆盖为 tag
    files+=(-f "$OFFLINE_OVERRIDE")
  fi
  if [[ -f "$RUNTIME_OVERRIDE" ]]; then
    files+=(-f "$RUNTIME_OVERRIDE")
  fi
  docker compose --env-file "$ENV_FILE" "${files[@]}" "$@"
}

env_value() {
  local key="$1"
  local line=""
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null || true)"
  printf '%s' "${line#*=}"
}

upsert_env() {
  local key="$1"
  local value="$2"
  local tmp found=0
  tmp="$(mktemp)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "${key}="* ]]; then
      printf '%s=%s\n' "$key" "$value"
      found=1
    else
      printf '%s\n' "$line"
    fi
  done < "$ENV_FILE" >"$tmp"
  if [[ "$found" -eq 0 ]]; then
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  cat "$tmp" >"$ENV_FILE"
  rm -f "$tmp"
  chmod 600 "$ENV_FILE"
}

secret_bytes() {
  openssl rand "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
}

generate_jwks() {
  docker run --rm --network none --entrypoint node "$APP_IMAGE" --input-type=module -e '
import { generateKeyPairSync, randomBytes } from "node:crypto";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = privateKey.export({ format: "jwk" });
process.stdout.write(JSON.stringify({
  keys: [{ ...jwk, alg: "RS256", kid: randomBytes(8).toString("hex"), use: "sig" }],
}));
'
}

image_present() {
  local image="$1"
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi
  [[ "$image" != *@* ]] && return 1
  local nametag="${image%@*}"
  local digest="${image##*@}"
  if docker image inspect "$digest" >/dev/null 2>&1; then
    docker tag "$digest" "$nametag" >/dev/null 2>&1 || true
    docker image inspect "$image" >/dev/null 2>&1 && return 0
    docker image inspect "$nametag" >/dev/null 2>&1 && return 0
  fi
  docker image inspect "$nametag" >/dev/null 2>&1
}

image_exact() {
  docker image inspect "$1" >/dev/null 2>&1
}

is_app_image() {
  case "$1" in
    purechat-next:* | *purechat-next:*) return 0 ;;
    *) return 1 ;;
  esac
}

file_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    die "需要 sha256sum 或 shasum 以检测镜像档案是否变化"
  fi
}

archive_stamp() {
  printf '%s' "$ROOT/images/.loaded-$(basename "$1").sha256"
}

# 依赖镜像存在则跳过；应用镜像在档案哈希变化时强制重新 load（同名 tag 不会自动覆盖运行中容器）
should_load_archive() {
  local image="$1"
  local archive="$2"
  if ! image_present "$image"; then
    return 0
  fi
  if ! is_app_image "$image"; then
    return 1
  fi
  [[ -f "$ROOT/$archive" ]] || return 1
  local stamp hash
  stamp="$(archive_stamp "$archive")"
  hash="$(file_sha256 "$ROOT/$archive")"
  if [[ -f "$stamp" && "$(cat "$stamp")" == "$hash" ]]; then
    return 1
  fi
  echo "应用镜像档案已更新，将重新导入 $image（覆盖已有 tag）"
  return 0
}

mark_archive_loaded() {
  local image="$1"
  local archive="$2"
  if is_app_image "$image"; then
    file_sha256 "$ROOT/$archive" >"$(archive_stamp "$archive")"
    APP_IMAGE_RELOADED=1
  fi
}

service_for_image() {
  case "$1" in
    purechat-next:* | *purechat-next:*) printf 'app' ;;
    *) return 1 ;;
  esac
}

# docker load 不会带上 Compose 里的 @sha256 引用；生成 override，避免 No such image
write_offline_image_override() {
  local image nametag service
  local -a entries=()
  rm -f "$OFFLINE_OVERRIDE"
  [[ -f "$MANIFEST" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    image="${line%%	*}"
    [[ "$image" == *@* ]] || continue
    nametag="${image%@*}"
    if image_exact "$image"; then
      continue
    fi
    image_exact "$nametag" || continue
    service="$(service_for_image "$nametag")" || continue
    entries+=("$service"$'\t'"$nametag")
  done <"$MANIFEST"

  if [[ ${#entries[@]} -eq 0 ]]; then
    return 0
  fi

  {
    echo '# 由 install.sh 自动生成：离线 load 只有 name:tag，覆盖 compose 中的 digest 引用'
    echo 'services:'
    local entry
    for entry in "${entries[@]}"; do
      service="${entry%%	*}"
      nametag="${entry#*	}"
      printf '  %s:\n    image: %s\n' "$service" "$nametag"
    done
  } >"$OFFLINE_OVERRIDE"
  echo "✅ 已生成离线镜像覆盖 $OFFLINE_OVERRIDE（${#entries[@]} 个服务）"
}

load_archive() {
  local archive="$1"
  echo "导入 $archive ..."
  gzip -dc "$ROOT/$archive" | docker load
}

ensure_images_offline() {
  [[ -f "$MANIFEST" ]] || die "缺少 images/manifest.txt，请将离线包完整解压到 $ROOT"
  local image archive loaded=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    image="${line%%	*}"
    archive="${line#*	}"
    [[ -n "$image" && -n "$archive" && "$image" != "$archive" ]] || die "images/manifest.txt 格式无效：$line"
    if ! should_load_archive "$image" "$archive"; then
      if image_exact "$image"; then
        echo "已存在镜像 $image"
      else
        echo "已存在镜像 ${image%@*}（将用 tag 覆盖 compose 中的 digest）"
      fi
      continue
    fi
    [[ -f "$ROOT/$archive" ]] || die "缺少 $archive，无法导入 $image。请将离线包完整解压到 $ROOT"
    if [[ "$loaded" != *$'\n'"$archive"$'\n'* ]]; then
      load_archive "$archive"
      loaded+=$'\n'"$archive"$'\n'
      mark_archive_loaded "$image" "$archive"
    fi
    image_present "$image" || die "已导入 $archive，但仍找不到镜像 $image"
  done <"$MANIFEST"
  write_offline_image_override
}

ensure_images_online() {
  resolve_app_image
  echo "在线模式：应用镜像 $APP_IMAGE"
  if image_exact "$APP_IMAGE"; then
    echo "已存在镜像 $APP_IMAGE"
  else
    echo "拉取 $APP_IMAGE ..."
    docker pull "$APP_IMAGE" || die "无法拉取 $APP_IMAGE。请检查网络 / GHCR 权限，或设置 PURECHAT_IMAGE 指向可达镜像"
  fi
  if [[ -f "$ENV_FILE" ]]; then
    upsert_env PURECHAT_IMAGE "$APP_IMAGE"
  fi
}

ensure_images() {
  if [[ "$MODE" == "online" ]]; then
    ensure_images_online
  else
    ensure_images_offline
  fi
}

apply_profile() {
  local profile="$1"
  local profile_file="$PROFILE_DIR/${profile}.env"
  [[ -f "$profile_file" ]] || die "未知部署档案 --profile ${profile}，缺少 $profile_file"
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" != "$line" ]] || continue
    upsert_env "$key" "$value"
  done <"$profile_file"
  echo "✅ 已应用资源档案 $profile"
}

create_env() {
  [[ -f "$ENV_EXAMPLE" ]] || die "缺少 $ENV_EXAMPLE"
  command -v openssl >/dev/null 2>&1 || die "需要 openssl 以生成密钥"
  resolve_app_image
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  upsert_env AUTH_SECRET "$(secret_bytes 32)"
  upsert_env CRON_SECRET "$(secret_bytes 32)"
  upsert_env KEY_VAULTS_SECRET "$(secret_bytes 32)"
  upsert_env POSTGRES_USER "$PG_APP_USER"
  upsert_env POSTGRES_DB "$PG_APP_DB"
  upsert_env POSTGRES_PASSWORD "$(secret_bytes 24)"
  upsert_env REDIS_PASSWORD "$(secret_bytes 24)"
  upsert_env REDIS_PREFIX "purechat"
  upsert_env REDIS_URL ""
  upsert_env REDIS_USERNAME ""
  if [[ "$MODE" == "online" ]]; then
    upsert_env PURECHAT_IMAGE "$APP_IMAGE"
  fi
  local jwks
  jwks="$(generate_jwks | tr -d '\n')"
  [[ -n "$jwks" && "$jwks" == '{"keys":'* ]] || die "无法用 $APP_IMAGE 生成 JWKS_KEY，请确认该镜像已可用"
  upsert_env JWKS_KEY "$jwks"
  if grep -q '__GENERATE_' "$ENV_FILE"; then
    die "$ENV_FILE 仍含未替换的占位符"
  fi
  echo "✅ 已创建 $ENV_FILE（权限 0600）"
}

warn_if_localhost_url() {
  local app_url
  app_url="$(env_value APP_URL)"
  if [[ "$app_url" == *localhost* || "$app_url" == *127.0.0.1* ]]; then
    echo "⚠️  APP_URL=$app_url 。生产请使用 HTTPS 域名，例如："
    echo "    APP_URL=https://chat.example.com ./install.sh"
  fi
}

warn_if_public_bind() {
  local bind app_url
  bind="$(env_value APP_BIND_ADDRESS)"
  app_url="$(env_value APP_URL)"
  if [[ "$bind" == "0.0.0.0" ]]; then
    echo "⚠️  APP_BIND_ADDRESS=0.0.0.0：应用直接暴露在公网，仅适合未备案临时调试。"
    echo "    备案后请改回 127.0.0.1，并用 Nginx 或 Caddy 反代 HTTPS 域名。"
  fi
  if [[ "$app_url" == http://* && "$app_url" != *localhost* && "$app_url" != *127.0.0.1* ]]; then
    echo "⚠️  使用 HTTP + 公网地址（$app_url）：Cookie / OAuth / 微信渠道可能异常，仅供临时验收。"
  fi
}

warn_if_missing_provider() {
  local key value
  for key in OPENAI_API_KEY DEEPSEEK_API_KEY AI_GATEWAY_API_KEY PURECHAT_API_KEY; do
    value="$(env_value "$key")"
    if [[ -n "$value" ]]; then
      return 0
    fi
  done
  echo "⚠️  尚未配置模型 Provider 密钥。编辑 $ENV_FILE 写入 DEEPSEEK_API_KEY 等，再执行 ./install.sh up"
}

warn_if_missing_s3() {
  local endpoint bucket access secret
  endpoint="$(env_value S3_ENDPOINT)"
  bucket="$(env_value S3_BUCKET)"
  access="$(env_value S3_ACCESS_KEY_ID)"
  secret="$(env_value S3_SECRET_ACCESS_KEY)"
  if [[ -n "$endpoint" && -n "$bucket" && -n "$access" && -n "$secret" ]]; then
    return 0
  fi
  echo "⚠️  尚未配置云对象存储（S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY）。"
  echo "    聊天可用；文件 / 知识库上传会不可用。编辑 $ENV_FILE 后执行 ./install.sh up"
}

container_env() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" | awk -F= -v key="$2" '$1==key {print substr($0, index($0, "=")+1); exit}'
}

container_names_by_image() {
  local pattern="$1"
  docker ps --format '{{.Names}}\t{{.Image}}' | awk -v pat="$pattern" 'BEGIN{IGNORECASE=1} $2 ~ pat {print $1}'
}

pick_container() {
  local kind="$1"
  local explicit="$2"
  local pattern="$3"
  local preferred="$4"
  local name names=()
  if [[ -n "$explicit" ]]; then
    docker inspect "$explicit" >/dev/null 2>&1 || die "${kind} 容器 ${explicit} 不存在或未运行。请设置正确的容器名。"
    printf '%s' "$explicit"
    return
  fi
  while IFS= read -r name; do
    [[ -n "$name" ]] && names+=("$name")
  done < <(container_names_by_image "$pattern")
  if [[ ${#names[@]} -eq 0 ]]; then
    return 1
  fi
  for name in "${names[@]}"; do
    if [[ "$name" == "$preferred" ]]; then
      printf '%s' "$name"
      return
    fi
  done
  if [[ ${#names[@]} -eq 1 ]]; then
    printf '%s' "${names[0]}"
    return
  fi
  die "找到多个 ${kind} 容器：${names[*]}。请设置 ${kind} 容器名环境变量后重试。"
}

ensure_ext_network() {
  docker network inspect "$EXT_NET" >/dev/null 2>&1 || docker network create "$EXT_NET" >/dev/null
}

connect_ext_network() {
  local container="$1"
  docker network connect "$EXT_NET" "$container" >/dev/null 2>&1 || true
  docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$container" \
    | grep -qx "$EXT_NET" || die "无法把容器 $container 加入 Docker 网络 $EXT_NET"
}

write_runtime_override() {
  ensure_ext_network
  cat >"$RUNTIME_OVERRIDE" <<EOF
# 由 install.sh 生成：把应用接到系统 PostgreSQL / Redis 所在的 Docker 网络。
services:
  app:
    networks:
      ext: {}
networks:
  ext:
    external: true
    name: ${EXT_NET}
EOF
}

sql_quote() {
  local value="$1"
  printf "%s" "${value//\'/\'\'}"
}

provision_postgres() {
  local container admin password exists
  container="$(pick_container POSTGRES "${POSTGRES_CONTAINER:-$(env_value POSTGRES_CONTAINER)}" 'postgres' postgresql)" \
    || die "未找到运行中的 PostgreSQL 容器。请先启动 PostgreSQL，或设置 POSTGRES_CONTAINER。"
  admin="$(container_env "$container" POSTGRES_USER)"
  admin="${admin:-postgres}"
  password="$(env_value POSTGRES_PASSWORD)"
  [[ -n "$password" && "$password" != __GENERATE_* ]] || die "POSTGRES_PASSWORD 未生成。请重新执行 ./install.sh"
  echo "正在系统 PostgreSQL 容器 $container 中确保用户/库 ${PG_APP_USER}/${PG_APP_DB} …"
  docker exec -i "$container" psql -U "$admin" -d postgres -v ON_ERROR_STOP=1 >/dev/null <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_APP_USER}') THEN
    CREATE ROLE ${PG_APP_USER} LOGIN PASSWORD '$(sql_quote "$password")';
  ELSE
    ALTER ROLE ${PG_APP_USER} WITH LOGIN PASSWORD '$(sql_quote "$password")';
  END IF;
END
\$\$;
SQL
  exists="$(docker exec -i "$container" psql -U "$admin" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='${PG_APP_DB}'")"
  if [[ "$exists" != "1" ]]; then
    docker exec -i "$container" psql -U "$admin" -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${PG_APP_DB} OWNER ${PG_APP_USER}" >/dev/null
  fi
  docker exec -i "$container" psql -U "$admin" -d "$PG_APP_DB" -v ON_ERROR_STOP=1 >/dev/null <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${PG_APP_DB} TO ${PG_APP_USER};
GRANT ALL ON SCHEMA public TO ${PG_APP_USER};
ALTER SCHEMA public OWNER TO ${PG_APP_USER};
SQL
  ensure_ext_network
  connect_ext_network "$container"
  upsert_env POSTGRES_CONTAINER "$container"
  upsert_env POSTGRES_USER "$PG_APP_USER"
  upsert_env POSTGRES_DB "$PG_APP_DB"
  upsert_env POSTGRES_HOST "$container"
  upsert_env POSTGRES_PORT "5432"
  echo "✅ PostgreSQL：用户 ${PG_APP_USER} 已连接到容器 $container"
}

redis_cli() {
  local container="$1"
  local auth="$2"
  shift 2
  if [[ -n "$auth" ]]; then
    docker exec -e REDISCLI_AUTH="$auth" -i "$container" redis-cli --no-auth-warning --raw "$@"
  else
    docker exec -i "$container" redis-cli --no-auth-warning --raw "$@"
  fi
}

redis_reply() {
  redis_cli "$@" 2>/dev/null | tr -d '\r' || true
}

redis_requirepass_from_cmd() {
  docker inspect -f '{{range .Config.Entrypoint}}{{println .}}{{end}}{{range .Config.Cmd}}{{println .}}{{end}}' "$1" | awk '
    $0=="--requirepass" {getline; if ($0 != "") {print; exit}}
    $0 ~ /^--requirepass=/ {sub(/^--requirepass=/, ""); print; exit}
  '
}

redis_admin_password() {
  local container="$1"
  local pass
  pass="$(container_env "$container" REDIS_PASSWORD)"
  if [[ -n "$pass" ]]; then
    printf '%s' "$pass"
    return
  fi
  redis_requirepass_from_cmd "$container"
}

redis_ping_as() {
  local container="$1"
  local user="$2"
  local pass="$3"
  local reply=""
  if [[ -n "$user" ]]; then
    reply="$(docker exec -i "$container" redis-cli --no-auth-warning --raw --user "$user" -a "$pass" PING 2>/dev/null | tr -d '\r' || true)"
  elif [[ -n "$pass" ]]; then
    reply="$(redis_reply "$container" "$pass" PING)"
  else
    reply="$(redis_reply "$container" "" PING)"
  fi
  [[ "$reply" == "PONG" ]]
}

skip_redis() {
  upsert_env REDIS_URL ""
  upsert_env REDIS_USERNAME ""
  echo "$1"
}

provision_redis() {
  local disable container admin_pass user_pass reply
  disable="${DISABLE_REDIS:-$(env_value DISABLE_REDIS)}"
  if [[ "$disable" == "1" || "$disable" == "true" ]]; then
    skip_redis "ℹ️  已设置 DISABLE_REDIS，跳过系统 Redis"
    return 0
  fi
  container="$(pick_container REDIS "${REDIS_CONTAINER:-$(env_value REDIS_CONTAINER)}" 'redis' redis)" || {
    skip_redis "ℹ️  未找到 Redis 容器，应用将在无 Redis 下降级运行（会话缓存不可用）"
    return 0
  }
  admin_pass="$(redis_admin_password "$container")"
  if ! redis_ping_as "$container" "" "$admin_pass"; then
    skip_redis "⚠️  无法认证系统 Redis（容器 $container）。请确认 REDIS_PASSWORD，或设置 DISABLE_REDIS=1"
    return 0
  fi
  user_pass="$(env_value REDIS_PASSWORD)"
  [[ -n "$user_pass" && "$user_pass" != __GENERATE_* ]] || user_pass="$(secret_bytes 24)"
  reply="$(redis_reply "$container" "$admin_pass" ACL SETUSER "$REDIS_APP_USER" reset on ">${user_pass}" '~purechat:*' '+@all')"
  if [[ "$reply" == "OK" ]] && redis_ping_as "$container" "$REDIS_APP_USER" "$user_pass"; then
    upsert_env REDIS_USERNAME "$REDIS_APP_USER"
    upsert_env REDIS_PASSWORD "$user_pass"
    echo "✅ Redis：已创建 ACL 用户 ${REDIS_APP_USER}（容器 $container）"
  elif redis_ping_as "$container" "" "$admin_pass"; then
    upsert_env REDIS_USERNAME ""
    upsert_env REDIS_PASSWORD "$admin_pass"
    echo "⚠️  未能创建 Redis ACL 用户，已改用实例密码 + REDIS_PREFIX=purechat"
  else
    skip_redis "⚠️  系统 Redis 认证失败，已跳过 Redis"
    return 0
  fi
  ensure_ext_network
  connect_ext_network "$container"
  upsert_env REDIS_CONTAINER "$container"
  upsert_env REDIS_URL "redis://${container}:6379"
  upsert_env REDIS_PREFIX "purechat"
}

provision_system_deps() {
  [[ -f "$ENV_FILE" ]] || die "缺少 $ENV_FILE"
  provision_postgres
  provision_redis
  write_runtime_override
}

healthcheck() {
  local port
  port="$(env_value APP_PORT)"
  port="${port:-3210}"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error "http://127.0.0.1:${port}/api/health" >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "http://127.0.0.1:${port}/api/health" >/dev/null
  else
    echo "⚠️  未找到 curl/wget，跳过健康检查。请手动访问 http://127.0.0.1:${port}/api/health"
    return 0
  fi
  echo "✅ 健康检查通过 http://127.0.0.1:${port}/api/health"
}

ensure_docker() {
  command -v docker >/dev/null 2>&1 || die "未检测到 docker，请先安装 Docker 与 Compose"
  docker info >/dev/null 2>&1 || die "无法连接 Docker 守护进程。请确认当前用户在 docker 组，或使用 sudo ./install.sh"
  docker compose version >/dev/null 2>&1 || die "未检测到 docker compose 插件"
}

run_up() {
  [[ -f "$ENV_FILE" ]] || die "缺少 $ENV_FILE，请先执行：APP_URL=https://chat.example.com ./install.sh"
  provision_system_deps
  if [[ "${APP_IMAGE_RELOADED:-0}" == 1 ]]; then
    echo "应用镜像已更新，强制重建 app 容器（同名 tag 不会自动切换正在运行的容器）"
    COMPOSE_UP_ARGS+=(--force-recreate app)
  fi
  if [[ "$MODE" == "online" ]]; then
    echo "启动 Compose（--no-build --pull missing，模式=online）..."
  else
    echo "启动 Compose（--no-build --pull never，模式=offline）..."
  fi
  compose up "${COMPOSE_UP_ARGS[@]}"
  healthcheck
}

# 保留调用方传入的环境变量，避免被下面的 flag 变量名覆盖
ENV_APP_URL="${APP_URL:-}"
ENV_APP_BIND="${APP_BIND_ADDRESS:-}"
PROFILE=""
APP_URL_FLAG=""
APP_BIND_FLAG=""
MODE_FORCE=""
ACTION="install"
COMPOSE_PASSTHROUGH=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --online)
      MODE_FORCE=online
      shift
      ;;
    --offline)
      MODE_FORCE=offline
      shift
      ;;
    --profile)
      [[ $# -ge 2 && "$2" != -* ]] || die "请指定部署档案，例如 --profile 2g"
      PROFILE="$2"
      shift 2
      ;;
    --profile=*)
      PROFILE="${1#*=}"
      shift
      ;;
    --app-url)
      [[ $# -ge 2 && "$2" != -* ]] || die "请指定 --app-url，或设置环境变量 APP_URL（例 https://chat.example.com）"
      APP_URL_FLAG="$2"
      shift 2
      ;;
    --app-url=*)
      APP_URL_FLAG="${1#*=}"
      shift
      ;;
    --bind)
      [[ $# -ge 2 && "$2" != -* ]] || die "请指定 --bind 127.0.0.1 或 --bind 0.0.0.0"
      APP_BIND_FLAG="$2"
      shift 2
      ;;
    --bind=*)
      APP_BIND_FLAG="${1#*=}"
      shift
      ;;
    build)
      die "目标主机禁止 docker compose build。在线请拉 GHCR；离线请用本机 pnpm docker:pack"
      ;;
    pull)
      resolve_mode "$MODE_FORCE"
      if [[ "$MODE" == "offline" ]]; then
        die "离线部署禁止 docker compose pull，请使用本机 pnpm docker:pack 后上传镜像"
      fi
      ACTION="compose"
      COMPOSE_PASSTHROUGH=("$@")
      break
      ;;
    up | ps | logs | restart | stop | down | exec | images | top | config)
      ACTION="compose"
      COMPOSE_PASSTHROUGH=("$@")
      break
      ;;
    *)
      die "未知参数 $1"$'\n'"$(usage)"
      ;;
  esac
done

resolve_mode "$MODE_FORCE"
resolve_app_image

if [[ "$MODE" == "online" ]]; then
  COMPOSE_UP_ARGS=(-d --wait --no-build --pull missing)
else
  COMPOSE_UP_ARGS=(-d --wait --no-build --pull never)
fi

ensure_docker

if [[ "$ACTION" == "compose" ]]; then
  [[ -f "$ENV_FILE" ]] || die "缺少 $ENV_FILE，请先执行：APP_URL=https://chat.example.com ./install.sh"
  if [[ "${COMPOSE_PASSTHROUGH[0]}" == "up" ]]; then
    ensure_images
    if [[ ${#COMPOSE_PASSTHROUGH[@]} -gt 1 ]]; then
      COMPOSE_UP_ARGS+=("${COMPOSE_PASSTHROUGH[@]:1}")
    fi
    run_up
    exit 0
  fi
  compose "${COMPOSE_PASSTHROUGH[@]}"
  exit 0
fi

ensure_images

if [[ -f "$ENV_FILE" ]]; then
  echo "复用已有 $ENV_FILE（不覆盖密钥）"
  chmod 600 "$ENV_FILE"
  if [[ "$MODE" == "online" ]]; then
    upsert_env PURECHAT_IMAGE "$APP_IMAGE"
  fi
else
  create_env
fi

# 默认应用 2g 资源档案；显式 --profile 可覆盖
apply_profile "${PROFILE:-2g}"

RESOLVED_APP_URL="${APP_URL_FLAG:-$ENV_APP_URL}"
RESOLVED_APP_BIND="${APP_BIND_FLAG:-$ENV_APP_BIND}"

if [[ -n "$RESOLVED_APP_URL" ]]; then
  upsert_env APP_URL "$RESOLVED_APP_URL"
  echo "✅ 已写入 APP_URL=$RESOLVED_APP_URL"
fi
if [[ -n "$RESOLVED_APP_BIND" ]]; then
  upsert_env APP_BIND_ADDRESS "$RESOLVED_APP_BIND"
  echo "✅ 已写入 APP_BIND_ADDRESS=$RESOLVED_APP_BIND"
fi

warn_if_localhost_url
warn_if_public_bind
warn_if_missing_provider
warn_if_missing_s3
run_up

listen_port="$(env_value APP_PORT)"
bind_addr="$(env_value APP_BIND_ADDRESS)"
bind_addr="${bind_addr:-127.0.0.1}"
echo
if [[ "$bind_addr" == "0.0.0.0" ]]; then
  echo "应用已监听 0.0.0.0:${listen_port:-3210}（公网可直连）。安全组请放行该端口。"
else
  echo "应用只监听 127.0.0.1:${listen_port:-3210}。接下来把 HTTPS 反代到该地址。"
fi
echo "模式：$MODE · 应用镜像：$APP_IMAGE"
echo "常用命令： ./install.sh ps   |   ./install.sh logs app   |   ./install.sh up --force-recreate"
echo "临时公网 IP 启动： ./start-ip.sh"
