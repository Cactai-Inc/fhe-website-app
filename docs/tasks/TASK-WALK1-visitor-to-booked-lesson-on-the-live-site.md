# TASK-WALK1 — visitor to booked lesson, on the LIVE SITE, with a real browser

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** Deliberate: the high-stakes decisions are
**pre-decided in §3**, so what remains is disciplined rule-following and accurate recording, not
judgement. **The judgement is escalated, not exercised — see §3.7.**

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

⚠️ **`.env.test` LIVES IN THE WORKTREE, NOT THE MAIN REPO.** It is gitignored, and **a gitignored
file does not propagate to a worktree** — creating it in `fhe-website-app/` leaves `wt-<id>/` without
it. This cost WALK1 three stops. **The orchestrator places it at `wt-<id>/.env.test` directly**, and
the thread reads it from its own working directory.

**Credentials** live in **`.env.test`** at the repo root (owner-supplied, gitignored — same pattern
as `.env.db`). **Never echo a credential into the report, a commit, a screenshot, or the terminal.**
If `.env.test` is absent, **STOP and report** — do not proceed and do not ask for it in chat.

### ⚠️ AUTHENTICATION — do NOT automate Google

The site is **Google-first** at `/login`, but **email + password login is fully wired and is one tap
behind it** (`Login.tsx:18-20,120-130` — *"Google-first: show the large Google button by default;
the email/password [form] is one tap away"*, calling `signInWithPassword`). **Use that.**
**Never attempt to drive Google's OAuth screens** — Google detects and blocks automated browsers,
and a failed attempt can lock or challenge a real account.

**Verified: no MFA factor is enrolled** on `admin@fhequestrian.com` or `hello@fhequestrian.com`
(`auth.mfa_factors` is empty for both), so the TOTP step at `Login.tsx:82-93` is conditional and
will not trigger. **If a verification-code screen appears anyway, STOP** — something changed and the
orchestrator must know.

**Two supported paths, in order of preference:**
1. **`FHE_ADMIN_PASSWORD` in `.env.test`** — click *"Sign in with email and password"*, then submit.
   This is the primary path.
2. **`FHE_STORAGE_STATE=<path>`** — a Playwright `storageState` JSON. If present, **load the session
   and skip the login form entirely.** If the session is dead, STOP and report rather than falling
   back to Google.
3. **`FHE_MAGIC_LINK=<url>`** — a one-time sign-in link the owner generates from the Supabase
   dashboard. ⚠️ **SINGLE USE AND SHORT-LIVED.** If this is how you authenticate:
   **open it, and the moment the session is live, WRITE `storageState` to disk and use that for the
   rest of the walk.** Never navigate to the magic link twice — the second visit fails and the
   credential is spent. If it is already expired or consumed, **STOP and ask for a fresh one**;
   do not attempt any other route in.

**Whichever path is used, save and reuse the session.** The walk switches between the test identity
and the admin account repeatedly — re-authenticating per switch is both fragile and wasteful. Keep
one storage-state file per identity and swap contexts.

**Test accounts you create yourself set their own password at activation** — they never involve
Google, so the client-side half of the walk is unaffected either way.

### ⚠️ YOU DO NOT NEED TO READ EMAIL TO PROCEED — build the link from the database

**Magic-link login is not exposed** (`signInWithOtp` appears nowhere; the only magic link in this
app is password reset). **And you do not need one.**

**An activation link is reconstructable.** `invitations.token` is a real column, and
`/activate?token=<token>` is exactly how `Register.tsx:23` reads it. So when a step says *"follow
the email"*:

```sql
-- .env.db line 1 is the prod connection string
SELECT token, status, expires_at FROM invitations
WHERE lower(email) = lower('<the walk identity>') ORDER BY created_at DESC LIMIT 1;
```
then open `${FHE_SITE_URL}/activate?token=<token>`.

⚠️ **THIS SEPARATES TWO QUESTIONS THAT MUST NOT BLOCK EACH OTHER:**
- **"Does the flow work?"** — answered by the DB-built link. **The walk never stalls waiting on an
  inbox.**
- **"Did the email arrive?"** — answered by the owner from his own inbox. **Record every message
  that should have fired: the step, the expected subject, the recipient, the time.**

**Never conclude the flow is broken because an email did not arrive, or that email works because the
flow completed.** They are independent findings and the report states them separately.
**Use the same technique for any other token-bearing link** (contract invitations, counterparty
invites) — the token is in the row.

**Screenshots** to `docs/reports/walk1-shots/`, named by step. **Redact any credential or real
third-party personal data before committing a shot.**

⚠️ **SCREENSHOT AND DOM DISCIPLINE — this is the budget.** Image and DOM volume, not model choice,
is what makes a browser walk expensive.
- **Capture at decision points only** — a state that changed, a confirmation, an error, an empty
  state, a price, a notification. **Never step-by-step narration shots.**
- **Never dump full-page DOM or HTML into the transcript.** Query the specific element you need
  (`text_content`, `inner_text` of one node). If you need a list, extract the list, not the page.
- **One screenshot per numbered step, maximum.** If a step needs two, it is two steps.
- Prefer **reading visible text** over screenshotting to answer a factual question (a price, a
  label, a count). Screenshot to evidence what the owner must SEE.

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
3. **MONEY — RULED BY THE OWNER, 2026-08-20. Use Zelle and cash ONLY. Never a card.**
   > *"test mode use the only options, zelle and cash, you need to be able to verify both options
   > are functioning properly, nothing is real, they both get approved manually now so the user just
   > says they sent the payment or are paying cash. nothing blocks them from any action because the
   > lesson never happens without payment being verified."*

   **Both options must be exercised — one purchase paid by Zelle, one by cash.** Nothing is charged;
   the user simply declares they have paid or will pay cash, and a human confirms later.
   ⚠️ **STRIPE IS OUT — owner, 2026-08-20: *"kill stripe mode, its not setup and we dont need it
   now."*** It is not configured and is not part of this programme. **DO NOT submit a card payment
   under any circumstances.** If a surface offers a card option at all, **do not use it — record
   that it is offered**, because presenting a payment method that is not set up is itself a defect
   worth reporting.
   ⚠️ **THE OWNER'S RULE IS AN ACCEPTANCE TEST, NOT JUST A PERMISSION: declaring payment must NOT
   block the user from anything.** After the declaration, the user continues — booking included.
   **If any action is gated on the payment being confirmed, that is a DEFECT and must be reported**,
   because the real control is operational: *the lesson never happens without payment being
   verified.* Test the claim, then keep going and record whether you were stopped.
   **Leave both declarations UNCONFIRMED.** Admin confirmation is WALK2's job — it needs unconfirmed
   claims waiting for it. Record the exact purchase ids and their state at hand-off.
4. **The signing freeze:** the owner directed contract signing as part of this programme, so it is
   lifted **for the WALKTEST identity only**. **Never sign, alter or execute a real client's
   document.**
5. **Email really sends.** Only ever to the WALKTEST address or the owner's own. Never to a client.
6. **If anything is destructive, ambiguous, or would touch real data — STOP and report.**
   A half-finished walk with an honest stop beats a complete walk that damaged production.
7. ⚠️ **ESCALATE, DO NOT REASON.** When the app does something you cannot classify as
   right-or-wrong, **do not deliberate about it and do not investigate the cause.** Write down
   exactly what you saw, what you expected, and the step number — then continue the walk if it is
   safe, or stop if it is not. **Diagnosis is the orchestrator's job, not this thread's.** Attempting
   root-cause analysis mid-walk is the single largest waste of budget available here.
8. **NEVER read source code or query the database to explain a behaviour.** This thread observes the
   running app. If you find yourself opening `src/` to work out *why*, you have left the task.

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
