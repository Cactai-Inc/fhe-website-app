# TASK-WALK1 — visitor to booked lesson, on the LIVE SITE, with a real browser

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** It operates on production with real credentials,
creates real rows and sends real email. Judgement about when to STOP is the main requirement.

⚠️ **THIS RUNS AGAINST PRODUCTION.** The owner authorised it: *"yea test the live site."* Every row
you create is real, every email you send actually goes to somebody, and there is no undo.
**Read §3 (RULES OF ENGAGEMENT) before you open a browser.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-walk1`, branch `task/walk1` ·
report to `docs/reports/TASK-WALK1-REPORT.md` · commit, **do not push** · no subagents ·
**TEARDOWN:** kill every browser and dev process; process census in the report.

---

# 1. WHY — the first browser walk this project has ever run

**Nothing in this app has ever been opened in a browser and written down.** Every render claim in
every report is marked NOT VERIFIED. The owner: *"i can give you login access to run the app for
real because i dont have time to test manually and we need to test everything."*

**This walk answers the question that reshapes everything after it: does email actually work?**
Production says **46 notifications, 0 ever emailed** and **2 proven sends, ever**. WALK2 (company
side) and WALK3 (contracts) are specced *after* this returns, because if mail is dead the rest of
the matrix changes shape.

---

# 2. PHASE 0 — TOOLING (commit alone, before touching the site)

No browser automation exists in this repo — **verified: no Playwright, Puppeteer, Cypress or
Selenium in `package.json` or `node_modules/.bin`.** Install **Playwright** in the worktree only.

⚠️ **Do NOT add it to the repo's `package.json` dependencies.** This is test tooling for a walk, not
a project dependency — a stray dependency in `package.json` deploys to Vercel. Keep it worktree-local
and say in the report exactly what you installed and where.

**Credentials** live in **`.env.test`** at the repo root (owner-supplied, gitignored — same pattern
as `.env.db`). **Never echo a credential into the report, a commit, a screenshot, or the terminal.**
If `.env.test` is absent, **STOP and report** — do not proceed and do not ask for it in chat.

**Screenshots** to `docs/reports/walk1-shots/`, named by step. **Redact any credential or real
third-party personal data before committing a shot.**

---

# 3. RULES OF ENGAGEMENT — production safety

1. **One unique test identity per run, on the OWNER'S OWN INBOX so he can confirm receipt.**
   Owner, 2026-08-20: *"i can [confirm emails], I suggest you use cjzigs@icloud.com or some
   variation of that the way you did before so i get the emails but they are all unique individual
   test accounts."*
   **Use `cjzigs+walk1-<yyyymmddHHMM>@icloud.com`** — plus-addressing delivers to the owner's real
   inbox while giving every run a distinct address, so no two walks collide on one account.
   **Last name `WALKTEST`.** Record the exact address in the report's first line, and **list every
   row it created** so the set is purgeable.
   ⚠️ **`cjzigs@` is a D1 protected test identity — do NOT sign in as it or alter its records.**
   You are borrowing its *inbox* via plus-addressing, not its account.
   ⚠️ **Confirm plus-addressing survives the signup path** before relying on it — if any step
   normalises or rejects the `+`, that is itself a finding worth reporting, and you should fall back
   to a distinct address the owner supplies rather than reusing one.
   **The owner is the human verifier for email.** When a message should have arrived, say so
   explicitly in the report — subject, expected time, which step — so he can confirm or deny it
   from his own inbox rather than you guessing.
2. **NEVER touch a real client's record.** Read them, never write them. The production purge of
   2026-08-17 is why this rule exists.
3. ⚠️ **MONEY — STOP AND ASK.** It is unknown whether Stripe is in live or test mode.
   **Do not submit a card payment until the orchestrator confirms the mode.** If a flow demands
   payment to continue, prefer the **Zelle/cash path** (staff-confirmed, no card). If neither is
   possible, **STOP at that step and report** — a real charge on a real card is not recoverable by
   you.
4. **The signing freeze:** the owner directed contract signing as part of this programme, so it is
   lifted **for the WALKTEST identity only**. **Never sign, alter or execute a real client's
   document.**
5. **Email really sends.** Only ever to the WALKTEST address or the owner's own. Never to a client.
6. **If anything is destructive, ambiguous, or would touch real data — STOP and report.**
   A half-finished walk with an honest stop beats a complete walk that damaged production.

---

# 4. THE WALK — in the owner's order

## §A — the web visitor books a lesson
Public site as an anonymous visitor: the lessons funnel end to end, through the question engine, to
submission. **Record what the visitor sees at every step, and what arrives by email.**

## §B — the direct link: `/sign/rider`
**This URL has never been used once — 0 `signup_attempts` rows in production, ever.** Open it cold,
as a texted link would arrive. Complete the form. **Then follow the email**: activation link → set a
login → land wherever it lands. **Record where it lands and whether that is right.**

## §C — the authenticated calendar, both credit states
The owner's requirement: *"which should support a purchase flow if the user clicks the book button
and doesnt have credits they add credits, no need to make them go through the catalog."*
1. **With NO credits** — click Book. **Does a purchase flow appear in place, or is the user
   deflected to the catalog?** The second is a defect; record which happens.
2. **With credits** — click Book and complete a booking. Confirm the credit is debited and the
   booking appears on the calendar.

## §D — every lesson choice, and the same choices in the app
**Measured in production, 2026-08-20 — all 9 active `RIDING_LESSON` offerings:**

| offering | price | kind | units / freq |
|---|---|---|---|
| Single Lesson | 150.00 | scheduled | 1 |
| Single Lesson (With your horse) | 120.00 | scheduled | 1 |
| Evaluation Lesson | 170.00 | scheduled | 1 |
| 4-Lesson Punch Card | 500.00 | scheduled | 4 |
| 8-Lesson Punch Card | 950.00 | scheduled | 8 |
| **1x Weekly Lesson** | 460.00 | **recurring** | freq 1 |
| **1x Weekly Lesson (With your horse)** | 420.00 | **recurring** | freq 1 |
| **2x Weekly Lessons** | 880.00 | **recurring** | freq 2 |
| **2x Weekly Lessons (With your horse)** | 780.00 | **recurring** | freq 2 |

**Every one must appear on the website AND in the app, with the same name and price.** Build the
comparison as a table in the report — website column, app column, match yes/no.

⚠️ **The four `recurring` offerings are the owner's "monthly memberships" and get particular
attention.** For each: what is minted, over what period, with what expiry, and **what the user is
told they have bought.** Relevant context, to verify rather than assume: recurring credits are
minted by the `mint-monthly-allotments` cron, **and no cron has ever been observed running** —
so establish whether the first month's entitlement arrives at purchase or waits for a cron that
may never fire. **This is the single most valuable finding available in this walk.**

## §E — notifications, watched throughout, not as a final step
At every stage record **all three channels**: the **user's dashboard**, the **admin dashboard**, and
**email to both**. Production baseline: `notifications` holds 46 rows with **`emailed_at` NULL on
every one**. **Establish whether that changes when a real action happens.** For each notification:
did a row appear · did a dashboard show it · did an email arrive · how long did it take.

---

# 5. OUT OF SCOPE — these are WALK2 and WALK3

- The company side: confirming, revising, cancelling, authoring, inviting (**WALK2**).
- Reschedule and cancel per lesson type (**WALK2**).
- Contracts: signing, editing, suggesting changes, cancelling from both party sides; doc controls;
  Add New Item (clause / subsection / section); inserts and tokens; comments (**WALK3**).
- **Any code fix.** This walk changes no application code. Findings are recorded, not repaired —
  a fix mid-walk invalidates every step after it.

---

# 6. THE TEST THIS MUST PASS

1. **A real browser drove the live site.** Screenshots prove it, one per numbered step.
2. **The WALKTEST identity is named in the report**, and every row it created is listed so it can be
   purged.
3. §B is answered: **what happens when a never-before-used signup URL meets a real person**, from
   cold link to landed session.
4. §C is answered for **both** credit states, and says plainly whether the no-credits path buys in
   place or deflects to the catalog.
5. **All 9 lesson offerings** appear in the website-vs-app comparison table, each marked match or
   mismatch.
6. **The four recurring offerings each have a stated answer** to: what was minted, when, expiring
   when, and whether it required a cron that has never run.
7. **The email question is answered outright**, with times: *does mail send from this system, yes or
   no.* If yes, list every message received. If no, say at which step it should have fired.
8. Every notification observed is recorded across all three channels.
9. **Every stop is recorded with its reason** — a stop is a result, not a failure.

# 7. THE REPORT

`docs/reports/TASK-WALK1-REPORT.md`, opening with: the test identity · whether mail works · the
single most important finding. Then the walk, then **flagged-not-fixed**, then teardown.
