# 0091 — Provider presentation

2026-11-06, owner request: improve the separate provider website for presentation.
Keep the Persian/RTL RoadAra identity, existing semantic theme tokens and local
font. Add a travel hero, three authored destination ideas, a short guide and native
FAQ. Illustrations are local inline SVG; no imagery service or new dependency.
Destination cards have no invented availability, ticket prices, bookings or user
history, and never describe the accepted referral as a different journey.

After SSO, render the existing approved claims as a readable traveler profile and
account summary, retaining the escaped original JSON pre block. Phone-only identities
stay usable. Only present national ID/passport/email fields actually authorized in
that immutable claim snapshot. Documents remain self-reported; source/consent copy
does not imply independent verification. Existing account states, logout, callback,
CSRF, SDK, cookies, store and attribution rules are unchanged.

The rendering layer is extracted into presentation.ts; server.ts changes only its
HTML composition. Header discovery links, steps and native disclosures stay usable
without JavaScript. Main website and admin presentation are outside this change.
Mobbin search returned a paid-plan requirement, so no Mobbin reference or external
product precedent is claimed. Design decisions use the observed baseline and this
project's own tokens. Validate desktop/mobile render and owning SSO regressions.
