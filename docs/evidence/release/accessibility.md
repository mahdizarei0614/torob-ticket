# T31 accessibility acceptance

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../history-rewrite.md. This is not a new test run.

Status: **COMPLETE FOR THE AGREED REPRESENTATIVE SCOPE; BOUNDED VENDOR RESIDUAL RECORDED**. This report separates
representative automated/native evidence, bounded manual review and actual
assistive-technology checks. It is not a WCAG certification. T31 uses specification1.42 and
the current task brief.

Latest completed native proof:

| Selection | Actual outcome | Scope |
|---|---|---|
| Chrome affected final | 22PASS/0FAIL, no other outcome/error categories;260.748s | 9semantic,9referral,2hotel,2targeted responsive cases;1102v3source hashes unchanged |
| Firefox affected final | 22PASS/0FAIL, no other outcome/error categories;311.851s | Same9semantic,9referral,2hotel,2targeted responsive cases;1102v3source hashes unchanged |
| Configured Playwright WebKit27.2full | 43PASS/0FAIL/1existing Chromium-CDP guard skip across44cases;544.151s | All9semantic and7responsive cases passed;1102v2source hashes unchanged; originally absent app keyboard key restored with verified readback |

Independent Chrome verification completed **5PASS/0FAIL** in71.350seconds. A
separate16.725second diagnostic capture confirmed two transient vendor
announcement violations immediately after profile close, then zero violations
after their natural retirement. That capture is not a clean immediate scan and
is not merged into ordinary acceptance counts. The finding is retained as
**T31-F01**, accepted as a bounded lower-impact follow-up for this scope.
VoiceOver was **NOT PERFORMED at the owner's request**.

- Chrome affected selection.
- Firefox affected selection.
- Completed WebKit selection.
- Verified app-key restoration.
- Independent five-case verification.
- Separate diagnostic capture.

## Scope and method

Consumer Persian/RTL and English admin remain semantic HTML. The whole accessible
page is scanned with pinned `@axe-core/playwright`4.14.0 and WCAG2A/AA,2.1A/AA
and2.2AA tags. Active portals are included. No page/node exclusions or disabled
rules are used. Each scan retains its exact violations and incomplete findings;
passing-rule IDs/counts and engine/environment metadata are recorded separately.
Incomplete checks require review and are not silently counted as passes.

New acceptance source:

- [Semantic and keyboard cases](../../../tests/e2e/src/accessibility.spec.ts).
- [Whole-page scan and real Tab helpers](../../../tests/e2e/src/a11y-helpers.ts).
- [Narrow city-menu audit and passive native focus trace](../../../tests/e2e/src/city-menu-focus.ts).
- [Responsive, targets, palettes and RTL coverage](../../../tests/e2e/src/responsive-rtl.spec.ts), owned by the responsive audit.

All mutable contexts use the owned-reviewer fixture, deterministic seed/clock,
separate cookies and explicit namespace cleanup. The user's existing browser
session, database and Docker stack are not reset. Session-bearing traces are
off. Only the owner-approved `https://zarei.xyz/` navigation is intercepted;
actual local recheck/confirmation still run. This does not establish a booking
or real provider integration.

## Representative semantic states

| Task | Native/semantic assertions | Automated scan states |
|---|---|---|
| Composer/city menu | Named combobox, expanded owner, valid choice authority | Complete composer, filtered city menu |
| Invalid form | Explicit attempted submission, useful focus, persistent error description after Escape | Invalid composer |
| Jalali dates | One calendar grid; provisional changes can cancel without changing committed dates | Priced calendar |
| Results/provider detail | Native selected card, ordered round-trip timeline, LTR route codes, independent details control | Complete results, expanded route/provider evidence |
| Filters | Foreground dialog semantics and Escape focus return | Result filter panel |
| Arrival hotel discovery | Current hotel result owner, named capacity, custom-point transaction/cancel, close focus return | Hotel list and custom-point mode |
| Identity | One connected native action/ID across real local sign-in and sign-out; Escape focus return | Guest, signed-in and returned-guest profile popover |
| Changed fare/admin | Material alert and explicit consent; actual linked English search inspection | Changed-fare dialog, admin inspection |

