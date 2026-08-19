# OPEN ITEMS — everything unresolved, as of 2026-08-18

**Collected from the task docs, every report, the waves register, the DECIDE sheet and the code.**
Nothing here is scheduled except where marked. **Grouped by what kind of thing it is.**

---

# 1. CONFIRMED BUGS, NOT YET FIXED  → all folded into `TASK-CLOSEOUT`

| # | bug | source |
|---|---|---|
| A3 | **A locked contract can be altered and then signed.** Gates 3–6 only run when state is `editable`; the sign button only appears when `locked`. Proven: field blanked, horse unconfirmed, signed anyway | CONTRACTWALK |
| A2 | **Two completeness checks disagree** — screen shows no blockers, gate refuses with "17 required field(s) still empty", all 17 conditionals the UI hides | CONTRACTWALK |
| A4 | **An already-activated client clicking their old link is told to hunt for an email that does not exist** | CONTRACTWALK |
| B2 | **Horse documents are created at LOCK**, in the name of a party who has not signed and may decline | CONTRACTWALK + owner ruling |
| B3 | **`contracts.status` stays `draft` beside an EXECUTED document** — the status update is trapped inside a deal branch that never runs | CONTRACTWALK |
| B5 | **Resolved notifications are deleted with no record** they existed | CONTRACTWALK + owner ruling |
| — | **Booking generation did not keep up with the entitlement.** `set_recurring_days` computes a multi-day allowance; `generate_monthly_lessons` still books ONE weekday | orchestrator, 2026-08-18 |
| — | **À la carte care mints nothing** (CREDITALIGN F1) — a one-off Clip or Exercise Session gives no entitlement | CAREPLANS |
| G4 | **`BookSupport.tsx` still carries the step-tracker defect** CAREPATH fixed in `BookHorse.tsx` | CAREPATH |
| G5 | **"Turnout" section heading is hardcoded**, not catalog-driven (D13) | CAREPATH |
| G3/F8 | **A mixed-category inquiry is filed under one funnel's category**, so staff filters under-count it | CAREPATH / ASKRIGHT |
| G2 | **Riding experience is enforced client-side only** | LESSONREQUEST |
| G4 | **The agreed-time panel exists on the lead path only** | LESSONREQUEST |
| — | **`/book/rider` is orphaned** and contradicts the no-questions-page ruling | SESSIONBOOK |

---

# 2. OWNER DECISIONS STILL OPEN

| what | where | why it matters |
|---|---|---|
| **`DEPENDENT` — four questions**: can a guardian use their own credit · can siblings share · does Brian get an account · what happens at 18 | `TASK-DEPENDENT` | **Gabriella Olenik is a real 13-year-old recorded as the buyer of her own lessons** |
| **Does a single care service mint a credit**, or is it a visit with no credit? | CLOSEOUT §2.2 | blocks à la carte care |
| **What IS a mixed inquiry**, for filing and filtering? | CLOSEOUT §3.3 | blocks the category fix |
| **Monthly billing**: the exact review day · do invoices send if nobody reviews · who is notified · does the client get anything at review time | `MONTHLY-BILLING-REVIEW.md` | blocks any biller |
| **The two pricing algorithms** — finder (fee ↔ duration ↔ volume) and assistance (fixed fee from budget band) | `ACQUISITION-PRICING…md` | **owner has not designed them yet** |
| **What a Party sees after signing** — they have a login, a stable, and no relationship | PARTYROLE | — |
| **Are the five `INTAKE_HORSE_*` forms the fulfilment forms?** | ASKRIGHT §A7 | five paper imports nothing renders |
| **Footer**: the Cactai URL · the light map tiles against the dark footer | FOOTER | cosmetic |

---

# 3. BUILT BUT NEVER VERIFIED IN A BROWSER  ⚠️ **the largest single gap**

