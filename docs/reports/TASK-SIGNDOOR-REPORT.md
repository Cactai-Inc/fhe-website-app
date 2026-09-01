# TASK-SIGNDOOR — report

**Thread:** TASK-SIGNDOOR · `wt-1` · branch `task/signdoor` · merge-base `911aa440`.
**Spec:** `docs/tasks/TASK-SIGNDOOR-the-sign-page-asks-for-the-email-and-nothing-else.md`.
**Running record:** `docs/reports/TASK-SIGNDOOR-LEDGER.md`. **Not pushed. ORCH merges.**

## THE HEADLINE
The four funnel doors now render exactly two inputs — email and confirm email — and POST
exactly `{path, email, confirmEmail}`; `/sign/deal` is byte-identical in what it renders and
sends. Name, phone, address and FIX1's minor question are asked on the first page after auth,
where the minor question is now a **no-default radio pair** instead of a defaulted checkbox.
**The spec's trap 3 was wrong and it was the load-bearing one:** the path does NOT survive as
standing categories (proven empty on production for a door signup), so a migration carries it
on the invitation instead — without which this task would have re-created the AR7 incident.
**30/30 browser assertions pass; typecheck, typecheck:api, lint and build are clean.**

## CLNR PASS — deferred, and why
**Not clean, and not swept by me: a `CLNR-1` thread was LIVE.** `docs/reports/CLNR-1-LEDGER.md`
was untracked in the main worktree with mtime `2026-09-01 10:43`, three minutes before this
thread started, its RESUME block reading `IN FLIGHT full census`. `CLNR-ROLE.md` §3:
*"NEVER MOVE A FILE UNDER A RUNNING THREAD."* So I moved, renamed and archived nothing and ran
no competing sweep. **CLNR-1 has since finished and pushed** (`cb60d466`, `895f2cb9`) — dead
handoff lineage archived, two misfiled docs relocated, the worktree pool recycled to cap.
**Zero overlap with my change set**, so the merge is clean:

```
$ comm -12 <(git diff --name-only $(git merge-base HEAD origin/main) HEAD | sort) \
           <(git diff --name-only $(git merge-base HEAD origin/main) origin/main | sort)
(no output)
```

## CRITERION BY CRITERION

### 1 · Each funnel path renders exactly the email capture (count the `<input>`s: 2) and submits successfully; `SendStateScreen` shows outcome + spam notice + report link ✅
`node test/browser/probe-sign-minor.mjs` — the REAL `SignStart` in a real Chromium (D17):
```
── the door: /sign/* ──
PASS  /sign/guest — exactly the email capture (2 inputs: sign-email, sign-confirm-email)
PASS  /sign/guest — no name, no phone, no address, no minor question
PASS  /sign/rider — exactly the email capture (2 inputs: sign-email, sign-confirm-email)
PASS  /sign/rider — no name, no phone, no address, no minor question
PASS  /sign/horse — exactly the email capture (2 inputs: sign-email, sign-confirm-email)
PASS  /sign/horse — no name, no phone, no address, no minor question
PASS  /sign/rider+horse — exactly the email capture (2 inputs: sign-email, sign-confirm-email)
PASS  /sign/rider+horse — no name, no phone, no address, no minor question
PASS  /sign/rider — Continue is disabled until the two addresses agree
PASS  /sign/rider — and enabled once they do
POSTed body: {"path":"rider","email":"newrider@example.com","confirmEmail":"newrider@example.com"}
PASS  payload — three keys and no more: path, email, confirmEmail
PASS  send state — the real outcome names the address
PASS  send state — the spam notice is there
PASS  send state — the report-issue escape hatch is there
```
`SendStateScreen` was **not rebuilt** — it is the same component, reached by the same
`setOutcome`, and the spam notice and `/api/signup-help` escape hatch are the same lines.

