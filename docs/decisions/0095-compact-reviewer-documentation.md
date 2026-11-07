# 0095 — Compact reviewer documentation

Owner instruction, 2026-11-07: accept the proposed safe documentation cleanup.
Keep setup/reviewer/SSO/architecture guides, specification/decisions and selected
final verification evidence. Remove bulky historical evidence from the current
tree while retaining immutable access at commit
`226bd9d929a023d4060ba102602faad9fde97914`. Do not rewrite Git history.

Move the recovery Compose fixture into `tests/e2e/fixtures` and reproducible
hotel-directory inputs/scripts into `tools/hotel-directory`. Update their callers
and preserve existing fixture data/attribution. Redirect old Markdown evidence
links to real files/directories in the fixed Git snapshot, retaining fragments.

Generated reports default to ignored `.local/evidence`, with named run folders,
existing privacy sanitization and protected parent-path checks. Keep historical
protected roots for backwards compatibility and protect `.local` and its evidence
parents against accidental overwrite/sanitization of private state. Raw evidence
media/logs/JSON under docs are ignored; curated tracked receipts remain present.

No application behavior, seed, schema, SSO implementation or private configuration
changes. No Docker volume deletion. Verify report/config contracts, relocated
hotel inputs, live documentation links and an isolated fresh Docker startup with
populated history and connected provider. Record checks and independent review
before completing the main-branch reviewer handoff.
