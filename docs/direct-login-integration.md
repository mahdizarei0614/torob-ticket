# Direct Login integration

## Local walkthrough

Open the configured TorobTicket origin, normally http://localhost:4300.
The Docker local-review stack (packaged and development) issues `123456` for newly requested phone verification
codes on TorobTicket and its reference providers. Manual API startup can opt in
with `TOROBTICKET_SSO_TEST_SMS_CODE=123456`, a development/test `NODE_ENV` and a
loopback SSO origin. Packaged production-build code uses the explicit
`TOROBTICKET_LOCAL_REVIEW=true` gate with all public origins on HTTP loopback. A test challenge is redeemable only while those conditions
hold. Codes issued before enabling this setting retain their originally issued
value, so request a fresh code to use `123456`.

Open the separate admin port, normally `http://localhost:4301/admin/direct-login`,
in the same browser and canonical hostname as the consumer. Legacy main-site
admin URLs redirect there, retaining the host-only reviewer workspace cookie. Choose
Connect provider, retain the reference integration URLs, set an optional acquisition
rate in IRR and save. Empty rates are unpriced. Zero is a valid rate. The secret is
shown only in the save response. Saving again rotates credentials and revokes old
grants and access tokens.

Run a travel comparison and select that provider. Its confirmed receipt opens a
choice of ordinary provider navigation and Continue with TorobTicket. Continue
opens the provider's registered start endpoint with an opaque referral handle,
then the TorobTicket authorization screen. Enter a phone and retrieve the verification
code from the scoped admin Verification messages inbox. Consent shares the approved
number with only the selected provider. The provider callback uses the backend SDK,
creates its own account/session and resumes the exact referral offer.

For the existing-account journey, open the provider from admin first and sign in
there using its own verification message. This records an account commitment
before the later referral. Use the same phone on TorobTicket. An existing session
and a matching prior commitment support the fee exemption. Signing in to an old
provider account once also recovers a logged-out account-linking conflict.

Denying consent shares no contact claims. The guest path works without TorobTicket
sign-in. Unenrolled providers keep their prior destination. Ordinary outbound fees
retain the existing rolling-hour/tier/month rules. Acquisitions use separate immutable
rate snapshots at consent and deduplicate confirmed fees by provider/customer.
Their totals are exact integer IRR strings. No implicit click-fee credit or combined
invoice is calculated. Fee stacking/credit remains a commercial policy decision.

## Trust and local provenance

Phone delivery is a local admin inbox. Completing that challenge establishes local
verification, not ownership of a physical mobile. TorobTicket does not federate
with the actual Torob service. No external provider credentials or SMS service are
connected. The issuer and reference provider use real persisted protocol operations.
Reference provider accounts, sessions, PKCE transactions and enrollment/outbox records
live in their own scoped store. A separate issuer store witnesses commitments and
reconciles local account enrollment independently of a provider completion report.
Both stores run in this local application and share its trust boundary.

Reference account proofs use salted, domain-separated Merkle commitments, including
individual enrollment commitments. The issuer timestamps receipt of roots and orders
them before referral issuance. Client-supplied timestamps cannot backdate evidence.
A root commits to a record, so an external verifier must also establish that it
represents an actual verified account. Ordinary signed provider claims alone cannot
establish that fact. Every local signup path records enrollment before attribution,
including the ordinary provider signup form. Reconciliation considers only consented
identities within the ten-minute attribution window and retains unknown cases.

External clients can submit roots and per-customer proofs without uploading customer
lists. The `EnrollmentVerifier` interface in
`apps/api/src/direct-login/enrollment-verifier.ts` is the explicit independent
verification integration point. Its default rejects external attestations. A trusted
adapter must authenticate attestations, provider/account bindings, verified contact,
first-account eligibility and actual enrollment time. It must not infer those facts
from provider-controlled CRM timestamps. External self-reports remain pending, unbilled.
Automatic private matching for logged-out users is outside this pilot. Existing
provider sessions or deliberate account linking select the account to prove.

## Partner endpoints