### 2 · The emailed link opens the auth-setup page with method gated by domain *(verify only)* ✅
Unchanged and untouched — `git diff` names neither file. `src/pages/Register.tsx:13,91` imports
and calls `authMethodForEmail(invitedEmail)` from `src/lib/emailAuthMethod.ts`, whose header
states the 2026-07-25 owner spec verbatim: gmail/googlemail → `'google'`; a known non-Google
consumer mailbox → `'password'`; anything else → `'both'`. The link the funnel emails is
`${origin}/activate?token=${out.token}` (`api/sign-start.ts:381`), which is the same URL the
staff invitation flow sends and lands on that page. **The only thing this task changed about it
is that the token now belongs to a nameless contact**, which Register does not read.

### 3 · First page after auth asks name/phone(/address) + the minor question on minor-allowed paths; a parent can enroll a child end-to-end and the minor lands via `attach_minor_to_guardian` ✅
**The rendering half** — the real `Onboarding` in a real Chromium, `sign_path` driven by fixture:
```
── the first page after auth: /app/onboarding `details` ──
PASS  sign_path=guest — minor question PRESENT (radios=2) [Who is visiting? *]
PASS  sign_path=rider — minor question PRESENT (radios=2) [Who will be riding? *]
PASS  sign_path=rider+horse — minor question PRESENT (radios=2) [Who will be riding? *]
PASS  sign_path=horse — minor question ABSENT (radios=0)
PASS  sign_path=deal — minor question ABSENT (radios=0)
PASS  sign_path=horse WITH a minor already attached — the question renders, prefilled to "My child"
PASS  sign_path=rider — NO DEFAULT: neither radio is checked on arrival
PASS  sign_path=rider — the rider block is hidden until the question is answered
PASS  sign_path=rider — Save is disabled while the question is unanswered
PASS  sign_path=rider "Me" — no rider block (the self-serving adult is unchanged)
PASS  sign_path=rider "Me" — the name field is still just "First name"
PASS  sign_path=rider "My child" — the account holder's field says YOUR first name
PASS  sign_path=rider "My child" — the rider block renders: first, last, date of birth
PASS  sign_path=rider "My child" — a DOB of 18+ is refused at the field
PASS  sign_path=rider "My child" — Save stays disabled while the DOB is 18+
```
**What the form actually sends** (read off `window.__rpc`, not off the source):
```
update_my_onboarding_profile payload: {
  "phone": "(619) 555-0100", "date_of_birth": "1985-03-02",
  "address_street": "1 Test Way", "address_city": "San Diego",
  "address_state": "CA", "address_zip": "92109",
  "emergency_contact_1_name": "Someone Else", "emergency_contact_1_relationship": "Sibling",
  "emergency_contact_1_phone": "619 555 0199",
  "first_name": "Test", "last_name": "Parent",
  "has_minor": true, "minor_first_name": "Test",
  "minor_last_name": "Child", "minor_dob": "2015-01-01"
}
PASS  payload — the ACCOUNT HOLDER is the parent
PASS  payload — the MINOR travels separately, with a date of birth
PASS  payload — switching back to "Me" sends NO minor key at all, even after one was typed
```
**The database half, on production, rolled back** — the path resolves, the guard opens, and
the child lands through the same RPC the door used to call:
```
BEGIN;
-- a RIDER door signup exactly as api/sign-start now provisions it: NAMELESS
INSERT INTO contacts (org_id, first_name, last_name, email) … NULL, NULL, 'signdoor-parent@…'
INSERT INTO invitations (…, contact_id, categories) … ARRAY['RIDER']

guardian                             |path |asks_the_question|groups_the_spec_wanted_to_use
2853fc76-1008-4650-9c39-d7084b16bc5c |rider|t                |{}

SELECT attach_minor_to_guardian(<guardian>, 'Test', 'Child', '2015-01-01');
id                                   |first_name|last_name|date_of_birth|guardian_contact_id
0eb59530-e7a2-493c-a96e-0be7f90fc9d3 |Test      |Child    |2015-01-01   |2853fc76-1008-4650-9c39-d7084b16bc5c

UPDATE invitations SET categories = ARRAY['HORSE_OWNER'] …
horse_path|asks_the_question
horse     |f
ROLLBACK;
```
⚠️ **Note the fourth column: `groups = {}`.** That is the spec's trap-3 mechanism, empty, for
exactly the person it was supposed to serve. See "WHERE THE SPEC WAS WRONG".
⚠️ **The seam I could not cross:** `update_my_onboarding_profile` raises without `auth.uid()`,
and no worktree has a login, so the wrapper itself is not exercised end-to-end here. The probe
proves the payload that reaches it; the SQL proves what it does with that payload; the render
checklist below is the owner's one click that joins them.

