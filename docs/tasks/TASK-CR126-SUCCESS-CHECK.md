# TASK-CR126 — success cross-check

**An item is DONE only when its check passes — implemented AND verified, not merely coded.**
Fill the Result column: `GREEN` (verified pass, with evidence), `RED` (fails), `N/A` (with reason).
"Evidence" = the exact query, the rendered string observed, or the WALKTEST step that proves it.
Do not mark GREEN from reading the code — reach the behavior (a read is not a finding).

## Group A — horse-add modal

| # | Item | Success condition (the observable proof) | Result | Evidence |
|---|---|---|---|---|
| A1a | Location add-block | On the add-horse modal, no keeping-spots exist until "+ Add location" is clicked; clicking adds one term-select + value input; the selected term is the label above the value; each pair has Remove | | |
| A1b | Term vocab | The term select offers exactly: Barn, Stable, Field, Stall, Pen, Paddock, Corral, Building | | |
| A1c | Multiple spots | Adding 3+ spots works; they wrap to a new row after 4 across; each removable independently | | |
| A1d | Persist round-trip | Add "Field 2" + "Paddock 3", save, reopen the horse → both appear from `horses.home_keeping_spots` (query the row) | | |
| A1e | Legacy mirror intact | After A1d, `home_barn`/`home_stall` still resolve for the horse-record display and contract merge (query: first Barn/Stall spot shows) | | |
| A1f | "(blank if outdoor)" gone | The Barn label no longer carries "(blank if outdoor)" | | |
| A2a | Care-team pick-or-type | Trainer/Care giver/Groom show a combobox: "Type a name manually" first, then people from the directory | | |
| A2b | Matchable value | A picked person stores a matchable identity (per escalation-1 decision), not just raw text — verify the stored shape | | |
| A3 | Microchip label | Label reads "Microchip number" — no "(checked first)" | | |
| A4a | Vaccination add-block | "+ Add vaccination"; each row has name, details, date administered, good-until, and a records upload | | |
| A4b | Vaccination optional | Saving with zero vaccinations succeeds (matches meds/supplements) | | |
| A4c | Vaccination persist | Add one with a file, save, reopen → row + file reference present in `horses.vaccinations` | | |

## Group B — Bill of Sale fields & clauses

| # | Item | Success condition | Result | Evidence |
|---|---|---|---|---|
| B1 | Party reconcile | Each field in the B1 table carries the intended `owner_role` in `contract_field_defs` (query all 12) | | |
| B2 | Price/deposit step | On a NEW sale, price + deposit are NOT on step 1; they render with the other terms. The "why were they first" answer is recorded here | | |
| B3 | Breeding include gate | On a Mare, the author (staff) sees an Include / Don't Include control; choosing controls the two breeding sections' visibility | | |
| B4 | Sex-match notice | The disclosure notice shows ONLY when Sex ∉ {Mare,Stallion,Colt,Filly}; hidden when it matches. The redundant warranty-header disclosure is gone | | |
| B5a | Financing options | `TXN.FINANCING_ELECTION` options are exactly Included / Not Applicable | | |
| B5b | Financing omit | With Not Applicable, no financing section content renders (PRICE.FINANCING_DECLINED does not appear) | | |
| B6a | PPE options | `TXN.PPE_CHOICE` options are exactly Seller Declines / Buyer Requested / Buyer Waived | | |
| B6b | PPE gating | CONDUCTED-equivalent clause gates on Buyer Requested; contingency on Buyer Requested + contingent=Yes; NA→Seller Declines; waived→Buyer Waived | | |
| B6c | PPE notices | Rendered gate notices read "…is 'Buyer Requested'" and "…is 'Not Included'" as specified | | |
| B7 | PPE timing | `PPE_DEADLINE` is a select (Date / Prior to Delivery / During Evaluation Period / No timeframe); the composed sentence tail matches the choice | | |
| B8a | Notice-deadline removed | PPE.CONTINGENCY no longer says "on or before {deadline}"; TXN.PPE_NOTICE_DEADLINE retired | | |
| B8b | Deposit-driven refund | "the Deposit … refunded in full," appears only when a deposit exists; omitted otherwise | | |
| B8c | Last line removed | "If Buyer gives no such notice by that date…" is gone | | |
| B9 | Drug window removed | The testing-window sentence is gone; TXN.DRUG_TEST_WINDOW retired | | |
| B10a | Trial typo | TRIAL.TERMS starts "During" not ". During" | | |
| B10b | Trial deposit | With a deposit: "the Deposit of {amount} is {Refunded in Full / Partial Refund % / Not refunded}"; without: fragment omitted | | |
| B11a | Transport conditional | Transport content omitted when delivery = trial/current location; shown when it differs | | |
| B11b | Seller-delay penalty | Delivery section includes the seller-delay penalty sentence, driven by a buyer-set fee field | | |
| B12 | Transfer options | `TXN.TRANSFER_FEES_RESPONSIBLE` options include Not Applicable | | |
| B13a | Acks required | `TXN.NO_SLAUGHTER_ACK` and `TXN.BUYER_ACCEPTS_DISCLOSURES` are `required=true` | | |
| B13b | Acks block signing | With either unchecked, `contract_lock_blockers` returns a blocker and the sign affordance does NOT open (WALKTEST: leave no-slaughter unchecked → no sign button) | | |

## Group C — signing view

| # | Item | Success condition | Result | Evidence |
|---|---|---|---|---|
| C1 | By/Title boxes | The findings on why the buyer preview showed editable By/Title (and the seller didn't) are recorded; the company-sign affordance does not appear before the doc is complete | | |
| C2 | Either-party tip | A `DEAL` field's owned tip reads "Either party may complete this section." (not "…as the Buyer/Seller…") | | |

## Gates (all must pass before hand-back)

| Gate | Result |
|---|---|
| typecheck 0 errors | |
| typecheck:api 0 errors | |
| lint 0 errors | |
| build clean | |
| every new/changed DB function `proacl` proven (no anon leak) | |
| migrations rehearsed (BEGIN…ROLLBACK) before real apply | |
