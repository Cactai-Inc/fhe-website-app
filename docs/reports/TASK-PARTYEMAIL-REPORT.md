# TASK-PARTYEMAIL — report

**Branch** `task/partyemail` · worktree `~/Downloads/claude-code-repo/wt-partyemail` · **not pushed**
**Commits** `f45a093` (Phase 0, alone) · `a16ca30` (Phases 1–4)
**Database** prod `lrstswfxfsezdmvkvukc` — **all six migrations applied**
**Run** Opus 5, thinking on, effort high · no subagents

Every DB claim below is query output from the live database. **Render claims are NOT
VERIFIED** — no dev server was started at any point, so nothing here asserts what a
browser paints.

---

## 0. What shipped

| # | Migration | Applied |
|---|---|---|
| P0 | `20260820T0900_partyemail_p0_kiosk_execution_snapshots.sql` | ✅ |
| P1 | `20260820T0910_partyemail_p1_email_only_party.sql` | ✅ |
| P2 | `20260820T0915_partyemail_p2_the_deal_form_collects_an_address.sql` | ✅ |
| P3 | `20260820T0920_partyemail_p3_full_name_required_to_sign.sql` | ✅ |
| P4a | `20260820T0930_partyemail_p4a_record_owns_the_party_fields.sql` | ✅ |
| P4b | `20260820T0940_partyemail_p4b_regenerate_on_open_and_redemption.sql` | ✅ |

Code: `src/lib/contracts.ts` · `src/components/app/PartiesHorseCard.tsx` ·
`src/pages/app/ContractPage.tsx` · `src/pages/SignStart.tsx` · `api/sign-start.ts`.
`ClauseDocument.tsx` was **not touched** — no proposal was needed.

Post-apply verification of the live prod bodies:

```
             proname             | pronargs | has_freeze | has_address_args | has_name_blocker | calls_regenerate
---------------------------------+----------+------------+------------------+------------------+------------------
 add_document_party_by_email     |        3 | f          | f                | f                | f
 contract_lock_blockers          |        1 | f          | f                | t                | f
 fill_claimant_details           |        9 | f          | t                | f                | f
 fill_party_fields_from_contacts |        1 | t          | f                | f                | f
 redeem_contract_invitation      |        1 | f          | f                | f                | t
 regenerate_contract_document    |        1 | f          | f                | f                | t
```

---

## 1. PHASE 0 — X4: a kiosk execution now snapshots itself

### The defect, and why it was invisible

`sign_release` executed a release with a **status-only** UPDATE. The three execution
triggers on `documents` are all `AFTER UPDATE OF workflow_state`:

```
contract_execution_effects_trg  -> apply_contract_execution_effects()
deal_autocomplete_trg           -> deal_autocomplete_on_execution()
trg_snapshot_execution_audit    -> snapshot_execution_audit()
```

Postgres evaluates `UPDATE OF <col>` against the columns the **statement** names.
`documents_sync_workflow_on_status` (a BEFORE trigger) *did* set
`NEW.workflow_state := 'executed'`, so the stored value was always correct — but
assigning a column inside a BEFORE trigger does not add it to the statement's target
list. **The value was right and no trigger fired.** That is why nothing looked wrong.

### Standing population (prod, 2026-08-20)

```
 kiosk | executed_docs | with_audit_row
-------+---------------+----------------
 f     |            11 |              1
 t     |            40 |             20
```

The 20 kiosk documents that *do* carry an audit row were **all written on 2026-07-26
by a one-off backfill**. Every kiosk execution since has none:

```
DOC-JV29QEA2QF 2026-07-26   DOC-XKXXVJAAD9 2026-07-28   DOC-4G6GWUXNTT 2026-08-02
DOC-KWWXRCUWJF 2026-07-26   DOC-NR3Z49XPZ9 2026-07-28   DOC-JSKQTJYC9E 2026-08-02
DOC-DM98DWTRQS 2026-07-26   DOC-VTR7CGXJMJ 2026-07-28   DOC-XW6VPBRV47 2026-08-02
DOC-9VWU95ZGEM 2026-07-26   DOC-UFKPMGGB52 2026-07-28   DOC-ZABS47NFRC 2026-08-02
DOC-AZ7DG94A8P 2026-08-14   DOC-JUUFJNMT66 2026-08-15
DOC-PN5ZATJSEJ 2026-08-14   DOC-WM6E4ECQSG 2026-08-15
DOC-WA8CURV487 2026-08-14   DOC-97KZFBNWK6 2026-08-15
DOC-AZAKQZJQEZ 2026-08-14   DOC-5GQZFA2YAH 2026-08-15
```

