# Direct Login hostname correction — 2026-11-07

Source `4edae73991408185f952f863711a0294b7274941`.
[Decision0097](../decisions/0097-canonical-frontend-origin.md) and
[task brief](../tasks/2026-11-07-direct-login-origin.md).

The reported Chrome tabs used127.0.0.1 for comparison/admin but localhost for the
issuer. Both aliases returned200. Distinct host-only workspace cookies caused the
strict client/workspace comparison to reject authorization. The initial middleware
regression failed4of5cases before correction.

Verification:

- 31 focused checks passed in the existing dependency-equipped Node 24.17.0 image:
  22runner/development/hostname cases and9browser-configuration cases. E2E
  TypeScript and focused tooling/E2E lint passed. Custom ports, bracketed IPv6,
  case/default-port normalization and isolated graphics with inherited issuer
  configuration are covered. The automated passport journeys were updated and
  typechecked; their browser interactions below were exercised through CUA. The
  final test-only project-baseURL correction passed targeted types/lint again.
- Actual Chrome UI began at127.0.0.1:4300 and redirected to localhost before
  comparison. International search→RoadAra→direct continuation→123456verification→
  passport/Latin profile→consent returned `created`. Provider logout and a new
  authorization from the same offer returned `existing` with the same account ID,
  passport and both Latin names. External attribution remained `pending`.
  These were authored inputs in an existing browser, not a zero-cookie claim.
- Both Caddy configurations validated and both frontend images built. After the
  final entrypoint normalization update,9HTTP probes passed against refreshed
  images: alias GET/HEAD paths retain query strings, canonical pages do not loop,
  a foreign Host cannot choose a destination, and API GET/HEAD/POST never redirect.
  The Chrome run used the same default origins before that final normalization;
  application assets and issuer/provider code were unchanged by it.
- Only web/admin containers were replaced with `--no-deps`. All five runtime
  services are healthy. API/database/provider container IDs and database/provider
  volume mounts match the initial inventory. No reset or volume deletion.

Independent source/docs/evidence review approved after correcting the inherited
graphics, normalized-authority and stale verification-example findings. Earlier
host checks hit a Node26fixture failure and missing host TypeScript; an initial
container assertion read its old entrypoint. The final pinned mounted-source run
resolved those setup issues.

Raw receipts and the inspected screenshot remain ignored under
`.local/evidence/direct-login-origin-20261107/`; no generated media/logs enter Git.
This is focused local verification, not another cold-device/full-regression run.
Historical alias workspaces remain stored separately; already-invalid requests
must restart from a canonical offer. Source is committed locally; no remote push.