Provider enrollment registers an exact callback and login initiation URL on the
same HTTPS origin. Only loopback development origins permit HTTP. Browser sign-in
starts at `/direct-login/begin`, allowing SameSite=Strict TorobTicket cookies to be
used by its own page even when navigation arrives from a different provider site.
The guarded API validates client, receipt, callback, state, nonce and S256 parameters
before creating an expiring flow. User consent precedes authorization code issuance.

Each client has issuer `/api/v1/direct-login/issuer/{clientId}` with
`/.well-known/openid-configuration`, `/jwks` and `/userinfo`. The shared backchannel
routes are POST `/api/v1/direct-login/token`, `/acknowledgments`, `/commitments`,
`/existing-proofs` and `/account-events`. They authenticate the client and derive
reviewer scope from its server-owned registration. They accept no workspace selector.
Token exchange requires the exact callback and verifier. Codes are one-use and expire
in sixty seconds. Access/ID tokens expire in two minutes. Browser transactions and
referral handles expire in ten minutes. All responses carrying identities, codes,
consent, provider state or admin evidence use no-store and no-referrer.

The SDK exports `begin`, `finish`, `acceptReferral`, `publishCommitment`,
`proveExisting` and `reportAccount`, plus salted Merkle helpers. See
`libs/provider-sdk/README.md` for backend integration. Its build emits a standalone
ES module and declarations with no runtime dependencies. Run `nx build provider-sdk`,
then pack `dist/libs/provider-sdk` using npm pack. No package publication is needed.

## Configuration and operations

`TOROBTICKET_SSO_ORIGIN` is the canonical public HTTPS origin or a loopback HTTP
origin. It defaults to http://localhost:4300. Use the same origin in the browser
and reference client registrations. `TOROBTICKET_SSO_INTERNAL_ORIGIN` optionally
routes reference-provider backchannel requests to the API inside a deployment.
It defaults to http://127.0.0.1:4302. These values are configuration, never derived
from an untrusted Host header. Keys persist with the workspace. Namespace reset
cascades issuer/client/provider data and invalidates outstanding sessions and grants.

The local secret store is protected by the application's database/access boundary.
A production deployment additionally needs actual delivery, independent verification,
production account recovery and identity lifecycle policy, managed secret/key storage,
security review and operational monitoring. A provider that bypasses all observable
integration paths on its own infrastructure still requires independent evidence.

## Verification

The owning integration suite exercises actual HTTP/PostgreSQL, SDK code exchange,
existing-account proofs, denied consent, code/OTP replays, client isolation, logout,
reset and external unverified reports. Its database must explicitly end in `_test`.
Unit proof tests cover odd/even trees and identity/provider substitution. Browser
evidence verifies admin enrollment, sign-in, consent and the resumed provider offer.

Protocol references are OpenID Connect Core, OAuth security BCP RFC9700, and the
Merkle inclusion construction described in RFC9162. The local implementation supports
the documented subset and has not undergone OpenID conformance certification.


## Separate provider website and traveler profile

`apps/example-provider` is a standalone Node application with its own persistent
private credentials/accounts/sessions/transaction/outbox store. It does the actual
SDK authorization-code exchange, verifies the signed claims, and renders escaped
JSON in `pre#sso-response`. The app is local; it does not contact a commercial
travel provider or issue a ticket.

`pnpm docker:dev` and `pnpm docker:up` now start the provider service too. Host
`pnpm start` includes its build/serve target. The canonical platform origin is
`TOROBTICKET_SSO_ORIGIN`. The provider defaults to the other loopback hostname:
platform127.0.0.1:4300 → providerlocalhost:4310, or platformlocalhost:4300 →
provider127.0.0.1:4310. Different ports alone would share host cookies and are
insufficient isolation. `TOROBTICKET_EXAMPLE_PROVIDER_ORIGIN` overrides the public
origin and must use a different hostname; outside loopback use HTTPS. The optional
`TOROBTICKET_EXAMPLE_PROVIDER_PORT` changes the published/default public port.
Internal Docker traffic uses the fixed operator-configured service origins.

1. Open the canonical traveler app. Docker local-review mode automatically connects
   راه‌آرا for this reviewer. No admin configuration is required.
