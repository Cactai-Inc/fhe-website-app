# BUNDLE-FUNNELDEBT — B2 (cut by ORCH, 2026-09-03; RECONCILED-2026-09-02.md §8 row B2)

**Sender: hand everything back to `FHE-ORCH`** (today `FHE-ORCH-8`). Bundle tree: `wt-9`. Task trees
allotted: `wt-10` (ask ORCH for more; the pool grows on demand).

## Read first, in this order
1. `docs/orch/RECONCILED-2026-09-02.md` §2 (F1–F7, 3.2a — the measured state of each, 2026-09-02)
   and §7.2 (F3's upgrade: the CHECK constraint forbids the right value).
2. `docs/reports/HANDOFF-SIGNBOOK-THREAD-2026-09-01.md` §2–§3 (the owner: *"these are not small"*)
   · `docs/reports/SIGNBOOK-FINDING-the-door-does-not-know-who-is-knocking.md`.
3. `docs/reports/FINDING-the-guardian-declared-at-the-door-is-lost-at-provisioning.md` (four
   revisions proposed, none built) · `docs/tasks/TASK-DEPENDENT-the-guardian-buys-the-child-rides.md`
   (the commerce half of the same spine; `purchases`/`bookings` have no payer/guardian column).
4. `docs/reference/CHANGE-ORDER-LEDGER.md` — CAREPATH §C6 (the activation + confirmation emails were
   HIS ruling; collapsing them is subtractive), CR-98/CR-99 for the sign-flow context, CR-101·A1.
5. `CLAUDE.md` D32 (nothing removed; a relabel is an UPDATE — still the owner's call on 781 live
   rows), D19, D35/D36, D39, D41/D44. Memory: `fhe-supabase-errors-are-not-error-instances`,
   `fhe-revoke-from-public-is-not-enough`.

## The items, with state
| # | Item | State |
|---|---|---|
| 1 | **F1** — an order submission sends TWO emails (activation via `api/request-activation.ts`; inquiry confirmation via `src/lib/api.ts:142` → `api/inquiry-confirmation.ts`) | facts known; the collapse is the owner's call (escalation 1) |
| 2 | **F2** — `flush_held_executed_document_emails` 30-min backstop (`api/delivery-sweep.ts:39`, hourly from GitHub Actions) can split the one executed-document email into two | facts known; tuning is the owner's (escalation 2) |
| 3 | **F3** — booking events filed under `status_events.entity_type='offering'`: 829 rows on 2026-09-02, 781 booking-shaped, still being written; `entity_type='booking'` rows: 0; the CHECK in `20260821T1500_lessonplan_m1…sql:171,174` forbids `booking` | writer(s) + constraint + relabel; D32-sensitive (escalation 3) |
| 4 | **F4** — a member with no `clients` row cannot submit a booking request: `RAISE EXCEPTION 'no member profile'` in `request_open_time` / `book_open_slot` (and the same guard at 9 other sites across 6 migrations — the spec inventories them) | heal-vs-guard is a product call (escalation 4) |
| 5 | **F6 GUARDIAN** — the lead→client door drops the declared guardian; no `guardian` read in `provision_client_invitation` / `redeem_invitation`; the minor spine itself works | choose one of the four revisions (escalation 5) |
| 6 | **DEPENDENT** — the guardian buys the child's rides: payer/guardian on `purchases`/`bookings` | in item 5's spec (escalation 6) |
| 7 | **3.2a** — Confirmation copy, HALF built: `Confirmation.tsx:167-190` says the email carries an activation link; MISSING the rules/policies/waiver-after-activation line and `SendStateScreen`'s spam / add-us-to-contacts / contact-us lines (`SignStart.tsx:169-170` — READ them there; do not edit SignStart) | copy; guest-facing (gate) |
| 8 | **CR-117 — THE GIFT FLOW RIDES THE ACTIVATION LINK (added by ORCH 2026-09-03).** The owner: there is no anonymous user any more; an account exists the moment we have the email address, and "activation" is the recipient's auth setup. Today: `src/pages/Redeem.tsx` reveals anonymously via `openGift(code)` then asks a recipient with no account for a PASSWORD; `src/lib/gifts.ts` `registerForGift()` → `api/register-gift.ts` calls `auth.admin.createUser` on its own endpoint, deliberately not the invited path, on the now-retired premise that "the gift code is the credential". Required: the gift email carries the reveal animation AND a unique activation link with the code bound to it; the recipient's email address IS the account. **`gifts` = 0 rows in production, so nothing live breaks.** B1 is revoking anon on `open_gift` and `redeem_gift` in parallel — ACLs only, never a body. | ruled (CR-117); spec needed (escalation 8) |
| — | **F5 / 4.7 DISPLAYNAME's control half — NOT in this bundle.** It needs a control on `AccountHub.tsx`, which B5 SUPPLIES holds (access-point rows). Moved to B10 as a one-RPC build after B5's AccountHub merge. | out |
| — | **F7** (`trg_seed_display_name` anon) — B1 GRANTS. | out |

## Ownership declaration (D35/D36) — this bundle holds:
- **DB (bodies, never ACLs — B1 holds every ACL):** the `status_events` CHECK constraint + every
  writer that files a booking event (the spec names them; candidates in the five migrations that
  insert into `status_events`) · `request_open_time` · `book_open_slot` · the other 'no member
  profile' guard sites IF the spec heals them · `provision_client_invitation` · `redeem_invitation`
  (guardian read) · a NEW payer/guardian column on `purchases` and/or `bookings` — **declare the
  exact column name before applying; B5 holds a DIFFERENT new column on `purchases` (horse
  attribution); never share a migration file with B5**.
- **Files (CR-116):** `src/pages/Redeem.tsx` · `src/lib/gifts.ts` · `api/register-gift.ts` · the gift
  email template. **Not `src/pages/Gift.tsx`** unless the spec proves it is the same door — report it
  up if so.
- **Files:** `api/request-activation.ts` · `api/inquiry-confirmation.ts` · `api/delivery-sweep.ts`
  (the hold parameter) · `src/lib/api.ts` — the ONE call at `:142`, nothing else in that file ·
  `src/pages/Confirmation.tsx` · `src/pages/app/Onboarding.tsx` for the guardian path — EXCEPT the
  stale-comment lines `:106-108` and `:621`, which B1 holds (merge after B1's comment edit lands, or
  rebase over it).
- **NOT this bundle's:** `SignStart.tsx` (B3 INROADS; read it, never edit it) · any function ACL
  (B1) · `AccountHub.tsx` (B5) · the six-state request machine and `request_purchase_payment` (B6).
  If the guardian work needs a door change in `SignStart.tsx`, that is a FINDING routed up.
- **Trees:** `wt-9` (MGMT) · `wt-10` (tasks).

## Pre-registered escalation points (the only summons) — ONE batched summons after DSNR, with evidence
1. **F1** — collapse the two emails into one, or keep both per CAREPATH §C6? Prepare: both emails'
   text as sent today, the one-email draft, the recommendation.
2. **F2** — the backstop: shorten/lengthen the 30 minutes, or make the sweep skip documents whose
   executed email is still being composed? Prepare the two failure cases with times.
3. **F3** — relabel the 781 live rows to `booking` (an UPDATE, not a removal — D32 permits; still
   history), or leave them and fix only the writer + constraint + a compatibility read? Prepare the
   row counts (re-measured), which readers consume `entity_type`, and the recommendation.
4. **F4** — heal (create the `clients` row at request time from the member's contact) or guard
   with a message? Prepare: who has no `clients` row in production today (count), why.
5. **F6** — which of the FINDING's four revisions; prepare the one-paragraph diff of each.
6. **DEPENDENT** — payer on the purchase, or guardian on the booking, or both; prepare with the
   first real minor's records as the worked example (Charlotte Caddell exists — READ ONLY; the owner
   is handling that family himself).
7. **CR-117 · the OTHER password path** — `api/register-invited.ts` is the endpoint `register-gift`
   cites as having "the same problem". Does the activation-link ruling retire it too, or does the
   invited path stay password-based? Prepare: what each endpoint does today, who reaches it, the
   one-flow-for-everyone option, the recommendation.
8. **CR-117 · the gift email** — the reveal animation and the activation link in one email, or a
   reveal email followed by an activation email? Prepare both, with the buyer's experience of each.
9. Anything else the spec cannot resolve — in the SAME summons.

## Gates to ORCH
- **Every email text change and `Confirmation.tsx` copy** is guest-facing — render checklist +
  the email as it would send, UP before merge. Owner framing stands: account FIRST, then documents;
  copy must never imply signing before activation.
- **Production data change (F3 relabel)** — apply only after the owner's ruling is in the CR ledger
  (ORCH writes that file; send the verbatim words up).

## Merge lane
Per task after VRFY. F3 writer + constraint may merge before the relabel; the relabel runs under the
rehearsal discipline (`BEGIN…ROLLBACK` first, counts before/after in the report).

## Sequence inside the bundle
DSNR (tier: MGMT evaluates and decides, D45 — the SHAPE of the request→activation→booking spine and the minor/guardian spine;
the spec set + disjoint chunk declaration + the batched escalation with evidence) → owner rules →
CODR (Opus · HIGH · ON) → VRFY per merge (Opus · HIGH · ON; production: `status_events` counts by
`entity_type` before/after; a guardian survives provisioning on a WALKTEST fixture; `proacl` on every
touched function — a `CREATE OR REPLACE` keeps the ACL, a DROP+CREATE does not) → WALKR at close:
the inbound request → activation → booking flow and the minor-at-the-door flow (FLOW-MAP names; the
WALKTEST fixture, never a real client).

## Suggested model/effort — SUGGESTIONS ONLY (D45): MGMT evaluates each task's work and decides, stating why
DSNR: MGMT decides (D45). CODR: Opus · HIGH · ON. VRFY: Opus · HIGH · ON. WALKR: Opus · HIGH · ON.
