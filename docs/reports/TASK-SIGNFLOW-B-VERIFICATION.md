# TASK-SIGNFLOW-B — VERIFICATION (ORCH, 2026-09-02)
**Verdict: VERIFIED AND MERGED** (2c3a0492), **fourth door ACCEPTED.**
**Scope ruling (ORCH):** the spec's §5 "verified: no address fields" on `CaptureInfoModal` was a
false premise; the thread corrected against reality per TASK-ROLE second act. Stripping it would
leave one door writing the same contact record unnormalised — the D39 half-built pattern. Accepted.
**Checked independently in wt-3:** the four kinds + exact-key-before-substring arms in
`normalize.ts` (the `'capacity'.includes('city')` trap is closed); wiring present in
`Onboarding.tsx`, `SignStart.tsx`, `CaptureInfoModal.tsx`, `ContactDossierModal.tsx`; the
on-change `.toUpperCase()` is gone from `SignStart` (the one grep hit is the comment recording
its removal); unit tests 42/42.
**The three remaining unnormalised writers (report §5.2 — ProvisionClientForm:558, ContractIntake:193,
ContractPage:1973): FOLLOW-UP TASK, not an amendment** — B is closed and never reopened; ContractPage
is in SIGNFLOW-C's green list, so the follow-up is `FHE-TASK-SIGNFLOW-F`, specced by a DSNR-profile
task and sequenced AFTER C merges.
Gates after the triple merge: typecheck 0 · typecheck:api 0 · lint 45w/0e (one warning RETIRED with
D's deleted files) · build clean · test:api 7/7.