### 4 · A brand-new email and an already-known email get byte-identical response shapes ✅
There is **one** success return in the handler and every field in it is unconditional:
```
api/sign-start.ts:427   return res.status(200).json({ ok: true, status, attemptId, nameApplied });
```
`nameApplied` is assigned in exactly two places — `let nameApplied = false` (:229) and
`nameApplied = Boolean(dealFixed)` (:261), which is **inside the `isDeal` branch**. So on a
funnel it is now structurally always `false`, for a new address and a returning one alike; the
`correct_claimant_name_from_signup` call that could vary it is gone from the funnel because the
field that fed it is gone. `status` is decided by OUR send, never by whether the address was
known (`provision_client_invitation` treats a repeat as the resume path and returns a token
either way), and `rate_limited` is keyed on `sha256(ip|user-agent)`, never the email — both
unchanged. **The slim body made this property stronger, not weaker: the one field that used to
vary between a first and a second submission from the same requester no longer exists.**

### 5 · `signup_attempts` still records every attempt; `/api/signup-help` still escalates ✅
`record_signup_attempt` is still called once per request, outside every branch, in its own
try/catch so a recording failure cannot fail a signup (`api/sign-start.ts:395`). Its
`p_first_name` / `p_last_name` / `p_phone` are now null on a funnel, which is the truth about
what was submitted rather than a gap. `api/signup-help.ts` is **untouched**:
```
$ git diff origin/main --name-only | grep -c signup-help
0
```

### 6 · `deal` path diff: zero ✅
```
PASS  /sign/deal — the full form is untouched (10 inputs)
PASS  /sign/deal — still never asks the minor question (a deal party must be 18+)
```
All ten inputs (`sign-first`, `sign-last`, `sign-phone`, `sign-email`, `sign-confirm-email`,
`sign-address1`, `sign-address2`, `sign-city`, `sign-state`, `sign-zip`) render as before, in
the same order. The endpoint's deal branch — `find_claimable_contract`,
`fill_claimant_details`, `correct_claimant_name_from_signup`, `invite_contract_counterparty`,
`CONTRACT_INVITE` — is unchanged line for line.
⚠️ **Honest qualification: the deal SOURCE did change, though its behaviour did not.** Two JSX
blocks are now wrapped in `{isDeal && (…)}` and two labels lost a `{isForChild ? … : …}`
ternary whose condition was already permanently false on `deal`. There was no way to slim a
shared component without touching the lines around the branch. The rendered output, the
validation and the POST body are identical, and that is what the two assertions above check.

### 7 · Typecheck, build, `test/browser` sign pages green ✅
```
$ npm run typecheck      → tsc --noEmit -p tsconfig.app.json   (no output, exit 0)
$ npm run typecheck:api  → tsc --noEmit -p tsconfig.api.json   (no output, exit 0)
$ npx eslint .           → ✖ 46 problems (0 errors, 46 warnings)
$ git stash; npx eslint . → ✖ 46 problems (0 errors, 46 warnings)   # identical baseline
$ npm run build          → vite build + prerender + seo-files, "wrote dist/sitemap.xml and dist/robots.txt"
$ node test/browser/probe-sign-minor.mjs → ALL PASS  (30 assertions)
```

## THE REACH
- **The door.** `/sign/:path` → `src/App.tsx` route → `src/pages/SignStart.tsx:340`
  (`export default function SignStart`). Public, no auth. The form is at `:528` and the only
  control that submits is `Continue` (`:735`), which calls `submit()` (`:412`) → `POST
  /api/sign-start`. `SendStateScreen` (`:196`) replaces the form on any outcome.
- **The link.** `api/sign-start.ts:381` — `${origin}/activate?token=${out.token}` → the
  `/activate` route → `src/pages/Register.tsx:91`, method gated by
  `authMethodForEmail(invitedEmail)`.
