# 0088 — External provider and traveler profile

Date 2026-11-04. Explicit owner request for a separately hosted local provider
with an actual SDK SSO exchange and JSON response, plus ticket-related profile data.

A fourth application, example-provider, runs on localhost:4310 with its own Node
backend, private persistent JSON store and host-only browser cookies. The platform
uses its configured origin, currently127.0.0.1:4300. Admin installs scoped client
credentials through short-lived one-use installation codes. The provider exchanges
those codes only with the configured platform backchannel. Partial installation
leaves the client disabled and can be retried. Public/internal origins are server
configuration, never caller-selected network targets.

A traveler scope is additive to openid/phone. A primary-traveler profile contains
names, birth date, gender, nationality, optional contact email, and route-relevant
identity documents. Domestic Iranian profiles share national ID. International
profiles share passport and Latin names, and foreign domestic profiles use passport.
Document expiry covers recorded travel dates, without inventing a universal
six-month validity rule. Entered documents are self-reported and are not identity
verification. Existing phone-only grants remain compatible. Consent binds an
immutable profile projection, also used by UserInfo. Profiles never synthesize
other travelers in a historical party.

The separate provider displays verified decoded claims in an escaped JSON pre
block and creates/reuses its own subject-bound account. Tokens and client secrets
stay on the backend. External account reports stay unbilled pending independent
verification. The separate site's local account status is its own observed state.
The prior same-origin reference provider remains supported.

Field choices are implementation defaults informed by carrier booking/profile
interfaces and OpenID claims. They are not a claim to satisfy every carrier,
immigration rule, or ticket-issuance requirement.

Sources
- https://www.qatarairways.com/en/help.html
- https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims
