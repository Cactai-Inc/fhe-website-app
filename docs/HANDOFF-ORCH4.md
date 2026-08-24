# HANDOFF → ORCH4

## WHERE YOU ARE — read this before anything else

```
repo          /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch        main            fd5a899f (clean, pushed)
database      Supabase project lrstswfxfsezdmvkvukc — connection string in .env.db (line 1)
worktrees     wt-pamela (~/Downloads/claude-code-repo/wt-pamela) — TASK-PAMELA, COMPLETE,
              NOT YET AUDITED OR MERGED. Branch task/pamela, head 1720fb9d, 3 commits, not
              pushed. This is your first job — see §3.
platform      macOS. Every path above is absolute and real; nothing is a placeholder.
```

⚠️ **`cd` into the repo first.** A fresh session often starts in `/Users/Cactai` or `~/Downloads`,
not the repo — every relative path here and in `ORCHESTRATOR.md` resolves only from the repo
root. **`.env.db` holds the real production connection string; direct `psql` is how everything
gets verified.** Worktrees need `.env.db` and `.env.test` copied in explicitly at creation — they
are gitignored and do **not** propagate from the main checkout.

---

**Written by ORCH3 at its own close, 2026-08-24, for the thread that replaces it.**
**This file instructs. It is not a status report.** If you finish reading it and still have to
ask the owner how to operate or what to do first, this file failed and you should fix it rather
than answering in chat.

**Read `docs/ORCHESTRATOR.md` first for the role** (it does not change). This file is what is
true right now, and — per the owner's own request at the close of this thread — is written as a
**full accounting**, not just a pointer list: everything worked on, everything decided, everything
still open, and how the owner actually works. Long, deliberately. Nothing here should have to be
re-derived by asking him again.

---

# 1. THE STATE OF THE APP, IN ONE PARAGRAPH

The database and RPC layer remains the correct, expensive half of this app — that assessment from
ORCH2/ORCH3's start still holds. What changed materially this session: **the surface layer got
substantially less broken.** A real, working, data-correct staff dashboard exists for the first
time (`/app/dashboard`, TASK-DASHBOARDBUILD) and has been iterated on live with the owner all
session — toggle redesigned twice, KPIs fixed to hide when empty, the lead-follow-up loop
actually closes now, the account-provisioning form no longer hinges everything on sending an
email. A genuine admin-side IA refactor is now in motion with real, reviewed specs
(`docs/design/refactor/`), not just a wish. **The single biggest live risk right now is that
`TASK-PAMELA` — a real, verified-by-its-own-thread body of work — sits merged nowhere,** and your
very first act should be auditing and merging it before anything else, per the owner's explicit
instruction at handoff time.

---

# 2. WHO YOU ARE, AND THE THREE ABSOLUTES

**You orchestrate. You do not build**, except a genuinely small (2-3 line), fully-specified,
uncontended change — and even then, verify against live production/code first, every time.

1. **Never spawn a subagent for FHE build work.** Author a spec, hand the owner a two-line prompt,
   he runs the thread. This rule has been violated before and is expensive when it is.
2. **Verify before asserting.** Query production. Read the actual file. This session caught two
   concrete instances of a prior thread's doc asserting something false — see §7.
3. **Never trust a self-reported "done."** Every single task merged this session was verified by
   direct query against production, not by reading the report and believing it. Every one of them
   held up under that scrutiny — which is itself worth knowing: **the threads this owner runs are
   good.** Verify anyway. It is not distrust, it is the job.

---

# 3. WHAT TO DO FIRST — the owner's own words, do not reorder

> **Owner, 2026-08-24, at this thread's close:** *"it will start with a review of everything we
> are about to do for the refactor and a review of the last thread that ran the pamela task set
> which is complete and just needs that thread to review it."*

**Step 1 — audit and merge TASK-PAMELA.** Worktree `wt-pamela`, branch `task/pamela`, 3 commits,
report at `docs/reports/TASK-PAMELA-REPORT.md`. The spec is
`docs/tasks/TASK-PAMELA-account-save-and-the-horse-fields-a-contract-actually-needs.md` — read it
in full first, it carries the owner's exact words for both parts and the corrections made to it
mid-flight (the "everything except name/microchip/registration is a dropdown" rule was this
thread's own overreach, corrected before the build ran — read that correction, don't rediscover
it). Audit exactly like every other merge this session (§6): diff against merge-base, verify the
headline claims with your own query, verify the reach, typecheck/lint, then merge, push, archive-
tag, remove the worktree.