## Keyboard and live announcements

The critical journey uses actual `Tab`/`Shift+Tab`, arrows, Enter/Space and typed
city text. It does not inject focus or use locator clicks for the journey.
Seed/session/URL prerequisites are not presented as keyboard interactions.
It traverses cities, changes a provisional calendar date then cancels, submits,
selects a card, expands/collapses details, closes filters/hotels and activates the
provider handoff. Focus tape includes actual viewport bounds plus the element
and ancestor focus styles; phase screenshots support visible-focus inspection.
The helper recognizes focus-within decorations rather than requiring every
proxy input to paint its own outline.

A separate normal-motion case records public live-region text mutations through
actual asynchronous results. During30native animation frames it requires
changing route progress and zero new live announcements. This tests the captured
DOM-announcement window, not screen-reader speech or every possible timing.
The static assertion that complete ticket cards are not live regions is narrower
and is not substituted for this observation.

## Actual initial execution — Chromium

E2E types and the two new source files' scoped lint passed before execution.
The first eight-case run finished **1PASS/7FAIL**, zero skipped/flaky/not-run/
interrupted/global errors. This failed run is retained:

- Actual initial log.
- Actual run summary.

Confirmed axe findings were a desktop hotel button whose visible words were not
included in its accessible name, an `aria-label` on a prohibited generic selected
mark, and admin brand/theme labels that omitted visible words. The calendar and
changed-price dialog scans had zero violations in that run; the combined
changed-fare/admin case still failed at admin and is not called a passing test.
City-menu, hotel and keyboard follow-up coverage was also blocked by three
authoring errors: closing a city menu before seeking outside form controls,
scoping hotel status to its one results region, and traversing backwards from a
seller link to the preceding details button. Corrected cases require a new run.

The second Chromium selection contains nine cases, adding the measured native
live-announcement window. It finished **3PASS/6FAIL**, zero other outcome/error
categories. Calendar, changed-fare plus admin, and the normal-motion live case
passed. The full results remain separate from the first run:

- Second actual log.
- Second run summary.

The shortened Persian hotel phrase still failed label-in-name because its suffix
differed from the accessible phrase; the next correction uses the exact existing
descriptive city phrase visibly too. Invalid submission is interactive by design,
so its measured3.8:1 disabled-style text contrast is a real correction target,
not an inactive-control exception. Root owns that tokenized CSS correction.
The generic selected mark violation is gone. The hotel list scan had zero axe
violations; its custom-point follow-up hit a test setup problem when a real radio
input was covered by its clickable label. The corrected setup uses native Space.
The critical journey completed actual calendar keyboard change/cancel and
recorded viewport-bounded focus phases, then its traversal helper waited on an
outside control temporarily hidden by an intermediate city menu. The helper now
continues real Tab/Shift+Tab through such a popup, retaining the duplicate-owner
guard and bounded traversal limit.

Approved consumer corrections preserve native `aria-pressed` selection authority
and make the visual selected check decorative. Intentional code-route and price
range containers receive group roles so their supplied names are exposed; route
buttons include their visible public code and full place name. These address
manual name-in-role review as well as axe incompletes, without hiding content or
weakening scans. Subsequent native/browser verification is recorded below.

## Resumed Chromium verification — actual nine-case run

Web and E2E typechecks, scoped lint, and all43tests across six affected web unit
files passed, including the hotel coordinate-editor cases. The nine semantic
acceptance cases then finished **7PASS/2FAIL**, zero skipped/flaky/not-run/
interrupted/global errors. All17scoped runtime/config/test hashes match before
and after execution:

- Actual run summary.
- Actual log.
- Scoped post-run source receipt.
- Affected unit output.

