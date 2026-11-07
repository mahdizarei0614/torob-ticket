# 0096 — Remove bulky evidence from history

Owner instruction, 2026-11-07: "I don't need those big files in history." This
authorizes rewriting the published main history to purge retired evidence and
updating it with an exact-old-SHA force-with-lease. It supersedes the prior0095
no-history-rewrite policy. Preserve the current product, selected proof and source
code history; do not flatten main or modify application/seed/SDK behavior.

Work in an isolated --no-local clone. Filter old docs/evidence versions, restore
only the current selected proof, compare all mapped trees outside that prefix,
and verify the complete current tree before documentation-policy edits. Retain
original proof IDs as historical identifiers with an explicit old/new commit map;
remove promises/links for raw archives that no longer ship.

Before publication verify integrity, reachable artifacts, small-clone size and
unchanged runtime files. Push only refs/heads/main using the lease against
94459fea2c684b84b1a20e8e1ec03f4161550004. Recheck the live branch before any update.
Align the clean local main only after the remote and fresh-clone checks succeed;
preserve ignored private files, avoid git clean, and remove old unreachable
objects/reflogs from this repository only. No Docker operations or volume deletion.
