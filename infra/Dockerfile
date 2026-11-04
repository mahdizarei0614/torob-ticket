# Both immutable indexes contain linux/arm64 and linux/amd64 variants.
FROM node:24.17.0-bookworm-slim@sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532 AS node-base
# Prisma requires explicit OpenSSL support (decision 0001).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM node-base AS dependencies
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm install --global pnpm@11.9.0 --registry="$NPM_REGISTRY"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --fetch-timeout=300000 --registry="$NPM_REGISTRY"

FROM dependencies AS development
ARG PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR NODE_ENV=development
COPY . .
RUN pnpm exec prisma generate

FROM dependencies AS build
ARG PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ARG TOROBTICKET_PUBLIC_ORIGIN=""
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
COPY . .
ENV NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false
RUN pnpm build && pnpm exec tsc -p prisma/tsconfig.json && pnpm exec tsc-alias -p prisma/tsconfig.json

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

FROM node-base AS example-provider
ENV NODE_ENV=production PORT=4310 HOST=0.0.0.0 TOROBTICKET_PROVIDER_STORE=/data/provider.json
COPY --from=build /app/dist/apps/example-provider ./dist/apps/example-provider
COPY apps/example-provider/public ./apps/example-provider/public
COPY libs/ui/src/styles/tokens.css ./libs/ui/src/styles/tokens.css
COPY assets/fonts/Vazirmatn-wght.woff2 ./assets/fonts/Vazirmatn-wght.woff2
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "dist/apps/example-provider/apps/example-provider/src/main.js"]

FROM caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f AS gateway
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/apps/web /srv/web
COPY --from=build /app/dist/apps/admin /srv/admin

FROM caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f AS development-gateway
COPY infra/Caddyfile.dev /etc/caddy/Caddyfile
