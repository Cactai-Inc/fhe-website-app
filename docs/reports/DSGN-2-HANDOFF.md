# DSGN-2 → ORCH · HANDOFF

**Thread:** `DSGN-2` (dispatched as `DSGN-SIGN-FLOW`) · **Closed** 2026-09-01
**Assignment:** CR-98 (URGENT) + CR-99, strip spec first and alone.
**Working record:** `docs/reports/DSGN-2-LEDGER.md` — every number's query lives there.

**Delivered — four specs:**
- `docs/tasks/TASK-SIGNSTRIP-the-unauthorised-purchase-block-comes-off.md` ⚠️ **URGENT — dispatch now**
- `docs/tasks/TASK-SIGNDOOR-the-sign-page-asks-for-the-email-and-nothing-else.md`
- `docs/tasks/TASK-SIGNBOOK-the-wizard-ends-in-a-booking-request-not-a-payment.md`
- `docs/tasks/TASK-REQCARDS-the-request-card-is-an-action-surface-and-both-ends-press-buttons.md`

---

# 1 · THE CHUNKS, IN DEPENDENCY ORDER

| # | Chunk | Must merge before it | Dispatchable |
|---|---|---|---|
| 1 | **SIGNSTRIP** — the block off `/sign/*` | nothing | ✅ **now — it waits on nobody** |
| 2 | **SIGNDOOR** — email-only door, capture moves post-auth | SIGNSTRIP (same file) | ✅ after 1 merges |
| 3 | **SIGNBOOK** — wizard reordered, ends in a `requested` booking | SIGNDOOR + **TASK-LIFECYCLE** (DSGN-1) | ⚠️ **blocked on ASK-OWNER A1** |
| 4 | **REQCARDS** — staff card + client payment modal, both ends of the machine | LIFECYCLE + SIGNBOOK | ⚠️ **blocked on the §9 SHAPE review** |

**Why four and not other cuts:** SIGNSTRIP alone because it is urgent and touches nothing else.
SIGNDOOR is one chunk because slimming the door and widening the post-auth form are one MOVE of the
same fields — split, they leave a window where neither side asks. SIGNBOOK is the whole
visitor-walked wizard (one actor, one sitting, one step machine). REQCARDS pairs CR-99 with CR-98
steps 11–14 because they are the two ends of one approval/payment ping-pong — the ledger itself says
CR-99 is CR-97's machine from the staff side; two specs would define the same transitions twice.

## ⚠️ CROSS-CUTTING DEPENDENCY: TASK-LIFECYCLE (DSGN-1)
Chunks 3 and 4 sit ON the six-state machine. If LIFECYCLE is not merged when you reach chunk 3,
sequence it first — SIGNBOOK's `requested` and REQCARDS' derived statuses are that machine or they
are D18's second machine.

# 2 · CONTENTION I CAN SEE
- **`src/pages/SignStart.tsx`**: chunks 1 and 2, strictly serial (spec'd that way).
- **`src/pages/app/Onboarding.tsx`**: chunks 2 and 3 both edit it (2 widens `details`, 3 reorders
  the machine). Serial, or one thread takes both if you merge them — that is your call to make.
- **`OrderPayment.tsx` / `mark_purchase_paid`**: chunks 3 (moves the component out) and 4 (gives it
  a modal home). BACKDATE just shipped changes around `mark_purchase_paid` — whichever thread
  touches it first should re-read its current body, not the memory of it.
- I cannot see what is RUNNING — wt-1..5 were all parked at `14140564` when I looked.

# 3 · MODEL / EFFORT — recommendation, ORCH decides
- **SIGNSTRIP**: Sonnet, standard. Surgical deletion with an exact footprint list.
- **SIGNDOOR**: Opus, high. Anti-enumeration and the minor-capture move are subtle; the diff is not.
- **SIGNBOOK**: Opus, high, thinking on. Largest chunk; resequencing a live wizard with two doors.
- **REQCARDS**: Opus, high. Greenfield UI over live money paths.

# 4 · ASK-OWNER — most blocking first
- **A1 (blocks SIGNBOOK):** CR-98 step 3 says WHICH documents comes from the `/sign/*` PATH, and
  signing (step 4) happens BEFORE the offering is chosen (step 5). The 2026-08-24 ruling says docs
  come from the OFFERING. Which governs the self-serve funnel — and if an offering picked at step 5
  carries a doc requirement the path-set didn't include, does the wizard loop back to sign it?
- **A2 (blocks REQCARDS build, not its spec):** the §9 SHAPE — card anatomy, cluster location,
  states — needs his eyes. Ask alongside A1; it is the *"dedicated style and possibly a location"*
  he explicitly left open.
- **A3 (non-blocking):** does email-only apply to `/sign/deal` too? I left `deal` untouched — its
  form finds an existing contract and D22 requires the address a contract prints. If he wants it
  email-only as well, that is a small follow-up to SIGNDOOR.

# 5 · WHAT I DECIDED THAT THE CRs DID NOT
1. **The guest-path variant of the block ("Services we offer once you're onboarded") is the same
   block and comes off.** His complaint is the block, not the heading string; one guard renders both.
2. **The strip removes the whole footprint** — fetch, state, map, imports — not just the JSX. A dead
   catalog fetch on every page load is not a removed block.
3. **`deal` stays as-is for now** (→ A3) — conservative and reversible.
4. **The minor question moves post-auth** (SIGNDOOR §5.3) — forced by email-only, safe because
   post-auth the guardian's email is verified; same `attach_minor_to_guardian` RPC, no second
   concept.
5. **Payment leaves the onboarding wizard entirely** (SIGNBOOK) — it is the direct reading of steps
   7 → 11–13 (request first, pay after approval), and it inverts WALK1's pay-first gate. The staff
   pay-first provisioning door stays working (spec'd, tested).
6. **CR-99 + CR-98 steps 11–14 are one chunk** — one machine, two ends (§1).

# 6 · SHAPES NEEDING HIS EYES BEFORE BUILD
**REQCARDS §9** (card + cluster + client modal states). Nothing in SIGNSTRIP/SIGNDOOR changes a
surface's shape beyond what his own words already specify (email box, check-your-email screen —
which already exists as SendStateScreen and is kept).

# 7 · STEP-3 STATUS (validation criteria)
CR-98's 14-step flow is 🔒 the owner's own end-to-end specification — the specs' tests are numbered
to it. CR-99 is **captured, not ruled**: its actions list is verbatim ownable, but style/location
are open → A2. I did not invent criteria for them; the §9 shape is a PROPOSAL for him to mark up.