2. For additional providers, open admin on its separate port and choose
   **Connect separate site** on the desired provider row. The API stages a
   disabled client, sends a one-use60-second installation code server-to-server,
   and activates only the unchanged successfully installed registration. No secret
   is copied through the browser. Failed installation stays disabled; retry it.
3. Search and select an offer from that provider. Choose either ordinary site
   navigation followed by **ادامه با ترب‌تیکت**, or the direct continuation option.
4. Verify the TorobTicket phone. In the opted-in local development runtime,
   `123456` works under the existing loopback/test gates. Complete primary-traveler
   information, save it, and explicitly authorize sharing with the named provider.
5. The separate site creates/reuses its own subject-bound account. The displayed
   `provider_account.status` is `created` on first successful login and `existing`
   on subsequent logins. A different verified phone creates a different subject.
   Existing accounts from the older same-origin reference provider are retained
   there and are not silently copied into this separate store.

Base fields are given/family name, Gregorian birth date, gender and two-letter
nationality, with optional contact email. Domestic Iranian travel requires a
10-digit national ID. International travel requires passport number, issuing
country, expiry through the recorded last travel date and Latin names. Foreign
travelers on domestic routes use passport. These are self-reported signup fields,
not verified identity documents or a guarantee of every carrier's requirements.
Other travelers must be completed at the provider; no party is fabricated from
one profile. The issuer derives travel context from its stored referral receipt.

The additive SDK scope is `openid phone traveler`. Old `openid phone` integrations
remain valid and do not receive profile/document claims. Consent freezes only the
relevant document projection in both ID-token and UserInfo data. Later profile
edits cannot rewrite a prior grant. Denial produces no new disclosure. JSON shows
verified decoded claims, not raw tokens or credentials. Cookies are host-only;
provider cookies use Lax for cross-site callback and issuer cookies retain Strict.
Logout requires a session-bound form CSRF token even for `Origin:null` forms.

The provider's persistent JSON store is a bounded, single-process local example,
written atomically with private file permissions. Container data is in the
`example_provider` volume; host data defaults to ignored `.local/example-provider`.
Both ordinary shutdown paths preserve it. Explicit Docker reset removes project
volumes. Do not run multiple writers against this example file store.

An external account event remains `pending` and unbilled until independently
verified. The local site's `existing` result is not an existing-customer billing
exemption. Merkle proofs still require a trusted commitment from before referral;
provider assertions alone cannot waive referral attribution. See decision0088 and
`docs/evidence/adjustments/external-provider/verification.md` for actual evidence.


## Automatic reviewer connection

The explicit local-review flag initializes only missing or incomplete automatically
owned RoadAra connections after workspace bootstrap/resume/reset commits. It uses
singleflight and transactional ownership/revision checks. Existing manual/custom
or disabled clients are never replaced. A failed automatic connection stays
retryable/disabled and does not break guest comparison. Refreshing after services
recover retries initialization. No traveler identity/profile/account is prefilled.
Rates remain unset; independent external evidence remains required for billing.

API and provider/initializer images now have separate packaged/development tags.
OpenSSL runtime libraries and trust/license files come from the matching pinned
official Node Debian image, so backend builds do not depend on apt mirrors. The
provider entrypoint preserves and normalizes only its dedicated volume file's
ownership, refuses symlink/hardlink stores, then drops to UID/GID1000 before
serving. Readiness checks that the private store is writable in both modes.


## Provider presentation

The separate website includes three authored destination/flight ideas, local SVG
illustrations and expandable flight details. Their schedules and one-adult totals
are fixed presentation fixtures (integer rials, displayed as toman); they do not
assert live availability or a booked journey. Browsing stays on the provider.
TorobTicket appears only in the explicit SDK sign-in option for an incoming referral
and approved-claim provenance. The accepted referral and its price are unchanged. After SSO, the readable traveler profile uses only the approved claim
snapshot, including only the document fields supplied for that trip. Phone-only
identities remain supported. The original escaped JSON response stays visible
below the profile, with created/existing account status and session-bound logout.
No sample identity, travel history or acquisition metric is inserted.
