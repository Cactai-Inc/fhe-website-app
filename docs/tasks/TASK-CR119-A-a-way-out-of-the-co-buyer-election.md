# TASK-CR119-A — an explicit way out of the co-buyer election, where the confusion actually is (CODR profile, no design ambiguity)

**Owner's words, verbatim — `docs/reference/CHANGE-ORDER-LEDGER.md` CR-119.**

## ORCH's fact-find (the one query + the read — do not re-derive)
The write path and the DB-side teardown are NOT broken. Production, checked 2026-09-03:
- The stuck document: `documents.id = 80537662-7b4e-4adc-9ebc-49ed9d2bed78` (template `HORSE_SALE_V2`,
  `workflow_state='editable'` — not locked, not frozen), `TXN.CO_BUYER_ENABLED='YES'`, one `BUYER`
  party (the primary buyer only — no co-buyer party was ever added).
- `remove_document_co_buyer(uuid)` exists in production. `set_contract_field`'s teardown hook
  (`20260802090001_sale_engine_functions.sql:721-725`) calls it whenever `TXN.CO_BUYER_ENABLED`
  changes to `NO`. **The write path works.**
- The field itself (`input_kind='select'`, `format_type='select'`, options `Yes`/`No`, `owner_role='DEAL'`)
  renders generically via `ContractCascade.tsx`'s `SelectWithOther` (`:387-419`) — a plain `<select>`,
  wherever `TXN.CO_BUYER_ENABLED` sits in the document's PARTIES section field order. **Selecting "No"
  there calls `onSave → set_contract_field(doc, 'TXN.CO_BUYER_ENABLED', 'NO')` and DOES tear the
  election down.**
**THE ACTUAL DEFECT: not a broken write, a missing exit where the user is looking.** Checking "Yes"
opens the bespoke co-buyer capture card in `ContractPage.tsx` (`:1955-1990`) — pick-or-hand-enter,
an "Add co-buyer" button, **and nothing else**. No cancel, no "remove," no restatement of the
underlying Yes/No. A staff user who elected "Yes" and changed their mind sees a card that only ever
adds a co-buyer, has to notice a plain, unlabeled-as-a-checkbox `<select>` field elsewhere in the same
long document body, and is not told that field is the way out. **That is what "stuck" means here.**

## IMMEDIATE UNBLOCK (tell the owner directly, no build needed for this)
On `80537662-7b4e-4adc-9ebc-49ed9d2bed78`, find "Is there a co-buyer?" in the PARTIES section of the
document body (a plain dropdown, not inside the co-buyer capture card) and set it to **No**. That
single write tears the election down — no party was added yet, so nothing else to undo.

## The durable fix — narrow, no design ambiguity
Add an explicit way out **inside the co-buyer capture card itself** (`ContractPage.tsx:1955-1990`,
the same card that has no exit today): a "Not adding a co-buyer" / "Remove this election" action,
staff-visible, that calls the existing `set_contract_field(id, 'TXN.CO_BUYER_ENABLED', 'NO')` path (a
thin wrapper in `src/lib/api.ts` alongside `setDocumentCoBuyer`, or a direct call — match the file's
own idiom) and reloads the same way `addCoBuyer` does (`load({ blank: false }); setChangeKey(k => k+1)`).
No DB change — the teardown hook already exists and is correct. **One file, one small addition, at the
exact place the confusion lives.** No thread owns `ContractPage.tsx` or `ContractCascade.tsx` (D35/D36
check run — clear).

## Ownership
**Files:** `src/pages/app/ContractPage.tsx` (the new action in the co-buyer card) · `src/lib/api.ts`
(if a wrapper is added, name it to match `setDocumentCoBuyer`'s neighbors). **NOT yours:**
`ContractCascade.tsx`'s generic `SelectWithOther` (already correct — read only, to confirm the new
button reaches the same RPC path, not a second one).

## THE TEST
On a document with `TXN.CO_BUYER_ENABLED='YES'` and 1 buyer party: click the new action; confirm
`TXN.CO_BUYER_ENABLED` reads `NO` after reload and the capture card is gone (its own visibility
condition already requires `=== 'YES'`, so this is automatic once the value flips). On a document
where a co-buyer party WAS already added (2 buyer parties): confirm the same action still calls
`remove_document_co_buyer` correctly (find or make a WALKTEST fixture — never a real client, and never
touch `80537662-7b4e-4adc-9ebc-49ed9d2bed78` beyond the one-field unblock above, which the owner does
himself or you confirm done before building).

## Report to
`FHE-ORCH` (direct dispatch, not a bundle). Model: **Opus · HIGH · thinking ON** — one file, the fix
is fully bounded by this charge, no shape question left open.
