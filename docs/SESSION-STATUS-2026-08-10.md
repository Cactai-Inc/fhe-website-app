# SESSION STATUS — 2026-08-10, end of the orchestration day

**Written for a context compaction. This is the full picture; nothing else from the session
survives.** `origin/main` = `6cf1215`, clean, in sync.

---

# 1. WHAT IS RUNNING RIGHT NOW

| thread | branch | ahead | state |
|---|---|---|---|
| **LEASEFIX** | `task/leasefix` | 6 | building the insurance restructure. **Fully unblocked.** |
| **NOGUARD2** | `task/noguard2` | 4 | Phase B. **AUDIT BEFORE MERGING.** |
| **SUPERSEDE** | `task/supersede` | 1 | answered "yes, supersede". **Needs audit + merge.** |
| **UIBUILD** | `task/uibuild` | 0 | queue empty. **UIO-013 is written and UNSENT.** |
| **ROSTER** | `task/roster` | 1 | delivered. **DB work stands; row presentation SUPERSEDED by the card decision.** |

**Dormant, work already merged:** `wt-horsedocs`, `wt-horseintake`, `wt-sendguard`.
**`task/uireview` is 10 ahead and CLOSED** — its content was extracted into UIO-003/004/005.

---

# 2. SHIPPED AND DEPLOYED TODAY

- **Claire Bourdon unblocked** — `postgrest-js` returns a plain object, not an `Error`, so every
  `e instanceof Error` test discarded the real message. Plus `'N/A'` reaching columns that
  cannot store it.
- **`void_signatures_on_edit` DROPPED** — anonymous, no caller, could void every signature on
  any of 61 executed documents.
- **Three `gift_*` guards** now fail closed.
- **`ensure_horse_documents` guarded** — it could soft-delete two EXECUTED signed documents.
- **The invited category survives activation** — `derive_affiliations` reads redeemed invitations.
- **SENDGUARD §1 and §3** — no signing invite to a party who signed; the sweep is signature-aware.
- **Eight UI orders** — nav flicker, scroll containment, drawer scroll-jump, avatar, chevron,
  header shadow, Save/favicon, nav groups.
- **Pre-commit hooks** — code commits from the canonical checkout are refused.
- **45 dead worktrees removed**, 3.1GB.

---

# 3. WAITING ON THE OWNER

1. **BOOKFLOW detail.** Calendar, booking of purchased items, order view, admin-vs-client slot
   views. **He called it a launch blocker.** `TASK-BOOKFLOW-PENDING-owner-walkthrough.md`
2. **Frequency omission meaning** — "one time", or unspecified?
3. **CCC stall behaviour** — a Lessee who cannot meet the required limit cannot truthfully
   declare; is stalling intended?
4. **Deductible cap** — one sentence, or leave it? The clause scopes the TRIGGER, not the AMOUNT.
5. **Two evaluation pages to look at:** `docs/reference/uio-011-hover-and-green-evaluation.html`
   and `docs/reference/uio-006-open-state-options.html`
6. **UIO-013** (gold nav states) is written and **has not been sent to UIBUILD.**

---

# 4. THE QUEUE — specced, not started

| task | note |
|---|---|
| **INQUIRYMAIL** | form submissions send NO email; only a daily 16:00 cron carrying a COUNT |
| **Dashboard/Inbound content merge** | nav half done; content merge needs its own order |
| **UIO-013** | gold nav states, unsent |
| **ROSTER re-point** | rows -> cards |
| **ADMINSWEEP** | never run; largest remaining piece |
| **PAGEFRAME · TITLESWEEP · PURPOSEFIX · GIFTCREDITS · GOOGLEAUTH · FACILITYTERM · MOBILEPASS · NOGUARD3** | unrun, in `docs/tasks/` |

---

# 5. STANDING CONSTRAINTS

- **SIGNING FREEZE IS IN FORCE** — `docs/reference/SIGNING-FREEZE.md`. Five items must all close
  before it lifts.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE**, not prohibited — minimal diff, orchestrator approval.
