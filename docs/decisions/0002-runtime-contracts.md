# 0002 — Runtime wire contracts

Date: 2026-10-24 · Status: accepted implementation ruling for T02.

The public contracts library owns Zod schemas and inferred wire types. It exports
no Nest class, database model, provider adapter, test runtime, or domain service.
Zod remains the exact `4.6.7` pin already verified and installed by T01; the
[official documentation](https://zod.dev/) confirms stable Zod 4 and support for
TypeScript 5.5 or later (this workspace uses 5.9.3).

Commands reject unknown fields at every authored object boundary. Bodies cannot
select a session or identity. Raw provider payloads and provenance source values
remain unknown data so normalization can retain unfamiliar source fields rather
than silently dropping evidence. Conditions distinguish known values from an
explicit unknown reason; price completeness and eligibility are separate unions.

`LocalDate` is a real Gregorian date-only value; `ISOInstant` requires UTC Z.
Instants are compared as instants, including when precision differs. Segment
locations carry validated IANA time zone identifiers. Return dates may equal the
departure date; actual itinerary feasibility belongs to domain processing.

Absent and empty provider/operator filters normalize to the same object. Nonempty
lists are deduplicated and sorted. Departure windows use minutes 0–1439 and may
cross midnight; local-time interpretation belongs to domain processing.

Hotel-local child ages remain optional at the wire boundary, are count-checked
when supplied, and are separate from transport ages. T20 applies room policy and
returns AGE_REQUIRED when needed. An allocation records traveler counts even
when ages are unknown; it never invents infant ages. Each occupied room has an
adult as required by the approved fixture policy.

Search events discriminate the event type together with its payload. Snapshot
and terminal envelopes must agree with payload search ID/generation. Terminal
events reject collecting snapshots. Incomplete prices remain representable even
when no price component is known, and cannot enter eligible comparison quotes.
Date-price cells use distinct checking/no-match/outside-coverage/unavailable
states; no-match requires completed successful coverage without failed providers.

The Nest command pipe returns HTTP 400 with an ApiError containing INVALID_QUERY,
fieldPaths (arrays of field names/indices), retryable=false, and requestId. It
reports unknown keys at their exact path without returning submitted values or
Zod prose. Callers can supply a correlation string or request-context resolver;
the default UUID is generated separately for each failed transform. T02 adds no
request middleware, session persistence, domain pricing, or application endpoints.
