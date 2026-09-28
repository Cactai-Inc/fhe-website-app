# TASK-CR126 — horse-add modal + Bill of Sale overhaul

**Source: `docs/reference/CHANGE-ORDER-LEDGER.md` CR-126 (owner verbatim). Read it before building.**
**Model: Opus · HIGH · thinking ON.** Branch already exists: `task/cr126-horse-and-bos` (the DB layer
below is already committed on it). Work there; hand back to the owner.

**Companion: `docs/tasks/TASK-CR126-SUCCESS-CHECK.md`** — the per-item verification checklist. An item
is DONE only when its cross-check passes, not when the code is written. Update it as you go.

---

## ALREADY DONE (committed on this branch — do NOT redo)

- **DB migration `…cr126_1…` + `…cr126_2…` applied to production:**
  - `horses.home_keeping_spots`, `horses.current_keeping_spots`, `horses.vaccinations` — jsonb lists,
    default `[]`. The one existing horse (`b16b6f12…`) back-filled: "Barn A"/"Stall 10" → `[{term,value}]`.
  - `set_horse_locations(uuid, jsonb)` now reads `home.keeping_spots` / `current.keeping_spots` /
    `payload.vaccinations` and writes the lists; it DERIVES legacy `home_barn`/`home_stall`/`current_barn`/
    `current_stall` from the first Barn|Stable and first Stall|Pen spot via `_first_spot_string(jsonb,text[])`
    so existing readers (contract merge, `HorsePage`, `HorseRecordsPage`) keep working unchanged.
  - `_first_spot_string` revoked from PUBLIC (baked into the migration).
- **Investigation answers delivered to the owner** (record them in the ledger findings, don't re-investigate):
  1. **"(checked first)" on the microchip label** = microchip is the server-side dedup key. Internal
     detail leaked into a user label. → just remove the parenthetical.
  2. **"Sign for French Heritage Equestrian" button** records the COMPANY's signature (staff sign for
     the faceless company party; name+title print as By/Title). It appeared before the doc was complete
     because `signPhaseOpen = state==='locked' || (editablePhase && docComplete)`, and `docComplete`
     means zero lock blockers.
  3. **The no-slaughter checkbox (`TXN.NO_SLAUGHTER_ACK`) is `required: false`** — so is
     `TXN.BUYER_ACCEPTS_DISCLOSURES`. Not required ⇒ not a lock blocker ⇒ `docComplete` reads true with
     them unchecked ⇒ signing opens. **This is the bug: those acknowledgments must be required.**

---

## GROUP A — the horse-add modal (`src/components/app/HorseIntakeForm.tsx`)

**A1. Locations become a repeatable "+ Add" block, exactly like medications.** Model it on
`RepeatableMeds` / `MedicationBlock` (`:527-600`) and the `RRP`/`+ Add {noun}` pattern. Each home and
current location has a **keeping-spots list**: start with a `+ Add location` button; clicking it adds one
term:value pair — a term SELECT (fixed vocab: **Barn, Stable, Field, Stall, Pen, Paddock, Corral,
Building**) whose chosen term becomes the LABEL above an empty input for the value; a small **Remove** on
each pair. The current 4-across horizontal layout is good; the selected term as the label (owner's cleaner
option) is the chosen approach — up to 4 pairs per row, wrap to a new row after. The list persists via
`setHorseLocations` → `home.keeping_spots` / `current.keeping_spots` (already wired in the DB).
- **Remove "(blank if outdoor)"** from the Barn label (now moot — a spot is only added if the user adds it).
- Update `HorseLocationDetail` in `src/lib/horses.ts`: add `keeping_spots?: {term:string; value:string}[]`;
  the flat `barn`/`stall` fields stay as read-only legacy mirrors (the DB derives them) — the form no longer
  writes them directly.
- Read `home_keeping_spots`/`current_keeping_spots` on prefill (the payload shape `getHorseIntakeRecord`
  returns — extend it to surface the lists; today it surfaces `home_barn`/`home_stall`).

