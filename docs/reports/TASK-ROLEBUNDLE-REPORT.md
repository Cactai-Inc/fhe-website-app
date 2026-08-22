# TASK-ROLEBUNDLE — the contract role says what the party owes

**`contract_role_documents` is wired, and it turned out to need three corrections
the seed table alone does not tell you.** All three of the owner's premises
checked out exactly; the work was in what wiring it *literally* would have done.

Branch `task/rolebundle` off main `83b26c1`, worktree
`~/Downloads/claude-code-repo/wt-stabilize`. One migration, dry-run in
`BEGIN … ROLLBACK` then applied to production. Committed, **not pushed**.

---

## The premises, verified

| claim | verdict |
|---|---|
| `contract_role_documents (doc_role, template_key)` exists | **true** — plus `id`, `org_id`; unique on `(org_id, doc_role, template_key)`; CHECK restricts `doc_role` to BUYER/LESSEE/LESSOR/SELLER |
| LESSEE → Company Policies + Facility Rules + Horse Care Release + Emergency Vet Auth | **true, exactly** |
| LESSOR / BUYER / SELLER carry their own bundles | **true** — LESSOR, BUYER and SELLER each → Company Policies + General Release (10 rows total) |
| zero functions in the database reference it | **true** — and it is worse than unwired: **zero views, zero `src/`, zero `api/`, and row security is ENABLED with NO POLICY AT ALL**, so even a staff session selecting from it got nothing back. It was seeded, then sealed |

---

## Three things wiring it literally would have done wrong

### 1. It would have asked French Heritage Equestrian to sign its own Company Policies

The table says LESSOR owes `COMPANY_POLICIES` + `RELEASE_GENERAL`. On every lease
FHE writes, **the LESSOR is French Heritage Equestrian.** The first run of the new
reader against WALK4's executed lease returned, verbatim:

```
"party_name": "French Heritage Equestrian", "party_role": "LESSOR",
"template_key": "COMPANY_POLICIES", "satisfied": false
```

