# Direct Login hostname consistency — 2026-11-07

Owner reports an invalid/expired request at `/direct-login/begin`. The active
comparison/admin tabs use127.0.0.1, while the configured issuer uses localhost.
Host-only cookies create different reviewer workspaces, so authorization correctly
rejects the mismatched client. Both aliases currently serve the application200.

Before either frontend bootstraps, redirect GET/HEAD pages to its configured
canonical origin, preserving path/query and custom ports. Cover packaged Caddy
and ordinary Docker/native Vite development; keep standalone graphics rigs local.
Exclude API requests/mutations from canonical redirects. Keep the separate provider
hostname, host-only cookies, exact client/workspace binding, PKCE and consent.
Preserve all databases/provider volumes and existing reviewer records.

Use a failing behavior regression, actual packaged redirect probes and browser
new/existing international SSO starting with the alternate hostname. Record
concise proof and an independent review; generate raw logs only in ignored
`.local/evidence/direct-login-origin-20261107/`. No release/version change or push.
