# Reachable history cleanup — 2026-11-07

The owner requested removing bulky historical evidence. An isolated fresh bare
clone was filtered with official git-filter-repo; only docs/evidence/ was removed
from old commits. The43selected current evidence files were restored afterwards.
This does not reintroduce the historical raw archive.

## Integrity and source preservation

The original main had 306 commits. The map contains 259 retained commits whose full
trees outside docs/evidence exactly match their original versions; 47 artifact-only
commits were removed. Before changing the explanatory docs/policy, restoring the
selected proof produced exactly the old main tree. After those docs changes,
every tracked application/SDK/fixture/asset/tool/test/schema/infra/package file
still matches its original blob hash. Selected JSON and image proof is unchanged;
historical narrative reports explicitly label original source IDs/retention scope.

The source commit map preserves original IDs as historical identifiers. All-zero
new IDs mean evidence-only commits removed by filtering. No earlier startup,
browser or test result is relabeled as a newly executed check of rewritten IDs.
No Docker/private files or data volumes were modified.

## Footprint and publication checks

Before filtering, the packed Git database was 422.31 MiB; the filtered source-history
clone was 14.09 MiB before current curated proof was restored. Final integrity,
reachable-blob and fresh-clone checks are required before the main-only remote
update. Publication uses the exact lease against original main
94459fea2c684b84b1a20e8e1ec03f4161550004, so concurrent remote work is not overwritten.
The original working repository stays intact until the candidate is verified.
A fresh remote clone and local unreachable-object cleanup complete the handoff.
Only reachable main history/fresh-clone size is claimed; GitHub caches, forks or
other references may retain old objects independently.