**Step 2 — review the refactor bundle.** `docs/design/refactor/` — four current documents
(`ADMIN-IA.md`, `ADMIN-PAGE-SPECS.md`, `ADMIN-WAVES.md`, `PROGRESSION-PLAN.md`) plus a
`prior-thread-2026-08-20/` subdirectory with an earlier, partially-superseded proposal and its own
README explaining exactly where the two disagree. **Do not treat this as settled and ready to
run.** §8 below lists what is still genuinely open in it, including one significant unfinished
finding (a real `lesson_plans` engine already exists in production and `PROGRESSION-PLAN.md`'s
relationship to it has not been fully reconciled — see §8).

---

# 4. THE FULL ACCOUNTING — everything worked on this session, in the order it happened

This session ran from roughly 2026-08-22 through 2026-08-24. It picked up mid-stream from prior
ORCH3 work; what follows is this stretch only. Everything below is merged to `main` and pushed
unless stated otherwise.

## 4.1 TASK-AUTHORITY — one booking owner, one credit write path

Written earlier, never run, verified stale-but-still-true before sending. Backfilled
`bookings.account_contact_id` from `client_id` (33 rows), added a derive trigger so it never
drifts again, voided one orphan test credit grant, added `audit_bookings` coverage.

**The real finding was narrower than the doc's own wording:** there was nothing to repoint in
`src/`/`api/` reads — the actual bug was `bookings_self_read`'s RLS policy keyed on
`account_user_id` (populated on only 3 of 43 bookings), which is the literal mechanism behind
"I couldn't reach the booking from her account." Fixed and verified live by simulating a real
client session: 3 of 12 reachable bookings before, 12 of 12 after. Also found and removed a
second, fully dead, unimported copy of the same wrong credit-write path sitting in `src/lib/api.ts`
since before a module split.

## 4.2 TASK-DEALAUTO + its follow-up — deals auto-generate, the bundle sequences in, the
scheduler that never ran

**First pass:** deals now open on `contracts` INSERT rather than needing a human to author one —
verified live, 7 auto-generated deals, zero manually authored. The bundle (horse vet auth + care
release) now sequences in immediately behind whichever signature executes the governing document,
one email carries the whole signing set. Found and fixed a real production defect underneath the
task: every client-signed document run since 2026-08-20 had been silently failing delivery
(`deliver_executed_document_set` rejected the execution trigger's own call — `SECURITY DEFINER`
does not change `auth.uid()`).