**These 20 are NOT backfilled.** They are what they are; a snapshot written today
would be a snapshot of today's row, not of what was signed, and that would be worse
than an honest gap.

### The fix — two edits, mirroring `record_signature`

1. **Persist `merged_body` BEFORE the execution UPDATE.** The body used to be written
   *after*. Even with the trigger firing, the snapshot would have archived the
   pre-signature merge. `record_signature` has always ordered it this way.
2. **Name `workflow_state` in the execution UPDATE.** The stored value is unchanged
   (`'executed'` either way); only the trigger firing changes.

### Test 1 — proven, twice, both directions

All proofs ran inside `BEGIN … ROLLBACK` against prod. The **signing freeze holds**:
no signature was executed on any pre-existing document. Two independent instruments
were used — a probe trigger carrying the *identical* event clause
(`AFTER UPDATE OF workflow_state ON documents`), and per-function call counts from
`pg_stat_user_functions` with `track_functions='pl'`.

**Before (unpatched):**

```
--- probe trigger firings ---            --- calls added by one kiosk execution ---
 probe_firings                            apply_contract_execution_effects | 0
             0                            deal_autocomplete_on_execution   | 0
--- contract_execution_audit rows ---     snapshot_execution_audit         | 0
 audit_rows
          0
```

**After (against the APPLIED prod function):**

```
--- AFTER UPDATE OF workflow_state fired ---
      tg      |  old_ws  |  new_ws
--------------+----------+----------
 zzz_probe_ws | editable | executed

--- calls added by one kiosk execution ---
 apply_contract_execution_effects | 1
 deal_autocomplete_on_execution   | 1
 snapshot_execution_audit         | 1

--- the audit row, and that it archives THE SIGNED BODY ---
 same_doc | body_len | archive_matches_live | typed_name_archived
----------+----------+----------------------+---------------------
 t        |    10330 | t                    | t

 rules_ack_in_archive | unsubstituted_placeholder
----------------------+---------------------------
 t                    | f
```

`old_ws = 'editable'` is the load-bearing detail: `snapshot_execution_audit` requires
`OLD.workflow_state IS DISTINCT FROM 'executed'`, and it is.

Nothing persisted — `documents` stayed at 51 rows and zero probe contacts remain.

**Side effect, disclosed:** one `pg_stat_reset()` was run on prod while establishing
the measurement technique. That resets cumulative *statistics counters* only (no
data). Every subsequent measurement used a before/after delta instead.

---

## 2. PHASE 1 — an email-only party

`add_document_party_by_email(document, role, email)`:

- **Matches before it mints.** The address is looked up against the org's contacts
  first — an address we already hold **is** that person, and their record fills the
  party immediately. Only an unseen address creates a stub (`email` +
  `name_needs_confirmation = true`, no name).
- **No `email` column on `document_parties`.** The contact is the party identity.
- **No second invite path.** `invite_contract_counterparty` already refuses a
  non-party; this is the creation side it was missing, and it feeds that unchanged
  invite.
- **No second re-anchoring path.** When the role already has a roster row — the
  normal case, since every template seeds its roles at contract start —
  `reassign_document_party` does the work it already does: move both roster rows,
  clear the five stale tokens, refill, re-merge.

`document_parties_summary` gained `awaiting_details` so the card can say *"an email
and nothing else yet"* instead of printing an em dash.

**Why the card needed a new control at all:** `contract_party_options` filters out
every contact without a name, so a counterparty we knew only by email could not be
offered in the picker. It still can't — which is right — so the email box is the door.

---

## 3. PHASE 2 — the address on the `/sign` form

`.ADDRESS` is one of the five party tokens and **no self-service path populated it**.
A party who onboarded themselves printed on the instrument with no address.

- `SignStart.tsx` gains street / apt (optional) / city / state / ZIP. **Nothing else
  was added** — the collected set is the four values D22 §0 names.
- It is on the **shared** form, not a deal-only branch: the collected set is four
  values for everybody and the same contact record backs every path.
- `fill_claimant_details` gained the five components, **blanks-only semantics
  unchanged**, and `api/sign-start.ts` now calls it on **both** branches — the deal
  claim (as before) and the provisioning paths, using the `contact_id`
  `provision_client_invitation` already returns. One writer, whichever door.
