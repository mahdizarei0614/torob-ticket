# T06 provider normalization and evidence boundary

Approved controller ruling, 2026-10-24: T06 extends the existing SearchRepository
with two focused seams for scoped provider context snapshots and atomic evidence
appends. Data access owns their types and imports neither adapters nor fixtures.
API composes the authenticated SessionContext, frozen source anchor, real clock,
run-pinned mapping/fixture revisions, scoped overrides and an awaited trace sink.
No controller, schema change, search orchestration or quote evaluator is added.

Source fixture IDs identify immutable authored inputs. Each API operation has a
fresh ID; persisted raw instances and their trace/offer links use derived operation
IDs, while sourceRawRecordId remains in the raw envelope and offer provenance.
Accepted raw, trace and offer are written in one scoped transaction. Rejected and
ambiguous raw/trace pairs remain inspectable without accepted offers. Mapping
chains are resolved at the search run's pinned revision; newer patches cannot
rewrite historical evidence.

Gross source amounts include known mandatory charges. Known fees partition the
gross amount; they are never added again. Missing mandatory charges remain an
incomplete gross report. Cabin allowance, cancellation and seat terms absent from
sources remain unknown. T07 owns final party eligibility and fare evaluation;
T06 carries source party, remaining seats and whole-party-gross pricing evidence.

Adapter date inventory performs one timed operation for its entire date batch,
with the opposite leg held fixed. Operations respect abort and absolute deadlines,
clear their own timers/listeners, and await the evidence sink. An already-entered
atomic database append may finish after cancellation; no additional source records
are started and no partial batch is reported as success. T09 owns concurrency,
search lifecycle and terminal coverage. ProviderRun evidence containers remain
collecting until that owner records the operation outcome.

T06 PostgreSQL integration exposed an existing reset/expiry defect once real
NormalizationDecision rows reference the scoped mapping chain: session deletion
failed at NormalizationDecision_mapping_fkey before the deeper raw-record cascade
completed. Controller approved migration 0002 after real failing reset and cleanup
assertions. Only that existing composite FK becomes DEFERRABLE INITIALLY DEFERRED;
NO ACTION and session isolation remain. Orphan/wrong-session references still fail
at transaction commit. No other relationship or schema model changes.
