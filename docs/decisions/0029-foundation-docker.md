# 0029 — Early foundation Docker packaging

Date: 2026-10-24. Status: accepted implementation ruling within T29 early scope.

The four-service local stack uses immutable official multi-platform image indexes,
all app compilation inside Docker, one successful migration/idempotent foundation
seed initializer before API start, and database-backed readiness before Caddy.
Only Caddy publishes a loopback port. The API runs as the unprivileged Node user
with production dependencies and explicit Debian OpenSSL runtime support.

Caddy owns independent consumer/admin SPA fallbacks, API forwarding without HTML
error replacement and immediate proxy flush for future SSE. Existing font and
theme assets remain local and revalidate; Vite content hashes earn immutable
caching. Missing assets return 404. Provider-demo paths resolve the consumer shell
until their product route implementation arrives.

No rich catalog or search endpoint is introduced by packaging. T05 inventory,
T09 SSE delivery/replay, future geography/art integration and full T33 clean-start
acceptance remain pending. Parent T29 remains ACTIVE. Native foundation runtime
verification covers arm64 only; amd64 is a documented supported-index build path.