**Follow-up pass**, same day, three owner rulings: (F1) each party's copy now carries only the
documents they're actually a party to — the first real run had leaked the lessor's signed release
to the lessee. (F2) horse-document authority now correctly inverts on a sale — a lease leaves
ownership with the lessor, a bill of sale moves it to the buyer, and the generator now follows
that; found a real defect in the process — `apply_contract_execution_effects` never called
`ensure_horse_documents` in its sale branch at all, so every sale ever written left the new owner
with no vet authorization on file. (F3) there is now a real scheduler —
`.github/workflows/scheduled-jobs.yml` — because **zero of Vercel's five declared cron jobs had
ever fired, ever** (Hobby plan likely caps at 2 daily, the repo asked for 5 hourly). You (this
session) confirmed the fix live: triggered the workflow by hand via `gh workflow run`, watched it
fail once (GitHub's copy of `CRON_SECRET` didn't match Vercel's), fixed the secret, re-ran,
watched it succeed, and it flushed a real backlog of 10 held documents on the spot.

⚠️ **Stated plainly because the follow-up thread said so too:** a lease or sale can now be
executed by someone who has not signed a participant liability release. This was asked of the
owner directly before being built, not assumed. Still true; not revisited since.

## 4.3 TASK-DASHBOARDBUILD — two real dashboards, then a full day of live iteration on them

The big one. Built the owner-dashboard the ground-up plan called for: two views (Head Trainer /
Business Operations) behind a per-account default and a session-only toggle, 16 zones each backed
by one named RPC, self-hiding when empty, and — the single most consequential fix —
`revenue_summary()` replacing `calendar_revenue` as the *only* revenue computation in the app.
Verified live: the old function said **$15,600** for August; the correct one says **$1,510**. The
old one was counting unpaid orders, double-counting credit-covered sessions, counting standing-
slot sessions minted months into the future, and recognizing at session date instead of payment
date — four independent ways to be wrong, all at once, for the app's entire life.

**Then a full day of the owner actually using it and correcting it live**, all shipped as small,
direct, verified fixes in the main checkout (not worktree threads — each was 2-20 lines, fully
specified, no ambiguity left):

- Zero-value KPI tiles now hide, same rule as an empty zone: *"no KPI's should be shown... when
  the value is zero, theres nothing to show."*
- The view toggle rebuilt **twice**. First pass: renamed "Head Trainer"/"Business Operations" to
  "Claire's Dashboard"/"CJ's Dashboard", dropped the role-pill badge, dropped the "this is/isn't
  your default" caption, dropped the "change my default view" shortcut link, reflowed the header
  (toggle top-right next to the greeting, date moved down and enlarged). Second pass, same day:
  rebuilt again into a single small peek button — "Show Claire's Dashboard" at home, becomes a
  plain X once you've toggled away, click X to return. *"it's not even a secondary action... it
  doesn't need to be a full size UI element."*
- The activity read-back zone (B6) collapses by default — one-line summary, click to expand.
- **The landing surface was completely broken and is now fixed.** Two real bugs, both found by
  reading the mechanism, not guessing: the "already landed" flag lived in `sessionStorage` scoped
  to the browser tab, not the login, so a reused tab silently skipped the fresh-arrival redirect;
  and the 30-minute-away redirect only listened for `document.visibilitychange` (tab-switching),
  which never fires when a tab just sits open and unfocused-on while the owner steps away — the
  exact case he described. Fixed: `AuthContext`'s `SIGNED_IN` handler now clears the flag on every
  login, and real activity tracking (pointer/key/wheel/touch) plus a 60s poll now catch genuine
  idle time regardless of tab-switching.
- **The lead follow-up system was showing false "overdue" notices for people who had already
  converted to clients.** Traced to the exact root cause: `dash_people_waiting()`'s query never
  checked conversion status, so it disagreed with the one correct definition of "converted"
  already living in the `inbound_queue` view (used correctly elsewhere in the app). Fixed by
  reusing that view, not re-deriving the check. Then found something better while fixing it: a
  full "mark contacted" + notes system (`markRequestContacted`, `appendRequestNote`) already
  existed, built for a page (`IntakePage`) that was retired months ago and never carried forward —
  genuinely unreachable, not missing. Reused both functions, wired a "Mark contacted" button plus
  an optional single-click note field directly onto the dashboard. 16 → 1 genuinely open inquiry
  on production, verified.
- Records' "All" tab removed — it aggregated only contact types (leads/clients/partners/vendors),
  never the horses/documents/lessons/deals/files sitting right next to it in the same strip, so it
  never actually showed "all" of anything. Default tab changed to Leads (was Clients, is now
  Leads — "that is the most important thing i could see is a person who wants to work with us").
- The public header's glass background ported into the app header (owner asked, with one flagged
  tradeoff: a prior deliberate 2026-08-08 ruling removed exactly this for a documented technical
  reason — the fix went in anyway per direct instruction, tradeoff recorded inline in the CSS).
  Avatar ring thickened from 1px to 2px — it didn't read as a clickable control at 1px.
- The "parties are selected, never created here" banner removed from the new-contract page — it
  had become stale guidance once TASK-PAMELA's horse-intake modal made inline creation real.

## 4.4 TASK-CREDITGRANT — hand-write, comp, and bill are one order, not a second write path