- The 4-arg overload was **dropped, not kept**: PostgREST resolves an RPC by argument
  names and two overloads differing only by defaults are ambiguous.
- `contacts.address_composed` is `GENERATED ALWAYS` and is never written.

---

## 4. PHASE 3 — a full name is required to be signable

`contract_lock_blockers` gains `party_name_required`. A signing party blocks when
**either** their contact record carries no name **or** the party namespace's
`.FULL_NAME`/`.PRINTED_NAME` token exists on the document and is blank. Both are
checked because they can disagree: a contract created before the record was named
holds blank tokens, and naming the record afterwards does not retroactively fill a
document nobody re-generated.

The `'A party'` fallback stays for **display** — it is how the blocker names someone
with neither name nor email — and no longer satisfies signability. Company parties
and the `FHE`/`COMPANY` roles are exempt, matching the `onboarding_documents` blocker
directly above it.

**One check, not two (A2).** The screen's blocker list is rendered from this
function's output via `approve_contract_review` / `advance_document_workflow`. The
Parties & Horse card changed in the same commit: a missing name is no longer an em
dash but an *"Add their full name"* affordance under the line **"A full name is
required before signing."** Card and gate say the same thing.

---

## 5. PHASE 4 — propagation

### 4a — the record owns the party fields

`fill_party_fields_from_contacts` was a **one-time seed**, not a propagation:

```sql
ON CONFLICT ... DO UPDATE SET value = EXCLUDED.value
  WHERE coalesce(btrim(contract_fields.value), '') = ''
```

Once a token held anything, the contact record could never reach it again — *exactly*
the contract "locked to only using the email address" the owner described.

Now:

| token | owner |
|---|---|
| `.EMAIL` `.PHONE` `.ADDRESS` | the **record**, forever — locked and executed documents included |
| `.FULL_NAME` `.PRINTED_NAME` | the record until anything is signed; the **signature** after |
| `.PARTY_TYPE` | unchanged (blank-only) — a declaration on the instrument, not a contact detail |

The freeze is **an exclusion inside this fill**, not a second locking concept. It is
document-level (`workflow_state='executed'` OR any sealed signature) because a
signature attests to the whole instrument, including the other side's name. An empty
source value is still skipped: clearing a phone on the record does not blank a live
contract.

**D14 — a propagated change is a change.** When a push *overwrites* an existing
value, `log_contract_change` records it with `detail->>'propagated' = 'true'`, so it
lands in track-changes like a person's edit. A **first** fill (blank → value) is not
a change and is not logged.

### 4b — `regenerate_contract_document()`, the one seam

Horse record → `HORSE.*` · contact records → party tokens · recompose · **replay the
signatures** · persist.

**The signature replay is not optional.** `remerge_contract_from_clauses` leaves
`{{SIG.<NS>.NAME}}` / `.DATE` as literal placeholders — it skips SIG tokens
deliberately, and `record_signature` substitutes them at signing. Re-merging a
part-signed or executed document without replaying them would **erase a signature
from the rendered body**. The replay reads the `signatures` rows.

**Writing an executed document is safe** because execution snapshots the signed
content into `contract_execution_audit`, written once
(`ON CONFLICT (document_id) DO NOTHING`) and never rewritten by this path — and Phase
0 made that true of kiosk executions too.

**Called from exactly two places:** `ContractPage` on open (once per document per
visit — `load({blank:false})` runs after every field save and every realtime echo,
and re-generating on each would make a full recompose the cost of a keystroke), and
`redeem_contract_invitation`. **No blanket `AFTER UPDATE ON contacts` trigger.**

---

## 6. THE TEST — all nine, plus the tenth

Tests 2–9 ran as **one continuous rolled-back transaction** against prod
(`scratchpad/e2e_C.sql`), with `request.jwt.claims` set to impersonate each real
actor in turn so every function-level authorization check ran for real. Staff = CJ
(`admin@fhequestrian.com`), lessor = Sarah Morgan, lessee = a new claimant. Nothing
persisted.

### 1 — kiosk execution fires all three triggers and writes an audit row ✅
Section 1 above: 0 → 1 for each of the three functions; 0 → 1 audit rows.

### 2 — a party created from an email address alone ✅

