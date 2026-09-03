# TASK-CR119-A — an explicit way out of the co-buyer election, where the confusion actually is (CODR profile, no design ambiguity)

**Owner's words, verbatim — `docs/reference/CHANGE-ORDER-LEDGER.md` CR-119.**

## ORCH's fact-find (the one query + the read — do not re-derive) — CORRECTED once already, read this version
**A first pass here was wrong and is withdrawn** (it reported a generic dropdown as the way out; the
owner confirmed "no such surface exits" and the trace was redone against the actual renderer). Do not
re-derive; the corrected facts:
- `HORSE_SALE_V2` is one of the six **clause-composed** templates. `ContractPage.tsx:2006-2043` routes
  these through `ClauseDocument.tsx`, never through `ContractCascade.tsx` — `SelectWithOther` and every
  other `ContractCascade` control **do not exist for this document**. Ignore any trace that says otherwise.
- `TXN.CO_BUYER_ENABLED`'s `clause_key` is `PARTIES.CO_BUYER_PENDING`
  (`20260802090000_sale_and_bos_templates.sql:327`). That clause's OWN visibility is
  `{"equals":[""],"field_key":"TXN.CO_BUYER_ENABLED"}` — **visible only while the question is
  unanswered** (`ClauseDocument.tsx:21-22`: "a clause whose conditional_on isn't met is hidden"). No
  other clause in the template carries this field as its own. **The instant the owner answers Yes,
  the only clause holding the control hides itself, taking the control with it.** A true self-locking
  UI defect, not a discoverability gap.
- The write path itself is fine: `remove_document_co_buyer(uuid)` exists in production, and
  `set_contract_field`'s teardown hook (`20260802090001_sale_engine_functions.sql:721-725`) calls it
  correctly whenever `TXN.CO_BUYER_ENABLED` changes to `NO`. **Nothing wrong with the RPC — the bug is
  that no rendered control ever calls it again once the field is `YES`.**
- The bespoke co-buyer capture card in `ContractPage.tsx` (`:1955-1990`) is the ONLY surface left once
  the field is `YES` — pick-or-hand-enter, an "Add co-buyer" button, **and nothing else**. No cancel,
  no "remove," no restatement of the underlying question. **This card is a plain React conditional,
  not clause-gated — it is the one place that reliably stays visible, which is why the fix below still
  targets it.**

## THE LIVE DOCUMENT — already fixed directly, do not touch it
`80537662-7b4e-4adc-9ebc-49ed9d2bed78` was unblocked by ORCH on 2026-09-03: rehearsed in a transaction
(rolled back to prove it), then applied for real — `TXN.CO_BUYER_ENABLED` cleared to `''`,
`remerge_contract_from_clauses` re-run. No party, signature, or other field touched. **This is not
your task's to redo or verify against** — build and test against a WALKTEST fixture only (§THE TEST
below), never this document.

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
