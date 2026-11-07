# Documentation cleanup — 2026-11-07

Historical cleanup record: the later history-purge request is explained in
[decision0096](../decisions/0096-remove-bulky-evidence-history.md). Raw archives
referenced by the original run were subsequently removed from history; retained
receipts keep their original source identifiers.

Owner accepted compact reviewer documentation under [decision0095](../decisions/0095-compact-reviewer-documentation.md).
The original pre-purge snapshot identified the old report collection. This earlier checkout cleanup did
not rewrite history or delete Docker volumes; the later history purge is a
separate owner-authorized step.

## Scope and measured size

The tracked docs occupied 760,385,489bytes before cleanup and about 3,000,000 bytes
afterwards: an approximately 99.6% reduction in the current tree. Git clone/history size was
unchanged at that step; the later history purge is recorded separately. Removed 9,373 historical files, including 38 untracked macOS .DS_Store
files. Retained 38 selected original proof files, six representative captures and
the concise reviewer/setup/SSO/architecture/AI/design/decision guides.

Relocated 14 hotel-directory inputs/tools and one recovery Compose fixture into
their source owners. The recovery override now labels all six current services
and both volumes. Rendering the configuration succeeds without changing Docker
state. Executable/curation inputs are no longer stored in the historical archive.

At that step, checked relative Markdown links and immutable archive references
resolved to current files or the original snapshot; the later purge retired
links to raw artifacts that no longer ship. Historical
plain paths in older decisions/trackers identify the original removed artifacts. New generated
output defaults to ignored .local/evidence with named-run/privacy/parent guards;
legacy protected roots remain protected. New raw media/reports in docs are ignored.

## Actual verification

[Structured receipts](documentation-cleanup/verification.json) record 48 passing
Node Docker-runner/report-directory/privacy/config cases, E2E type checking and
tooling/E2E lint. The relocated offline coordinate verifier passes all 301 hotels.
Curation in a temporary source tree reproduces the runtime directory byte-for-byte
with SHA256 6d67dfa88633e9c4882783b6a28d99c5d2c4cb0c15ad06836d9f3cb1b9e93bd0.
Application/fixture/schema JSON remains unchanged; fixture TS edits only update
provenance comments. The provider SDK and application behavior are unchanged.

The working-tree cleanup candidate was built through ordinary pnpm docker:up,
with no `.env`/host `node_modules`, on fresh isolated project torobticket-docs-20261107
and ports 4380/4381/4382. Five services became healthy; initializer exited 0. Before
opening a reviewer, the database held one sealed history template, zero public
reviewers, 7,908 outbound records and six tariffs. A fresh reviewer then received
three months/six providers/2,729 current-month outbound records and automatically
connected RoadAra SSO. All three frontend URLs returned HTML/HTTP 200; provider
health read 5,569 actual provider runs. See the [runtime receipt](documentation-cleanup/runtime.json).

This is startup/reporting verification of the cleanup candidate, not a new full
browser or PostgreSQL acceptance run. The earlier retained six SSO/interaction
journeys remain attributed to their named application-source snapshot. The
preexisting Cheft worker was outside this task; no existing services or data
volumes were stopped, deleted or reconfigured. [Independent source/evidence review](documentation-cleanup/review.md) approved.
