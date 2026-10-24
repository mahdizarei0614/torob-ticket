# TorobTicket working agreements

Read docs/superpowers/specs/2026-10-24-torobticket-design.md and the current task
brief before implementation. The specification is authoritative; record
implementation rulings in the SDD ledger and docs/decisions.

- Persian/RTL consumer, English admin, LTR transport codes.
- Demo comparison/referral only. No payments, booking claims, real OAuth,
  external provider integration, fabricated conversion metrics, or runtime LLM.
- All authored UI colors and shader colors use semantic theme tokens.
- Never import server/database/provider code into browser libraries.
- Preserve unknown conditions and provenance; use whole-party/stay totals.
- Keep each reviewer's mutable data isolated on the server.
- Use meaningful behavior tests, actual verification evidence, and independent
  task reviews. Record commits and evidence in the master tracker.
- Do not push, publish, deploy, or submit an application without instruction.

## Automatic market-build versioning

Owner instruction, 2026-10-11: when a market build is requested, choose the
highest applicable semantic bump from changes since the previous market build:
patch for small fixes/changes, minor for substantial changes/features, major for
breaking compatibility. This also applies before 1.0. Every newly requested
market build gets an increase; unchanged new builds default to patch. Choose
once for the complete artifact set; retries retain the chosen version.
Synchronize manifests/metadata and increment Android build codes separately.
Explicit owner version instructions take precedence. A rules-only task does
not change versions or start a build.