```
 party_role |              contact_id              |           email           | first_name | last_name | name_needs_confirmation | has_account
------------+--------------------------------------+---------------------------+------------+-----------+-------------------------+-------------
 LESSEE     | 198b7053-4d39-4790-8a23-aa7860df8554 | ada.probe@example.invalid |            |           | t                       | f

      field_key      |           value
---------------------+---------------------------
 LESSEE.EMAIL        | ada.probe@example.invalid
 LESSEE.FULL_NAME    | (empty)
 LESSEE.PRINTED_NAME | (empty)
```

`LESSEE.PHONE` and `LESSEE.ADDRESS` have no row at all — the email flowed
contract → party, and **nothing was read back**.

### 3 — NOT signable, and the blocker says so, in the list the screen renders ✅

```
        code         |                      message
---------------------+-----------------------------------------------------------------
 required_fields     | Required field(s) still empty: Purpose of the lease, …
 party_name_required | A full name is required before signing for: ada.probe@example.invalid
 horse_unconfirmed   | The horse information has not been confirmed by the Lessor
```

### 4 — `/sign/deal` puts all four values on the CONTACT RECORD ✅

```
 found | same_contact
-------+--------------
 true  | t

BEFORE: first_name | last_name | phone | email                     | address_line1 | … | address_composed
        (null)     | (null)    | (null)| ada.probe@example.invalid | (null)        |   | (null)

AFTER:  Ada | Lovelace | (858) 555-0142 | ada.probe@example.invalid
        752 Windemere Ct | San Diego | CA | 92109
        address_composed = "752 Windemere Ct, San Diego, CA 92109"
        name_needs_confirmation = f

 address_composed_is_generated |                 generation_expression
-------------------------------+--------------------------------------------------------
 ALWAYS                        | compose_address(address_line1, address_line2, city, state, postal_code)
```

`address_composed` recomputed and was **never written** — it is `GENERATED ALWAYS`,
so a direct write would have raised.

### 5 — on redemption the tokens fill FROM THE RECORD ✅

```
BEFORE                                   AFTER
 LESSEE.EMAIL        | ada.probe@…        LESSEE.ADDRESS      | 752 Windemere Ct, San Diego, CA 92109
 LESSEE.FULL_NAME    | (empty)            LESSEE.EMAIL        | ada.probe@example.invalid
 LESSEE.PRINTED_NAME | (empty)            LESSEE.FULL_NAME    | Ada Lovelace
                                          LESSEE.PHONE        | (858) 555-0142
                                          LESSEE.PRINTED_NAME | Ada Lovelace
```

Driven by `redeem_contract_invitation` alone — the claimant activated, redeemed, and
the document filled itself.

### 6 — the blocker from #3 is gone ✅

```
       code        |  name_blocker_cleared
-------------------+-----------------------
 required_fields   |  t
 horse_unconfirmed |
```

### 7 — a record change reaches the merged body on the next generation ✅

```
BEFORE  … and Ada Lovelace of 752 Windemere Ct, San Diego, CA 92109 ("Lessee").
        Address: 752 Windemere Ct, San Diego, CA 92109.
        Phone: (858) 555-0142.

AFTER   … and Ada Lovelace of 1 Analytical Engine Way, Del Mar, CA 92014 ("Lessee").
        Address: 1 Analytical Engine Way, Del Mar, CA 92014.
        Phone: (619) 555-0777.

 old_address_still_present | old_phone_still_present
---------------------------+-------------------------
 f                         | f
```

And D14 held — it was recorded as a change, not applied silently:

```
   field_key    |               old_value               |                 new_value                  | propagated | actor_label
----------------+---------------------------------------+--------------------------------------------+------------+-------------
 LESSEE.ADDRESS | 752 Windemere Ct, San Diego, CA 92109 | 1 Analytical Engine Way, Del Mar, CA 92014 | true       | CJ Z
 LESSEE.PHONE   | (858) 555-0142                        | (619) 555-0777                             | true       | CJ Z
```

### 8 — on a SIGNED document: the address moves, the name does not ✅

Both parties signed through the real `record_signature`, and the document executed:

```
  status  | workflow_state | hashed        lessee_sig | lessor_sig | placeholders_left
----------+----------------+--------        ----------+------------+-------------------
 EXECUTED | executed       | t              t         | t          | f
```

Then the contact's address **and name** were changed and the document regenerated:

