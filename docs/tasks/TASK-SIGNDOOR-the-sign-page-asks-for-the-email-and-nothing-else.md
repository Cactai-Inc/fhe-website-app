# TASK-SIGNDOOR — `/sign/*` asks for the email address and nothing else

**Source:** CR-98 steps 1–3 (the door half). **Authored by DSGN-2, 2026-09-01.**
**Standing requirements:** `docs/method/TASK-ROLE.md`. **Must merge first: `TASK-SIGNSTRIP`**
(same file — building this on the un-stripped page is a guaranteed conflict).

## 1 · THE OWNER'S WORDS
> *"the purpose of this page is purely to capture the initial information for the setup of an
> account, it was supposed to only ask for their email address. then it prints a notification to
> check their email account for the link to click to setup their account, with the spam notice and
> the report issue link at the bottom."*

And step 3 of his flow: the personal-information form is the **first page after auth** — *"the
MINIMUM the DOCUMENTS require."*

## 2 · MEASURED (2026-09-01, main @ 475f1724 — re-run, don't trust)
- `src/pages/SignStart.tsx` carries **14+ `<input>`s**: name, phone, email×2, address×5, and the
  FIX1 minor block (radio + minor name/dob) on minor-allowed paths.
- `api/sign-start.ts` takes the full body, then: rate-limits per requester hash (10/hr), provisions
  via `provision_client_invitation` (same RPC as admin-send-invitation), writes typed details via
  `fill_claimant_details` (blanks-only), attaches minors via `attach_minor_to_guardian()` — which
  was **lifted OUT of `update_my_onboarding_profile` on 2026-08-31** (`20260831T0910`) — and sends
  the shared invitation email (`api/_lib/invitationEmail.ts`; a resend is the SAME link).
- The confirmation half **already exists**: `SendStateScreen` renders the real send outcome with the
  spam notice (`SignStart.tsx:264–265, :351`) and the report-issue escape hatch (`/api/signup-help`
  escalates from `signup_attempts`). **Keep it; do not rebuild it.**
- Step 2 (auth setup) is **already built and correct**: `Register.tsx` gates Google vs password by
  email domain via `src/lib/emailAuthMethod.ts` (owner spec 2026-07-25: gmail → Google only, known
  non-Google → password only, ambiguous → both). **Out of scope beyond verifying the link lands there.**
- The post-auth `details` step exists: `Onboarding.tsx` step machine (`:90`), writes through
  `updateMyOnboardingProfile`.

## 3 · THE INCUMBENT — convergence, not greenfield
The door (`SignStart.tsx` + `api/sign-start.ts`) and the post-auth `details` step both exist. This
task **moves capture from the first to the second** — nothing new is invented.

## 4 · WHY THIS IS ONE CHUNK AND NOT TWO
Slimming the door and widening the post-auth form are the **same move on the same data**: every
field the door stops asking must be asked post-auth, or a parent cannot enroll a child and D22's
address rule breaks. Splitting them across two merges opens a window where NEITHER side asks. One
thread, one merge, no window.

## 5 · THE WORK
1. **The four funnel paths ask for EMAIL (+ confirm) only.** Submit → `SendStateScreen` exactly as
   today: real outcome, spam notice, report-issue link.
2. **`api/sign-start.ts` slims to `{ path, email, confirmEmail }`** for the funnels: still
   rate-limited, still anti-enumeration, still provisioning through `provision_client_invitation`,
   still recording `signup_attempts`. Name/phone/minor/address fields go.
3. **The capture moves to the post-auth personal-info step** (`Onboarding.tsx` `details`): name,
   phone, the FIX1 minor question (radio, no default) with minor name/dob on minor-allowed paths,
   address where required. Writes through the existing spine: `updateMyOnboardingProfile` /
   `fill_claimant_details` semantics, and **`attach_minor_to_guardian()` — the same RPC, called from
   the new place. Do not create a second minor concept** (it was lifted out of
   `update_my_onboarding_profile` two days ago; you are putting the CALL back, not the logic).
4. **`deal` path: UNCHANGED in this task.** Its form serves a different purpose (find an existing
   contract; address prints on it — D22). Flagged ASK-OWNER in the DSGN-2 handoff; do not decide it
   here.

## 6 · THE TRAPS
1. ⚠️ **Provisioning with no name.** `provision_client_invitation` and the invitation email have
   always received a name. Verify the email template renders decently nameless, and that
   `fill_claimant_details`' blanks-only rule means the post-auth form fills what the door left blank
   — the whole design depends on that property.
2. ⚠️ **FIX1/AR7 must not regress.** The minor question moved to the door because onboarding got it
   wrong once. Moving it back post-auth is fine ONLY because post-auth the account is provably the
   guardian's (email verified). Keep the no-default radio; keep `MINOR_PATHS` server-side re-decision.
3. ⚠️ **The path must survive the trip.** Which docs and categories apply is decided by the `/sign/*`
   path (step 3: *"rider → participant docs"*). The door already maps path → standing categories at
   provision time — confirm that mapping still fires with the slim body, or the post-auth flow
   cannot know what to ask.
4. ⚠️ **Anti-enumeration holds**: identical response shape for new and returning emails; rate limit
   keyed on requester hash, never the email. The slim body makes this EASIER to break by accident —
   re-read the header comment in `api/sign-start.ts` before touching it.
5. **`test/browser/sign-start.tsx` / `probe-sign-minor.mjs`** exercise the current form — they will
   need rewriting to the new shape, and the minor probe must move to the post-auth step.

## 7 · OUT OF SCOPE
Wizard resequencing (docs/offering/calendar order — TASK-SIGNBOOK), payment anything, staff
anything, `deal`, `Register.tsx` beyond verifying the emailed link lands there.

## 8 · THE REACH
`/sign/rider` (and guest, horse, rider+horse), public. Post-auth: the emailed link → `Register.tsx`
→ first page after auth is the personal-info form.

## 9 · THE TELL
The visitor sees one email box, then "check your email" with the spam notice and report link. After
auth, the personal-info form greets them by asking — not assuming — who is signing up. **Undo:** git
revert; the RPCs are untouched, only call sites moved.

## 10 · THE TEST THIS MUST PASS
1. Each funnel path renders exactly the email capture (count the `<input>`s: 2) and submits
   successfully; `SendStateScreen` shows outcome + spam notice + report link. *(owner step 1)*
2. The emailed link opens the auth-setup page with method gated by domain — gmail address shows
   Google, hotmail shows password. *(owner step 2 — verify, already built)*
3. First page after auth asks name/phone(/address where required) and the minor question on
   minor-allowed paths; a parent can enroll a child end-to-end and the minor lands via
   `attach_minor_to_guardian` (query the row). *(owner step 3, FIX1 held)*
4. A brand-new email and an already-known email get byte-identical response shapes from
   `/api/sign-start`.
5. `signup_attempts` still records every attempt; `/api/signup-help` still escalates.
6. `deal` path diff: zero.
7. Typecheck, build, `test/browser` sign pages green.

## 11 · THE REPORT
`docs/reports/TASK-SIGNDOOR-REPORT.md` — each test item with the command/query and output.
Worktree from the first edit.
