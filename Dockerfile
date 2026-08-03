## Set global build ENV
ARG NODEJS_VERSION="22"

## Base image for all building stages
FROM node:${NODEJS_VERSION}-slim AS base

ARG USE_CN_MIRROR

ENV DEBIAN_FRONTEND="noninteractive"

RUN set -e && \
    if [ "${USE_CN_MIRROR:-false}" = "true" ]; then \
        sed -i "s/deb.debian.org/mirrors.ustc.edu.cn/g" "/etc/apt/sources.list.d/debian.sources"; \
    fi && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

## Install dependencies
FROM base AS deps

ARG USE_CN_MIRROR

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN set -e && \
    if [ "${USE_CN_MIRROR:-false}" = "true" ]; then \
        npm config set registry "https://registry.npmmirror.com/"; \
    fi && \
    export COREPACK_NPM_REGISTRY="$(npm config get registry | sed 's/\/$//')" && \
    npm i -g corepack@latest && \
    corepack enable && \
    corepack use "$(sed -n 's/.*"packageManager": "\(.*\)".*/\1/p' package.json)" && \
    pnpm install --frozen-lockfile

## Build SPA + Next standalone
FROM deps AS builder

ARG USE_CN_MIRROR

WORKDIR /app

COPY . .

# Build-time placeholders（运行时由容器环境变量覆盖）
ENV APP_URL="http://localhost:3210" \
    AUTH_SECRET="use-for-build" \
    DATABASE_DRIVER="node" \
    DATABASE_URL="postgres://postgres:password@localhost:5432/postgres" \
    DOCKER="true" \
    KEY_VAULTS_SECRET="use-for-build" \
    NODE_ENV="production" \
    NODE_OPTIONS="--max-old-space-size=8192"

RUN pnpm run build:docker

## Production runner
FROM base AS runner

WORKDIR /app

ENV HOSTNAME="0.0.0.0" \
    NODE_ENV="production" \
    NODE_OPTIONS="--dns-result-order=ipv4first --use-openssl-ca" \
    PORT="3210" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

# App
ENV APP_URL="" \
    ALLOWED_ORIGINS="" \
    API_KEY_SELECT_MODE="" \
    CRON_SECRET=""

# Auth
ENV AUTH_SECRET="" \
    AUTH_SSO_PROVIDERS="" \
    AUTH_DISABLE_EMAIL_PASSWORD="" \
    AUTH_EMAIL_VERIFICATION="" \
    AUTH_ENABLE_MAGIC_LINK="" \
    JWKS_KEY="" \
    JWT_ACCESS_EXPIRATION="15m" \
    JWT_REFRESH_EXPIRATION="7d" \
    AUTH_GITHUB_ID="" \
    AUTH_GITHUB_SECRET="" \
    AUTH_GOOGLE_ID="" \
    AUTH_GOOGLE_SECRET="" \
    AUTH_WECHAT_ID="" \
    AUTH_WECHAT_SECRET="" \
    AUTH_FEISHU_APP_ID="" \
    AUTH_FEISHU_APP_SECRET="" \
    GITHUB_CLIENT_ID="" \
    GITHUB_CLIENT_SECRET=""

# Database / Redis
ENV DATABASE_DRIVER="node" \
    DATABASE_URL="" \
    KEY_VAULTS_SECRET="" \
    REDIS_URL="" \
    REDIS_PREFIX="purechat" \
    REDIS_TLS="" \
    REDIS_USERNAME="" \
    REDIS_PASSWORD="" \
    REDIS_DATABASE="" \
    DISABLE_REDIS=""

# Email
ENV EMAIL_SERVICE_PROVIDER="" \
    SMTP_HOST="" \
    SMTP_PORT="" \
    SMTP_SECURE="" \
    SMTP_USER="" \
    SMTP_PASS="" \
    SMTP_FROM="" \
    RESEND_API_KEY="" \
    RESEND_FROM=""

# S3
ENV S3_ACCESS_KEY_ID="" \
    S3_SECRET_ACCESS_KEY="" \
    S3_BUCKET="" \
    S3_ENDPOINT="" \
    S3_REGION="" \
    S3_ENABLE_PATH_STYLE="" \
    S3_SET_ACL="" \
    FILE_STORAGE_LIMIT_MB=""

# Search / channels / LLM
ENV SEARCH_PROVIDERS="" \
    SEARXNG_URL="" \
    WECHAT_WEBHOOK_SECRET="" \
    QQ_WEBHOOK_SECRET="" \
    AI_GATEWAY_API_KEY="" \
    PUREHUB_API_KEY="" \
    PUREHUB_ENABLED="" \
    AI_GATEWAY_BASE_URL="" \
    OPENAI_API_KEY="" \
    OPENAI_PROXY_URL="" \
    OPENAI_MODEL_LIST="" \
    ENABLED_OPENAI="" \
    DEEPSEEK_API_KEY="" \
    DEEPSEEK_PROXY_URL=""

RUN set -e && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Next.js standalone output（含精简 node_modules）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# SPA 静态资源与 public
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3210/tcp

CMD ["node", "server.js"]
