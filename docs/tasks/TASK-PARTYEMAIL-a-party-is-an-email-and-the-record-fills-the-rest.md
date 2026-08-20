# TASK-PARTYEMAIL — a party is an email address, and the record fills the rest

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** It changes signing behaviour, execution triggers
and what an executed document renders. Every one of those is evidence infrastructure.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-partyemail`, branch `task/partyemail` ·
**Phase 0 first and separately committed** · report to `docs/reports/TASK-PARTYEMAIL-REPORT.md` ·
commit, **do not push** · no subagents · every DB claim is query output; render claims **NOT
VERIFIED**. **TEARDOWN:** no dev server, no vitest left running; process census in the report.

⚠️ **THE SIGNING FREEZE IS IN FORCE.** Trace and prove signing server-side. **Never execute a
signature on a real document.** Use rolled-back transactions.

---

# 1. THE DESIGN — the owner's own restatement, which is the specification

> **Owner, 2026-08-20:** *"only an email address is required for a contract to have a valid party
> and it must have a full name for it to be signable, and only the name is locked after signing and
> all data comes from the contact record or horse record, and the one exception is the email address
> — when its added to the contract to create a party that information is matched, that means it
> isnt read from the client record until they claim the contract by activating their account with a
> matching email."*

> *"if the contract record changes, email, name, phone, address, they need to be pushed to the
> contract fields… otherwise we end up with a contract that is locked to only using the email
> address."*

> *"the form they fill in when they use the link for /sign/deal they enter their full name, phone
> number, email, and full address."*

**Ruled and recorded as D22 in `CLAUDE.md`. Read it before starting. Nothing here is open to
redesign** — the questions were asked and answered on 2026-08-20.

**The direction of travel, which is the thing to hold in your head:**
- **Every token reads record → contract.** Contact and horse records are the source of truth.
- **The email alone flows contract → party**, as a **match key**. Nothing reads back until the
  person activates with that address. *That is what makes an email-only party coherent rather than
  merely empty.*

---

# 2. WHAT WAS MEASURED (orchestrator, prod + source @ `main`, 2026-08-20)

- `document_parties`: **`contact_id` NOT NULL, no email column.** An email-only party is not
  representable today.
- `contacts`: **no name is required** — `first_name` is nullable and `name_needs_confirmation`
  already exists for exactly this shape. **0 contacts** currently have an email and no name.
- **44 parties** exist whose contact has no account — `/sign/deal`'s real population.
- `fill_party_fields_from_contacts` writes **five tokens** per party namespace: `.FULL_NAME` ·
  `.PRINTED_NAME` · `.EMAIL` · `.PHONE` · `.ADDRESS`.
- It has **NO trigger on `contacts`**. Callers are contract-start / party-change only:
  `start_lease_contract_v2` · `start_sale_contract` · `start_bill_of_sale` ·
  `start_bill_of_sale_standalone` · `add_deal_document` · `reassign_document_party` ·
  `set_document_co_buyer` · `sync_contract_fields_from_defs`.
- `redeem_contract_invitation` calls `promote_contact_to_account` and re-anchors, but **never**
  calls the fill or the remerge.
- `remerge_contract_from_clauses` is **not** called on open — only at edit points
  (`src/lib/contracts.ts:696,719,727`).
- `contract_execution_audit` stores `merged_body` + `execution_hash` + `change_log` + `comments`,
  written by the `snapshot_execution_audit` trigger. **This is why re-merging a signed document is
  safe — the evidence is the snapshot, not the live row.**
- `contract_lock_blockers` raises `required_fields` and `party_type_mismatch` — **no name blocker**,
  and it coalesces a party's display name to `… c.email, 'A party'`.
- `SignStart.tsx:275-279` collects first · last · phone · email · confirm-email. **No address input
  exists anywhere on that page.**
- `template_tokens` declares `source_table` / `source_column` per token — **the owner's "changed in
  the record where the data lives" rule already exists as data.** Horse side is symmetric
  (`sync_horse_fields_to_documents`, `source_table='horses'`).

---

# 3. THE WORK — five items, in this order

## PHASE 0 — X4: kiosk executions must snapshot (PREREQUISITE, commit alone)

**`sign_release` executes with a status-only UPDATE**, so it never fires the three execution
triggers — including `snapshot_execution_audit`. **Those documents have no archived copy, so the
live row is their only evidence.**

⚠️ **Nothing else in this task may ship before this does.** Propagation into a kiosk-executed
document would overwrite the only record of what was signed, silently and irreversibly.

**The fix:** make `sign_release`'s execution UPDATE name the columns the triggers watch (compare
against `record_signature`, whose UPDATE names `workflow_state` — that is why the contract engine's
triggers fire and the kiosk's do not). **Prove all three fire**, and prove an audit row now appears
for a kiosk execution that previously produced none. **Do not backfill** the 28+ historic kiosk
executions — they are what they are; say so in the report.

## PHASE 1 — an email-only party

Create a party from an email address alone: a stub `contacts` row (email + `name_needs_confirmation`)
linked as a `document_parties` row, plus the surface on the contract page that does it.

⚠️ **Do NOT add an `email` column to `document_parties`.** The contact IS the party identity and
~34 tables key on `contact_id`. A second identity anchor is this project's defining failure.
⚠️ **`invite_contract_counterparty` already refuses a non-party** (*"contact % is not a party on this
contract"*) — it invites, it does not create. Extend the creation side; **do not duplicate the
invite.**

## PHASE 2 — the address field on the deal form

Add **full address** to `SignStart.tsx` (line1, line2, city, state, postal). It writes to the
contact record; `.ADDRESS` derives from there.
⚠️ **`contacts.address_composed` is a GENERATED column — never write it.** It recomputes from the
parts. See the existing note at `src/lib/contracts.ts:686-688`.
⚠️ **Add nothing else to this form.** Four values only: full name · phone · email · full address.

## PHASE 3 — a full name is required to be signable

Add a name blocker to `contract_lock_blockers`: **no signer party may have an empty
`.FULL_NAME`/`.PRINTED_NAME`.** The `'A party'` fallback may stay for display, but it **must not
satisfy signability** — a signature whose printed name is *"A party"* is worthless.
⚠️ **The blocker must agree with the screen.** Two disagreeing completeness checks was defect A2,
fixed by CLOSEOUT — do not reintroduce it. The UI must show this blocker in the same list.

## PHASE 4 — propagation: fetch and read on generation

1. **Re-merge on generation**, so a contract renders current contact/horse data — **including after
   signing.**
2. **Freeze exactly two tokens once signed:** `.FULL_NAME` and `.PRINTED_NAME` lock with the rest of
   the contract. `.EMAIL`, `.PHONE`, `.ADDRESS` keep re-filling forever.
3. **Re-fill at redemption**, so a party who activates sees their own details rather than blanks —
   `redeem_contract_invitation` is the hook.

⚠️ **Do not invent a second locking concept.** This is an exclusion inside the existing fill.
⚠️ **Do NOT add a blanket `AFTER UPDATE ON contacts` trigger.** It would re-merge every document
including executed ones, and it is the obvious lazy implementation. Propagate at generation and at
redemption.
⚠️ **On a signable-but-unsigned document a propagated change is a CHANGE — D14 governs it**
(surfaced to the party who did not make it, seen-is-approved). Propagation does not bypass review
because a machine made the edit.

---

# 4. OUT OF SCOPE

- The `/sign` funnel's missing inbound links and missing completion alert — **real, and a separate
  task** (flow map F2). Do not fix reach here.
- Backfilling historic kiosk executions.
- The five crons, the email layer, Stripe.
- Any change to `contract_field_defs` content or template wording.
- `ClauseDocument.tsx` is **STOP-AND-PROPOSE** — minimal diff plus the orchestrator's approval.

---

# 5. THE TEST THIS MUST PASS

1. **Phase 0:** a kiosk execution fires all three execution triggers and writes a
   `contract_execution_audit` row. Show the row. Show that it did not before.
2. A party exists on a contract created from **an email address alone**, with no name — proven by
   query.
3. That contract is **NOT signable**, and the blocker says so in the same list the screen renders.
4. The person completes `/sign/deal` with name, phone, email and address; the **contact record
   carries all four**, and `address_composed` recomputed without being written directly.
5. On redemption the contract's `.FULL_NAME`, `.EMAIL`, `.PHONE`, `.ADDRESS` are **populated from
   the record** — show before/after token values.
6. **The contract is now signable**, and the blocker from #3 is gone.
7. Change the contact's phone and address afterwards; **the contract reflects both on next
   generation.** Show the merged body before and after.
8. On a **signed** document: changing the contact's address updates `.ADDRESS`; changing their name
   **does NOT** change `.FULL_NAME`/`.PRINTED_NAME`. Both proven, same document.
9. **`contract_execution_audit.merged_body` for that signed document is byte-identical before and
   after #8** — the evidence did not move.
10. `npm run typecheck` 0 errors · lint identical to main · `test/db` diffed **file-for-file**
    against main (46 red is the baseline, not a result).

---

# 6. THE REACH

**What does a person click, from which page?** Staff: the contract page → add a party → type an
email → send. The party: the texted `/sign/deal` link → the form → the activation email → their
login → **the contract, already open**. State whether each is the ONLY way, and if a second path
exists, name it.

# 7. THE TELL

**What confirms it happened, and how is it undone?** State what staff see when a party is created
from an email, what the party sees when their details fill in, and — for Phase 4 — what a party sees
when a propagated change lands on a document they have already signed.

# 8. REPORT

`docs/reports/TASK-PARTYEMAIL-REPORT.md`, with a **flagged-not-fixed** section.
