# 0060 — Remove the rejected word scramble

Date:2026-10-30. Owner rejected the scramble and requested undoing its
implementation. Reinstate decision0058 and specification1.29 exactly.

Restore the seven pre-existing source/test files changed by1223274 to their
71d0624 bytes; remove its two scramble-only test additions, including the partial
undo conflict inside the E2E file. Remove the optional scramble APIs, hidden
sizers, consumer opt-ins and its test-double adaptation. Preserve all earlier
smooth fade/lift/width transitions, finite filter panels, authority/focus guards,
reduced-motion behavior and the large-ticket-list work.

Remove the obsolete active0059 decision and mark its master entry reverted.
Historical evidence remains archived with an explicit withdrawn status. No
scramble effects are retained. This supersedes the owner’s previous permission
for this implementation. No unrelated source, dependencies, runtime data or
Docker configuration changes. No push or deployment.

[Rollback checkpoint](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/undo-word-scramble/checkpoint.md).
