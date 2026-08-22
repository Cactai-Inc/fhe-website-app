# TASK-DASHBOARDBUILD — two real dashboards, a toggle between them, a default per account

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Real design judgment, a genuinely new
preference mechanism, and one root-cause fix (revenue) that changes a number staff already
trust. **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-dashboardbuild` (copy
`.env.db`/`.env.test` in — gitignored, do not propagate), branch `task/dashboardbuild` ·
report to `docs/reports/TASK-DASHBOARDBUILD-REPORT.md` · commit, **do not push** · no subagents.
⚠️ Check `git log --oneline -15` for a live thread before touching shared files (`AppLayout.tsx`,
`OpsDashboard.tsx`) — `task/dealauto` may be running.

---

# 1. THE DESIGN BASIS — read this file in full first

**`docs/design/DASHBOARDS-GROUND-UP-PLAN.md`**, committed to the repo today. It is the owner-
approved zone inventory for both dashboards, the Lesson Workspace concept, the task/suggestion
substrate concept, and the revenue root cause. **Cite it, do not re-derive it.**

⚠️ **It was authored 2026-08-21 against main `5f2bb5b`.** A great deal has shipped since —
PARTYEMAIL, BUYANDBOOK, CATEGORISE, NOSTRIP, SLOTREACH, CONTRACTSEND, LESSONPLAN, TESTREPAIR,
ROLEBUNDLE, ERRSWEEP, ARCHIVE. **Every "EXISTS" data source in the plan must be re-verified
against the CURRENT schema before you build against it** — table shapes, RPC names and even
whole subsystems (standing slots, lesson plans, archived contacts) have moved.

---

# 2. THE NEW RULING — a toggle, not a fixed designation

> **Owner, 2026-08-22:** *"we need to have a way for claire and i to either select which
> dashboard from the two styles we see in the ui on the dashboard or it needs to be generated for
> us based on a designation of our role... I vote for the toggle between the two views and we can
> set the primary view in the setting based on the email account used to login."*

**This changes D26's "a designation on the company accounts" language into something more
precise. Build exactly this:**

1. **Both dashboard views are reachable by BOTH accounts, always** — a visible toggle/switch on
   the dashboard itself, since Claire and CJ share one permission level (D26: same role, same
   capability, only emphasis differs). Neither view is gated by identity.
2. **A per-account SETTING decides which view is PRIMARY** — shown on fresh login and after
   ~30 minutes away (D26's landing-surface rule, unchanged). Keyed to the account's login email:
   `hello@fhequestrian.com` → Head Trainer view by default; `admin@fhequestrian.com` → Business
   Operations view by default. **Store this as a real, owner-editable setting** (D13) — a
   `profiles` column or a small preferences table, not a hardcoded email-string switch in the
   component tree.
3. **The toggle persists the CHOICE for that session**, but does not overwrite the stored
   default — switching to the other view to check something does not silently change what you
   land on next time. Only the settings screen changes the default.

---

# 3. WHAT TO BUILD — Phase 1 only, per the plan's own phasing

**Build the zones marked EXISTS or PARTIAL-with-existing-tables in the plan's §2/§3 inventory.**
Concretely:

**Claire's view:** C1 (today's plan — omit the Lesson Workspace click-through, see §4 below),
C2 (week strip), C3 (money waiting), C4 (people waiting), C6 (notes loop — the seen-marker idiom
`contract_change_request_seen` already exists, converge on its shape), C7 (stable board), C9
(documents & onboarding), C11 (community pulse), C12 (evaluations due), C13 (gifts).

**CJ's view:** B1 (revenue & money — §5 below), B2 (Claire's plate, mirrored per the plan's own
rule: money items and SLA breaches mirror, routine execution does not unless overdue), B3 (deals
& contracts), B6 (activity read-back — the four/five write-only ledgers, D19's corollary), B8
(tenant admin & catalog hygiene), B9 (onboarding pipeline).

⚠️ **Every zone renders only when it has something to show; absent zones are absent, with a
one-line "all quiet" footer** (plan §1, principle 1). **Every number is one named RPC**, reused
everywhere that number appears (D18) — no dashboard-local recomputation.

## OUT OF SCOPE FOR THIS PASS — name these, do not build them

- **C5 (leads & outreach), C8 (supplies), C10 (to-dos), B4 (growth funnel — needs new
  `page_events`), B5 (app/site health — needs a new client-error beacon), B7 (to-dos & goals),
  B10 (suggested next)** — every zone the plan itself marks **NEW** or needing new schema. These
  depend on §5's task/suggestion substrate, which is real, substantial, and deserves its own
  task, not a rushed inclusion here.
- **The Lesson Workspace (plan §4).** C1 links to booking/plan detail directly for now — not the
  full assembly page. Name it as the immediate follow-up.
- **`dashboard_prefs`-level zone pin/hide/reorder.** Ship the two-view toggle only; per-zone
  customization is later.

---

# 4. C1 WITHOUT THE LESSON WORKSPACE

Today's plan zone still needs a click-through — it does not float unlinked (D17). Point each row
at the existing booking/lesson-plan detail surfaces (`CalendarItemPanel`, whatever currently
shows a booking's plan). **Do not build a new assembly page for this pass** — that is the
Workspace, named as follow-up work.

---

# 5. B1 — REVENUE, CORRECTLY (the one root-cause fix in this pass)

**The plan's own diagnosis (§6), verified true when you re-check it:** `calendar_revenue` sums
`bookings.price_amount` over non-cancelled bookings in the window — wrong four ways: counts
unpaid bookings, double-counts credit-covered sessions, counts standing-slot sessions minted
months into the future (D23 mints them into eternity), and recognizes at session date instead of
payment date.

**Build `revenue_summary(p_from, p_to)`** over **paid** `purchases`, recognized at payment
timestamp. **The dashboard KPI and the calendar's existing revenue tile both call this same
function** — do not leave two numbers that can disagree (D18). Week/month figures, deltas.

---

# 6. THE TRAPS

- **Re-verify every data source.** The plan is a day old and this repo does not sit still.
- **`admin@cactai.io` is never a candidate for either view** — platform owner, not a tenant
  account (D1a). This feature is FHE-tenant-only.
- **D25 naming** in every zone: Riding Lesson / turnout service / clipping appointment — never
  "booking" in anything a person reads.
- **Do not build the task/suggestion substrate "just a little" to make one zone work.** If a
  zone needs it, it is out of scope — cut the zone, do not half-build the substrate.
- **`purchases`/`bookings` schemas have moved today** (BUYANDBOOK, CATEGORISE) — read the current
  shape before writing `revenue_summary`, do not assume the plan's column names are current.

---

# 7. THE TEST THIS MUST PASS

1. **Both accounts can toggle to either view, every time**, proven in a browser.
2. **The stored default is per-account, editable in a settings screen**, and surviving a toggle
   (toggling does not silently change the default).
3. **Every listed zone renders only when it has content**, and an empty dashboard shows the
   "all quiet" footer, not a wall of blank cards.
4. **`revenue_summary` is the only revenue computation** — the dashboard tile and the calendar
   tile show the identical number, both derived from paid purchases at payment date.
5. **Every zone's click-through lands somewhere real** — no zone is decorative.
6. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (baseline).

# 8. THE REACH
Where the toggle lives on screen, and where the default-view setting is changed.

# 9. THE TELL
What each account sees differently at login, and what changing the default setting confirms.

# 10. REPORT
`docs/reports/TASK-DASHBOARDBUILD-REPORT.md`, with **flagged-not-fixed** — every out-of-scope
zone from §3 belongs there, named plainly as follow-up, not silently dropped.
