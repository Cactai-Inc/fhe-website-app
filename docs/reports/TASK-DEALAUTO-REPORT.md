# TASK-DEALAUTO — the deal generates itself, the bundle signs itself in, one email carries both

**Branch** `task/dealauto` (worktree `~/Downloads/claude-code-repo/wt-dealauto`) · **not pushed**
**8 migrations, all APPLIED to production** (`lrstswfxfsezdmvkvukc`) · 3 source files changed
**Proven in a real browser against production data**, second signer through to the single email.

---

## 1. WHAT THE OWNER SAID, AND WHAT IS TRUE NOW

> *"all of those are bundled together to be signed after the contract is signed by both parties.
> if lessor is last to sign which is typically the case, the documents are to be surfaced in
> sequence immediately after the signature is captured on the contract. and then the whole
> document set, contract + bundle are sent in one email and captured as a deal. deals should auto
> generate now that i think about it so that page should be self-populating not manually authored
> as the first step before a contract nor after."*

| ruling | before | now |
|---|---|---|
| deals auto-generate | **0 rows in `deals`.** `create_deal` had exactly one caller — the New-deal modal — so a deal existed only if a human authored one | a deal is opened by the database on the `contracts` INSERT, whatever started the contract. 7 deals in production, none of them typed in |
| the bundle signs after both parties sign | the bundle was a **read-time computation only**. Nothing generated it. Ever | generated on the executing signature, sequenced behind the contract, and the signer is taken to it with **no further click** |
| one email, contract + bundle | two sends by design — and in fact **zero sends**: every client-signed run since at least 2026-08-20 died on `executed_email_error = 'not authorized'` | one POST, four PDFs, one email per party. Proven, with the delivery rows |
| Deals is a read surface | the only way a deal could exist | manual creation retired behind a boolean; the page reports and does not author |

---

## 2. THE DECISIONS I MADE, AND WHY

### §1 — creation happens at the CONTRACT INSERT, not at execution
The owner's phrase rules out both ends — *"not… as the first step before a contract nor after"* —
which leaves the moment the contract itself becomes real. Three existing facts agree with that
reading and none with the execution-time reading:

- `deal_status` already has a `'created'` code commented *"no governing document yet: the deal
  exists, nothing has been opened."* Unreachable unless deals precede documents.
- `deal_completion_state` already reports *"No Lessor named" / "No Lessee named"* as outstanding.
  A deal born at execution can never show either.
- §4 makes DealsPage the reporting surface. A deal that appears only at execution makes that page
  **blind to every lease in flight** — exactly the population staff need to see.

Execution keeps a second, idempotent call as a safety net, so a contract that predates the trigger
still acquires its deal.

### There is still exactly ONE `INSERT INTO deals` in the database
`create_deal` was **not** reimplemented and **not** bypassed. Its INSERT was lifted into
`ensure_deal_for_contract`, and `create_deal` now calls that. It also could not have been called
as-is from a trigger: it opens with `auth.uid()` + `has_staff_access()` guards and **creates its
own contract row**, so calling it from an existing contract's execution would have produced a
second contract.

### `deal_type` is read, never guessed
Four fallbacks, each reading something an existing function already trusts: `terms->>'deal_kind'`
(what `create_deal` writes) → `terms->>'deal_side'` (what the three `start_*` functions write) →
the governing document's template, using the *identical* predicate
`apply_contract_execution_effects` and `deal_autocomplete_on_execution` both use → the party roles.
**Unclassifiable returns NULL and no deal is created.** Proven: a `segment='rider'` contract with
empty `terms` gets zero deals.

