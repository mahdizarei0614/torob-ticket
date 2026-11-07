# Project documentation

Start with [Run locally](run-locally.md), the [reviewer guide](reviewer-guide.md),
and [provider SSO integration](direct-login-integration.md). The root README has
one-command Docker startup and the new/existing-account walkthrough.

[Architecture](architecture.md), [limitations](limitations.md), the
[AI development log](ai-development-log.md), [decisions](decisions/README.md), the
[specification](superpowers/specs/2026-10-24-torobticket-design.md) and
[selected verification evidence](evidence/README.md) remain in the current tree.

At the owner's request, bulky historical evidence was removed from Git history.
Old report references without a link identify removed artifacts; they are not
available archives. Original commit IDs in retained receipts, comments and older
tracker text describe the source actually checked at the time. The
[history policy](history-rewrite.md) and [commit map](history-commit-map.txt) explain
the corresponding rewritten source IDs and evidence-only commits that were pruned.
These old checks are not newly rerun test results.

Generated reports belong under ignored `.local/evidence/<specific-run>/`. Keep
only reviewed summaries or representative proof in `docs/evidence`. Fixtures live
under `tests/e2e/fixtures`; reproducible hotel source inputs/tools live under
`tools/hotel-directory`. Runtime application data, database seeds and SSO remain
unchanged by history cleanup.
