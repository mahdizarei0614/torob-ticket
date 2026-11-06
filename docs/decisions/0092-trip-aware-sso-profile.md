# 0092 — Trip-aware SSO profile completeness

2026-11-06. Owner reported missing passport and English names during fresh reviewer
SSO. Actual packaged UI reproduction confirms fresh international signup already
collects/shares them, while a stored domestic profile is incorrectly treated as
complete on a later international trip. The form is hidden and approval leads to
server validation failure. The prior README's domestic example also obscures the
international document path.

The consumer now evaluates stored profiles using the same travelerProfileForTrip
projection and recorded travel context as server consent. Missing/expired/currently
required fields reopen the prefilled form. Approval requires a valid current-trip
profile, available context and no active edit; denial remains available. Editing
only gates traveler-scoped clients, preserving legacy phone-only authorization.
Consent preview lists the actual projected document and Latin names with LTR
values before sharing. No broader data collection/disclosure rule is introduced.

Domestic Iranian travel continues to use national ID. International travel uses
passport plus Latin names; foreign domestic travelers use passport. Saved data is
self-reported. Server consent validation/immutable snapshots, SDK, SMS gates,
provider account reuse/isolation and pending external attribution are unchanged.
README defaults to the international passport walkthrough and explains domestic
behavior. Verify fresh all-UI international created/existing and domestic→
international existing-customer completion in the normal packaged Docker stack.