### §3 — what decides the send is neither candidate the task offered
Not `can_complete`: it gates on the governing document alone (the owner's own ruling, untouched),
so it is satisfied *the instant the lease executes* — the exact moment the bundle does not yet
exist. Using it would send the contract alone and leave the bundle to a second email, which is the
behaviour being removed. Not "the bundle for a given party is complete" either, because delivery is
not per-party: `/api/deliver-documents` groups recipients across a document **set**.

**The unit is the contract's signing set** — every document on the contract carrying a
`sign_sequence`. When none is left awaiting a signature, the deal's paperwork is finished and it
goes out as one email. `sign_sequence IS NOT NULL` is load-bearing: an unrelated draft parked on
the same contract cannot make the hold open-ended.

### `deal_completion_state` was NOT touched
The trap was explicit and it was right: its comment *"ONLY the governing document gates
completion… an optional agreement the parties chose not to sign is their business"* **is** the
owner's ruling, written down before today. The bundle does not block completion. In the walk the
deal reached `complete` on the lease's execution, while three bundle documents were still unsigned.

---

## 3. WHAT WAS BUILT

| migration | what |
|---|---|
| `…T0700_dealauto_1_the_deal_is_a_byproduct_of_the_contract` | `contract_deal_type`, `ensure_deal_for_contract` (the one INSERT), `contracts_ensure_deal_trg`, `create_deal` refactored onto it, backfill of 6 existing contracts |
| `…T0710_dealauto_2_the_governing_document_is_found_by_kind` | `is_deal_governing_template`, `deal_governing_document`; `deal_status` + `deal_detail` resolve by KIND |
| `…T0720_dealauto_3_the_bundle_sequences_in_behind_the_signature` | `ensure_contract_role_documents`; `ensure_horse_documents` born signable; `deal_autocomplete_on_execution` extended |
| `…T0730_dealauto_4_one_email_carries_the_contract_and_its_bundle` | hold rule (c) contract-scoped; `deliver_executed_document_set` reaches across the contract; sweep backstop for anchor-less documents |
| `…T0750_dealauto_6_a_finished_signing_set_is_the_send` | `contract_signing_set_complete`; the finished set IS the delivery event; governing document leads its own set; backfilled deals settled |
| `…T0760_dealauto_7_the_execution_trigger_may_actually_send` | the `not authorized` root cause (below) |
| `…T0740` / `…T0770_dealauto_5,8` | `contract_signing_set` gains `i_sign` / `i_signed` — "a seat I can complete", including the company seat staff complete |

**Source:** `ContractPage.tsx` (sign-and-continue + the "your part is done" tell),
`contracts.ts` (two optional fields), `DealsPage.tsx` (manual creation retired).

### The one that matters most — and it was already broken before this task
`deliver_executed_document_set`'s guard admitted `service_role`, staff, or a null auth context.
Its own comment says it means to admit *"the execution trigger (SECURITY DEFINER, runs as the
definer)"* — **that condition was never true.** SECURITY DEFINER changes the executing role; it
does not change `auth.uid()` / `auth.role()`, which keep reporting the signed-in human. When a
CLIENT signs the last document of their run, the trigger is refused, `documents_send_executed_email`
catches it (correctly — a mail failure must never roll back an executed instrument) and files it in
`executed_email_error`. Silently.

**Production, before the fix:**

```
template_key            | mailed | held | executed_email_error
HUMAN_EMERGENCY_MEDICAL |   f    |  f   | not authorized     <- the flush
COMPANY_POLICIES        |   f    |  t   |                    <- its batch,
FACILITY_RULES          |   f    |  t   |                       still held
RELEASE_PARTICIPANT     |   f    |  t   |
```

Three complete onboarding runs — 2026-08-20, -21, -22 — in exactly that shape. `pg_trigger_depth()
> 0` is now an admitted caller; it is 0 for any direct RPC from a browser, so the boundary (the
function IS granted to `authenticated`) is intact.

---

## 4. THE TEST THIS HAD TO PASS

Setup: a horse owned by **Walk4 WALKTEST** (an individual LESSOR, so the bundle is non-empty),
leased to **Walk1 WALKTEST**. Authoring, field-fill, lock and the LESSEE's signature were driven
through the app's own RPCs (`start_lease_contract_v2`, `set_contract_field`,
`confirm_horse_section`, `advance_document_workflow`, `lock_and_sign_contract` — the exact calls
the UI makes). **The deciding signature and everything after it was done by clicking, in a
browser**, as Walk4, against production data.

| # | required | result |
|---|---|---|
| 1 | a `deals` row before anyone touched a Deals page, correct `deal_type` | **FHE-000034, LEASE, present at contract creation** — before a single field was filled |
| 2 | second signer sees their bundle immediately, in the same session, in a browser | **`navigated without a further click: true`.** One click on Sign → *"Document 2 of 4 — signed in order"*, *"Signed. Next: Vet authorization."* Then 2→3→4 the same way. Four documents, four Sign clicks, zero navigation clicks |
| 3 | exactly one email, contract + every bundle document | **one `net.http_post`**, `documentIds` length 4. All four rows share one `executed_email_sent_at` (`14:18:20.000283`). `document_deliveries`: 4 docs × Walk1, 4 × Walk4, 4 × company mirror = **one email each with all four PDFs** |
| 4 | the deal reaches `complete` per the existing `can_complete` | **complete**, on the lease's execution, with the bundle still unsigned — matching the untouched rule |
| 5 | DealsPage shows it with no manual entry anywhere | 7 auto-generated deals; `"New deal" affordance present: false` on both routes |
| 6 | typecheck 0 · lint identical to main · `test/db` diffed file-for-file | `tsc` app **0**, api **0**. eslint **46 warnings / 0 errors on both branch and main**. `test/db` **575 passed / 193 failed / 51 red files — identical to main, file for file** |

Screenshots: `docs/reports/dealauto-shots/`.

### Trigger firing, proven — not inferred (ORCHESTRATOR §3c)
Probe triggers with the **identical event clause**, in rolled-back transactions:

- `AFTER INSERT ON contracts` → fired; deal present; and a `segment='rider'` contract with empty
  `terms` correctly got **no** deal.
- `AFTER UPDATE OF workflow_state ON documents` → fired on `record_signature`'s own
  `UPDATE documents SET status='EXECUTED', …, workflow_state='executed'`, which names the column.
  Six probe rows across one full lease run, including `editable -> executed` on the governing
  document.