Thirteen whole-page axe state receipts were produced: eleven have zero
violations; city-menu and custom-point mode still report issues. The menu reports
eight`aria-hidden-focus` ancestors outside the input/listbox. Installed React
Aria ComboBox already supplies `isNonModal:true` through its context; its
combobox behavior separately hides outside content while the menu is open.
Adding that flag alone is not a demonstrated fix. Actual focus/Tab-dismissal
tracing was required before changing the vendor's keyboard/AT strategy; that
measured work and its per-engine corrections are recorded below.

Custom-point mode reports one`scrollable-region-focusable` issue on the hotel
collection pane: card controls are disabled during point selection while the
pane remains scrollable. At that checkpoint the owning feature still needed an
accessible scroll-focus target; the later correction and passing runs retain
this original failure. Neither issue is suppressed or relabeled as a passing scan.

The real keyboard critical journey passed in17.129seconds, including actual
city queries, provisional date change/cancel, selected card/details, filter and
hotel close/focus-return, and an exact intercepted provider popup. Its phase
screenshots and ancestor-style focus tape are retained under the run artifacts.
The separate normal-motion live case also passed; its captured30-rAF window had
changing route progress and no live-region text mutations. That is bounded DOM
evidence, not a spoken-output measurement.

## City-menu native diagnosis and exact manual disposition

A separate reviewed Chromium diagnostic finished **1PASS** in7.421seconds
(the complete run took10.160seconds). Its whole-page axe receipt retains the
original eight`aria-hidden-focus` findings; successful diagnostic capture is
not described as a clean axe scan. The21recorded source hashes were unchanged
during execution:

- Diagnostic log.
- Reviewed diagnostic source.
- Diagnostic artifact directory.

Actual synchronous`focusin`capture found no hidden or inert ancestor on native
Tab to the clear control, Shift+Tab to the previous radio, return to the input,
Escape dismissal or actual pointer focus on the outside appearance control.
Outside hiding retired before the outside focus events. Microtask and two finite
animation-frame samples are retained separately with same-owner markers.
Mutation timestamps represent observer delivery, not exact mutation occurrence.
This is native Chrome evidence; it does not establish other engines or AT speech.