The named follow-up TASK-AUTHORITY deferred. Three modes (hand-write a credit, comp one with the
loss recorded as a real dollar figure not an invisible zero, bill one with a real "request
payment" action), all three built as **one order with three prices**, reusing the existing
purchase/fulfillment engine rather than writing anything new onto `lesson_credits` directly —
verified live by reading the actual function body: zero write statements against `lesson_credits`
anywhere in `grant_lesson_credit()`. Also found: `_mint_credits_for_purchase_item` never actually
read `payment_status` at all, only `status <> 'draft'` — so the "bill" mode's credits mint
immediately not because of any new rule, but because the existing gate already produced that
behavior once someone actually looked at it.

## 4.5 The production test-data purge

6 WALKTEST/STABTEST identities, 5 ZZZ-prefixed horses, and everything hanging off them across 22
tables — 617 audit_logs rows, 154 document_parties, 84 documents, all 7 rows that existed in
`deals`. Modeled on `purge_account`'s own discipline (children-first deletes, dry-run in
`BEGIN…ROLLBACK` first) rather than repurposing that function itself, since it's structurally
scoped to only the owner's two real test emails. Took five iterations of the dry-run to find every
FK the initial script missed (`signup_attempts`, `request_alert_sends`, `horse_relationships`
`source_document_id`, `documents.contact_id` directly rather than only through `document_parties`)
— **that iteration is exactly the discipline working, not a sign it was done carelessly.** Final
verification confirmed zero remaining references anywhere. Three unrelated, older test identities
(`inviteworks`, `averify2`) were correctly left untouched — never in scope.

## 4.6 TASK-PAMELA — see §3. Complete, unaudited, your first job.

Two parts. **Part A**, reframed mid-spec by the owner from "add a save button" to the real
defect: *"every account hinges on activation and it shouldnt... truly the activation is when i
create an account."* The client's own password/token claim is a separate, later, optional event
from the account actually existing. **Part B**, also corrected mid-spec: the horse-in-contract
fields bug was diagnosed as "everything except name/microchip/registration must be a dropdown" —
the owner corrected this to the real test (does the value need to MATCH something, or does it
just display as typed) before the thread built anything, and separately ruled that whatever was
rendering the bad 8-field experience gets **deleted**, not repaired — replaced by a modal
containing the real, already-correct `HorseIntakeForm`, with a bidirectional lessor↔horse-owner
sync on save. Read the actual report before assuming either part is done exactly as first
specified; both were corrected before the build ran.

## 4.7 The activity-log investigation, close of session

