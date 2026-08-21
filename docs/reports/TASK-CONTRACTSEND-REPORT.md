# TASK-CONTRACTSEND — report

## Can the owner send a contract today?

**The two defects that made it impossible are fixed, and both fixes are proven in a real
browser. But I cannot tell you it works in production, because this session had no
production access — and the task's acceptance criterion is a production walk.**

Precisely:

- **Both blockers are gone.** No date could be saved (§1) and the horse-confirmation control
  could never render (§2). Either one alone made it impossible to lock any lease — WALK3 got
  a contract executed only by writing to the database directly. Both are fixed, and each fix
  is demonstrated by rendering the real `ContractPage` in real Chromium and clicking the real
  control, not by reading source.
- **A third defect (§3) that was silently orphaning documents is fixed** — it is very likely
  why production held zero contracts before WALK3.
- **What I could not do:** author, fill, lock and sign a lease end-to-end **in production**.
  This container has no `.env.db`, no Supabase credentials and no browser session for the
  tenant. **Acceptance criteria 4, 5 (the existing-orphan list), 6 and 7 need a production
  walk that only the owner's environment can run.** I have not claimed them.
- **§4's premise is wrong, and I can show why.** `my_roles` is not the bug. See §4 below —
  the card WALK3 saw "with no controls" is the *agreed terms* list, which correctly has none.

**Recommendation: run one owner-side walk against production before sending a real contract.**
Everything needed for it is listed in "What still needs a production walk" at the end.

---

## §1 — No date field could be saved

### The defect, and why four different attempts all failed

`InlineInput` (`ContractCascade.tsx`) committed **only on blur**, and the Enter-to-commit
shortcut every other input honoured **explicitly excluded dates**:

```js
onKeyDown={(e) => { if (e.key === 'Enter' && type !== 'date') { … blur(); } }}
```

A Chrome date field keeps focus through the entire picker interaction. So a date had exactly
one commit path — focus physically leaving the control — and none of WALK3's four attempts
(`.fill()`, `.type()`, a native-setter `dispatchEvent`, segmented keyboard entry) does that.
The value appeared in the document and **no RPC was ever fired**, exactly as reported.

### Proof, before the fix

Reproduced in Chromium against the live-fixture document. The asymmetry is the finding:

| control | `.fill()`, no blur | then Enter |
|---|---|---|
| **date** | value on screen, **0 saves** | **still 0 saves** |
| text | commits | commits |
| select | commits immediately | — |

### It was never the server

Against real Postgres (PGlite running this repo's schema), `set_contract_field` stores and
returns every kind cleanly, dates included — ISO in, ISO out, which matters because
`<input type="date">` silently rejects any non-ISO value. `contract_lock_blockers` also
correctly drops the field from `required_fields` once set. **The defect was entirely
client-side**, which is what made it survive: the DB looked fine.

### The fix

A date now commits **on change**, like a `select` — and Enter commits it too.

This is safe for a date and not for free text: a date input's value is **atomic** (the
browser reports `''` until every segment is valid, then a complete ISO date), so there is no
half-typed state to protect — which is the only reason the text path waits for blur. Applied
to both renderers (`InlineInput` and the block `FieldControl`, so flat-template documents get
it too).

While pinning this I found and fixed a flaw in my own first cut: committing on change *and*
on blur wrote the same value twice whenever the parent's reload lagged. Both controls now
track what they have already sent (`sentRef`), so one edit is one write.

### Result — 18/18 input kinds round-trip, in a real browser

`node test/browser/probe-field-roundtrip.mjs`:

| kind | result | kind | result |
|---|---|---|---|
| (null) | PASS | certify | PASS |
| text | PASS | yesno | PASS |
| longtext | PASS | buttons | PASS |
| number | PASS | contacts_list | PASS |
| currency | PASS | fee_schedule | PASS |
| **date** | **PASS** (was the defect) | med_schedule | PASS |
| percent | PASS ¹ | reveal_text | PASS |
| select | PASS | location | PASS |
| | | add_text | PASS |
| | | week_grid | PASS ¹ |

¹ `percent` and `week_grid` sit behind conditional gates. Until the gate is open they render
as **deliberate non-interactive previews** (`pointer-events-none`) because the composer drops
their line — accepting input there would be a lie. Opening the gate is part of reaching the
control; both save correctly once open. **I initially misread both as failures**, which is
worth recording: a generic "fill every box" sweep reports eight false failures on this page.

And the round-trip proper — **a date typed into the real page survives a full reload**
(`probe-horse-confirmation.mjs`, check 4).

⚠️ **jsdom passed this bug.** It accepts any string as a date value and fires events the
browser will not, so the original code passed under jsdom and failed in Chromium. That is why
`test/browser/` exists.

---

## §2 — The horse-confirmation control could never render

