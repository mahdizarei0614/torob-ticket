# TorobTicket provider SDK

This package runs on a Node backend. Obtain an enabled client, issuer, callback URL
and secret from TorobTicket Admin → Direct Login. Keep credentials and login
transactions on the server. The issuer provides OIDC discovery and JWKS.

```ts
import { createProviderSdk } from '@torob-ticket/provider-sdk';

const sdk = createProviderSdk({ issuer, clientId, clientSecret, callbackUrl });

// The registered login initiation endpoint receives the opaque ref query value.
await sdk.acceptReferral(ref);
const { transaction, url } = sdk.begin(ref);
// Persist transaction under a random HttpOnly, Secure browser session cookie.
await sessions.store(browserSession, transaction);
response.redirect(url);

// At the exact registered callback, atomically claim the browser transaction.
const expected = await sessions.claim(browserSession);
const claims = await sdk.finish(new URL(request.url, callbackUrl), expected);
// claims.sub is stable for this provider. Verify ownership of any old account
// before linking. Commit account creation and an outbox event together.
await accounts.createOrLinkAndEnqueue(claims);

// A retryable outbox worker submits completion evidence.
await sdk.reportAccount(claims.referral_id, claims.sub, accountId, attestation);
```

`finish` validates state, nonce, S256 PKCE, signature, issuer, audience and expiry.
The issuer serializes one-use code redemption. Recover an uncertain exchange by
starting a fresh authorization on the same referral. Persist completed results to
make repeated callback navigation recoverable without creating another account.

To prove an existing customer without sharing a roster, use `accountTree` on the
provider backend and keep random per-account salts private. Submit its root with
`publishCommitment(root, independentAttestation)` before any relevant referral.
`proveExisting(ref, tree.proof(accountId))` nominates one account. TorobTicket
checks the proof using its own consented, verified phone. The provider needs an
existing account session or an explicit user account-linking action to select it.
A plain phone hash is unsuitable because phone numbers can be enumerated.

The issuer requires an independently verified enrollment attestation before an
external commitment can earn a prior-account exemption. An external completion
report stays pending until the configured EnrollmentVerifier confirms first
account enrollment. The default adapter trusts no external attestation.

Current supported protocol is OIDC authorization code with S256 PKCE, EdDSA ID
tokens, client_secret_post and `openid phone` / `openid phone traveler`. There are no refresh tokens or
implicit grants. Endpoint URLs are derived from the registered TorobTicket issuer.
The consuming backend owns browser session binding, account linking, callback
recovery, secure secret storage and outbox delivery. Use HTTPS outside loopback.

For ticket-related signup, pass `scope: 'openid phone traveler'` in the SDK
configuration. `claims.traveler_profile` then contains the explicitly approved
primary-traveler snapshot: names, date of birth, gender, nationality, optional
email, and the document fields relevant to the recorded trip. Domestic Iranian
travel uses national ID; international travel uses passport and Latin names.
Foreign domestic travelers use passport. Entered documents are self-reported.
Phone-only clients remain supported and receive no traveler profile.

The runnable integration is `apps/example-provider`: a separate Node HTTP backend,
private account/session store, cross-host redirects and escaped claims JSON in
`pre#sso-response`. Its browser never receives the client secret or raw ID/access
tokens. See `docs/direct-login-integration.md` for setup and scope boundaries.
