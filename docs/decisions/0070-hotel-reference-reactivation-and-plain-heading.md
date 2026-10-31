# 0070 — Reference reactivation and plain route heading

2026-10-31. Owner withdraws the origin/stop/destination scramble and requests
intrinsic hotel sort width with capacity at the opposite edge, plus a real fix
for the still-failing custom reference selection.

Restore the pre-scramble heading's plain React labels, LTR facility codes and
existing finite frame/arrow transitions. Remove the unused heading component,
its scramble-only tests and sole GSAP manifest/lock dependency. Leave map glow,
vehicle/route animation, metallic recommendation and other UI motion untouched.

Hotel sort controls use fit-content width bounded by the space available beside
the room selector. The row uses space-between; it does not stretch the sort
container to fill spare desktop width. Keep54px alignment, zero option gaps,
sliding indicator, four-person rates and mobile horizontal scrolling.

The actual missed interaction is reactivation: native radio onChange only runs
when its value changes. After a point was saved, clicking the checked fourth
option never reopened point mode. Returning from another sort could also silently
reuse a saved point. Opening the fourth option now always enters the guarded
picker, including an explicit optional shared onReselect action for a checked
radio. Capture selected-at-press-start so initial selection is not called twice;
fence release by current value/options/disabled/policy and retain the gesture's
authority-bound callback. Consume the native input's compatibility click from
the same keyboard event turn without a timing debounce or suppressing later
assistive-technology activation. Active openPoint is idempotent.

Preserve view/trip/session/authority guards. Map, cluster and reference-pin clicks
choose actual coordinates; Cancel restores the prior query/sort/point and
close/reopen retains current reference evidence. A saved reference pin physically
covering its source cluster is the legitimate topmost click target, not a reason
to force a click through it. Verify native first/repeated pointer, touch, checked
Space/Enter, saved-reference return, cancellation and marker persistence.

Record before-fix regression and independent behavior/types/native/scope evidence
under docs/evidence/adjustments/hotel-reference-reselection. Preserve foreign
package/branding/index/tokens/master/search/infra work. No DB operation, ordinary
reset, image rebuild, push/deploy, market build or Superpowers plugin. M7 remains
partial29/35,T30active.