The owner reported hundreds of identical "Offering / Pending" rows flooding the full activity
log and suspected test debris. **It is not test debris.** Traced fully: `entity_type='offering'`
in `status_events` is a misleading name for "this is a `bookings.id`," and `trg_status_bookings()`
fires on every booking insert or status change regardless of whether the booking has a client —
so every time the app (re)generates a batch of future open availability slots, it also floods the
general activity feed with one meaningless row per slot. **This is the exact same root cause as
the "standing open spots" the owner already ruled should disappear from the calendar** (§4.8/
`ADMIN-PAGE-SPECS.md`'s Calendar section) — the calendar rebuild removes the cause; a small,
not-yet-built filter fix on the activity feed's own query would stop it from surfacing client-less
slots regardless of when that rebuild ships. **Offered, not built** — see §8.

## 4.8 The refactor initiative

Two threads produced design material, one handing off to the other:

**The 2026-08-20 thread** (`docs/design/refactor/prior-thread-2026-08-20/`) proposed a flat
8-area rail (Today · Schedule · People · Horses · Money · Documents & Deals · Operations ·
Settings), touching member app, public `/sign/*`, and superadmin, plus a full new layout-primitive
kit (`src/ui/`) and a tiered "Commit" component for value-moving actions.

**The 2026-08-24 thread** (`docs/design/refactor/ADMIN-IA.md` etc.) narrowed scope to staff/admin
only — matching the owner's direct instruction earlier this session ("this will only be a refactor
of the admin side for me and Claire for now") — and restructured the rail into 4 nested zones
(Dashboard · Work · Community · Admin, Claire sees 3, CJ sees 4).

**This thread's review, verified against live code before writing anything down:**
- **The older thread's IA doc contains a real factual error**: it claims `Admin.tsx` has zero
  imports and marks it dead. It has exactly one importer, `RecordsPage.tsx`, and is the live
  Clients tab — the exact file TASK-PAMELA just edited.
- **The newer thread inherited a related error**: `ADMIN-IA.md` lists `OwnerDashboard.tsx` as a
  retirement candidate pending an import check. That check, run for real, shows it's imported by
  `DashboardChrome.tsx`, `api-dashboard.ts`, and `DashboardHome.tsx` — it **is** this week's
  actual dashboard (§4.3). Only `OpsDashboard.tsx`, the genuinely dead 2026-07-01 predecessor, is
  correctly retireable. Both corrections are written directly into `ADMIN-IA.md` and
  `ADMIN-WAVES.md` (an appended "ORCH3 notes" section) — don't rediscover them.
- **The primitive kit the newer docs assume (`src/ui/`, the Commit component, the fhe-ui skill)
  does not exist.** Checked directly: neither `src/ui/` nor `.claude/skills/fhe-ui/` are present
  anywhere in the repo. `ADMIN-WAVES.md`'s Wave 0 only names building `PageHeader`, not the rest
  of what `ADMIN-PAGE-SPECS.md` assumes every later wave composes from. **This is a real,
  unaddressed prerequisite gap — see §8.**
- **The Commit pattern (D19 tiers) is still marked "proposed, awaiting owner sign-off" in its own
  source document**, yet every later document treats it as settled fact. No sign-off has actually
  happened anywhere this session saw.
- **The 4-zone rail shape is confirmed, not open.** Owner, 2026-08-24: *"claire gets three and i
  get 4."* Matches `ADMIN-IA.md` exactly.
- **Claire's actual daily use pattern, direct from the owner, folded into `ADMIN-IA.md` §8 and a
  substantially rewritten Calendar section in `ADMIN-PAGE-SPECS.md`:** she lives in two places —
  the Dashboard (pure overview) and the Calendar specifically (not the Work zone broadly — this
  is where she actually operates: creates sessions, opens lesson plans, writes activity notes).
  The Calendar section now specifies, all verified against the live component first: removing the
  visible "standing open slots" entirely (blank calendar, request-based availability); the two
  creation paths (client request → staff approval → payment-if-owed; staff direct-create with
  lesson plan attached at creation); a real, diagnosed bug (`itemLabel()` in `CalendarPage.tsx`
  deliberately shows staff the same opaque "Reserved" label meant for a client viewing someone
  else's private calendar — `isStaff` exists in that component and gates other UI but was never
  passed into this function); `CalendarItemPanel`'s narrow side-panel becoming a full modal on
  desktop; and the activity report as a structurally separate full-page/modal surface from the
  booking/edit UI, never combined.
- **`PROGRESSION-PLAN.md` was expanded with the owner's exact five major milestones** (walk
  off-lead → trot → canter → jump, sequential; group riding as its own invite-gated exception, not
  frontier-computed like the other four) and the full Lesson Plan spec (bidirectional pre-lesson
  notes — Claire writes one the rider reads, the rider writes one Claire reads, a genuinely new
  requirement not in the original draft).
- ⚠️ **Unfinished, found in the last few minutes of this session, not yet reconciled — see §8.**

