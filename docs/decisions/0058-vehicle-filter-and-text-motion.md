# 0058 — Vehicle-dependent controls and bounded text motion

Date:2026-10-30. Owner request: ease the filters and their words when switching
vehicles, and animate appropriate text changes/entrances throughout the page.

Use the existing Motion library and shared motion policy. GSAP was permitted,
but these finite effects do not require another dependency, ticker or ownership
system. Keep the controls native and their semantics current immediately.

Segmented options enter/leave by animating real intrinsic widths, opacity and a
small vertical/blur offset. Neighboring controls reflow without scaling their
letters. Preserve the measured selected indicator, keyboard/focus behavior,
44px targets and the four-control row. Retiring options become disabled, inert
and accessibility-hidden immediately. Keep at most one previous option cohort;
rapid changes settle on the latest actual inventory.

`MotionText` transitions whole Persian phrases, retaining their shaping and RTL
direction. There is one accessible current phrase and at most one decorative,
inert, aria-hidden outgoing phrase. Short fade/lift/blur effects are interruptible
and bounded. An unchanged value does not restart an animation. First appearance
is opt-in. Reduced motion, disabled/covered owners and hidden documents settle
directly; resuming does not replay settled changes.

Apply it to shared segmented labels/options, comparison/seller/coverage headings,
filter words/counts/errors, empty-result explanations and the destination hotel
prompt. Existing content presence supplies finite filter-overlay entrance/exit.
Fence retained forms by their actual open generation and live ownership so old
submit, clear, edit, cancel and Escape events cannot affect a reopened panel.

Leave native input values, typing, selection/caret/IME, native select options,
current monetary facts and ticket rows immediate. Do not add per-card text
animation owners to the48-card list or change search/referral/data semantics.
Use theme tokens and existing flat motion. This is a presentation refinement;
M7 remains partial29/35 and T30 active.

Source/native verification, limitations and independent review are recorded in
the checkpoint.
