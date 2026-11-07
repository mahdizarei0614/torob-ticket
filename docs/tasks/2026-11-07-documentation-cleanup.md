# Reviewer documentation cleanup — 2026-11-07

Owner accepted trimming the documentation while keeping concise reviewer/setup/
SSO/architecture/decision records and selected final verification evidence.

Remove bulky historical evidence from the current tree; preserve access through
immutable links to source snapshot226bd9d929a023d4060ba102602faad9fde97914. Do not
rewrite Git history. Relocate the recovery Compose fixture and reproducible hotel
source inputs into their owning test/tools directories before deleting old paths.
Repair links to retained or archived material. Future generated reports belong
in ignored .local/evidence, with protected parent-path checks maintained.

Preserve every application, seed, schema, SDK and provider store. Verify affected
report/config contracts and an isolated pnpm docker:up with fresh history/SSO.
Do not stop or reset another Docker project, remove any existing data volumes,
or change private configuration. Record actual evidence and independent review,
update the main branch and the already-authorized reviewer handoff.


Later owner follow-up: [Git history cleanup](2026-11-07-git-history-cleanup.md)
supersedes the original no-rewrite condition; it does not relabel this step's
verification or change application data.
