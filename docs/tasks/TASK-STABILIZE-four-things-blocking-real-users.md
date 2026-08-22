# TASK-STABILIZE — four things blocking real users, fixed surgically

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Touches account activation, credit/slot
minting and a new account category. Real judgment, kept deliberately small in scope.

⚠️ **THIS IS NOT REFACTOR WORK.** D30 (ground-up rebuild, data ported not migrated) is a
separate, later track. **This task stabilizes the CURRENT app for CURRENT users.** Smallest
correct diff per item. No schema redesign, no new identity model, no touching
`supabase/migrations/`'s disposition. If a fix reveals it genuinely needs the rebuild's scope,
STOP and report that rather than half-building toward it.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-stabilize`, branch `task/stabilize`
(copy `.env.db` and `.env.test` in — gitignored, do not propagate) · report to
`docs/reports/TASK-STABILIZE-REPORT.md` · commit, **do not push** · no subagents · migrations
dry-run in `BEGIN … ROLLBACK` with the rollback proven, then applied.

---

# ITEM 1 — account activation reports failure on success

**Diagnosed by `TASK-WALK4` (unmerged, `task/walk4`), read its report §"a party can finish
activating and be told they failed" before starting — do not re-diagnose.**

**The bug:** the first activation attempt succeeds server-side — `invitations.status = redeemed`,
`redeemed_at` set, `document_parties.contact_id` correctly repointed, the auth account is real and
its password works at `/login` — but the screen shows *"We could not finish activating your
account."* A retry then shows *"an account already exists — sign in instead,"* with **no sign-in
form on that page.**

**Cause, per WALK4:** something client-side, AFTER the successful `redeem_contract_invitation`
call, throws and renders the generic failure branch. Not diagnosed further — that is this item's
job. Start at `RegisterComplete.tsx`.

**Fix:** find and fix the post-redemption throw. **Also fix the dead-end retry** — a person told
"you've already activated, sign in instead" must see a way to sign in from that exact screen.

**Test:** activate a fresh test invitation through the real UI. **Confirm success on the first
attempt, not just on retry.** Then deliberately reproduce the old failure path (if still
reachable) and confirm the retry screen now offers a working sign-in.

---

# ITEM 2 — a "deal party" account category doesn't exist

**Confirmed absent, 2026-08-21:** `ProvisionClientForm.tsx` hardcodes exactly three categories —
`GUEST`, `RIDER`, `HORSE_OWNER`. Nothing else is selectable in any account or contract creation
surface. The owner needs a fourth: **a person who has a contract with FHE and nothing else** — no
riding, no horse care, no visiting.

**Add `DEAL_PARTY`** (or the owner's preferred label) as a fourth selectable category, alongside
the existing three, in every surface that currently offers them
(`ProvisionClientForm.tsx`, `SignChoose.tsx`'s `/sign/deal` path already exists as an ENTRY point
but does not set this category on the resulting account — confirm and fix that gap specifically).

**Provisioning for this category:** ⚠️ **ASK THE OWNER, DO NOT GUESS**, but the default that fits
everything ruled so far: **no `category_document_requirements` row** (no Policies/Rules/Release —
those are for people who are physically present or riding), because a deal party's only
obligation is the contract itself, which has its own signing gate independent of onboarding
documents.

**Visibility:** a `DEAL_PARTY` account must not see the booking/lesson/horse-care surfaces that
make no sense for them. ⚠️ **Do not build a new permission system for this** — gate the existing
member nav/dashboard on the category the same way any category-conditional surface already works
(`AppLayout.tsx` nav arrays), adding one more condition, not a new mechanism.

**Test:** create an account as `DEAL_PARTY` through both the staff form and `/sign/deal`. Confirm
no service documents are assigned, and the account's own dashboard/nav does not offer booking or
horse-care surfaces. Confirm the account CAN still see and sign its own contract.

---

# ITEM 3 — adding a horse for a client

**Mechanically exists** — `create_horse_record` (RPC, does not touch `clients`, unrelated to Item
4) and `staff_assign_horse_party` (attaches a horse to a contact, called from
`HorseRecordsPage.tsx`) are both real and wired.

⚠️ **UNVERIFIED WHETHER THIS IS REACHABLE FROM A CLIENT'S OWN RECORD/DOSSIER**, as opposed to only
from the separate Horse Records page. **Verify in a browser FIRST** — open a real client's
dossier/record, attempt to add a horse for them from there. **If it works, this item is closed —
say so and stop.** If it's missing or broken, fix the smallest gap (most likely: no "add horse"
entry point on the client dossier calling the already-working RPCs — wire the existing
functions to that surface, do not write new ones — D18).

**Test:** from a client's own record/dossier, add a horse, and confirm it appears both on the
horse's own record and on that client's relationships.

---

# ITEM 4 — weekly riders never get their standing slot or a credit

**Fully diagnosed by `TASK-WALK4`** (unmerged, `task/walk4`), read its §C and §D before starting.

**The bug:** `set_my_standing_schedule` (called by both the client-side slot picker and staff's
dossier control) requires a `clients` row keyed on the contact
(`current_client_id()`/`_generate_plan_month`'s guard) — and **nothing in the current
provisioning paths reliably creates one.** Reproduced two ways in WALK4, both ending in
`clients` still empty for the test contact:
- A contact provisioned entirely through a contract-party path
  (`add_document_party_by_email` → `reassign_document_party`).
- **A contact who completed the ENTIRE self-service onboarding wizard**, all documents signed,
  payment declared — still no `clients` row afterward.

**Also broken by the same gap:** staff cannot manually book this client either — they are
**absent from the client dropdown** in the one-off booking form, because that dropdown only
lists contacts who already have a `clients` row.

**Cause, narrowed:** `_ensure_client_account` DOES reference `clients` in its body (confirmed —
it is meant to ensure the row exists) but is evidently not reaching that branch for at least
these two provisioning shapes. **Find why** — likely a conditional that assumes a path this
contact didn't take, or a caller that should invoke `_ensure_client_account` and doesn't.

**Fix:** make `clients` row creation unconditional on becoming a real client, regardless of
which provisioning path was taken. ⚠️ **Reuse `_ensure_client_account` — do not write a second
account-spine function (D18).** ⚠️ **D23 still governs what this client then gets: NOT spendable
credits.** A weekly rider gets a standing slot; `remaining = 0` on the entitlement is correct.
A credit mints only on cancellation or during reschedule. **Do not build a credit-minting path
for weekly riders — that would be the wrong fix.** The `clients` row is the only thing missing;
once it exists, the already-built standing-slot machinery (SLOTREACH) should work unmodified.

**Test:** provision a fresh contact through BOTH shapes above (contract-party path, and full
self-service wizard) and confirm a `clients` row exists after each. Then buy a recurring 2x
weekly lesson, declare payment, and complete `set_my_standing_schedule` successfully from BOTH
the client side and the staff dossier control — show the two standing bookings landing on the
calendar. Confirm the client now appears in the manual-booking dropdown.

---

# THE TEST THIS MUST PASS (all four)

1. A fresh activation succeeds on the FIRST attempt, and the retry screen (if ever reached) has a
   working sign-in path.
2. A `DEAL_PARTY` account can be created, receives no service documents, and its nav hides
   booking/horse-care surfaces while still showing its contract.
3. Adding a horse from a client's own record works, or was already working and is confirmed so.
4. Both provisioning shapes produce a `clients` row, and a weekly rider's standing slot can be
   set from both the client side and staff side, with no spendable credit minted.
5. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (baseline, not a
   green target).
6. **No new tables, no schema redesign, no second write path for anything an engine already
   owns.**

# REPORT
`docs/reports/TASK-STABILIZE-REPORT.md`. One section per item, each stating pass/fail plainly.
Flag anything that turned out to need the ground-up rebuild's scope rather than a surgical fix.
