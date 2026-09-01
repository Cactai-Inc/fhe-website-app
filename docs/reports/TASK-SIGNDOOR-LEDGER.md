# TASK-SIGNDOOR — running ledger

## RESUME
Role / thread   TASK-SIGNDOOR · wt-1 · branch task/signdoor
Merge-base      911aa440 (== origin/main at checkout; TASK-SIGNSTRIP merged, prerequisite met)
DONE            CLNR pass (deferred — see below); spec read-back; premise verification (§ Facts)
IN FLIGHT       nothing yet — about to edit
NEXT            migration: my_onboarding_state returns sign_path; then SignStart slim, api slim,
                Onboarding radio, tests
DECIDED         see § Decisions
BLOCKED         nothing
DO NOT          Do NOT gate the post-auth minor question on my_standing_categories() /
                fetchMyCategories(). PROVEN EMPTY for a door signup (§ Facts F3). The spec's
                trap 3 points there; it is wrong. The path lives on invitations.categories.

---

## ZEROTH ACT — CLNR pass: DEFERRED, not skipped
`docs/reports/CLNR-1-LEDGER.md` is untracked in the MAIN worktree, mtime 2026-09-01 10:43, i.e.
three minutes before this thread started (10:46). Its RESUME block reads
`IN FLIGHT full census (§3 step 1)`. **A CLNR-1 thread is live right now.**
`CLNR-ROLE.md` §3 NON-NEGOTIABLES: *"NEVER MOVE A FILE UNDER A RUNNING THREAD."* So this thread
moved, renamed and archived NOTHING, and ran no competing sweep. Read-only observations only:
- `wt-signstrip` is merged (`f4f67133` is an ancestor of `origin/main`) and clean and still on disk
  — a §4 trigger. CLNR-1 owns it; not touched.
- `src/pages/Onboarding.tsx` (cited by the spec) does not exist; the file is
  `src/pages/app/Onboarding.tsx`. Spec-path drift, reported below, not fixed by moving anything.

## FIRST ACT — the spec, read back
**What I understand the task to be.** The four funnel doors (`/sign/guest|rider|horse|rider+horse`)
stop asking for anything except the email address (+ confirm). Submit still goes to
`/api/sign-start`, still rate-limits on the requester hash, still provisions through
`provision_client_invitation`, still assigns the door's paperwork, still records `signup_attempts`,
still sends the same invitation email, and still renders the EXISTING `SendStateScreen` with the
spam notice and the report-issue link. Everything the door stops asking — name, phone, the FIX1
minor question, address — is asked on the FIRST page after auth, the `details` step of
`src/pages/app/Onboarding.tsx`, through the RPC spine that is already there.

**What I will change.** `src/pages/SignStart.tsx` (funnel branch only), `api/sign-start.ts` (funnel
branch only), `src/pages/app/Onboarding.tsx` (the minor question becomes a no-default radio, gated
by the path the visitor came in by), `src/lib/api.ts` (one field on `OnboardingState`), ONE
migration (`my_onboarding_state` returns the path; `update_my_onboarding_profile` re-decides the
minor rule server-side), and the two sign tests.

**What I will NOT change.** `deal` — its form, its API branch, its `fill_claimant_details` /
`correct_claimant_name_from_signup` / `invite_contract_counterparty` calls stay byte-identical.
`SendStateScreen`. `DeliverabilityPanel`. `Register.tsx` / `emailAuthMethod.ts`. The wizard
sequence. Payment. Staff surfaces. `attach_minor_to_guardian` itself.

## SECOND ACT — the premises, re-run
See § Facts. Three of the spec's premises are wrong; one materially.
