# Direct Login integration

## Local walkthrough

Open the configured TorobTicket origin, normally http://localhost:4300.
The Docker development stack issues `123456` for newly requested phone verification
codes on TorobTicket and its reference providers. Manual API startup can opt in
with `TOROBTICKET_SSO_TEST_SMS_CODE=123456`, a development/test `NODE_ENV` and a
loopback SSO origin. A test challenge is redeemable only while those conditions
hold. Codes issued before enabling this setting retain their originally issued
value, so request a fresh code to use `123456`.

Open `/admin/direct-login` in the same browser and reviewer workspace. Choose
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
