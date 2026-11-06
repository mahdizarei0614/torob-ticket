# 0091 — Provider presentation and local discovery

2026-11-06, owner request: improve the separate provider website for presentation.
The owner's subsequent clarification fixes direction: TorobTicket guides users to
providers. The provider does not send users back to TorobTicket to find flights.
This supersedes the initial layout's TorobTicket discovery links and guide copy.

Keep all header, hero, destination, flight-detail and footer discovery controls on
RoadAra. The rendering functions receive no issuer-origin argument. Public pages
contain no TorobTicket promotion or outbound navigation. An incoming valid referral
may show the explicit Continue with TorobTicket SDK sign-in option; its internal
login endpoint retains the existing bounded issuer authentication/return protocol.
Approved-claim provenance and the JSON issuer value remain part of the SSO result.

Use the existing Persian/RTL semantic tokens/font and local inline SVG. Add three
fixed authored flight ideas with schedules and complete one-adult, one-way economy
prices stored as integer rials, displayed as toman. These are independent local
presentation fixtures, not accepted quotes or live availability. Native detail
panels retain unknown baggage/refund conditions. No booking, purchase, user history,
acquisition metric or billable referral is created by browsing these examples.

After SSO, render only the approved claim snapshot as a traveler profile and
account summary, retaining the escaped original JSON pre. Phone-only identities
stay usable; only supplied national ID/passport/email fields appear. Documents
remain self-reported. Existing account states, logout, callback, CSRF, SDK, cookies,
store and attribution behavior are unchanged. Local section navigation retains
an incoming opaque referral query until the explicit sign-in action.

Mobbin search returned a paid-plan requirement; no external product precedent is
claimed. Design uses the observed baseline and project tokens. Verify provider-local
links, retained referral, native details, desktop/mobile and owning SSO regressions.