**A2. Care-team fields (Trainer, Care giver, Groom, Other) become pick-or-type.** Today raw text
(`:512-522`) — unsortable, unmatchable. Change to a combobox: **first option is always "Type a name
manually"** (free text), below it the selectable people. Source the people from `staff_contact_directory`
(exists; returns id, name, role, etc.). Store the selected contact's identity so the value is matchable —
decide with the owner whether to store a contact_id + display string or just the normalized name; **flag
this as escalation 1** (it affects whether these become FK-linked or stay strings). Manual entry must
always remain available as the first option.

**A3. Microchip label** (`:1241`): `"Microchip number (checked first)"` → `"Microchip number"`. One-line.

**A4. Vaccinations section — new repeatable block, mirrors medications, all optional.** `+ Add
vaccination`. Each row: **name** (manual text), **additional details** (text), **date administered**
(date), **good-until** (date), and **a file upload for the records copy**. Persist via the new
`horses.vaccinations` jsonb list (already added) through `setHorseLocations`'s `payload.vaccinations`, OR a
dedicated writer if cleaner — the column exists either way. For the upload, reuse the existing files/
file_links spine (grep `hardDeleteFile`/`listOrgFiles`/the `files` bucket helpers in `src/lib/files.ts`);
store the file id/reference inside the vaccination row. Add a `HorseVaccination` interface to
`src/lib/horses.ts`.

---

## GROUP B — Bill of Sale field definitions (DB: `contract_field_defs` / `contract_clause_defs` for
`HORSE_SALE_V2`, applied by a new migration + `sync_contract_fields_from_defs`)

**⚠️ FIRST TASK OF THIS GROUP — reconcile party responsibility against what the owner SEES.** The owner
reports many fields rendering as "for the Seller to complete" (green-highlighted, other-party tip) when
they should be either-party. In the code, `fieldIsMine` (`ClauseDocument.tsx:183`) returns TRUE for
`owner_role='DEAL'` — a DEAL field is ALWAYS the viewer's, never "the other party's". So any field the
owner sees as "seller's to complete" is NOT currently DEAL; it carries `owner_role='SELLER'` (or BUYER).
`sync_contract_fields_from_defs` copies `owner_role` from the def onto the document field verbatim, so the
def is the source of truth. **Open a live draft BOS (or generate a test one) and read each field's actual
`owner_role`, then reconcile:**