```
BEFORE                                                AFTER
 LESSEE.ADDRESS      | 1 Analytical Engine Way, …      LESSEE.ADDRESS      | 99 Bernoulli Row, Encinitas, CA 92024
 LESSEE.FULL_NAME    | Ada Lovelace                    LESSEE.FULL_NAME    | Ada Lovelace     ← unchanged
 LESSEE.PRINTED_NAME | Ada Lovelace                    LESSEE.PRINTED_NAME | Ada Lovelace     ← unchanged
 LESSEE.PHONE        | (619) 555-0777                  LESSEE.PHONE        | (619) 555-0777

contact record now reads:  Augusta | King | 99 Bernoulli Row, Encinitas, CA 92024

 new_address_rendered | old_address_rendered | signed_name_still_rendered | new_name_leaked_in
----------------------+----------------------+----------------------------+--------------------
 t                    | f                    | t                          | f
```

### 9 — the evidence did not move ✅

```
            md5_before            |            md5_after             | byte_identical | archive_holds_the_signed_address
----------------------------------+----------------------------------+----------------+----------------------------------
 b6461ba49fa2e0dee130a631c21fd2dc | b6461ba49fa2e0dee130a631c21fd2dc | t              | t
```

The archive still holds the address that was signed (`1 Analytical Engine Way`) while
the live row renders the current one. **The snapshot is the evidence; the live row is
the current rendering of it.**

### 10 — health ✅

