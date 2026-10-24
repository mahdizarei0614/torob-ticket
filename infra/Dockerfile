# Both immutable indexes contain linux/arm64 and linux/amd64 variants.
FROM node:24.17.0-bookworm-slim@sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532 AS node-base
# Prisma requires explicit OpenSSL support (decision 0001).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM node-base AS dependencies
RUN npm install --global pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --fetch-timeout=300000

FROM dependencies AS build
COPY . .
ENV NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false
RUN pnpm build && pnpm exec tsc -p prisma/tsconfig.json

FROM build AS initializer
ENV NODE_ENV=production
ENTRYPOINT ["sh", "infra/init.sh"]

FROM dependencies AS production-dependencies
RUN pnpm prune --prod

FROM node-base AS api
ENV NODE_ENV=production PORT=4302
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/api ./dist/apps/api
COPY infra/healthcheck.mjs ./infra/healthcheck.mjs
USER node
CMD ["node", "dist/apps/api/apps/api/src/main.js"]

FROM caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f AS gateway
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/apps/web /srv/web
COPY --from=build /app/dist/apps/admin /srv/admin
