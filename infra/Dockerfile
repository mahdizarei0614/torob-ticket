# Both immutable indexes contain linux/arm64 and linux/amd64 variants.
# Copy OpenSSL from the matching pinned official Debian image. No apt mirror is
# needed at build time; both source/runtime images support arm64 and amd64.
FROM node:24.17.0-bookworm@sha256:733e1c06ada118ed9f6133a31aa1290be6929664026fb28821500437c61f2c6f AS openssl-runtime
RUN mkdir -p /openssl/lib && cp /usr/lib/*-linux-gnu/libssl.so.3 /usr/lib/*-linux-gnu/libcrypto.so.3 /openssl/lib/

FROM node:24.17.0-bookworm-slim@sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532 AS node-base
COPY --from=openssl-runtime /openssl/lib/ /usr/local/lib/
COPY --from=openssl-runtime /usr/bin/openssl /usr/local/bin/openssl
COPY --from=openssl-runtime /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=openssl-runtime /etc/ssl/openssl.cnf /etc/ssl/openssl.cnf
COPY --from=openssl-runtime /usr/share/doc/libssl3/copyright /usr/share/doc/libssl3/copyright
RUN mkdir -p /usr/lib/ssl && ln -s /etc/ssl/openssl.cnf /usr/lib/ssl/openssl.cnf && ln -s /etc/ssl/certs /usr/lib/ssl/certs && ln -s /etc/ssl/certs/ca-certificates.crt /usr/lib/ssl/cert.pem && ldconfig && openssl version
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
COPY infra/provider-entrypoint.mjs infra/provider-store-permissions.mjs ./infra/
CMD ["node", "infra/provider-entrypoint.mjs"]