| check | result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run typecheck:api` | **0 errors** |
| `npm run lint` | **0 errors, 46 warnings** — `diff` against main's output is **empty** |
| `npx vitest run test/db` | **46 failed / 26 passed (72 files), 203/479/107 of 789 tests** — file-for-file `diff` against main is **empty** |

46 red is the baseline, not a result. The per-file status list and the test totals are
byte-identical between `main` and `task/partyemail`.

---

## 7. THE REACH

**Staff — is it the only way?** The contract page → *Parties & Horse* → **Edit** →
type an address in the **"or add by email…"** box → **Add**. Reachable at
`/app/contracts/:id` (and the same card on the deal page, same component).
**It is the only way to create a party from an email**: `contract_party_options` will
not offer a nameless contact, and `reassign_document_party` only accepts a
`contact_id` that already exists. A second path exists to *invite* an existing party —
`invite_contract_counterparty`, staff's Send flow, and `/api/sign-start`'s deal branch
— but none of those can **create** one.

**The party — is it the only way?** The texted `/sign/deal` link → the form (name,
phone, email, **address**) → `/api/sign-start` matches the address via
`find_claimable_contract` → `fill_claimant_details` writes the record →
`invite_contract_counterparty` mints the invitation → the CONTRACT_INVITE email →
`/activate?token=…&kind=contract` → `redeem_contract_invitation` → the contract, open,
**with their details already in it**.
A **second path exists**: staff can invite the same party directly from the contract
page's Send flow, which mints the same `CONTRACT` invitation and redeems through the
same function. Both converge on `redeem_contract_invitation`, so both get the re-fill.

**One surface deliberately does NOT regenerate:** `/app/ops/documents/:id`
(`DocumentViewerPage`) renders `documents.merged_body` read-only, for *any* document
including releases. It is an archival view and shows the stored body. Naming it here
rather than wiring it keeps the propagation seam singular; if the owner wants the
viewer live too, it is a one-line addition of the same call.

---

## 8. THE TELL

**Staff, when a party is created from an email.** The *Parties & Horse* card shows the
role with the email address on the Mail line, no name, and — in place of the name —
an **"Add their full name"** button under the red line **"A full name is required
before signing."** The picker shows the party as a synthetic option labelled with the
email so the row never reads as empty. If they try to advance the document,
`approve_contract_review` returns `party_name_required` with the same words.

**The party, when their details fill in.** They complete `/sign/deal`, activate, and
land on the contract already open — with their name, phone and address rendered in
the recitals and the signature block, not blanks. They never type any of it into the
contract; they typed it into the form once and the record carried it.

**A party, when a propagated change lands on a document they have already signed.**
Their `.EMAIL`, `.PHONE`, `.ADDRESS` update in the rendered body. Their **name does
not** — the signature block still reads what they signed. The change is written to
`contract_change_log` with `detail->>'propagated' = 'true'` and `old_value` /
`new_value`, so it appears in the document's change history alongside human edits,
attributed to whoever's action triggered the regeneration.

**How it is undone.** There is no separate undo, by design — the contract has no
second copy of these values to revert. Correct the **contact record** and the next
generation carries the correction; that is the whole point of D22. The frozen name is
undone only by removing the signature (`remove_my_signature`), which unfreezes the
name tokens because the freeze reads the signature rows. **The evidence of what was
signed is never undone**: `contract_execution_audit` is written once and this path
never rewrites it.

---

## 9. FLAGGED, NOT FIXED

**F1 — Clause definitions are not versioned, and re-merge composes from the CURRENT
ones.** `remerge_contract_from_clauses` reads `contract_clause_defs WHERE
template_key = …` with no version filter. `documents.signed_template_version` records
which version was signed and **nothing consults it when composing**. Before this task
that was latent (executed documents were never re-merged); Phase 4 would have exposed
it. **Guard added inside `regenerate_contract_document`:** on an executed document
whose `signed_template_version` differs from the template's current `version`, the
body write is **refused** — the record data still lands in `contract_fields`, and the
stored body is returned unchanged. This is one guard beyond the letter of the spec,
and it is the only place I went past it. **The underlying exposure is unfixed**: the
real repair is composing an executed document from the clause defs *as they were at
signing*, which needs versioned clause rows. Out of scope here; worth a task.

**F2 — `sign_release`'s execution UPDATE has no `AND status <> 'EXECUTED'` guard.**
`record_signature` has one. `sign_release` creates the document in the same call so it
cannot re-execute today, but the asymmetry is a trap for the next editor. Left alone
to keep the Phase 0 diff to the two edits that fix X4.

**F3 — `add_document_party_by_email`'s INSERT branch guesses `is_signer`/
`signer_order`.** When the role has no roster row it inserts `is_signer = true` with
`max(signer_order)+1`. Every template seeds its party roles at contract start, so this
branch is unreachable in practice today (prod holds **zero** documents with a
`contract_id`) — and therefore **untested against a real document**. If a template
ever ships without seeding a role, that default deserves a look.

**F4 — the `/sign` funnel's missing inbound links and missing completion alert.**
Explicitly out of scope (flow map F2). Unchanged and still broken.

**F5 — the 20 unbackfilled kiosk executions.** Listed in §1. Not backfilled, by
instruction and on the merits.

**F6 — `document_parties_summary` reports `awaiting_details` but only
`PartiesHorseCard` consumes it.** The e2e proves the data; **no render was verified.**

**F7 — RESOLVED 2026-08-20, owner-ruled. The address is required on `/sign/deal`
only.** As first built it was required on all five paths, because D22 §0 stated the
collected set as four values without qualifying by path. The owner revised the
ruling: *"full name and email and phone number are the minimum required set, if they
have a contract they need to give us an address."* D22 §0 is rewritten accordingly,
and the fix is on `task/partyaddr` — `PATH_REQUIRES_ADDRESS` in `SignStart.tsx`
plus the matching server-side guard in `api/sign-start.ts`, with a partial address
refused on every path. A form-configuration surface for `/sign/*` was proposed and
**declined by the owner**; that refusal is recorded in D22 §0 so it is not
re-proposed.

**F8 — the e2e impersonated via `request.jwt.claims` while connected as `postgres`.**
Every *function-level* authorization check ran for real (`auth.uid()`,
`has_staff_access()`, `current_org()`, `caller_is_document_party_or_staff` all
resolved correctly). **RLS was not exercised** — a `postgres` connection bypasses it.
The new RPCs are all `SECURITY DEFINER` with explicit internal authorization, and
grants were set explicitly (`REVOKE` from PUBLIC/anon, `GRANT` to authenticated +
service_role), but **RLS behaviour for a real `authenticated` connection is
unverified**.

---

## 10. TEARDOWN

**No dev server was ever started. No vitest is running.** Both `test/db` runs
completed and exited (`--maxWorkers=2`, per the standing resource rule). All psql
sessions were one-shot `-f` invocations that exited.

Process census at close:

```
$ ps aux | grep -Ei "vitest|vite|node .*dev|psql" | grep -v grep
(no output)

$ ps aux | grep -i node | grep -v grep
10 processes — ALL "Code Helper" / "Code Helper (Plugin)" (VS Code), none from this task
```

`node_modules` in the worktree is a **symlink** to the canonical checkout's, not a
second install.

**Prod residue: none.** `documents` = 51 rows (unchanged); zero contacts matching
`%example.invalid`. Every test transaction rolled back.
