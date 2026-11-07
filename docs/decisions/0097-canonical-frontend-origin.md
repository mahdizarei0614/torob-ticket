# 0097 — Canonical frontend origins before reviewer bootstrap

2026-11-07. Owner's invalid Direct Login screenshot was traced to comparison/admin
tabs on127.0.0.1 and the configured issuer on localhost. The provider client belongs
to the original host's reviewer workspace. Authorization on the other host gets
different host-only cookies and correctly rejects the mismatched client. Both
frontends previously served either hostname200, allowing this state.

Packaged Caddy and the development frontend middleware redirect GET/HEAD frontend
paths to fixed configured web/admin origins before the application bootstraps.
Preserve the full URI/query, use temporary302/no-store/no-referrer responses, and
exclude `/api` and `/api/*` plus other methods. API readiness, credentials and
mutations are never forwarded/replayed to another origin. Caddy compares exact
Host authority (not the port-stripping host matcher); its entrypoint normalizes
host case/default ports consistently with the API's URL origins. Custom ports and
bracketed IPv6 remain supported. Standalone graphics rigs keep their isolated port,
including when an issuer origin is inherited.

Default packaged/browser test origins now match localhost and the configured
issuer override. Explicit test/release targets must use their actual canonical
origin. The provider keeps its separate hostname. No client/workspace ownership,
cookie SameSite, PKCE, consent, referral cutoff or billing rule is loosened.

This does not migrate historical alias cookies/data or make an already-invalid
authorization reusable. Start a new offer from the canonical traveler app. All
existing records and Docker volumes remain preserved. Verify new/existing account
SSO including passport/Latin claims, plus direct HTTP redirect/API boundaries.
