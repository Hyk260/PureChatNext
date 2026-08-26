FROM node:22.23.2-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS base

ARG USE_CN_MIRROR
ARG DEBIAN_MIRROR="https://mirrors.aliyun.com"
ENV DEBIAN_FRONTEND="noninteractive"

RUN set -e; \
    apt-get -o Acquire::Retries=5 update; \
    apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates; \
    rm -rf /var/lib/apt/lists/*; \
    if [ "${USE_CN_MIRROR:-false}" = "true" ]; then \
      sed -i "s|http://deb.debian.org|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    fi

FROM base AS deps
WORKDIR /app
ARG NPM_REGISTRY

# node-pty may fall back to node-gyp when an architecture-specific prebuild is unavailable.
RUN set -e; \
    apt-get -o Acquire::Retries=5 update; \
    apt-get -o Acquire::Retries=5 install -y --no-install-recommends python3 make g++; \
    rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked set -e; \
    if [ -n "${NPM_REGISTRY:-}" ]; then \
      npm config set registry "${NPM_REGISTRY}"; \
    elif [ "${USE_CN_MIRROR:-false}" = "true" ]; then \
      npm config set registry https://registry.npmmirror.com/; \
    fi; \
    export npm_config_nodedir="/usr/local"; \
    npm install --global "$(sed -n 's/.*"packageManager": "\(.*\)".*/\1/p' package.json)"; \
    pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .

ENV APP_URL="http://localhost:3210" \
    DATABASE_DRIVER="node" \
    DATABASE_URL="postgres://postgres:password@localhost:5432/postgres" \
    DOCKER="true" \
    NODE_ENV="production" \
    NODE_OPTIONS="--max-old-space-size=8192"

RUN AUTH_SECRET="docker-build-placeholder-not-a-secret" \
    KEY_VAULTS_SECRET="docker-build-placeholder-not-a-secret" \
    pnpm run build:docker

FROM node:22.23.2-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS runner
WORKDIR /app

ENV DATABASE_DRIVER="node" \
    HOSTNAME="0.0.0.0" \
    MIGRATIONS_FOLDER="/app/migrations" \
    NODE_ENV="production" \
    NODE_OPTIONS="--dns-result-order=ipv4first --use-openssl-ca" \
    PORT="3210" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

COPY --from=base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs && \
    dpkg --purge --force-depends --force-remove-essential perl-base && \
    rm -rf \
      /usr/local/lib/node_modules/corepack \
      /usr/local/lib/node_modules/npm \
      /usr/local/bin/corepack \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/pnpm \
      /usr/local/bin/pnpx \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Next 16.3.1 standalone keeps this pnpm symlink but currently omits its target.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm/@swc+helpers@0.5.23 /app/node_modules/.pnpm/@swc+helpers@0.5.23
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/src/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/dist/docker-migrate.mjs ./docker-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/dist/docker-s3-init.mjs ./docker-s3-init.mjs

USER nextjs
EXPOSE 3210/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3210/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["/bin/sh", "-c", "node /app/docker-s3-init.mjs && node /app/docker-migrate.mjs && exec node /app/server.js"]
