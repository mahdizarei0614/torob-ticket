# 0090 — Reviewer SSO bootstrap

2026-11-06, explicit owner request. Docker's local-review configuration provisions
RoadAra/demo-provider-01 when each reviewer initializes their own workspace. No
shared reviewer cookie, fixed client secret, copied phone roster or user profile
is shipped. Installation uses the existing private one-use-code handshake and
creates a separate client per reviewer. Rates remain unset and external account
reports remain pending until independently verified.

A generic SessionService initializer runs after explicit bootstrap/resume/reset
commits. DirectLoginService registers a local-review initializer, avoiding a
module cycle and an API/provider startup-readiness dependency deadlock. Automatic
setup is idempotent, singleflight and guarded by stored ownership/revision state.
Failed managed setup can retry; manual edits/disables/custom clients win.

TOROBTICKET_LOCAL_REVIEW=true is explicit in the loopback-only Compose stack.
The canonical web/admin/provider public origins must all be HTTP loopback, with
the provider on its own hostname. Under that gate the packaged production-build
API may use the separately opted-in local SMS code123456. No public/nonloopback
production exception exists. Challenge redemption rechecks the same gate.

README documents a fresh-run search→RoadAra→consent→JSON flow and repeat-phone
account reuse, with no admin enrollment needed. Reviewer data is entered only by
the reviewer and only approved trip-relevant claims are disclosed. Clean packaged
build/start/browser evidence is required; container readiness alone is insufficient.


To verify the actual fresh Docker path without the prior apt mirror failures,
backend runtime OpenSSL/CA/license files are copied from the matching pinned
Node24.17.0bookworm image into the existing slim runtime; no TLS verification is
bypassed. OpenSSL default trust/config paths point to the copied CA bundle and
configuration. Backend images now have mode-specific tags. Provider volume ownership is
normalized through checked, no-follow file descriptors for its dedicated regular
file, then the entrypoint drops to
UID/GID1000. This preserves prior dev data while permitting packaged startup.