- **The first page after auth.** Activation lands the new account on `/app/onboarding` →
  `src/pages/app/Onboarding.tsx:323`. The load effect reads `my_onboarding_state()` (`:590`);
  with `needed: true` and no purchase it sets `step = 'details'` (`:674`), which renders the
  form at `:1132`. The minor question is the fieldset at `:1151`, gated by `asksMinor` (`:413`)
  = `!NON_MINOR_PATHS.has(state.sign_path) || Boolean(state.minor)`. The only control that
  commits is `Save & continue to documents` (`:1381`) → `saveDetails()` (`:782`) →
  `update_my_onboarding_profile` → `attach_minor_to_guardian`.
- **Is that the only way?** For the funnels, yes. `/sign/*` is the sole public door and the
  `details` step is the sole pre-signing profile form; `AppLayout`'s wall redirects an
  unonboarded member back to it.

## FLAGGED, NOT FIXED
- The details form requires a **full address from everyone**, including a `guest` who will
  never have a contract — stricter than D22 §0 and than the door ever was.
- `useFormDraft` restore in `Onboarding.tsx` was spreading the WHOLE draft into `form`, so
  `update_my_onboarding_profile` was receiving junk keys. **Fixed here** (it is my file and the
  probe printed it), noted so ORCH sees a fix it did not commission.
- `docs/method/CLNR-ROLE.md` §2b names "the FOUR role files … `ORCH-ROLE.md`"; the file is
  `ORCHESTRATOR.md` and there are six. (CLNR-1 filed the same drift.)

## WHAT I DECIDED THAT THE SPEC DID NOT
1. **The path travels on `invitations.categories`**, read back by a new
   `sign_path_for_contact(uuid)` and surfaced as `my_onboarding_state().sign_path`. Forced by
   the spec being wrong; reuses the incumbent `_sign_path_for_categories()`, adds no column.
2. **An unknown path fails OPEN to asking the minor question.** Only `horse` and `deal` are
   silent. Not asking is the 2026-08-28 incident; asking a horse owner one extra question is
   not. Expressed as a deny-list in both TypeScript and SQL so the default is visible.
3. **A guardian who already has a child attached is always asked, and the server always lets
   that attach through.** Otherwise an edit to an existing child would be dropped in silence.
4. **`correct_claimant_name_from_signup` is not called on a funnel** (no name to correct) and
   is not retired — `deal` still calls it. FIX1 §B's screen line is now unreachable on a funnel
   and is kept for `deal`.
5. **`test/browser/sign-start.tsx` needed no rewrite.** The spec expected one; it mounts the
   real page, so it slimmed with the page. A NEW entry, `onboarding-details.tsx`, was added for
   the post-auth half, following `documents-content.tsx`'s `__rpcFixtures` idiom.

## WHERE THE SPEC WAS WRONG
1. ⚠️ **§6 trap 3 — the material one.** *"The door already maps path → standing categories at
   provision time — confirm that mapping still fires."* It fires, and it is **useless for this
   purpose.** `my_standing_categories()` reads `groups`; `groups` is written only by
   `apply_affiliations()` = `derive_affiliations()`, which derives from **executed documents,
   purchases and horses**. A door signup has none. Proven on production, rolled back:
   `derive_affiliations(<fresh contact>)` → empty, `apply_affiliations` → `{}`, `groups` → `{}`.
   Had I built to the spec, the post-auth minor question would have been invisible to every
   self-service signup — the AR7 incident, reintroduced by the task written to preserve it.
2. **§5.3 / trap 2** — *"attach_minor_to_guardian … was lifted OUT of
   `update_my_onboarding_profile` … you are putting the CALL back."* The call was never absent:
   production's `update_my_onboarding_profile` already invokes it, and `Onboarding.tsx` already
   sent `has_minor` / `minor_*`. What was missing was the FIX1 **shape** (a defaulted checkbox,
   not a no-default radio) and any path gating at all. Nothing was put back.
3. **§2 / §5.3 path** — `src/pages/Onboarding.tsx` does not exist; it is
   `src/pages/app/Onboarding.tsx`.