The company does not countersign its own policies, and it does not sign a visitor
liability release to itself. The reader now excludes `contacts.is_company` —
**the same carve-out every other engine here already makes**: D7 ("the company
contact is matched by id only, never email"), `promote_contact_to_account`
(refuses a company contact outright), `_ensure_client_account` (excludes
`is_company` from its email match). With it, that same lease returns only the
LESSEE, correctly.

### 2. Two of LESSEE's four templates already have an incumbent writer

`HORSE_EMERGENCY_VET` and `RELEASE_HORSE_CARE` are **already generated**, scoped
to the contract, by `ensure_horse_documents(horse, contract_id, true)` — called
from `apply_contract_execution_effects` when the lease executes. Measured on
WALK3's real lease: both documents exist, `contract_id` set, `sign_sequence` 2
and 3.

Assigning them again at party-add would be a second write path for the same two
templates (D18) — and it would produce two copies addressed to different people,
because **the incumbent addresses them to the HORSE OWNER, and the seed table
names the LESSEE.** On WALK3's lease both are addressed to French Heritage
Equestrian, not to the lessee.

That disagreement is **reported, not resolved**: the reader returns
`on_this_contract_document_id` / `on_this_contract_addressed_to` so the two can be
compared rather than assumed equal. **It is a real open question for you** — see
"One decision left" below.

### 3. Assigning at party-add reverses a ruling you made four days ago

CLOSEOUT §1.5, owner-ruled 2026-08-18, is a comment in
`advance_document_workflow` today:

> *"the lock-time `ensure_horse_documents` call is REMOVED. A party reviewing a
> lease they might not sign gets nothing else attached; execution creates
> HORSE_EMERGENCY_VET + RELEASE_HORSE_CARE, because only then is the horse
> genuinely coming into care."*

Today's instruction places assignment at party-add, which is earlier than lock —
so for those two templates it would undo that ruling, and for the other two it
would attach paperwork to someone who has not agreed to anything yet.

**Both rulings are honoured by making the obligation computed rather than
generated** (below): the bundle is *known and shown* the moment a party takes a
role, and *nothing is attached* until the point each document's own owner
attaches it.

---

## What was built

### The obligation is COMPUTED, not stored — and that is D31, not a shortcut

D31: *"Obligation … computed from what was actually purchased or what
relationship currently exists, never from static category membership alone."*
**A contract role is a relationship, and `document_parties` already records it.**
So there is nothing to write and nothing to keep in sync:

```
document_parties (who holds which role on this contract)
  × contract_role_documents (what that role owes)
  = what this party owes on this deal
```

Copying that into `contact_required_documents` would have been wrong twice: that
table is keyed `(contact_id, template_key)` — **account-global, with no way to
express "scoped to that contract"** — and populating it is precisely the
static-bucket model D31 exists to retire.

**`contract_role_document_requirements(document_id)`** (new, applied) is the one
place that answers the question. Per party, per template it returns: the title,
whether it is `satisfied` (an executed document of that template on file for that
person), what already sits on this contract and who it is addressed to, and
`owned_by` — naming `ensure_horse_documents@execution` for the two templates that
have an incumbent generator, so a surface can say "attaches on execution" instead
of showing a gap that is not a gap.

Readable by staff **and by a party to that contract** — a lessee is entitled to
see what their own role owes. The table also got the staff read policy it never
had.

### "The three documents seen together, in one known event"

The contract's own **Parties & Horse** card now carries **"THE PAPERWORK THIS DEAL
CARRIES"** — the bundle, grouped by party and role, on the deal itself. Proven in
a browser on the real lease `375efff8-…`:

```
cjzigs+stab-party-1787389379@icloud.com · Lessee
  ⏱ Company Policies                              — not on file
  ⏱ Facility Rules and Safety Acknowledgment      — not on file
  ⏱ Horse Emergency Veterinary Authorization      — attaches when this lease executes
  ⏱ Horse Handling and Routine Care Liability Release — attaches when this lease executes
```

The LESSOR (French Heritage Equestrian) is correctly absent.
`rb-01-contract-paperwork-panel.png`.

### The "deal party" badge, derived — and the old one was wrong

Owner: *"derive it from 'this account holds a contract role and has no
purchases', don't add it as a category token."* Done: no new
`CLIENT_CATEGORIES` entry, no new `groups.group_type`, no schema change.

**A "Deal-only party" chip already existed on the roster, and it was wrong twice
over.** It read `supp.dealParty` — *party to ANY document*, which is true of every
client the moment they sign a release — and it was saved from appearing on all of
them only by an unrelated `m.kind === 'contact'` gate. So the one person the badge
is for (a real account holding a lease and buying nothing) **never got it.** It is
replaced by the owner's rule, using the same four contract roles the DB reader
uses, so the badge and the contract panel cannot disagree.

Proven in a browser, both directions:

| identity | roles | orders | badge |
|---|---|---|---|
| `cjzigs+stab-party-1787389379@…` | LESSEE | 0 | **DEAL PARTY** shown |
| `STABTEST STABTEST` | LESSEE | 1 | **not** shown — reads RIDER, derived from the purchase (D31 working as designed) |

---

## One decision left for you

**Who owes the horse documents on a lease — the LESSEE, or the horse owner?**

`contract_role_documents` says LESSEE. The shipped generator addresses them to the
horse OWNER. Both are defensible — the lessee is the one handling the horse; the
owner is the one who can authorize veterinary treatment on an animal they own —
and the two have been quietly disagreeing since stage1h, invisibly, because the
table was never read.

Nothing was changed either way. The reader shows both answers side by side so the
next person to look has the facts. Say which is right and it is a one-line change
to whichever side is wrong.

**The related question, if you want it later:** whether the outstanding bundle
should *block* the lease from locking (`contract_lock_blockers`). It does not
today, and I did not switch it on — it would stop live leases mid-flight, and
that is your call, not mine.

---

## Checks

| check | result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **0 errors** |
| `eslint .` | **46 problems (0 errors, 46 warnings)** — identical to main |
| `vitest run test/db` | **46 failed / 30 passed (76)**, failing-file list **diff-identical** to main |
| migration | dry-run in `BEGIN … ROLLBACK`, exercised against two real leases, then applied |

## Rows touched

The LESSEE role on the throwaway test lease `375efff8-…` was moved from
`cjzigs+stab-weekly-…` to `cjzigs+stab-party-…` (both STABILIZE test identities,
neither a real client) so the badge's positive and negative cases could both be
shown on real data. Nothing else was written. The 28 test bookings and two test
accounts from TASK-STABILIZE are still listed in that task's purge list.

## Teardown

Browser processes: none (Playwright closed on exit). Dev server: one `vite` on
:5199, stopped. `psql`: one-shot calls only. Tooling in `rolebundle-tooling/`,
gitignored, with vite's cache pointed OUTSIDE the repo (an in-repo cache put 4
lint errors into `eslint .` — caught and fixed before reporting). `node_modules`
in this worktree is a symlink to the main checkout's; remove it before reusing
the worktree for a build.
