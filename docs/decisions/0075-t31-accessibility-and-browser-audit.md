# T31 accessibility and browser audit

Owner resumesT31 on2026-11-01 after T30complete. Specification1.42 remains
authoritative; this implements existing accessibility requirements rather than
introducing a redesign. Cover automated semantics, native keyboard traversal,
visual contrast/reflow/RTL/targets, actual engine compatibility and separately
reported assistive-technology/device checks. An AX snapshot is not VoiceOver
evidence, a CSS viewport is not real browser200%zoom, and WebKit is not Safari
or a physical iPhone. No WCAG compliance certification is inferred.

Use pinned official @axe-core/playwright4.14.0 as a development-only tool and
retain whole-page WCAG2/2.1/2.2 A/AA violation and incomplete results without
blanket rule exclusions. Preserve unknown prices/referral evidence and current
compact production-style UI. Native keyboard journeys use real Tab/Arrows/Enter/
Space, not DOM focus injection. Source candidates are measured before fixes.

E2E_BROWSER selects exactly one engine: chromium(default),firefox,webkit.
PLAYWRIGHT_CHANNEL applies only to Chromium. Each engine gets a distinct owned
E2E_EVIDENCE_DIR so fixed feature capture names cannot overwrite another engine.
Default Nx scope remains Chromium and existing development Compose; no server
reset/rebuild/DBmigration. Use owned reviewer fixture namespaces and trace-off
privacy reporter. Resource-intensive/native/GPU jobs are sequential under root.

Owner explicitly chose to skip VoiceOver; record NOTPERFORMED without an AT
claim. Actual200%browserzoom used native Chrome UI on a new t31.localhost tab,
separating cookies/zoom from the original127.0.0.1 origin. Width2056→1028 and
DPR2→4, native200%toolbar, no horizontal overflow, calendar bounded and focus
returned;100%restored2056/DPR2. Its cleanup call stalled and reset/tab closure
are not confirmed. A separate first headful attempt did no zoom and reset only
its own namespace201. No CSSzoom/deviceScaleFactor or physicaldevice inference.

Sources: [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing),
[W3C WCAG2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/).


Measured corrections retain stable interfaces: hotelCTA visiblefullcityphrase
matches its existing accessible name; visualcheckmark is decorative while its
nativecardbutton retains aria-pressed. Route-codebuttons include both visible
code and fullplacename; named route/range wrappers usegroup semantics. English
adminvisibleADMIN/Appearance align existing accessible names, with a next-action
title. Interactive invalidsubmit uses ordinary textcolor over the existing muted
background. Mobilewheelarrows get44px width; desktop30px remains. Calendar's
outer scrollowner, not inner scrollablecontent, owns viewport-fit verification.

Arbitraryhotelreference had onlypointercommit; add a collapsed coordinates
alternative guarded by the same identity/transaction and GeoPointSchema, local
typing with no serverwrites, Enter/apply commit and Escape/cancel. Preserve
automatic one-night arrivaldates, actual mapselection and stale-handler fences.

Native cross-engine evidence requires event-time focus ownership, not just a
settled DOM snapshot. The pinned React Aria portalled combobox intentionally
hides outside content for touch AT. Retain its exact eight raw axe findings in
this one measured state, match their structural owners and require trusted
native Tab/ShiftTab/Escape/pointer transitions with exposed focus. Unexpected
rules, nodes or counts fail; every other scan remains strict zero. This is a
narrow per-engine manual disposition, never an excluded rule or AT speech claim.
[Adobe describes that portal strategy](https://react-aria.adobe.com/blog/building-a-combobox#portals).

Firefox capture proved native Tab focus could arrive at an outside control while
the combobox's outside hiding still applied. For an open, enabled, connected,
currently focused input only, capture unprevented, noncomposing, nonrepeated Tab
and synchronously invoke the same public state commit used by the vendor's Tab
handler. Do not prevent native navigation, inject focus, edit aria attributes or
replace the vendor's open-menu AT behavior. This limited browser integration uses
[React's flushSync](https://react.dev/reference/react-dom/flushSync); actual native
capture must prove cleanup, since source inspection alone cannot establish its
passive-effect timing. Existing raw-query and selected-option authority remain.

The profile retains one native account action and ID through pending sign-in
and sign-out. Update its current guarded action, text, inline icon and danger
presentation instead of replacing that button. This preserves native focus and
the vendor's retained pending-announcement label reference without private
announcer manipulation. Verify the same connected native node/ID after both
actions and strictly scan the returned guest state too.

A known button[data-card-select] spans an entire ticket, including sellers that
may extend below the viewport. Only that button may use an exposed44x44minimum
intersection clipped by the viewport and all clipping ancestors, with a visible
positive-width focus outline and an actual intersection-center paint hit inside
its owning price-card article. Retain its full box and phase screenshot. Every
small control keeps strict full bounds; no generic tolerance, artificial scroll
or focus injection is permitted. The initial Firefox screenshot independently
showed the card ring and primary ticket facts while only its seller bottom was
clipped. These prepared fixes passed47affected units/types/lint; fresh native
closure remains required and is recorded separately in the evidence reports.

macOS WebKit's ordinary Tab behavior follows the user's keyboard-navigation
preference and can skip native buttons. Do not add production tabindex values
or weaken native focus assertions to counter that platform setting. A separate
test-app-only wrapper may temporarily set org.webkit.Playwright's
AppleKeyboardUIMode integer to2, capture original absence/type/integer, launch a
fresh supplied child argv without a shell, and finally restore and verify the
exact prior integer or delete only that key when originally absent. Refuse
unsupported existing types before mutation; record child exit and any failed
restoration explicitly. Never alter global, Safari or VoiceOver preferences.
SIGINT/SIGTERM attempt cleanup; SIGKILL or power loss cannot guarantee it.

[Playwright41808](https://github.com/microsoft/playwright/issues/41808) documents
the platform behavior: a maintainer confirms Safari alignment, while the
application-domain defaults workaround is the issue author's example, not a
supported Playwright API guarantee.
[Playwright5609](https://github.com/microsoft/playwright/issues/5609) also describes
native Option+Tab as an alternative. Preserve the failed default-preference run
and label subsequent evidence with its actual app-specific setting. Such a
WebKit run is not actual Safari, physical-device or VoiceOver evidence.

Independent foreground verification completed5PASS/0FAIL. A separately counted
Chrome post-profile-close diagnostic confirmed a real bounded upstream residual:
two role-img-alt bridge nodes reference the exact retired account-button ID
immediately after Escape, with two aria-valid-attr-value incompletes. The account
trigger is exposed/focused and identity/reopen remain valid; natural retirement
after about7seconds removes those bridges, followed by an unsuppressed scan with
zero violations. Diagnostic capture success is not a clean immediate scan and
must not be merged with ordinary acceptance counts.

Accept this lower-impact label-lifetime residual as explicit follow-up T31-F01
within the agreed representative scope. Preserve raw immediate/post-retirement
evidence; do not delete vendor announcements, suppress rules, or claim AT speech
is unaffected. Follow up with a compatible upstream correction or public naming
that survives its closing view, verified by the same immediate Escape probe.
No global pending-button rewrite is authorized by this ruling. VoiceOver remains
NOT PERFORMED at the owner's explicit request; this is not WCAG certification.
