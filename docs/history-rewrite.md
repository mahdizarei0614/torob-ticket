# Git history cleanup — 2026-11-07

The owner requested removing the large files from history after the documentation
checkout was trimmed. This supersedes decision0095's earlier history-preservation
policy; [decision0096](decisions/0096-remove-bulky-evidence-history.md) records the
new authorization. Application code history is retained rather than flattened.

The isolated rewrite removed `docs/evidence/` from old commits, then restored only
the 43 selected evidence files already present on main. No complete raw archive or
backup branch is reintroduced. All 259 retained mapped commits were checked:
outside the removed directory their complete trees match the original commits.
Forty-seven commits that contained only removed artifacts were pruned. Before
policy/doc edits, restoring the selected proof reproduced the old main tree exactly.

[Commit map](history-commit-map.txt) maps original to rewritten source IDs. An
all-zero new ID means the evidence-only commit was removed. Original source IDs
inside captured proof remain historical identifiers; the mapping does not claim
that tests were rerun against rewritten commits. Large old raw artifacts are no
longer available through the removed archive links. Only current linked files,
selected proof and recorded summaries remain.

Runtime application files, fixture data, SDK, database schemas and Docker startup
are byte-identical to the pre-rewrite tip. This operation does not touch Docker
services, volumes, private `.env` files or ignored `.local` state. The retained
startup/SSO evidence keeps its original run scope and source identifiers.

The remote update is limited to main and guarded by the exact previous main ID
using a force-with-lease. Integrity, reachable-object and clone-size receipts are
recorded in the [rewrite verification](evidence/history-rewrite.md). Existing
clones should be replaced with a fresh clone to avoid bringing the old history
back. GitHub may retain old objects in caches or other references; this cleanup
claims reduced reachable main history and fresh-clone size, not server-wide
physical erasure.

Future generated evidence stays in ignored `.local/evidence`, with reviewed
current summaries under docs. This prevents bulk reports from regrowing main.
