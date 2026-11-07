# Selected verification evidence

The current tree keeps concise release summaries, selected final startup/SSO/
activity receipts and six representative captures. This is a curated index;
individual counts belong to their named runs, with their original limitations.

- [Current reviewer startup, activity and SSO](adjustments/referral-activity-history/checkpoint.md).
- [Final independent source/evidence review](adjustments/referral-activity-history/resume-20261107/automatic/final-evidence-review.md).
- [Six accepted reviewer journeys across two runs](adjustments/referral-activity-history/resume-20261107/automatic/browser-acceptance.json).
- [Fresh Docker data and image binding](adjustments/referral-activity-history/resume-20261107/automatic/clean-release-runtime-before-browser.json).
- [Representative activity](adjustments/referral-activity-history/resume-20261107/browser-history-release-002/activity_history_evidence_dir/current-month.png), [source lineage](adjustments/referral-activity-history/resume-20261107/browser-history-release-002/activity_history_evidence_dir/referral-trail.png), [passport disclosure](adjustments/referral-activity-history/resume-20261107/browser-release-001/passport_sso_evidence_dir/international-created.png).
- [Baseline release/accessibility/performance index](release/README.md).
- [Attribution and submission boundaries](T34/submission-and-attribution.md).

The owner subsequently requested removal of bulky files from Git history. Only
selected current receipts/captures are retained here. Older report references
that are now plain text identify removed artifacts; the complete raw archive is
no longer promised or shipped. Historical summaries describe their original
named runs, including their failures and limitations.

Original source IDs inside these captured receipts remain original identifiers.
Use the [commit map](../history-commit-map.txt) and
[history policy](../history-rewrite.md) to locate rewritten source equivalents.
This does not turn older verification into a new run against rewritten commits.

Generate new evidence in `.local/evidence/<specific-run>/`, which is ignored by
Git and Docker. Preserve authentication/privacy sanitization and use a separate
named output folder for each run; do not point tools at broad parent folders.