- **Sarah's `704c8d2d` is a SAMPLE**, not a live negotiation. Template changes should reach it.
- **61 EXECUTED documents are evidence.** Never rewritten.
- **Model choice is the orchestrator's**, per thread. Err up when scope is unknown.
- **This thread is procedural only.** Planning goes to a planning thread.

---

# 6. TRAPS LEARNED TODAY — all in the handoff

1. **The failure is an ADJACENT TEST, not skipped verification.** Four instances, one mine.
   Test the artifact on the target, never a proxy.
2. **A result that flatters the reporter deserves a SECOND test.**
3. **A migration containing its own `COMMIT;` ends your dry-run wrapper.** Two threads applied to
   production believing they were dry-running.
4. **`npx tsc` with no `node_modules` fetches an unrelated package and exits 0.**
5. **Minified CSS rewrites what you grep for** — space after the colon, `rgba()` -> 8-digit hex.
6. **Tracked git hooks vanish when you check out an older commit.** Install to `.git/`.
7. **Do not revise a task doc a thread is holding** — tell it what changed.

---

# 7. LIVE FINDINGS NOT YET FIXED

- **`apply_document_supersession` ignores `horse_id`** — SUPERSEDE is on it. CJ has ready-to-sign
  documents that would revoke another horse's authorization.
- **`admin@cactai.io` holds an FHE tenant contact row** — D1 says it must hold zero.
- **The unnamed `hello@` duplicate is LESSEE on Sarah's lease** — load-bearing, do not merge.
- **`bookings` has NO audit trigger** — a booking reads as inactivity. Folded into BOOKFLOW.
- **`guardian_contact_id` is populated and read by nothing in `src/`.**
- **`api/admin-send-invitation.ts:229`** swallows every failure into a flat string.
- **`contacts.tags` vs `groups`** — a claim and a verification rendered identically. Resolved for
  the roster (derived only); the duplication remains.
- **`fulfillment_units` has 12 rows**; generation may not be firing.
- **`test:db` is broken** — 55 of 64 files failing.

---

# 8. THE INSURANCE MODEL — settled

Authoritative: the top block of `docs/tasks/TASK-LEASEFIX-insurance-rulings-2026-08-10.md`.

```
Lessee   GL             third-party harm the LESSEE causes
Lessee   CCC (on GL)    the horse in the Lessee's custody; ENTITY only; limit >= FMV token
Lessor   mortality      death, regardless of fault
Lessor   medical        treatment (a component of mortality)

Both parties DECLARE. The requirement NARROWS the other's menu.
Only the LESSEE's obligation is written; the Lessor's is the remainder.

POLICY COST   Lessor pays | Lessee pays [$ or %] + optional frequency
DEDUCTIBLE    Lessor pays | Lessee pays [$ or %]   scoped to Lessee-caused events

$ caps exposure. % is a share of USE, and INDEXATION on an in-force policy.
Transparency = policy documents attached to the deal, NOT clause machinery.
21 fields -> 12.
```

---

# 9. THE ROSTER — settled

Authoritative: the top block of `docs/tasks/TASK-ROSTER-one-people-page.md`.

**A TRIAGE VIEW.** Spot the stuck and the most-engaged at a glance.

```
RING      grey lead · gold client/customer · green guest    one source per state
BADGES    rider · horse owner · deal-only party             DERIVED ONLY, never tags
NAMES     horses owned, horses leased
COUNTS    orders · credits · lessons
ACTIVITY  last-active timestamp · green dot < 1hr           ACTIONS, not sessions
FLAGS     only where he can act TODAY — unclaimed/expired invite,
          incomplete signup, outstanding docs, unpaid
PAIR      parent <-> dependent, both cards, both names
EXCLUDED  TEAM, LEAD
FORMAT    ContactsPage CARDS, not Admin.tsx rows
```
