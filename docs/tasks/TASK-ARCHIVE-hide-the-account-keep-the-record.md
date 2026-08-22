# TASK-ARCHIVE — an account can be hidden without destroying what it's evidence of

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Touches visibility on every contact-listing
surface plus a new staff-only view over evidence records. **APPLY YOUR WORK. Do not hold** —
but read §0 first.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-archive` (copy `.env.db`/`.env.test`
in — gitignored, do not propagate), branch `task/archive` · report to
`docs/reports/TASK-ARCHIVE-REPORT.md` · commit, **do not push** · no subagents.

---

# 0. ⚠️ CHECK FOR A LIVE THREAD BEFORE TOUCHING ANYTHING

A `STABILIZE` follow-up may still be running against `ProvisionClientForm.tsx`, `admin.ts`,
`RegisterComplete.tsx` and the category/provisioning path. **Read `git log --oneline -15` before
starting.** If those files have moved since this spec was written, re-read them fresh — do not
build against a stale copy. This task's own surface (contact-listing queries, a new admin view)
should not overlap that work, but confirm before assuming.

---

# 1. WHY — D11 was ruled, and never actually built

> **Owner (D11, 2026-08-11):** *"the only thing we would want to do is stop seeing the person's
> account in the main views, but the files will likely be associated with things that other
> people still see and the files need to remain visible for them."*

> **Owner, 2026-08-22, on today's proof case:** *"fix the root cause — deleting an account
> doesn't remove the information from the system so just make sure it retains visibility for the
> contracts even though the account is not visible to users and its only visible to me in the
> deleted accounts view which probably needs to be built."*

**Verified 2026-08-22: it was never built.** `contacts.deleted_at`/`.deleted_by` exist as
columns, but **zero source files filter on `deleted_at IS NULL`** — the flag has no effect on
anything. **`purge_account` is a hard delete** — it runs `DELETE FROM signatures WHERE
signer_contact_id = v_contact` among ~15 other DELETEs — the wrong tool entirely for this, and
D11 already said so explicitly.

**The concrete proof case exists right now**: two `TASK-STABILIZE` test identities
(`6cc4cb7d-cb63-4ab8-9067-41fd450174aa`, `b442080f-d745-4f8f-b794-ec659f34ea5f`) cannot be hard-
deleted — their signatures on 4 EXECUTED documents reference their `auth.users` rows directly,
and destroying that would destroy the evidence. They are the first real case this feature exists
for. **Archive them as this task's own acceptance proof.**

---

# 2. THE WORK

## §1 — archiving hides, never destroys
A new function, **`archive_contact(p_contact_id, p_reason)`**, staff-gated:
- Sets `contacts.deleted_at = now()`, `deleted_by = auth.uid()`.
- **Deletes nothing. Signs nothing off. Touches no document, signature, or contract row.**
- Refuses (or no-ops cleanly) on the platform/tenant-owner protected identities (D1's denylist —
  reuse it, do not re-derive it).
- Records the reason (D19: capture why).
- An **`unarchive_contact(p_contact_id)`** companion — this must be reversible.

⚠️ **Do not build a second archive mechanism.** If `set_document_party_archived` or
`staff_archive_horse` already establish a pattern worth matching for consistency, read them
first and converge on the same shape.

## §2 — archived accounts leave the main views
Every staff-facing contact/client listing (Records, Contacts, the provisioning form's contact
picker, any roster) must **filter `deleted_at IS NULL`** by default. ⚠️ **Enumerate every real
listing query — do not assume one central query serves them all.** Today none of them filter on
this column; find each one.

## §3 — the deleted-accounts view, staff-only
A new surface — **owner-facing, matching D26's Business Operations emphasis** — listing archived
contacts: who, when, by whom, why. Clicking through shows **the full record exactly as it stood**
— documents, signatures, contracts, purchases — nothing hidden from this specific view, because
nothing was destroyed. ⚠️ **This is the ONE place `deleted_at IS NOT NULL` rows are meant to
surface.** Gate it to staff with the appropriate access level; do not expose it to a general
client account.

## §4 — a document's other party still sees it
**The linked-file/shared-record principle (D15) applies here too.** If an archived contact was a
party on a contract with a REAL, active counterparty, that counterparty's own view of the
contract must be unaffected — they still see the document, the signatures, everything. Archiving
one party never hides a shared record from the other party who needs it.

## §5 — apply it to the proof case
Archive the two STABILIZE test contacts. Confirm: they no longer appear in Records/Contacts/the
provisioning picker; their 4 executed documents are still fully intact and readable; the new
deleted-accounts view shows both with a reason.

---

# 3. THE TRAPS

- **D16 is absolute here too.** Nothing about archiving may touch `contract_execution_audit`,
  `signatures`, or an EXECUTED document's `merged_body`.
- **D1's denylist still applies.** The platform owner, the two production FHE staff identities,
  and the company contact are never archivable, on purpose.
- **Do not repurpose `purge_account`.** It stays what it is — the owner's own deliberate,
  ad-hoc, staff-invoked hard-delete path for test identities. This task adds the OTHER thing
  next to it, it does not touch it.
- **`deleted_at IS NULL` must become the DEFAULT everywhere**, not an opt-in filter a screen
  forgets to add. A listing that quietly omits the filter reintroduces exactly this bug.

---

# 4. OUT OF SCOPE
Any redesign of the account/category model (that's D30/D31's rebuild) · bulk archiving · an
archival policy/automation (this is a manual, reasoned, staff action, not a scheduled sweep).

# 5. THE TEST THIS MUST PASS
1. `archive_contact` hides a contact from every enumerated listing; `unarchive_contact` reverses
   it completely.
2. **Zero rows deleted anywhere** by either function — prove it with row counts before/after.
3. The deleted-accounts view shows the archived contact with who/when/why, and their documents
   open exactly as before.
4. A real counterparty on a shared document is unaffected by the other party's archival.
5. The two STABILIZE test identities are archived, confirmed absent from Records, confirmed
   present with full history in the new view.
6. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (baseline).

# 6. THE REACH
Where staff go to archive an account, and where they go to find one again.

# 7. REPORT
`docs/reports/TASK-ARCHIVE-REPORT.md`, with **flagged-not-fixed**.
