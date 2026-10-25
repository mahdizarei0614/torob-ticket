# 0019 — Optional sandbox identity and saved search intent

Status: implemented; independent review and production evidence are recorded in T19.

The consumer remains usable as a guest. Account UI is an unobtrusive Persian/RTL header action with a clearly simulated one-click Torob continuation, a fixed fictional display name, and no password, email, OTP, SDK or external redirect. It unlocks only saved searches; comparison and the existing referral backend have no identity gate.

## Persistence and authorization

`DemoIdentity.signedIn` is a narrow additive migration. Signing out deactivates the same identity while retaining its saved intents for the reviewer's session lifetime; signing in reactivates it idempotently. Reset/expiry deletes the sandbox and cascades both identity and saves. Session cookies and namespace do not rotate during sign-in/out. Readiness requires migration0003.

AccountRepository rechecks the signed-in identity inside the same session-scoped transaction/row lock used by reset. Earlier guard snapshots cannot authorize a save after logout or namespace deletion. Every saved read/delete is scoped by authenticated session and identity; a signed-in peer receives404. Guests receive explicit IDENTITY_REQUIRED403. No caller-selected namespace or identity is accepted.

Save stores only normalized query intent, display name and creation metadata. Names normalize to NFC before bounded/trimmed validation. Shared canonicalTransportQuery preserves party/ages, full round-trip conditions, filters, class and sort. Catalog checks cover supported network/class/provider filters and mode-specific baggage; a save does not fetch inventory or assert availability. Structurally valid older dates remain legitimate intent, requiring visible correction when reopened.

A session holds at most20 distinct canonical intents. Under the session lock an identical canonical intent updates its name and retains ID/createdAt; a21st distinct intent receives SAVED_SEARCH_LIMIT429 without silent eviction. Removing an item provides explicit recovery.

## Browser intent and delivery

Auth state is separate from immutable Consumer bootstrap SessionInfo. Login/logout never replace that prop or remount controller, ThemeProvider, results or map. The account hook has a synchronous mutation single-flight, independent operation epochs and the shared start-pool reset epoch. Logout/new refresh/reset/unmount fence obsolete response and row-action deliveries. SESSION_EXPIRED and IDENTITY_REQUIRED clear privileged identity/list display. Actual row callbacks check both the live account epoch and controller date/intent lease before opening a saved query.

Saving captures the currently visible validated full draft and its controller lease. There is no automatic save/search after login. Cancel/Escape discard the name transaction. Same-turn edits/history/reset invalidate retained confirmation. A rejected request retains name/query for deliberate retry; success is announced only after the typed server response and refreshed list. Idempotent canonical saving also makes a retry after an uncertain response safe.

Opening a saved row is an explicit `openSavedSearch` action. It restores exact fields and calls the normal controller admission/submit path for a fresh generation and price operation, including repeated opens of identical intent. Login/list/history/reload never start a selected search. Invalid/stale intent remains in the form with correction text and no selected SearchPOST. Capacity or a still-unanswered current request leaves exact fields visible, explains that no fresh search started and does not queue/bypass the existing two-start bound.

## Presentation and theme

Account/calendar coverage is ORed in the existing graphics host and map; covered GL/label input pauses while camera/quote selection survives. The shared semantic Dialog provides focus restoration and a full-page mobile mode. No new renderer/animation owner is added. Theme system/light/dark preference remains local and available to guests; sign-out/reset do not clear it or write it into identity state.

API: GET `auth/demo`; POST `auth/demo/sign-in` and `sign-out` with strict empty bodies return `{identity}`. GET/POST `saved-searches`; GET/DELETE `saved-searches/:id`; list returns `{items}`, create/get return SavedSearch, delete returns `{deletedSavedSearchId}`. Browser client validates every response, encodes IDs, forwards cancellation and never automatically repeats mutations.

Meaningful real HTTP/PostgreSQL failures and actual controller/component regressions are retained separately from setup/type/lint failures. Native tests disable failed traces to avoid archiving session cookies. All tests use explicitly owned scopes/database resources; production preservation and independent reviews are root-owned. No T20/T21/T22 feature is implemented here.
