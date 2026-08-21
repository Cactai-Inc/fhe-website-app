# TASK-WALK4 — prove today's work actually works, in a real browser

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** Escalate, do not diagnose.

⚠️ **RUNS AGAINST PRODUCTION.** Worktree `~/Downloads/claude-code-repo/wt-walk4` (**already created,
`.env.db` and `.env.test` already in it**), branch `task/walk4` · report to
`docs/reports/TASK-WALK4-REPORT.md` · commit, **do not push** · no subagents.

---

# 1. WHY

**Everything shipped on 2026-08-21 was proven server-side or in tests. Almost none of it has been
seen in a browser.** CONTRACTSEND and LESSONPLAN ran in containers with no credentials and could not
walk anything; SLOTREACH likewise. **The owner needs to run his business on this tomorrow.**

⚠️ **jsdom passed the date bug** — it accepts any string as a date value, so the broken code was
green in tests and red in Chromium. **That is why this walk exists and why "tests pass" is not the
answer to "does it work."**

---

# 2. PHASE 0
Playwright, worktree-local (`wt-walk4/walk4-tooling/`, own `package.json`, `.gitignore` of `*`).
⚠️ **Never touch the repo's `package.json`.** Credentials in `.env.test`. **Never echo one.**
Screenshots → `docs/reports/walk4-shots/`, decision points only, one per step, no DOM dumps.

# 3. RULES OF ENGAGEMENT
1. Identities: `admin@fhequestrian.com` (staff) + a fresh `cjzigs+walk4-<yyyymmddHHMM>@icloud.com`,
   last name **`WALKTEST`**. Never sign in as `cjzigs@` itself (D1).
2. ⚠️ **NEVER touch a real client's record, booking, order or document. 60 executed documents are
   EVIDENCE.** List every row you create.
3. Money: **Zelle and cash only, never a card.**
4. **Escalate, do not diagnose.** Record what you saw, what you expected, the step. Do not open
   `src/` or query the DB to explain behaviour.
5. **Build activation links from `invitations.token`** — never wait on an inbox.

# 4. THE WALK — today's four shipments, in dependency order

## §A — a contract, end to end, ZERO database writes
**This is CONTRACTSEND's unmet acceptance criterion.** Author a lease, add a party, fill **every**
field including **a date** (the bug fixed today), **confirm the horse** (the control that could never
render), lock, and **sign from both sides**. ⚠️ **If you need a single direct DB write to finish,
the task failed — say so.**
Also: **New Contract must leave no orphan rows**, and **list production's existing orphans** (query
in the CONTRACTSEND report; **report them, do not delete**).

## §B — the counterparty's side
The counterparty signs in and: sees the contract, sees and acts on a **change request** (Accept ·
Reject · Withdraw — they are labelled *Agree* and *Edit*, **not** Accept/Reject), and tries
**Suggest**. ⚠️ **CONTRACTSEND could not diagnose why counterparty Suggest fails silently and left a
lead in its report. Reproduce it precisely** — what was clicked, what appeared, what the network did.

## §C — sell and schedule a recurring lesson
Buy a **2x Weekly Lesson**, declare **cash**, then **pick two days and times**. Reach it **both**
ways: the order-page link (`?step=slots`) and the **permanent standing-time bar on the member's
Calendar**. ⚠️ **Two standing lessons per week must appear**, and **must exist a month ahead** with
no scheduler running. ⚠️ **`remaining` = 0 is correct.**

## §D — staff sets a slot, and changes announce themselves
As staff, set/change a client's standing slot from the **contact dossier**. Then **reschedule and
cancel as staff** — WALK2 found staff-side actions fired **zero** notifications; today's migration
closed that. **Confirm a notification appears for both.**

## §E — the lesson-plan loop
Author a plan for the WALKTEST rider at **`/app/ops/lessons/plans`**. Confirm **the day's Riding
Lesson carries it**. **Record progress** with text and a photo. **Confirm the NEXT lesson leads with
the updated plan.** ⚠️ **That roll-forward is the whole feature — if it does not happen, nothing else
in §E matters.**

## §F — naming and notifications throughout
⚠️ **D25: nothing may say "booking" to a human.** Record every place that still does.
Record all three channels at every stage — client dashboard, admin dashboard, **email to both**.
⚠️ **`emailed_at` is always NULL and proves nothing.** Email works. **List every message that should
have arrived — step, subject, recipient, time — for the owner to confirm.**

---

# 5. THE TEST THIS MUST PASS
1. **A lease signed by both parties with ZERO direct database writes** — or an explicit statement of
   what blocked it.
2. Counterparty Suggest **reproduced**, with exactly what happened.
3. **Two standing lessons per week, a month out**, reachable both ways.
4. **Staff reschedule and cancel each produce a notification.**
5. **The plan loop closes** — next lesson shows the update.
6. Every "booking" said to a human is listed.
7. **No real client row touched**; executed count still 60 plus only what you created.
8. Every stop recorded with its reason.

# 6. REPORT
`docs/reports/TASK-WALK4-REPORT.md`. **Lead with: can the owner run his business on this tomorrow —
yes or no, and if no, the shortest list of what stops him.**
