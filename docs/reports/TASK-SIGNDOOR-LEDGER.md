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

---

## Facts (query + number, as run)

**F1 — SIGNSTRIP is merged.** `git log --grep=SIGNSTRIP` → `82293696 merge task/signstrip`,
`911aa440 SIGNSTRIP verification`. Prerequisite met; branched from `origin/main` @ 911aa440.

**F2 — spec path drift.** `src/pages/Onboarding.tsx` does not exist. The file is
`src/pages/app/Onboarding.tsx` (1788 lines).

**F3 — ⚠️ THE SPEC'S TRAP 3 IS WRONG, AND IT WAS THE ONE THAT MATTERED.** The spec says the
path survives as the person's STANDING CATEGORIES. It does not. `my_standing_categories()`
reads `groups`; `groups` is written only by `apply_affiliations()` = `derive_affiliations()`,
which derives RIDER/HORSE_OWNER/GUEST from EXECUTED DOCUMENTS, PURCHASES and HORSES. A
brand-new door signup has none of the three. Proven on production in a rolled-back transaction:

```
BEGIN;
INSERT INTO contacts (org_id, first_name, last_name, email)
  SELECT id, NULL, NULL, 'signdoor-probe@example.invalid' FROM organizations LIMIT 1;
SELECT derive_affiliations(:id);                             -- (empty)
SELECT apply_affiliations(:id);                              -- {}
SELECT array_agg(group_type) FROM groups WHERE contact_id=:id; -- {}
ROLLBACK;
```
Gating the post-auth minor question on categories would have hidden it from EVERY door
signup — the AR7 incident, reintroduced. The path actually lives on `invitations.categories`
(+ `invitations.document_id` for `deal`).

**F4 — the spec's §5.3 premise is also wrong, harmlessly.** It says `attach_minor_to_guardian`
was "lifted OUT of `update_my_onboarding_profile`" and I must "put the CALL back".
`update_my_onboarding_profile` on production ALREADY calls it (line 77 of its body), and
`Onboarding.tsx` already sends `has_minor` / `minor_*`. Only the toggle's SHAPE (checkbox,
defaulted to "self") and its path gating were missing. Nothing was put back.

**F5 — trap 1 (provisioning nameless) is a non-issue, proven.** The `INVITATION` email template
merges `ORG.BRAND_NAME`, `ORG.FOOTER`, `MSG.IS_RESEND`, `MSG.AGREED_TIME`, `MSG.CONTRACT_TITLE`,
`MSG.OFFERING_LABEL`, `MSG.CHECKLIST`, `MSG.LINK`, `MSG.EXPIRES_ON` — no name token exists.
`_ensure_client_account` inserts `first_name = nullif(trim(coalesce(p_first_name,'')),'')`, i.e.
NULL, not a placeholder — so `needsName` post-auth is true and the form asks.

**F6 — `invitations.kind` cannot identify the deal door.** `select kind, count(*) from
invitations where deleted_at is null group by 1` → `COMMUNITY|22`. All of them. `document_id`
is the discriminator (1 of 22 rows), and `invite_contract_counterparty` is its only writer.

## Decisions I made that the spec did not
1. **The path is carried on `invitations.categories`, read back by a new
   `sign_path_for_contact(uuid)`, and surfaced as `my_onboarding_state().sign_path`.** Forced by
   F3. Reuses the INCUMBENT `_sign_path_for_categories()` — no new column, no second concept.
2. **An UNKNOWN path fails OPEN to asking the minor question.** Not asking is the incident;
   asking a horse owner an extra question is not. Only `horse` and `deal` are silent.
3. **A guardian who already has a minor attached is always asked, and the server always lets
   the attach through.** Otherwise an edit to an existing child would be dropped in silence.
4. **`correct_claimant_name_from_signup` is NOT called on a funnel any more** (there is no name
   to correct) and is NOT retired — `deal` still calls it.
5. **The post-auth address stays REQUIRED for everyone**, as it already was. Loosening it is a
   product decision and is not mine.

## Commits
- `docs/reports/TASK-SIGNDOOR-LEDGER.md` — the ledger
- `supabase/migrations/20260901T1120_the_sign_path_survives_to_the_first_page_after_auth.sql`
  — APPLIED TO PRODUCTION, ACLs verified (`{postgres=X/postgres,service_role=X/postgres}`)
- `api/sign-start.ts` + `src/pages/SignStart.tsx` — the door
- `src/lib/api.ts` + `src/pages/app/Onboarding.tsx` — the first page after auth