| Field | Owner wants | Action |
|---|---|---|
| `TXN.CO_BUYER_ENABLED` (+ COBUYER.*) | BUYER decides co-buyer, not seller | set `owner_role='BUYER'` (co-buyer info is the buyer's) |
| `TXN.FINANCING_ELECTION` | either party | ensure `owner_role='DEAL'` |
| `TXN.SALES_TAX_RESPONSIBLE` (Taxes) | either party | ensure `owner_role='DEAL'` |
| `TXN.PPE_CHOICE` (the gating select) | **SELLER** makes the gating choice | set `owner_role='SELLER'` (it's BUYER today) |
| `TXN.PPE_CONTINGENT`, `TXN.DRUG_TEST_ELECTION` | BUYER (downstream of PPE) | set `owner_role='BUYER'` |
| `TXN.TRIAL_ENABLED` (+ trial fields) | either party | ensure `owner_role='DEAL'` |
| `TXN.DELIVERY_*`, `TXN.TRANSPORT_*` | either party | ensure `owner_role='DEAL'` |
| `TXN.BOARD_RATE_AFTER` (buyer-delay fee) | SELLER sets it | set `owner_role='SELLER'` |
| **NEW** seller-delay fee | BUYER sets it | new field (see B9) `owner_role='BUYER'` |
| `TXN.TRANSFER_FEES_RESPONSIBLE` | either party | ensure `owner_role='DEAL'` |
| `TXN.BREEDING_ELECTION` | staff/author (see B4) | ensure `owner_role='DEAL'` |

Verify each against the live value before changing; the table is the intent, not a blind UPDATE.

**B2. Sale price / deposit not at step 1.** On the sale-creation flow (`src/pages/app/ContractPage.tsx` /
`ContractIntake.tsx` / whichever renders the create wizard's first step — grep `TXN.PURCHASE_PRICE` and
`TXN.DEPOSIT_ENABLED` render order), move price + deposit out of the first step into the body with the
other terms. Investigate WHY they're first (likely a `sort_order` on the def or a hardcoded step) and
report it; the owner asked the question, so answer it in the success-check.

**B3. Breeding include/don't-include gate is missing for the author.** The owner (a Mare selected) sees
the disclosure notice and two grayed sections but NO control to include/exclude. Root cause candidates:
(a) there IS no include/exclude field — `TXN.BREEDING_ELECTION` exists with options Included/Not included
and is gated on Sex ∈ {Mare,Stallion,Colt,Filly}; confirm it renders. (b) it's assigned to a party the
author isn't. **Required outcome:** an Include / Don't Include control, visible to the author (staff),
shown ONLY when Sex ∈ those four; it gates the two breeding sections' inclusion+visibility. If the field
exists but doesn't render for staff, fix the render/ownership; if the options are wrong, set them to
`Include`/`Don't Include`.

**B4. The Sex-match disclosure notice** ("This is included when Sex is Mare or…") is UI-generated by
`describeGate` (`ClauseDocument.tsx:402`), not clause text. Owner wants it shown ONLY when Sex does NOT
match one of the four (so the reader understands why the Include gate is inactive), and hidden when Sex
DOES match. This is a render-condition change in the breeding section's gate-notice display — show the
notice only when the gating Sex condition is unmet. Remove the similar disclosure text above the breeding
warranty sections (the redundant one).

**B5. Financing options** → `Included`, `Not Applicable` only. Remove `Not included` and any `other`.
(Current: Included / Not included.) When `Not Applicable`, **omit the financing section content entirely** —
delete/retire the `PRICE.FINANCING_DECLINED` clause ("6.5 Financing Contingency Not Elected…") so nothing
renders. Gate `PRICE.FINANCING` on `FINANCING_ELECTION = INCLUDED` (already is).

**B6. PPE options** → `Seller Declines`, `Buyer Requested`, `Buyer Waived` (replacing Conducted/Waived/NA).
Re-gate downstream clauses:
- `PPE.CONDUCTED` → gate on `Buyer Requested`.
- `PPE.CONTINGENCY` → gate on `Buyer Requested` AND `PPE_CONTINGENT = YES`.
- The NA equivalent → `Seller Declines`.
- The waived equivalent → `Buyer Waived` (PPE.WAIVED text unchanged).
- The gate-notice text auto-updates from the option labels (it's `describeGate`), so changing the option
  LABELS is most of this. Owner's explicit notice edits: "…is 'Conducted'" → "…is 'Buyer Requested'";
  "…is 'Not applicable'" → "…is 'Not Included'". Since the notice is generated, these follow from the label
  changes — verify the rendered strings match.

**B7. PPE timing** — `TXN.PPE_DEADLINE` is date-only; make it a select with a paired date:
`Date` (appends "on or before {date}"), `Prior to Delivery` ("prior to delivery"), `During Evaluation
Period` ("during the evaluation period specified in this agreement"), `No timeframe requirement` (appends
nothing). Update `PPE.CONDUCTED` body: replace `on or before {{TXN.PPE_DEADLINE}}` with a composed phrase
driven by the new select.

**B8. PPE.CONTINGENCY body edits:** remove `on or before {{TXN.PPE_NOTICE_DEADLINE}}` (so it reads "If the
Buyer gives Seller written notice that the examination results are not satisfactory, this Agreement
terminates…"); make "the Deposit (if any) is refunded in full," conditional on `TXN.DEPOSIT_ENABLED=YES`
(omit that clause fragment entirely when no deposit); remove the last line "If Buyer gives no such notice
by that date, this contingency is deemed waived." `TXN.PPE_NOTICE_DEADLINE` field can be retired.

**B9. Drug testing** — remove the testing-window sentence entirely ("Buyer may have the samples tested…
within {{TXN.DRUG_TEST_WINDOW}} days after collection.") from `PPE.DRUG_TESTING`. Retire
`TXN.DRUG_TEST_WINDOW`. (Owner's reasoning accepted: the PPE blood draw either includes substance testing
or not; a window is meaningless. No counter-argument — remove it.)

**B10. Trial period (`TRIAL.TERMS`):** fix the leading ". During" typo (should be "During"). The deposit
sentence "and the Deposit (if any) is refunded in full;" becomes deposit-driven: when
`TXN.DEPOSIT_ENABLED=YES`, render "and the Deposit of {{TXN.DEPOSIT_AMOUNT}} is {selection}" where the
selection is a NEW field with options **Refunded in Full / Partial Refund (enter %) / Not refunded**
(Partial requires a % input); when no deposit, omit the deposit clause fragment.

**B11. Delivery (`DELIVERY.TERMS`) — transport conditional.** Omit the transport content when the delivery
location equals the trial location OR (no trial) equals the horse's current location; show transport info
only when delivery differs. This is a composition condition on the transport sentence keyed off
`TXN.DELIVERY_LOCATION` vs `TXN.TRIAL_LOCATION`/horse current location. Add a seller-delay penalty sentence
mirroring the buyer one: "If Seller delays delivery by more than 7 days, Seller shall pay ${{NEW_FIELD}}
penalty to Buyer per day until delivery occurs." (NEW field, `owner_role='BUYER'` per B1.)

**B12. Registration & Transfer Documents** (`TXN.TRANSFER_FEES_RESPONSIBLE` options) → add `Not
Applicable` to Buyer/Seller/Other.

**B13. No-slaughter + disclosures acknowledgments become REQUIRED** (the investigation bug). Set
`TXN.NO_SLAUGHTER_ACK.required = true` and `TXN.BUYER_ACCEPTS_DISCLOSURES.required = true` in the defs.
Verify `contract_lock_blockers` then counts an unchecked required checkbox as a blocker so `docComplete`
is false and signing does not open until they're checked. **Confirm the blocker path actually reads a
`certify`/checkbox field's blank state** — if it doesn't, that's a blocker-function fix, not just a flag.

---

## GROUP C — Bill of Sale signing-view / party-visibility (`ClauseDocument.tsx`, `ContractPage.tsx`)

**C1. The "By:/Title:" boxes at the bottom in edit mode.** Investigate why the buyer view shows two
editable By/Title inputs in preview while the seller view does not (owner's report). Likely the
company-behalf block (`ContractPage.tsx:2508`) renders for `companyPendingRoles` and FHE is the Buyer on
this document, so the buyer-side viewer sees the company-sign affordance. Confirm whether FHE is
Buyer/Seller on the document and whether that block should show in preview at all (it should NOT show
before the doc is complete — tie to B13's required-acknowledgment fix). Report findings in the success-check.

**C2. The "either party may complete this section" tip.** For fields that are legitimately `DEAL`
(either-party), the current tip when owned reads "This is for you, as the Buyer/Seller, to fill in." Owner
wants DEAL fields to read **"Either party may complete this section."** Add a DEAL-specific tip in
`ownFieldTip`/`OwnedField` so a `DEAL` field says "either party" rather than naming the viewer's role.
(Fields correctly reassigned to DEAL in B1 then get this tip automatically.)

---

## Escalations (batch to the owner once, after the reconcile in Group B's first task)
1. **Care-team matching (A2):** store contact_id-linked, or normalized name only? Affects sortability.
2. **The B1 reconcile result:** the actual `owner_role` of each "wrong party" field vs the intended one —
   confirm the flip list before applying, since it changes who can edit a live contract.

## Merge / hand-back
DB migrations applied under rehearsal (BEGIN…ROLLBACK) then for real, `proacl` proven on every new/changed
function. Gates: typecheck 0 · typecheck:api 0 · lint 0 errors · build clean. Every item's success-check
row must be GREEN before hand-back. Report to the owner.
