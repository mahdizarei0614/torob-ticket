# 0089 — Separate application containers and ports

2026-11-05, explicit owner request. Both Compose modes use permanent web, admin,
and example-provider services with independent loopback bindings4300,4301,4310.
Web/admin packaged images contain only their own assets and Caddy configuration;
development substitutes Vite in those same services/ports. API4302 stays private.
The former combined gateway is removed through narrow project/service ownership
checks and never through remove-orphans or data-volume deletion.

Web/admin keep one canonical hostname and host-only API cookies to retain the
reviewer's shared server workspace across ports. Ports are separate origins, so
admin Direct Login writes allow only the exact configured first-party admin or
web origin. Consumer phone/profile/consent writes still require the web origin.
No CORS relaxation or Origin header rewriting is needed: each frontend proxies
its own /api path. Provider remains on a different hostname to isolate cookies.

Legacy /admin navigation redirects to the admin port. Admin keeps /admin/ as its
router/asset base; /travel redirects to the canonical consumer origin. Reference
provider callbacks/defaults always use the canonical consumer origin. Public
origins/ports are operator configuration, not request-selected destinations.
