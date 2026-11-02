# 0081 — Negotiate bounded date-evidence batches

T35's complete real-PostgreSQL gate exposed a normal 44-day international train
calendar missing seller evidence under its existing deadline. It still had
priced cells; that did not establish complete provider coverage. The focused
reproduction retained the strict 2,112-record and four-successful-seller checks
and captured actual cancelled providers with committed prefixes. No raw-ID
collision or smaller legitimate inventory was established.

The existing 32-row coalescing ceiling persisted twelve-service days in roughly
two-day chunks. Repeated session-lock acquisitions and normalization/raw/offer
inserts consumed the provider/job budget. The actual persistence sink can now
advertise an optional `maxRows` capability, capped at 96. `SearchRepository`
enforces that hard maximum; `ProviderService` advertises it. The adapter accepts
only safe integers from 1 to 96. An absent or invalid capability retains the
existing 32-row default for custom sinks. Receiver-aware availability and the
original sequential row-hook fallback are unchanged.

Count coalescing alone did not satisfy the strict train gate. The next repair
prepares immutable row validation and exact JSON payloads before acquiring the
session row lock, allowing other database work to proceed during that CPU work.
Owned/current-run and revision authority still take precedence inside the lock;
prepared errors are replayed in their original order rather than exposing an
invalid foreign row before ownership checks. Provider-state checks and guarded
atomic writes remain inside the transaction. No payload is trusted merely
because an adapter produced it, and caller mutation after the synchronous JSON
snapshot cannot change prepared evidence.

The 4 MiB encoded batch limit remains, including the adapter's 2 KiB per-row
envelope allowance. A byte-bound chunk flushes before the row limit. Whole-date
record order/identities, normalization and duplicate scope remain exact. Earlier
committed chunks may remain evidence on failure; no failed provider returns its
staged dates as a successful batch. Oversized single dates fail explicitly.

The session lock, current run/revision checks, unique row/trace/offer bindings,
validation, cancellation checks before and between writes, all-or-nothing batch
transaction and reset/expiry authority remain in force. The 3,500 ms provider
and 5,000 ms job deadlines do not increase. No fixture/service/price/source
revision, inventory, quote identity, client-side calculation or visible product
flow changes. This is an engineering limit change to specification §11, with
strict compatibility/parity, 96/97-row, 4 MiB, failure and cancellation checks.

The same final gate also found old integration expectations: new showcase-v3
operations correctly use source-v5, while v1/v2 retain their exact sources;
fourteen current hotels have four capacity templates each (56), with legacy
three-template roots unchanged. Correct those assertions precisely and preserve
their lineage, immutability and per-property capacity checks. Raw counts and
full provider coverage are not weakened. Actual focused/full verification and
the final canonical source/image identity belong in the T35 evidence receipts.