**Two small, fully-specified, independent tasks are also staged and ready, unrelated to any of the
above:** `docs/tasks/TASK-LANDINGSIGNIN-a-sign-in-path-on-the-landing-page.md` (a Sign In link
missing specifically on the landing page's desktop header) and
`docs/tasks/TASK-SITECOPY-jumper-only-program-not-barn.md` (two copy corrections across public
marketing pages). Neither has a worktree staged yet; both are small enough to send as-is whenever
convenient.

---

# 5. WHO YOU ARE WORKING WITH, AND HOW

**He corrects fast, precisely, and expects the correction captured durably — not just applied
once.** Multiple times this session a spec was revised mid-flight because he caught this thread
over-generalizing his own instruction (the "everything except name/microchip/registration is a
dropdown" rule in TASK-PAMELA is the clearest example — he'd said something narrower and more
principled, this thread flattened it into a blanket rule, and he corrected it before any code
existed). **When that happens: rewrite the spec, don't just note the correction in chat.**

**He thinks out loud in long, dense messages that often contain multiple distinct rulings at
once** — the calendar/progression message in §4.8 alone covered nav structure confirmation,
mobile-nav exploration (genuinely undecided, he used "likely" and "or" three times — don't treat
that one as settled), the two-surface mental model, view-mode preferences, the standing-open-slots
removal, the full request/approval/payment flow, a notification-suppress toggle, the activity-
report-is-separate ruling, a live bug report (calendar labeling), a UI complaint (panel vs modal),
the full lesson-plan spec, and the five major milestones with their sequencing rule — **one
message, extract every distinct ruling, don't just answer the first thing you noticed.**

**He wants verification, not reassurance.** "I thought we established this already" (about the
calendar labeling bug) was him testing whether a previous ruling had actually shipped — it hadn't,
and the right response was tracing the exact function and line, not apologizing.

**He dislikes over-engineering and will say so directly** — "the real goal is to match what the
system needs with input fields the way the system needs the data to be input" is a precise
statement of a general principle (match complexity to actual need), not just a one-off rule about
horse fields. Read his corrections for the general principle underneath, not just the specific
fix.

**He values small, immediate fixes done directly over spec-and-delegate ceremony** for anything
genuinely small — the header CSS, the KPI zero-hiding, the toggle rebuilds, the banner removal
were all done in this thread, in the main checkout, verified, committed, and pushed within the
same turn he asked. Reserve worktree-thread delegation for things with real ambiguity or scope,
not everything.

**He is mobile-primary for Claire specifically** — "she does most things on her phone" is a real
design constraint stated directly, not incidental color. Weight mobile UX decisions accordingly
when they affect her surfaces.

**Focus mode is on.** Only your final text message per turn is visible to him — tool calls, and
text between them, are not. Front-load anything he needs to know into that final message; don't
assume he saw your reasoning.

---

# 6. HOW TO AUDIT WHAT COMES BACK — unchanged from `ORCHESTRATOR.md`, restated because it is
the single most load-bearing habit this session ran on

Every task merged this session (§4.1–4.4, and TASK-PAMELA once you've done it) was verified this
way, every time, no exceptions:

1. Locate the worktree, check `git log` for the actual commits, check `git status --porcelain`.
2. Dry-run the merge (`git merge --no-commit --no-ff`) to confirm no conflicts before committing
   to anything.
3. **Read the report in full.** Then **verify the headline claims yourself** — direct `psql`
   query against production for every number the report cites, not a re-read of the report's own
   claim. Simulate a real session (`SET request.jwt.claim.sub`, `SET role authenticated`) when a
   claim depends on RLS/identity, exactly like this thread did for Madeline Do's booking visibility
   and CJ's dashboard revenue figures.
4. **Read the live function/component body directly** when a report describes what code does —
   don't trust the description. This is how the `itemLabel()` staff-opacity bug, the
   `Admin.tsx`/`OwnerDashboard.tsx` dead-code errors, and the `lesson_plans` engine (§8) were all
   found — none of them were reported by anyone, all four were found by reading the actual file.
5. Typecheck and lint yourself on the branch, don't trust the report's numbers alone (though in
   every case this session, they matched exactly).
6. Merge with a commit message that states what you verified, specifically — not "looks good."
7. Push, archive-tag (`archive/<name>-<date>`), remove the worktree only after confirming
   `git merge-base --is-ancestor` and a clean `git status`.

---

# 7. WHERE THIS THREAD WAS WRONG OR HAD TO CORRECT ITSELF — carried forward so you neither
repeat it nor inherit it as fact

| the claim or action | the correction |
|---|---|
| Initial TASK-PAMELA spec: "everything except name/microchip/registration is a dropdown" | Owner corrected: the real test is whether the value needs to MATCH something, not a blanket rule. Farrier/vet stay free text under the correct test — they were never the actual problem. |
| Initial TASK-PAMELA spec: "redesign the horse-card fields in place" | Owner corrected: delete that code entirely, replace with the real `HorseIntakeForm` in a modal. Don't design a second implementation next to (or in place of) a correct one — D18 applies to UI as much as RPCs. |
| First dashboard-toggle rebuild (renamed labels, dropped chrome, kept a two-button segmented control) | Owner asked for a second, more radical simplification the same day: one small peek button, not two options. The first pass was a real improvement and still wrong in shape — don't assume one correction closes the topic. |
| Assumed the "IA-tree" document referenced earlier this session was permanently lost to compaction | It came back, twice, once as a full ten-document bundle pasted directly as attachments. Don't treat "I don't have this anymore" as permanent — ask, or wait, rather than working around a gap that might close on its own. |
| Read `ADMIN-IA.md`'s claim about `OwnerDashboard.tsx` and almost took the "RETIRE (after import check)" phrasing at face value | Ran the import check for real before accepting it. It was wrong. **Always run the check the document itself says to run — a document telling you to verify something is not the same as it having been verified.** |

---

# 8. WHAT IS OPEN — the real register, not a status recap

## 8a. Immediate

- **TASK-PAMELA** — audit and merge. §3.
- **The activity-log filter fix** — offered to the owner, not yet built or declined. Small,
  direct, matches the calendar's own standing-open-slots ruling. Confirm intent, then it's a
  same-turn fix (exclude `entity_type='offering'` rows with no client attached from
  `status_feed()`'s query), not a task spec.
- **`TASK-LANDINGSIGNIN` and `TASK-SITECOPY`** — ready to send, no worktree staged, zero
  dependency on anything else. Send whenever.

## 8b. The refactor — genuinely unresolved, in order of how much it blocks

1. **A real `lesson_plans` engine already exists in production and has never been reconciled
   against `PROGRESSION-PLAN.md`'s proposal.** Found in the last minutes of this session, while
   investigating the activity-log noise (`record_lesson_progress` references it). Verified: the
   `lesson_plans` table (versioned, supersession-tracked, one-current-per-client, an `objectives`
   jsonb array, `focus` and `coach_notes` fields, referenced by `booking_forms.plan_id`) is fully
   built, wired to real RPCs (`record_lesson_progress`, `_lesson_plan_for_booking`,
   `_current_lesson_plan`, `save_booking_form`), and has **zero rows** — built, correct,
   completely unexercised. `PROGRESSION-PLAN.md` as currently written proposes a SKILL /
   RIDER PROGRESS / FRONTIER / MILESTONE model that may substantially overlap with this — or may
   be exactly the missing structured layer this existing, simpler `objectives`-array engine needs
   sitting on top of it. **This has not been investigated deeply enough to know which, and it
   needs to be, before any Lessons/Progression wave gets specced or sent — building a second
   lesson-plan mechanism beside a correct, if unused, one is precisely the D18 failure this
   project's own history is full of.** Start by reading `record_lesson_progress`'s full body (only
   partially read this session), `_lesson_plan_for_booking`, `_current_lesson_plan`,
   `save_booking_form`, and `scrub_lesson_content` (the second function found referencing this
   entity type, not yet read at all), and figure out why a real, correctly-built engine has zero
   rows — is it unreachable (D17), or genuinely never tried?
2. **The primitive kit gap.** `src/ui/` and `.claude/skills/fhe-ui/` do not exist.
   `ADMIN-PAGE-SPECS.md` assumes every rebuilt page composes from a kit that has not been built,
   and `ADMIN-WAVES.md`'s Wave 0 only explicitly names `PageHeader`. Resolve before Wave 0 runs:
   either add an explicit "build the kit" step, or get an owner ruling that a lighter approach is
   fine for a refactor of the *current* app (D30 says this refactor is NOT the ground-up rebuild —
   worth weighing whether the full primitive-kit ambition from the 2026-08-20 thread is even the
   right size for that framing).
3. **Commit-tier (D19) sign-off never actually happened.** `01-DESIGN-SYSTEM.md` still says
   "proposed, awaiting owner sign-off" in its own header. Get an explicit yes/adjust before
   building it as a shared primitive everything else calls.
4. **The mobile nav treatment is genuinely undecided** — fixed bottom bar (as currently spec'd)
   vs. footer nav vs. subheader vs. a floating quick-access button. The owner was exploring, not
   deciding, when he raised it. Don't build any of the four without asking which.
5. Smaller open threads inherited from the 2026-08-20 doc and not yet re-confirmed under the
   newer, narrower scope: the mixed-inquiry filter derivation, the exact Sessions→Bookings naming
   (largely superseded by the newer docs' own naming, worth a final check), whether
   `/app/ops`'s module launcher has a real replacement plan for every hub it's currently the only
   reach to (flagged explicitly in `ADMIN-IA.md`'s dispositions list — don't let Wave 0 retire the
   launcher without confirming this).

## 8c. Flagged-not-fixed, inherited from merged tasks this session — real, just not urgent

- DEALAUTO F4 (a `pg_net` 15s timeout that succeeds but logs a false failure — harmless, noted for
  whoever next touches that code path), F5 (delivery hold rule (a) is deliberately still overly
  broad), F6 (`create_deal` is dead code, left callable on purpose as an escape hatch).
- A staff JWT can still write `lesson_credits` raw via PostgREST directly — the frontend write
  path is closed (TASK-CREDITGRANT) but the DB-level door isn't. Feeds an existing item on the
  owner's DECIDE sheet; not a new one.
- Five legacy RPCs still key booking ownership through `client_id` alone, proven harmless today
  and kept that way by TASK-AUTHORITY's new derive trigger, but not yet repointed to
  `account_contact_id` as the sole source of truth.
- Three pre-existing UI bugs named across multiple reports, none fixed yet: `contacts.display_name`
  doesn't exist as a column but `Admin.tsx:589` selects it, so the Clients page 400s on every
  load; a `threads`/`profiles` FK mismatch means Community's author-list can never resolve; and
  `TeamPage`'s save-confirmation vanishes on 4 of 5 panel controls because the page's `onChanged`
  handler always closes the panel on success.
- `email_templates` has no editor at all — a pre-existing D13 gap, 22 templates wide, that
  `PAYMENT_REQUEST` (TASK-CREDITGRANT) inherited rather than created.

---

# 9. LOAD-BEARING RULES YOU MUST NOT REDISCOVER

Everything in `ORCHESTRATOR.md` §2 still applies without exception. Restated here only where this
session found a new instance or a sharper phrasing:

- **A document telling you to verify something is not the same as it having been verified.**
  §7's last row. Run the check yourself even when the document claims it already ran one.
- **`OwnerDashboard.tsx` is this week's live dashboard. `OpsDashboard.tsx` is the dead 2026-07-01
  predecessor. They are not the same file and do not share a fate.**
- **`Admin.tsx` is the live Clients tab, one importer (`RecordsPage.tsx`), not dead code.**
- **A gitignored `.env*` file does not propagate to a new `git worktree` — copy `.env.db` and
  `.env.test` in explicitly, every time, at creation.**
- **A migration with its own `BEGIN`/`COMMIT` self-commits during what was meant to be a
  dry-run.** Never write one that way.
- **`test:db` red is the documented baseline, not proof of anything.** Verify against production
  with direct SQL, always.
- **Stage explicit file paths. Never `git add docs/` or `git add -A`.**
- **Check `git log --oneline -15` for a live thread on any file before touching it yourself.**

---

# 10. READING LIST — in this order

1. `docs/ORCHESTRATOR.md` — the role.
2. This file, in full — you're already here.
3. `docs/tasks/TASK-PAMELA-account-save-and-the-horse-fields-a-contract-actually-needs.md` and
   `docs/reports/TASK-PAMELA-REPORT.md` — your first real work.
4. `docs/design/refactor/ADMIN-IA.md`, then `ADMIN-PAGE-SPECS.md`, then `ADMIN-WAVES.md` (read its
   appended "ORCH3 notes" section, it's load-bearing), then `PROGRESSION-PLAN.md`.
5. `docs/design/refactor/prior-thread-2026-08-20/README.md` — context for the older documents,
   read the older documents themselves only if you need the primitive-kit detail (§8b item 2).
6. `CLAUDE.md` — the live spine and every settled D-rule. D32 (retention) and D26 (dashboards) are
   the two this session leaned on most.

**Do not read** `docs/HANDOFF-ORCH3.md`, `docs/ORCHESTRATOR-HANDOFF.md`, `docs/HANDOFF.md`,
`docs/HANDOFF-CHECKLIST.md`, or `docs/SESSION_HANDOFF_2026-08-07.md` — all superseded, all
history. If any load-bearing fact from them still mattered, it is repeated in this file.

---

# 11. THE PROMPT THAT SPAWNS YOU

```
FHE-ORCH-4

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/HANDOFF-ORCH4.md, then docs/ORCHESTRATOR.md, and take over.
```

**Opus 5 · thinking ON · effort HIGH.**

⚠️ **The `cd` line is not optional.** A fresh session does not know which repo it serves.