4. **§6 trap 1** — *"Verify the email template renders decently nameless."* It never had a name
   to render: the `INVITATION` row merges `ORG.BRAND_NAME`, `ORG.FOOTER`, `MSG.IS_RESEND`,
   `MSG.AGREED_TIME`, `MSG.CONTRACT_TITLE`, `MSG.OFFERING_LABEL`, `MSG.CHECKLIST`, `MSG.LINK`,
   `MSG.EXPIRES_ON`. A non-issue, verified rather than assumed.

## THE MIGRATION
`supabase/migrations/20260901T1120_the_sign_path_survives_to_the_first_page_after_auth.sql` —
**dry-run in a transaction, rolled back, verified nothing remained (`count = 0`), then applied
to production.** Two new functions and two `CREATE OR REPLACE`s of existing bodies with
unchanged signatures (no overload, no `DROP`+`CREATE`, so no silent ACL reset). ACLs proven
from `pg_proc.proacl` rather than assumed:
```
proname                 |proacl
_sign_path_allows_minor |{postgres=X/postgres,service_role=X/postgres}
sign_path_for_contact   |{postgres=X/postgres,service_role=X/postgres}
```
No `anon`, no `authenticated` — the BOOKS1 default-privileges trap closed explicitly.
**Undo:** `git revert` the code; the two new functions are additive and unreferenced once the
code is reverted, and both replaced bodies are recoverable from the prior migration files.

## THE OWNER'S RENDER CHECKLIST — run this on your phone
Nothing below is verified by me: no worktree has a login and I never simulate one.
1. **On your phone**, open `/sign/rider`. You should see the welcome line and **one box for
   your email, one to confirm it, and a Continue button** — no name, no phone, no address.
2. Enter an address you can read and submit. You should get **"Your activation email is on its
   way to …"**, the **spam/junk note**, and **"I never received it — tell support"**.
3. Repeat on `/sign/guest`, `/sign/horse`, `/sign/rider+horse` — same two boxes each time.
4. Open `/sign/deal`. **It should still ask for everything it did yesterday** — name, mobile,
   email ×2 and a full address. If anything is missing there, stop and tell ORCH.
5. Open the email on the phone and click the link. A **gmail** address should offer Google
   only; a **hotmail/outlook** address should offer email + password only.
6. Finish setting up the account. The first page should be **"Your details"**, opening with
   **"Who will be riding?"** and **neither option pre-selected**.
7. Choose **"My child"**. The name fields above should relabel to **"Your first name"**, and a
   **"The rider's details"** box should appear asking for the child's name and date of birth.
   Put in a birthday that makes them 18+ — it must refuse and keep Save disabled.
8. Put in a real child's birthday, fill the rest, and Save. Then check the child appears as the
   participant on the paperwork you are asked to sign, with **you** as the signer.
9. Repeat 5–8 from `/sign/horse`. **That one must NOT ask who is riding** — a horse owner is
   18+ by your own ruling.

## TEARDOWN CENSUS
```
$ pkill -9 -f "vite --config test/browser"       # harness server on :5199, started by me
$ ps aux | grep "[v]ite --config test/browser" | wc -l   → 0
$ lsof -i :5199 | wc -l                                  → 0
$ ps aux | grep -c "[C]hromium"                          → 0   # the probe closes its own browser
$ ps aux | grep "[n]ode" | grep "claude-code-repo"       → (no output)

$ git worktree list
/Users/Cactai/Downloads/claude-code-repo/fhe-website-app  b315f488 [main]
/Users/Cactai/Downloads/claude-code-repo/wt-1             caaf2059 [task/signdoor]  ← MINE, unmerged
/Users/Cactai/Downloads/claude-code-repo/wt-2             14140564 (detached, 0 dirty)
/Users/Cactai/Downloads/claude-code-repo/wt-3             14140564 (detached, 0 dirty)
```
Three pool trees, which is the cap — `wt-4` and `wt-5` were recycled away by CLNR-1's sweep
while this thread ran, and neither was mine.
I created no worktree and no scratch branch. `wt-1` was taken from the pool per TASK-ROLE §5
(detached, clean, `.env` + `.env.db` present), branched from `origin/main`, and
`git clean -xdf -e node_modules -e .env -e .env.db` was run before the first edit.
