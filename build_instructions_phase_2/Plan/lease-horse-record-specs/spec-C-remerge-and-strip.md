# Spec C — Re-merge from Fields, Data-Driven CUT, Strip-Unfilled (CORE)

Goal: at lock, rebuild `documents.merged_body` from the current `contract_fields` values, evaluate the lease's optional-section CUT conditions from those values, and strip unfilled terms/sections — so the signed document reflects exactly what was negotiated and shows only filled/agreed content (owner decisions 3 and 6). This closes GAP C and GAP D together.

## C.1 Why this is needed
`generate_document` v9 merges ONCE at generation from engagement/horse/transaction tables, and its CUT keep/strip is hardcoded to `MINOR%`/`JUMPER%`. The negotiation engine collects values into `contract_fields`, but nothing re-merges those values into `merged_body`, and the lease's CUT sections (`EVALUATION_PERIOD`, `PARTIAL_LEASE`, `INSURANCE`, etc.) have no keep/strip rule. Without this, the finished document neither reflects negotiated values nor drops unused sections.

## C.2 New function: `remerge_contract_from_fields(p_document_id uuid)`
SECURITY DEFINER, `search_path = public`. Authorization: staff of the document's org, or the originator (same predicate as `seed_contract_fields`). Behavior:

1. Load the template body fresh from `contract_templates.body` via the document's `template_id`. (Start from the ORIGINAL tokenized body, not the current `merged_body`, so re-merge is idempotent and reversible.)
2. Load all `contract_fields` for the document into a key→value map (`field_key` is the token name WITHOUT braces, e.g. `TXN.LEASE_FEE`; values as entered).
3. CUT-marker pass (data-driven — see C.3 table). For each distinct CUT section name in the body: if its KEEP condition is true, remove only its marker comments (keep the inner content); else remove the whole section (start comment through end comment). Use the same regexes v9 uses:
   - keep: `regexp_replace(body, '[ \t]*<!-- CUT-(START|END): ' || name || '[^>]*-->\n?', '', 'g')`
   - strip: `regexp_replace(body, '\n?[ \t]*<!-- CUT-START: ' || name || '[^>]*-->.*<!-- CUT-END: ' || name || ' -->\n?', E'\n', 'g')` (dotall; the v9 pattern relies on `.` matching newlines under the flags used — replicate v9's exact call so nested INSURANCE works: process OUTER `INSURANCE` first, then inner blocks, OR rely on the same greedy match v9 uses. VERIFY nesting: the INSURANCE wrapper contains the three insurance sub-blocks; when INSURANCE is stripped the inner ones vanish with it; when INSURANCE is kept, each inner block is then evaluated on its own condition. Implement by evaluating INSURANCE first and, if kept, evaluating the three children next.)
4. Token pass: replace every `{{field_key}}` present in the body with its `contract_fields` value (COALESCE to empty string). Leave `{{SIG.*}}` in place (signing fills them). For any token that has NO `contract_fields` row (e.g. a token the seed didn't cover), fall back to the v9 table-based resolution OR leave blank — prefer leaving blank and rely on the seed covering every non-SIG token (GAP E ensures this).
5. Strip-unfilled pass (decision 6). After token substitution, remove label lines whose value resolved empty. The template renders terms as `Label: {{TOKEN}}` on their own line; when the value is empty the line reads `Label: ` (trailing space/empty). Remove such lines so the finished document shows only filled terms. Implementation: split on newlines; drop any line matching `^[^:\n]+:\s*$` (a label with no value) EXCEPT lines that are section headers or prose. To avoid removing legitimate empty-looking prose, only strip lines that (a) contained a token before substitution AND (b) resolved empty. The safe way: do the strip DURING the token pass — when a token's value is empty, replace the whole line containing it (from preceding newline to following newline) with nothing, rather than replacing just the token. Pseudocode:
   ```
   for each field_key with empty value:
     body := regexp_replace(body, '(^|\n)[^\n]*\{\{' || field_key || '\}\}[^\n]*', '', 'g')  -- drop the line
   for each field_key with non-empty value:
     body := replace(body, '{{'||field_key||'}}', value)
   ```
   This drops the entire `Label: {{TOKEN}}` line when empty and fills it when present. Multi-token lines: if a line has two tokens and one is empty, prefer filling present tokens and blanking absent ones rather than dropping the line — so guard the line-drop to lines whose ONLY token is the empty one. (The new lease template puts each fillable term on its own single-token line, so this edge is rare; still guard it.)
6. Collapse the blank lines left by stripped sections/lines: `regexp_replace(body, '\n{3,}', E'\n\n', 'g')`.
7. `UPDATE documents SET merged_body = <rebuilt body> WHERE id = p_document_id AND workflow_state <> 'executed'` (never rewrite an executed body).

Return the rebuilt body (text) for convenience/testing.

## C.3 CUT condition table (GAP D — authoritative)
Conditions are evaluated from `contract_fields` values on the document. "present/non-empty" means the field's value is not null and not blank after trim.

| CUT section | KEEP when |
|---|---|
| `EVALUATION_PERIOD` | field `TXN.EVALUATION_START` is present OR field `include_evaluation_period` = 'Yes' (use whichever the seed defines; GAP E defines `TXN.EVALUATION_START`/`TXN.EVALUATION_END`, so KEEP when either is present) |
| `PARTIAL_LEASE` | field `TXN.LEASE_TYPE` value equals 'Partial Lease' (case-insensitive contains 'Partial') |
| `INSURANCE` (wrapper) | ANY of `TXN.MORTALITY_INSURANCE_COST`, `TXN.MAJOR_MEDICAL_INSURANCE_COST`, `TXN.LOSS_OF_USE_INSURANCE_COST` present, OR any of the corresponding required-flags = 'Yes' |
| `MORTALITY_INSURANCE` | `TXN.MORTALITY_INSURANCE_COST` present (or its required-flag = 'Yes') |
| `MAJOR_MEDICAL_INSURANCE` | `TXN.MAJOR_MEDICAL_INSURANCE_COST` present (or flag = 'Yes') |
| `LOSS_OF_USE_INSURANCE` | `TXN.LOSS_OF_USE_INSURANCE_COST` present (or flag = 'Yes') |
| `COMPETITION` | `TXN.COMPETITION_TERMS` present OR `competition_permitted` = 'Yes' |

The seed (GAP E) MUST define the fields these conditions read. Keep the condition logic in ONE place inside `remerge_contract_from_fields` as a small helper that takes the field map and the section name and returns keep/strip; add lease sections there. This keeps CUT rules data-driven and testable, unlike v9's hardcoded MINOR/JUMPER.

Leave v9's existing MINOR/JUMPER handling untouched for the other templates. The re-merge function is lease/purchase-specific (invoked at contract lock); it does not replace v9 for the release/onboarding flows.

## C.4 Wiring into lock
Call `remerge_contract_from_fields` at the lock transition so the body the parties see and sign is the stripped, field-sourced one. Two options; implement option (a):

(a) In `advance_document_workflow`, when `p_to = 'locked'` and the guards pass (no open change requests, no required blank), call `PERFORM remerge_contract_from_fields(p_document_id)` immediately before/after setting `workflow_state='locked'`. This guarantees the locked body is final before any signature.

Also call it defensively inside `lock_and_sign_contract` before delegating to `record_signature`, in case a caller signs straight from `editable` (the "clean uncontested contract" path that function already allows) — so that path also gets a field-sourced, stripped body.

Do NOT call it after `executed` (guarded by the `workflow_state <> 'executed'` clause in the UPDATE).

## C.5 Interaction with record_signature SIG substitution
`record_signature` v6 substitutes `{{SIG.<ROLE>.NAME/DATE}}` into `merged_body` at signing. Because re-merge starts from the original template body (which still contains `{{SIG.*}}`) and leaves SIG tokens in place, the sequence is: lock → re-merge (fills all non-SIG from fields, strips unfilled, resolves CUT, leaves SIG) → sign (record_signature fills SIG). Confirm re-merge is not called again after the first signature (it isn't — lock happens once, and the `executed` guard blocks it). If a document could be re-locked after a rejected signature round, ensure re-merge re-derives from fields cleanly (it does, since it always starts from the template body).

## C.6 Acceptance
- A lease where the parties skipped all split items and left insurance/competition/evaluation blank produces a signed body with NO insurance/competition/evaluation sections and no empty `Label:` lines.
- A lease that fills a previously-blank split at the end (before lock) shows that split in the final body.
- Setting `TXN.LEASE_TYPE='Full Lease'` strips the `PARTIAL_LEASE` section; `'Partial Lease'` keeps it with the reserved-days values.
- SIG tokens survive re-merge and are filled at signing.
- Re-merge is idempotent (running it twice yields the same body).
