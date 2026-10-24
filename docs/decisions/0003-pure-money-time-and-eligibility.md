# 0003 — Pure money, local time, and eligibility rules

Date: 2026-10-24 · Status: accepted implementation ruling for T03.

The domain public barrel exports `normalizeMoney`, `formatTomanParts`,
`toGregorianDate`, `elapsedMinutes`, `validateParty`, and `matchesEligibility`.
It also exports the supporting `localDateAt`, `matchesDepartureWindow`,
`SourceMoneyUnit`, `DepartureWindow`, `AgeRange`, `PartyPolicy`, and
`PartyValidationResult` types/helpers. Domain imports only contracts and the
already-installed exact `@internationalized/date` 3.12.4 dependency; clocks,
orchestration, provenance storage, and provider normalization stay with their
owning tasks.

Money normalization requires explicit IRR or TOMAN. Persian, Arabic-Indic, and
Latin digits are supported, with validated comma/Arabic grouping and decimal
separators. Negative amounts, ambiguous units/syntax, fractional rials, and
unsafe canonical totals are rejected. Toman supports at most one fractional
digit, representing one rial. BigInt arithmetic checks conversion before
returning safe integer IRR. The caller preserves original source value/unit in
provenance. `formatTomanParts(money, locale = 'fa-IR')` returns numeric
`Intl.NumberFormatPart[]`; the UI adds its explicit toman label. BigInt quotient
and remainder preserve the exact tenth even near MAX_SAFE_INTEGER. No monetary
rounding or per-traveler price multiplication occurs in eligibility matching.

Calendar conversion accepts strict YYYY-MM-DD values and uses calendar dates
directly, without creating an instant. Invalid Persian/Gregorian days are
rejected rather than constrained to a different day. Gregorian wire dates
remain Latin-digit date-only strings. `localDateAt(instant, zone)` derives a
destination-local hotel arrival date without UTC truncation. `elapsedMinutes`
compares validated UTC instants, permits zero, retains fractional minutes, and
rejects reversed intervals. This measures real elapsed time across DST changes.

As clarified in the design specification, the single `departureWindow` controls
**outbound departure only**, in the outbound departure place's time zone. Its
minute boundaries are inclusive; start greater than end crosses midnight;
equal endpoints select that one minute. A full day is 0–1439. The future
round-trip UI must label this control as outbound. Both legs' departure dates
are checked in their own zones. A return cannot depart before outbound arrival;
same-day returns are allowed without inventing a minimum turnaround margin.

`validateParty(party, policy)` returns `{ valid: true }` or
`{ valid: false, code: 'INVALID_QUERY' | 'AGE_REQUIRED', fieldPaths }`.
Generic contract bounds always apply: an adult is required, at most nine
travelers, infants no more than adults, nonnegative integer ages, and matching
age counts when supplied. `PartyPolicy` takes the provider capability flags
`requiresChildAges` and `requiresInfantAges`, plus optional inclusive authored
`childAgeRangeYears` and `infantAgeRangeMonths` ranges (`{ min, max }`).
Ranges themselves require the relevant ages. Missing ages yield AGE_REQUIRED
only when that provider's fare/seat rule requires them and that traveler group
is present. There are no universal invented child/infant age bands. Hotel-local
ages are separate data; this helper never substitutes them for transport ages.
Hotel-specific occupancy rules remain in T20.

`matchesEligibility(offer, query)` returns a boolean for a normalized offer.
Provider age/fare/seat validation must precede its normalized eligibility status.
Only known available, eligible, complete whole-party prices can match. Budget
is inclusive; absent/empty provider/operator lists are unrestricted. Requested
class, operator, affirmative baggage/refundability, and complete return terms
apply to both legs. Unknown baggage does not satisfy even a zero-kilogram
affirmative filter; unknown refundability cannot satisfy refundable-only.
Departure-window checks use only outbound departure. Flight stops include
technical/dwell stops; train/bus counts include only vehicle changes. Maximum
stops/transfers uses the sum across both directions and the future round-trip
UI must label that limit as the whole-trip total. Matching does not assemble
separate providers' one-way prices or implement freshness/clock policy.