Confirmed exactly as reported. `ContractPage.tsx` compared `f.section === 'Horse'` in **both**
render sites (the standalone card, and the flat renderer's section header) while every
template stores the **key**, `'HORSE'` — verified in the migrations, in a live production
field dump, and in a freshly seeded lease. The comparison matched nothing, `horseFields` was
always empty, and the control never appeared.

**This alone blocked every lease.** `contract_lock_blockers` returns `horse_unconfirmed` on a
fresh lease, and the only thing that clears it is `confirm_horse_section` — reachable solely
through that button. Both halves are now pinned by tests.

**Fixed as instructed:** the comparison, not the data, and case-insensitively via a named
`isHorseSection()` helper so it cannot recur by someone writing the heading instead of the key.

### Rendered, not read

![the horse-confirmation control](contractsend-shots/horse-confirmation.png)

- with the fix → **button visible, and clicking it fires `confirm_horse_section`**
- reverted to `=== 'Horse'` → **button absent**
- restored → visible again

That is causation, established by rendering the real page. It also settles the CONTRACTWALK
claim this task flagged: that control was **not** reachable, and the claim came from reading
source.

### The rest of §2 — other literal comparisons of this class

**Swept, and there are no others.** Every remaining `input_kind` / `format_type` comparison
uses lower-case literals that match the database exactly (verified against a live document's
rows). Every `party_role` / `owner_role` comparison uses upper-case literals that also match.
The three surviving `section ===` comparisons are key-to-key (against a `sectionKey` variable,
not a literal). The two sites fixed here were the only mismatches.

---

## §3 — "New contract" orphaned real database rows

Reproduced by reading the path, and the mechanism is exactly as WALK3 described.

`DEFAULT_CONTROLS` has `can_edit_deal: false`, and `NewContractPage` seeded **both** party
cards from it. `set_party_controls` refuses a document where no party can edit deal terms —
correctly; the guard exists so that not every change has to go through staff. So **the
combination the page displayed as its own default was one the server always rejects**, and it
failed on the *second* of two calls made *after* `start_lease_contract_v2` had already written
the contract, document and party rows. The user saw *"Could not start the contract"* — false —
and a real document was left behind that nobody could reach.

**Three fixes, because the shape of this bug has three parts:**

1. **The default is now valid.** Party B (the counterparty) holds `can_edit_deal` by default,
   so leaving the form alone produces a contract.
2. **Refuse before writing.** If neither party can edit deal terms, the page says so and names
   the control to change — while nothing has been created.
3. **Never orphan.** Every post-creation step (origination, both controls, horse assignment)
   is now individually tolerated: if one fails, the page **navigates to the document that
   exists** and reports which settings were not applied, on a banner that survives the page's
   reloads. An incompletely configured contract the author can see and finish beats an
   invisible one they cannot.

⚠️ **The existing orphans in production are not listed** — that needs a query against the
production database, which this session cannot reach. WALK3 named three
(`2f18d3ea-…`, `6f073fbd-…`, `ada59382-…`). The query to find the rest:

```sql
SELECT d.id, d.created_at, d.title
  FROM documents d
  LEFT JOIN document_party_controls c ON c.document_id = d.id
 WHERE d.deleted_at IS NULL AND d.workflow_state = 'editable'
 GROUP BY d.id HAVING count(c.*) < 2
 ORDER BY d.created_at DESC;
```
Do not delete them — D11 and D16 both apply.

---

## §4 — `my_roles` is not the bug, and the disposition controls are not missing

**The task's §4 premise does not survive contact with the evidence.** I checked before
building anything, per the instruction that this was a bug hunt.

**1. `my_roles` resolves correctly.** Against real Postgres, `contract_document_detail`
returns `["LESSEE"]` for the lessee and `["LESSOR"]` for the lessor. It returns `[]` for
staff — which is *correct*, staff are not a party, and `isOwnerSide` covers them
(`isOwnerSide = isStaff && !viewAsSigner`, and `viewAsSigner` can only be true when
`myRoles` is non-empty; so empty `my_roles` gives a staff viewer Accept/Reject, never
"Pending review").

**2. WALK3's screenshot shows a different thing than the task assumed.** In
`walk3-shots/C13-walktest-view-of-proposal.png`, the counterparty's proposal card renders the
clause under the heading **"AGREED ADDITIONAL TERMS"** — that is
`redline.addenda.filter(a => a.status === 'accepted')`, a list of things already agreed. It
has no Accept/Reject **by design**. It is not the `openClauses` branch, and it never reached
the `"Pending review"` fallback the task quotes.

**3. The real defect in that area is WALK3's F-4** — visible in
`C17-staff-view-after-walktest-suggest.png`: after WALKTEST submits a suggestion, the staff
view shows only the same single agreed term. The counterparty's suggestion is not there.
The modal reported success (*"suggested for review"*, `C16`), and both client wrappers
(`proposeContractComposition`, `addContractComposition`) do throw on error — so the server
accepted it.

⚠️ **I could not finish diagnosing F-4, and I am not going to guess.** The PGlite schema
snapshot is **dated 2026-08-03** and does not contain `contract_pending_compositions` or
`propose_contract_composition` at all. Applying the PARTYSTAGING migration on top fails with
*"contract_document_detail rewrite did not match its anchor"* — it is one of the ~31 in-place
function-rewrite migrations CLAUDE.md warns are unreplayable on a fresh database. **So the
local harness cannot exercise the suggest path in either direction.**

**One concrete lead, proven:** on a freshly started lease,
`caller_may_propose(doc, 'suggest')` returns **false for both parties**, because
`start_lease_contract_v2` seeds **no `document_party_controls` rows** and the check
`coalesce(c.can_suggest, false)` over a `LEFT JOIN` therefore yields false. Controls only
exist once staff set them on `NewContractPage`. Worth checking first against the live
document — and note it interacts with §3, since that is the very call that was failing.

**REVISE (counter-offer) is genuinely absent**, as the task says. Not built, per instruction.

**⚠️ A finding about the test infrastructure itself, which I think matters more than any of
the above:** the schema snapshot is **18 days stale**. Everything merged since 2026-08-03 —
PARTYSTAGING, ADDITEM, NOSTRIP, BUYANDBOOK, CATEGORISE — is invisible to `test/db`. Related:
`test/db/contract_workflow.test.ts` and `test/db/e2e_contract.test.ts` currently fail **40 of
42 tests on `main`**, unrelated to this task (they lack the `status_events_vocab` seed the
snapshot no longer carries). The contract engine's main DB suite is not running.

---

## Verification

| # | acceptance criterion | status |
|---|---|---|
| 1 | a date is typed, saved, and survives a reload | **PASS** — real Chromium; and stored/read-back verified against real Postgres |
| 2 | every `input_kind` round-trips, listed one by one | **PASS — 18/18**, table above |
| 3 | the horse-confirmation control renders and can be clicked | **PASS** — screenshot above; causation shown by revert |
| 4 | a complete lease authored → signed through the browser, zero DB writes | **NOT DONE** — needs production; no credentials in this session |
| 5 | New Contract creates no orphans; existing orphans listed | **half** — fixed and the mechanism is closed; the list needs a production query (SQL above) |
| 6 | `my_roles` resolves for a counterparty; both control sets render | **premise disproven** — `my_roles` resolves; see §4 |
| 7 | no real client document touched | **PASS, trivially** — this session never reached production |
| 8 | typecheck 0 · lint identical to main | **PASS** — typecheck clean; lint 0 errors / 46 warnings, byte-identical to main |

**Tests added** (6 new, all passing): `test/ui/contractsend_field_commit.test.tsx` (date
commits on change; text still waits for blur; no double-write),
`test/ui/contractsend_horse_section_case.test.ts` (the section key really is `HORSE` on both a
live and a fresh document), `test/db/contractsend_field_roundtrip.test.ts` (every kind
round-trips server-side; `horse_unconfirmed` blocks until confirmed).

**Pre-existing failures, unchanged by this work** (verified by stashing): 3 UI test failures
plus `clause_ownership_affordance` needing a build, and the 40 contract DB failures noted
above. UI passes went 130 → 136.

---

## What still needs a production walk

Short and specific. On the live site, as staff:

1. `/app/ops/contracts/new` — create a lease **leaving Document Controls alone**. It should
   now create a contract and land on it. (§3)
2. On the contract, type a **Commencement Date**, then reload. The value should still be
   there. (§1)
3. Confirm the **"I reviewed the horse info — it's accurate"** button is on the page, click
   it, and check `contract_lock_blockers` no longer returns `horse_unconfirmed`. (§2)
4. Then lock and sign both sides — the first end-to-end lease with **no database writes**.
5. Run the orphan query above and report what it finds. Do not delete anything.
6. If the counterparty's **Suggest** still fails silently, check `document_party_controls` for
   that document first (§4's lead), and capture the network response.

---

## Notes on how this was verified

No production database, no production browser session, no client data touched — none was
reachable from this session.

Everything above was proven against (a) **real Postgres**: PGlite loaded with this repo's own
schema, running the actual RPCs, and (b) **real Chromium**: the actual `ContractPage`, with
its real components, router and providers, served RPC payloads captured from (a). Only the
network layer is substituted. The harness, its limits and how to run it are in
`test/browser/README.md`.

That combination is what made the difference here: the DB proved the server was innocent, and
the browser proved a bug that **jsdom reported as passing**. It cannot prove RLS, delivery, or
anything about real data — hence the walk above.