The delivery proof was run the same way — signing all five documents of a synthetic lease inside a
transaction and reading `net.http_request_queue` before rolling back. **That is how the
"zero emails" defect in §3 was found**: with migrations 1–5 in place the queue was empty at the end
of a complete run. Reading the rows afterwards would have shown nothing wrong.

---

## 5. FLAGGED, NOT FIXED

**F1 — one email carries the OTHER party's bundle too. Owner decision.**
`/api/deliver-documents` in untargeted mode sends **all** attachments to the union of **all** the
documents' parties. In the walk, Walk1 (lessee) received Walk4's signed Visitor Release and both
horse documents; Walk4 received the lease. That follows the owner's wording — *"the whole document
set… sent in one email"* — and matches how `deal_detail` already exposes every document on a
contract to every contract party. But it is a **disclosure** decision, not a technical one. The
narrowing is one predicate in `deliver_executed_document_set` (restrict the contract widening to
documents the recipient is a party to) plus `recipientContactIds` targeting. **Say the word.**

**F2 — the LESSEE role bundle is structurally always empty.**
`contract_lock_blockers` refuses to sign a contract until every individual signer's onboarding wall
is clear, and that wall already requires `COMPANY_POLICIES` + `FACILITY_RULES` — which is exactly
the LESSEE row set in `contract_role_documents`. So by the time a lease *can* be signed, the
lessee's bundle is satisfied and generates nothing. The bundle only ever has content for
LESSOR/BUYER/SELLER, whose `RELEASE_GENERAL` is **not** in the wall. Not a bug in either mechanism
— the two lists simply overlap. Worth deciding whether `contract_role_documents` should carry the
wall's templates at all.

**F3 — the hourly delivery sweep is not clearing its backlog.**
`flush_held_executed_document_emails(30)` works: run as `service_role` it selected 4 contacts and
13 documents and queued 4 posts. Yet documents held since 2026-08-20 are still held and unmailed.
`/api/delivery-sweep` is in `vercel.json` at `0 * * * *`. Either the cron is not firing or it is
erroring. **Worth checking the Vercel cron log** — F1's fix and mine both depend on the sweep as
their backstop.

**F4 — `pg_net`'s 15 s timeout is now routinely exceeded.**
The walk's single POST rendered 4 PDFs and sent 3 emails; it **succeeded** (all 12 delivery rows
written) but `net._http_response` recorded `Timeout of 15000 ms reached`. Harmless today, because
`document_deliveries` is the durable success signal — but the whole point of this task is that the
sets get bigger, and a false timeout is a bad thing to be relying on nobody reading.

**F5 — hold rule (a) is far too broad, and I deliberately did not touch it.**
It holds a contact's executed document while that contact has **any** other non-EXECUTED document,
anywhere, in any state — including a draft on an unrelated contract that nobody is waiting on. It
is why the probe found zero emails. Loosening it risks the D25 onboarding batch for a gain this
task did not need, so instead I made the finished-signing-set its own delivery reason. Rule (a)
still governs everything else, and still has no time bound of its own.

**F6 — `create_deal` is left callable and unreachable.**
Per §4's instruction. It remains the escape hatch for a deal needing a contract envelope with no
governing document. `DEALS_MANUAL_CREATION_RETIRED = true` in `DealsPage.tsx`; flip it and the
modal returns unchanged.

**F7 — a fixed defect worth naming: the horse documents were unsignable.**
`ensure_horse_documents` attached `HORSE_EMERGENCY_VET` / `RELEASE_HORSE_CARE` to the right party
at the right time, with the right sequence numbers — and left them in `workflow_state='editable'`,
where ContractPage renders **no signing section at all** (it is gated on
`in_review || locked || signatures.length > 0`). Both live production copies carry **zero**
`contract_fields` and return `[]` from `contract_lock_blockers`. They now open `locked` when there
is nothing to author, which is what made steps 2 and 3 of the walk clickable.

---

## 6. TEARDOWN

Vite dev server stopped; every Playwright browser closed on script exit; `ps` clean for
`vitest`/`chromium`/`headless_shell`/`vite` at report time. `.env` (dev Supabase pointer, public
anon key read from the deployed bundle) and `dealauto-tooling/` are **gitignored and not
committed**. `.env.db` / `.env.test` were copied into the worktree and are gitignored — not
propagated.

**One production side effect to know about:** the WALKTEST identity `Walk4` was given a password so
the browser walk could sign as a real second party. It is a test identity; the password lives only
in gitignored `dealauto-tooling/state/walk4-password.txt`. A horse `ZZZ-DEALAUTO-TESTHORSE` and its
lease (deal FHE-000034, 4 executed documents) are real production rows, created deliberately as the
walk's evidence, and are named `ZZZ-` like every prior walk's test data.

**The signing freeze** (`docs/reference/SIGNING-FREEZE.md`) covers real client signing. The
signatures above are WALKTEST identities on `ZZZ-` test data, the same posture WALK1–WALK4 used on
2026-08-20/21.
