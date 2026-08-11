# TASK DOCPACKET — the onboarding set is a packet, not six documents

**Owner, 2026-08-10:**

> *"the onboarding docs need to be collected into files instead of appearing as individual
> documents its such a clusterfuck in the docs drawer right now. they are meant to be a packet
> not individual items, they are just rendered and signed that way to keep it easy to swap them
> in and out at onboarding"*

**Read the second half as carefully as the first.** The individual documents are NOT an
accident to be cleaned up — they are how the set stays swappable per category. **This is a
PRESENTATION change. Storage, generation and signing stay exactly as they are.**

---

## What the drawer shows today

Verified 2026-08-10. Live documents per contact:

```
CJ Z 8 · Sarah Morgan 7 · Claire Bourdon 6 · Mary Richardson 6
Charles Zigmund 5 · and eight more at 4 each
```

Four to eight individual rows where there should be **one packet row**, plus any genuine
contracts (a lease) listed separately.

**This is not churn.** Swept documents are already hidden — Claire has 6 swept and they do not
appear. The drawer is showing the real set, and the real set is too granular.

## There is no grouping key

`documents` has 41 columns and **not one of them records that six rows are one packet.**

What exists incidentally: documents assigned in one transaction share `created_at` to the
millisecond — Claire's six are all `2026-08-10 16:42:02.225`.

**Do not build the packet on that timestamp.** It is an artifact, not a declared relationship,
and it breaks on precisely the case the owner cares about: **swap a document in or out later
and it gets a new timestamp and falls out of its own packet.**

---

## DECIDED 2026-08-10 — option 3, and the packet expands.

**Grouping: contact + onboarding class.** No migration, no new column. Every onboarding-class
document for a contact is one packet, whenever it was assigned — so swapping documents in and
out changes the packet's contents, which is the flexibility the owner described. The class is
already knowable from `contract_templates.wall_gating`.

**Presentation: the packet row EXPANDS to reveal the individual documents**, each opening on
its own exactly as today. **Not** a combined continuous render. This is the smallest change
and every existing path keeps working — signing, printing and delivery still target the
individual documents underneath.

**Settled by the orchestrator, not the owner** (implementation detail under his direction):
a lease sits OUTSIDE the packet — it is a contract, not onboarding paperwork.

The three shapes are retained below as the record of why option 3 won.

## The shapes considered — ASK, DO NOT PICK (historical)

**1. Derive from the assignment instant.** No migration. **Breaks on every swap, resend or
late addition.** Listed only so nobody proposes it later; it fails the owner's own use case.

**2. A `packet_id` column on `documents`.** One migration, durable, survives swaps, and can
represent more than one packet per person over time.

**3. Group by contact + onboarding class — RECOMMENDED.** No new column, no migration. Every
onboarding-class document for a contact is one packet, whenever it was assigned. Swapping
documents in and out changes the packet's contents, which is exactly the flexibility the owner
described. The class is already knowable — `contract_templates.wall_gating` marks the
onboarding class and already drives `my_wall_state()`.

**Limit of option 3, stated honestly:** it cannot represent two packets for the same person
over time — a re-onboarding a year later merges into one. If that matters, option 2.

## Also needs answering — do not guess

- **What is the packet called?** One name for everyone, or named per standing category
  (Rider / Horse owner)?
- **Expand or combined view?** Click to reveal the individual documents, or open one
  continuous scroll of all of them?
- **Does a lease sit inside or outside?** Presumed OUTSIDE — a lease is a contract, not
  onboarding paperwork — but confirm.
- **Partial states.** What does the packet row show when three of six are signed? A count, a
  progress state, or the packet's own status?

## A dependency the owner should know about

**There is no server-side PDF generator in this codebase at all.** Confirmed in the
`PARTYJOURNEY` findings: PDFs are produced by browser print against `.print-document`.

So **"download the packet as one PDF" cannot be built today** — it is blocked on a generator
that does not exist. A combined on-screen view is achievable now; a single file is not.

Related: the onboarding completion email currently carries per-document PDFs. If the packet
becomes the unit, that email is affected — but it inherits the same blocker.

## Constraints

- **Presentation only.** No change to how documents are generated, assigned, or signed, and no
  merging of records. The swappability depends on them staying separate.
- **61 EXECUTED documents are evidence.** Grouping them for display must not alter a row.
- Own worktree off `origin/main`. Never the canonical checkout — a pre-commit hook refuses
  code commits there.
- Run `npm install` in the worktree before claiming a typecheck. **`npx tsc` with no
  `node_modules` fetches an unrelated package and exits 0.**