**Nothing from wave 1 or 2 has been opened in a browser.** Six checklists are stacked
(CAREPATH 18 steps · LESSONREQUEST 9 · GIFTPATH 4 · PARTYROLE 6 · SESSIONBOOK · FOOTER).

⚠️ **They converge on one unproven thing: THAT EMAILS ACTUALLY SEND.** No thread has ever sent one —
no real Supabase credentials in the build environment, and the mail endpoints are Vercel functions.
**Three separate reports each nominate their email step as the first thing to run.**

`TASK-CLOSEOUT` phase 4 replaces all six with one ordered walk.

---

# 4. INTEGRATIONS — NONE END-TO-END VERIFIED

| integration | state |
|---|---|
| **Stripe** | code exists (`api/stripe-create-session.ts`, `lib/payments.ts`, `OrderPayment.tsx`). **Never exercised in any thread.** Whether a real payment completes is unknown |
| **Email / mail provider** | endpoints and per-attempt logging exist. **Not one real send has been proven** |
| **Vercel cron** | live — `/api/notifications-nudge` daily, `/api/mint-monthly-allotments` daily. **Never observed running** |
| **Google Maps** | footer embed, key-less. Light tiles clash with the dark footer; styling needs an API key |
| **Zelle / cash** | staff-confirmed by hand; the loop was closed by ZELLECLOSE/CASHCONFIRM but never walked |

---

# 5. UNRUN TASK DOCS

**Live and worth running:**
- `TASK-CLOSEOUT` — **next**
- `TASK-DEPENDENT` — blocked on four owner answers
- `TASK-RECORDSELECT` — row + bulk archive on Records tabs
- `TASK-INVITELINK` — inviting someone who already has an account
- `TASK-LEASEGATE` ×2 — insurance disclosure + standard restriction gates
- `TASK-HORSEONE` — one horses page at the original URL
- `TASK-ADMINSWEEP` — reconcile the admin surface
- `TASK-NAVHOVER` — nav flicker and easing
- `TASK-UIBUILD` / `TASK-UIREVIEW` — UI orders and a screenshot loop
- `TASK-BOOKFLOW-PENDING` — owner walkthrough

**Dead — do not run** (superseded or cancelled): `RIDERQUALIFY` (cancelled) · `THREEFORMS`
(superseded) · `FUNNELDOORS` (superseded) · `FLAGHARVEST` (superseded by HARVESTCLOSE) ·
`ONEPEOPLE` (superseded by Records) · `PARTYJOURNEY` (overtaken by PARTYROLE + CONTRACTWALK) ·
`TASK-A-PARTY-VERIFY` ×2 (old).

---

# 6. THE 535-ITEM SHEET  → `docs/reports/flagharvest-work/DECIDE.md`

975 raw flags → 609 families → 535 awaiting **the owner's keep/remove pass**.
**21 rank-1 (live defect) · 61 rank-2 (security / data integrity) · 123 rank-3 · 37 rank-4 ·
113 rank-5 · 83 rank-6.** 14 flagged MOOT.

⚠️ **Some rank-1s will evaporate** now that the test data is purged — several concerned records that
no longer exist. **Deciding items 198–201 (62 reports between them) and 21–34 (one root cause,
thirteen symptoms) collapses about a fifth of the sheet.**

---

# 7. KNOWN DEBT, NOT SCHEDULED

- **The repo-wide default grant**: `anon` holds INSERT/UPDATE/DELETE/TRUNCATE on `purchases` and
  more — RLS is the only thing denying it. Systemic, on the DECIDE sheet as rank 2.
- **No tenant timezone column** — fixed by setting the database and roles to Pacific. **Single-tenant
  assumption**; a second tenant in another zone needs the `tenant_ts()` pattern.
- **`/about`** still reachable from the footer, needs a rebuild.
- **PGlite suite: 46 red files** — a documented baseline, not a green one.
- **13 worktrees and 2 stale zips** were cleaned; **keep them pruned.**
