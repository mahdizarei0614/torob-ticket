# Project documentation

Start with [Run locally](run-locally.md), the [reviewer guide](reviewer-guide.md),
and [provider SSO integration](direct-login-integration.md). The root README has
the one-command Docker startup and new/existing-account walkthrough.

[Architecture](architecture.md), [limitations](limitations.md), the
[AI development log](ai-development-log.md), [decisions](decisions/README.md) and
the authoritative [specification](superpowers/specs/2026-10-24-torobticket-design.md)
remain in the current tree. [Selected verification evidence](evidence/README.md)
contains concise results and a few representative captures.

Historical reports, screenshots and operator transcripts are preserved in the
[immutable pre-cleanup snapshot](https://github.com/mahdizarei0614/torob-ticket/tree/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence).
Links to removed historical material point to that exact commit. Plain historical
paths in older decision/tracker text refer to the same snapshot. They describe
the named run and do not establish verification of later changes.

New generated reports belong under ignored `.local/evidence/<specific-run>/`.
Keep only reviewed summaries or representative proof in `docs/evidence`; raw
reports/media there are ignored to avoid rebuilding the historical archive.
Test fixtures live under `tests/e2e/fixtures`; reproducible hotel curation inputs
and tools live under `tools/hotel-directory`. Application data and database seeds
remain in their original application/fixture/schema locations.

This cleanup changes the current checkout, not Git history. Previous commits and
clone-history size are intentionally unchanged.