[Adobe describes the portalled combobox strategy](https://react-aria.adobe.com/blog/building-a-combobox#portals):
outside content is deliberately hidden while its portalled input/listbox are
available to touch assistive technology. The pinned vendor source already has
`isNonModal:true`; its combobox behavior independently applies the outside hiding.
No vendor behavior was changed solely to satisfy an automated rule.

The maintained first semantic case now collects this one raw city-menu scan
without requiring zero findings. Instead it requires exactly the one rule and
eight structurally identified outside owners, an exposed current input/listbox,
and the same native event-time checks in the engine actually running. It saves
all original violations/incompletes, the focus/mutation timeline and an explicit
manual disposition. Any different rule, node, count or unsafe focus fails. No
generic ignore option, node exclusion or disabled axe rule exists. Every other
state keeps its zero-violation assertion. The final passing selections above
include this per-engine integration. Independent source review cleared the maintained
integration and its exact structural mapping before the final run. Observer
delivery order is recorded explicitly: a different engine's later observer
delivery must not be mistaken for unsafe native focus if the synchronous
focus-event ancestry is already exposed. Any such mismatch requires audit
triage, with the original event order retained.

Four additional intentional named containers now have group roles: selected
sellers, price-comparison reasons, signed-in identity, and route-stop wait facts.
The wait label retains the full known duration while its visual count animates.
The vendor profile wrapper incomplete remains separately documented; a correctly
named child dialog already owns that surface, so a duplicate role was not added.

## Final source preparation — actual checks

The final maintained helper and four group-role corrections passed web and E2E
typechecks, scoped lint across ten authored files, and **43of43affected web unit
tests across six files** in12.01seconds. No native browser cases were run in this
preparation lease. All21scoped source hashes remained unchanged between the
preparation snapshots; the first snapshot was captured while web typechecking
had just started, and no source edits occurred during the checks:

- Web types and E2E types.
- Scoped lint.
- Affected units.
- Post-check source binding.

The first combined Chromium selection collected44cases and finished
**43PASS/1FAIL**, zero other outcome/error categories. The failed first city
audit stopped before native replay because its controls-owner locator returned
zero nodes; all other43cases passed. The raw eight axe findings were unchanged.
The helper's final validation initially obscured that original locator failure.
An isolated diagnostic then preserved the original error and captured all eight
owner counts: seven matched once and the controls-owner locator matched zero.
Both failed executions are retained:

- Combined Chromium summary.
- Focused owner-facts summary.

The corrected helper identifies the controls' direct form container by its three
known current segment tracks rather than assumed direct radio-group children.
It captures every structural owner before asserting, leaves raw artifact capture
in`finally`, and validates the native trace on the normal successful path. This
preserves earlier exceptions and never turns a missing replay into a passing
manual disposition. E2E types and helper lint passed; independent review cleared
this change. The corrected city case then passed in **9.502seconds**. All eight
exact structural owners matched and the native event-time focus verification
passed; the raw eight axe findings are still retained. All1101root-recorded
source hashes were unchanged during that run:

- Corrected city-case summary.
- Per-run city evidence.

The later engine matrix above supersedes this intermediate checkpoint. These
results remain separate from the earlier Chromium7PASS/2FAIL evidence and the
43PASS/1FAILcombined selection.

## Firefox findings and prepared corrections

The first Firefox44selection finished **40PASS/3FAIL/1guarded touch skip**, with
unchanged root-recorded source. It exposed two actual defects and one overly
strict audit geometry assertion. The failed evidence remains available:

- Firefox summary.

Unlike Chrome, Firefox's synchronous focus events on Tab to the clear button and
Shift+Tab to the previous radio still had an`aria-hidden`ancestor while the
combobox was expanded. Later settled cleanup was clean; that did not excuse the
event-time failure. A guarded native input Tab capture now synchronously invokes
the same public commit operation as the vendor's Tab behavior. It leaves browser
default navigation, propagation, typed-query authority and open-menu AT hiding
intact. The call is limited to a connected, enabled, active input with an open
menu, excluding prevented, composing and repeated events.
[React documents this browser-integration use of flushSync](https://react.dev/reference/react-dom/flushSync).
Its possible effect flush is not substituted for actual native proof; all
event-time ancestry checks remain strict.

Firefox also exposed an unnamed image in the vendor's pending-button announcer:
sign-in replaced the focused guest button, leaving a retained label reference to
its removed ID. The profile now keeps one native action button across guest and
signed-in states, updating its action, icon and danger presentation. Existing
authority guards remain. The browser case records the same live native node and
ID after both sign-in and sign-out, then strictly scans the returned guest state.
No private announcer cleanup is used.

The third failure required an entire absolute ticket-selection button to fit
inside the viewport even when expanding sellers extended below it. Independent
review of the actual Firefox screenshot found the focus ring and ticket facts
visible. Only this known whole-card button may now use a substantial44×44visible
intersection, clipped by the viewport and every clipping ancestor. It must be
exposed, have a visible positive-width outline, and its intersection-center
paint hit must belong to its owning price-card article. Full geometry and the
phase screenshot remain recorded. All smaller controls keep strict full bounds;
no scrolling or focus is injected to make an assertion pass.

The prepared corrections passed UI, web and E2E types, scoped six-file lint and
**47affected unit tests**:31across five UI files in9.65seconds and16account-panel
tests in3.05seconds. Five new regressions cover synchronous native Tab cleanup,
raw-query preservation, exactly-once arrow-selected commit, IME/prevented event
ownership and stable account action/announcement targets. Logs contain no
warning/error output. Subsequent native verification is recorded below; these
preparation checks alone were not browser proof:

- UI affected units.
- Account units.
- Exact prepared source.

The focused repaired-runtime Firefox selection finished **2PASS/1FAIL** with
unchanged1102source hashes. The expanded profile case passed after both sign-in
and sign-out, and the complete native keyboard journey passed. The city receipt
already showed zero hidden ancestors at every focus capture and a closed menu
at each outside native focus. Its remaining failure was the audit's assumption
that MutationObserver delivery must precede focus. Firefox delivered clean-up
records after exposed native focus but before the explicit settled marker:

- Focused Firefox repair summary.

The audit now requires exactly one trusted outside focus of the expected
name/type while still checking **every** focus capture, including vendor virtual
focus, for hidden/inert ancestry. Observer retirement must be delivered within
the same finite action before its settled marker. Original delivery order and
all raw findings stay recorded; synchronous focus ownership remains decisive.
This helper-only correction passed E2E types and scoped lint. The later passing
Chrome/Firefox affected selections and configured WebKit full selection above
include the corrected native check; the earlier failed record remains separate.

## WebKit keyboard environment — actual scoped evidence

The default-preference WebKit44selection finished **40PASS/3FAIL/1guarded skip**.
Its ordinary macOS Tab behavior skipped native buttons. A maintainer confirms
[Playwright intentionally follows Safari's platform behavior](https://github.com/microsoft/playwright/issues/41808);
[native Option+Tab is an alternative](https://github.com/microsoft/playwright/issues/5609).
No production tabindex or manual focus changes were introduced to counter that
environment setting. This remains actual Playwright WebKit evidence, distinct
from actual Safari, a physical device or VoiceOver.

The scoped wrapper changes only the Playwright app's`AppleKeyboardUIMode`key,
never global, Safari or VoiceOver preferences. Its first invocation refused
before mutation because this OS used a different missing-key diagnostic. That
original source, receipt and log are retained. The parser was amended only for
the exact fixed key/domain diagnostic with exit1 in stdout or stderr; ambiguous
errors and unsupported existing types still refuse before mutation:

- Original zero-mutation refusal.
- Original source binding.
- Reviewed scoped wrapper.

A configured three-case WebKit run then finished **2PASS/1FAIL**. City-menu
event-time safety and the complete native keyboard journey passed. The hotel
case's remaining failure assumed that a pointer click focused a hotel button;
that assertion is separate from native keyboard selection. The current case
uses actual Tab/Space for its keyboard-focus claim. For this completed run the
app key was originally absent, its temporary integer2was verified, and exact
absence was restored and verified despite the failing child exit:

- Configured three-case summary.
- Completed preference restoration.

The configured full44selection completed **43PASS/0FAIL/1existing Chromium-CDP
guard skip** in544.151seconds, with all1102v2source hashes unchanged. All nine
semantic and seven responsive cases passed, including strict city event-time
checks, all three profile native-ID states and the critical keyboard journey.
The revised hotel desktop keyboard case also passed. The run used actual
Playwright WebKit27.2with the app-specific full-keyboard setting; its originally
absent app key was restored to absence and read back successfully. These facts
do not establish actual Safari, a physical device or assistive-technology speech.
Final Chrome and Firefox affected selections and independent focused verification
subsequently passed as recorded above. The separate bounded residual below
remains visible in the acceptance record.

## Chrome affected final — actual completed selection

The latest Chrome selection finished **22PASS/0FAIL** in260.748seconds with zero
flaky, skipped, not-run, interrupted or global errors. This was an affected
selection, **not a fresh44case run**: nine semantic cases, nine referral cases,
two hotel cases and two targeted responsive cases (keyboard coordinates and
masked-wheel contrast/focus). All1102v3source hashes were unchanged. It includes
strict native city cleanup, the three profile node/ID states and the complete
keyboard provider journey:

- Actual affected selection.
- Post-run source binding.

Firefox's matching22selection subsequently passed separately, as recorded below.

## Firefox affected final — actual completed selection

The matching Firefox selection finished **22PASS/0FAIL** in311.851seconds, with
zero flaky, skipped, not-run, interrupted or global errors and all1102v3source
hashes unchanged. Its nine semantic, nine referral, two hotel and two targeted
responsive cases match the Chrome affected selection. This is fresh Firefox
proof of the repaired city focus timing and stable account action; it is not a
fresh44case run or an inference from another engine:

- Actual affected selection.
- Post-run source binding.

## Retained findings and bounded manual review

Each engine retains the city menu's **eight raw`aria-hidden-focus`findings**.
Only that pinned portal state receives a per-run manual disposition: the exact
eight structural owners must match, the live input/listbox must be exposed, all
captured focus ancestry must be free of hiding/inert, expected native outside
focus must find the menu closed, and cleanup delivery must be bounded by each
completed action. Raw findings and event order remain visible. All other
maintained scan calls enforce zero violations. Passing those captured states
does not establish every transient DOM tree or spoken AT behavior.

The reviewed configured WebKit catalog covers16fresh whole-page receipts and
retains714contrast,36label/name and3vendor-wrapper incomplete entries across
repeated states. These are not counts of unique defects or automatic passes:

| Incomplete group | Bounded review and evidence |
|---|---|
| Canvas/overlap, decorative symbols, gradients and promotion pseudo-content | Six-palette masks/contrast and native focus checks cover their measured ranges. Selected result/map/hotel and exact consent frames received source/visual review. This is not714numerical whole-page passes or raster sampling of every animation frame. |
| Symbolic controls and calendar naming | Functional Persian icon names and full localized day names include visible day numerals; secondary prices/status remain described. No screen-reader speech session is claimed. |
| Three repeated vendor profile wrappers | The outer generic RAC label is redundant with a correctly named child Dialog. Intentional authored groups now own their names; duplicate wrapper roles were not added to silence the audit. |
| Internal map attribution | No`link-in-text-block`incomplete remains in these16states. The dedicated Chrome after-probe measured opaque text/focus contrast, native hit/camera behavior and target sizes; configured WebKit screenshots confirm the underline/surface visually without inferring raster ratios. |
| Consent partial-obscuring entries | The exact saved consent-phase frame shows readable versions, party amounts, conditions and actions on the opaque dialog. This is an exact-frame visual/source review rather than all-theme numerical certification. |

- Configured WebKit catalog and individual rulings.
- Independent review history and measured paint scope.

## T31-F01 — accepted bounded upstream announcement residual

The separate Chrome probe confirmed a real residual immediately after native
Escape closes the profile: **two`role-img-alt`violations** and
**two`aria-valid-attr-value`incomplete entries** belong to pending-announcement
bridges that reference the exact retired account-button ID. This is separate
from the repaired guest/signed-in/signed-out button lifetime. The original
button is absent, the account trigger is exposed and focused, and the current
identity and later reopen remain valid.

The probe held only delivery of the real successful sign-in response to observe
the public pending bridge. It fabricated no payload, removed no vendor nodes,
disabled no announcements and used no fixed sleep. Natural-retirement polling
observed the bridges disappear after about seven seconds; an unsuppressed
whole-page scan then reported **zero violations**, with ordinary incomplete
findings still retained. The capture completed successfully as a diagnostic;
its immediate state was not a clean accessibility scan. Its first failed
authoring attempt, which looked for the guest's unchanged name during its
legitimate busy-name prefix, is also preserved separately.

After independent review, this lower-impact upstream label-lifetime issue is
accepted for the agreed representative T31 scope because keyboard focus,
identity authority, close/reopen and the foreground task remain usable, and the
bridge retires naturally. This is an explicit retained finding, not a blanket
waiver or evidence that actual screen-reader speech is unaffected.

**Follow-up T31-F01:** evaluate a compatible upstream correction or public
announcement naming that survives the closing view; rerun this same immediate
Escape diagnostic without rule exclusions, private announcer manipulation or
waiting away the finding. Any spoken AT impact needs its own separately
authorized observation. No global pending-button rewrite is implied here.

- Exact immediate raw scan.
- Natural-retirement/raw-reference timeline.
- Unsuppressed post-retirement raw scan.

## Assistive-technology boundary

Native keyboard input, DOM roles/names and browser accessibility-tree inspection
are distinct from actual VoiceOver/NVDA speech. At the owner's explicit request,
VoiceOver was not performed. No actual screen-reader session, physical phone or
inclusive-user study is claimed. Record any other manual checks with the
specific engine/device and observed tasks. Browser emulation alone does not
establish that evidence.
