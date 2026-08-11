# SIGNING FREEZE — in force from 2026-08-10

> Owner: *"nothing is going to be signed at all until this full revision session is done."*

**No document is signed — lease, onboarding or otherwise — until the contract revision session
completes.** This is a standing constraint, not a preference.

---

## What it changes

**Several known defects are ARMED but cannot fire**, because every one of them needs a
signature to do damage. That lowers their urgency and **raises the bar for what must be true
before the freeze lifts.**

**It does NOT make them less important.** It converts them from "fix before someone signs" into
"all of these must be true on the same day."

---

## THE PRE-SIGNING CHECKLIST — every item must be closed before the freeze lifts

**Do not lift the freeze piecemeal.** These are independent causes with one shared consequence:
a signature that records something nobody agreed to.

### 1. Supersession ignores the horse — `TASK-SUPERSEDE`, NOT FIXED

Signing one horse's document supersedes another horse's on the same template. Two documents sit
at `ready_to_sign` today that would do it — CJ's Beaumont pair against his Peep Show pair.

**Until fixed, signing a horse-bound document silently revokes another horse's authorization.**

### 2. The 13.2 contradiction is reachable — `TASK-LEASEFIX`, IN FLIGHT

`ACCEPTS_PERSONALLY` is currently selectable in every branch, so a lease can be authored stating
both that the Lessor requires general liability **and** that the Lessee carries none — with
`GL_REQUIRED`'s material-breach language live alongside it.

**`contract_lock_blockers` does NOT catch it** — tested. It detects blank fields, and this is a
valid answer. Nothing stops such a document reaching signature.

### 3. Live documents can carry superseded content — `CONTRACT-CURRENCY-RULE.md`, NO MECHANISM

**Nothing recomposes a document when its template changes.** The leases are current only because
a remerge was run by hand; the onboarding documents only by timing.

**The revision session is rewriting template content continuously.** Every live unsigned
document must be recomposed before the freeze lifts, or someone signs superseded text.

### 4. Emailed links point at deleted rows — `SENDGUARD` §2, BUILT AND HELD

Every onboarding re-entry deletes the pending draft and mints a new id. A link sent before a
re-entry points at a deleted row.

Held deliberately until the lease work lands. **It must land before signing resumes**, or a
party follows a dead link to a document that no longer exists.

### 5. The insurance rebuild itself — `TASK-LEASEFIX`, IN FLIGHT

13.2 / 13.3 applied; mortality/medical collapse and the composite share control outstanding.
**Signing a lease mid-rebuild captures a half-migrated insurance section.**

---

## Lifting the freeze

**All five closed, then a recomposition pass, then verify.** The staleness query in
`CONTRACT-CURRENCY-RULE.md` must return zero rows for every live unsigned document —
**that check is the last gate, not the first.**

**61 EXECUTED documents are unaffected.** They are evidence of what was signed and nothing here
revisits them.
