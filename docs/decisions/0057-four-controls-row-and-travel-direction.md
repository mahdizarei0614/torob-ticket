# 0057 — Four labeled travel controls on one row

Implemented2026-10-30, source `f35e8e9`, specification1.28.

The owner clarified the intended row: origin, destination, class and the existing
outbound/return leg control. They also require a visible, relevant label. The
final label is «جهت سفر». One-way retains its checked «تاریخ رفت» option; round
trips expose both legs. The calendar stays below the wheel.

Use four explicit nonwrapping columns with aligned labels and54px control
surfaces. Keep readable type, intrinsic class/leg widths and44px option targets.
Constrained widths or long class choices use local horizontal scrolling instead
of another row or whole-page overflow. City menus and error tooltips remain
portalled outside the scroller. DateExplorer retains the existing leg, calendar
and interaction/generation ownership; this is placement/presentation only.

This supersedes0056's one-way omission and group-wrapping allowance. Optional
manual date inputs without a composed explorer remain separately available.

Source/static checks, independent review and native geometry/interaction passed.
Flight one-way/round-trip at1366px fit the630px row; train's longer class choices
use807px intrinsic content in the same630px scroller. No universal desktop-fit
claim is made. See the [checkpoint](../evidence/adjustments/search-four-controls-row/checkpoint.md)
and [independent approval](../evidence/adjustments/search-four-controls-row/independent-review.md).
M7 remains partial29/35 with T30 active. No remote action or image rebuild.

Owner copy correction,2026-10-30: the final visible and accessible label is
«جستجو بر اساس». This supersedes the earlier label wording only; layout, leg
selection and calendar behavior are unchanged.
