ARG NODEJS_VERSION="22"

FROM node:${NODEJS_VERSION}-slim AS base

ARG USE_CN_MIRROR
ENV DEBIAN_FRONTEND="noninteractive"

RUN set -e; \
    if [ "${USE_CN_MIRROR:-false}" = "true" ]; then \
      sed -i "s/deb.debian.org/mirrors.ustc.edu.cn/g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates; \
    rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN set -e; \
    if [ "${USE_CN_MIRROR:-false}" = "true" ]; then npm config set registry https://registry.npmmirror.com/; fi; \
    export COREPACK_NPM_REGISTRY="$(npm config get registry | sed 's/\/$//')"; \
    npm install --global corepack@latest; \
    corepack enable; \
    corepack use "$(sed -n 's/.*"packageManager": "\(.*\)".*/\1/p' package.json)"; \
    pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .

ENV APP_URL="http://localhost:3210" \
    AUTH_SECRET="use-for-build" \
    DATABASE_DRIVER="node" \
    DATABASE_URL="postgres://postgres:password@localhost:5432/postgres" \
    DOCKER="true" \
    KEY_VAULTS_SECRET="use-for-build" \
    NODE_ENV="production" \
    NODE_OPTIONS="--max-old-space-size=8192"

RUN pnpm run build:docker

FROM base AS runner
WORKDIR /app

ENV DATABASE_DRIVER="node" \
    HOSTNAME="0.0.0.0" \
    MIGRATIONS_FOLDER="/app/migrations" \
    NODE_ENV="production" \
    NODE_OPTIONS="--dns-result-order=ipv4first --use-openssl-ca" \
    PORT="3210" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/src/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/dist/docker-migrate.mjs ./docker-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/dist/wechat-gateway.mjs ./wechat-gateway.mjs

USER nextjs
EXPOSE 3210/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3210/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["/bin/sh", "-c", "node /app/docker-migrate.mjs && exec node /app/server.js"]
