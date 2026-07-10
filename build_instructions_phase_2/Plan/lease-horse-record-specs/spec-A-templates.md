# Spec A — Contract Templates

Goal: make the new standardized `HORSE_LEASE.md` the loaded body for template_key `HORSE_LEASE`, and confirm `HORSE_PURCHASE_SALE` meets the same standards.

## A.1 Replace the lease template source

Replace the file `supabase/contract_templates/HORSE_LEASE.md` with the new standardized body delivered alongside this spec (`artifacts/contract_templates/HORSE_LEASE.md`).

Key properties of the new body (do not regress these):
- Party-role-neutral LESSOR / LESSEE; FHE never named; `{{ORG.LEGAL_NAME}}` and the "COMPANY is not a party" line and the third-party-services clause are removed entirely (owner decision).
- House-standard clauses present: binding arbitration in San Diego, California (short form — the CURRENT clause; do NOT reintroduce the older JAMS/AAA streamlined-arbitration language, which was superseded on main and must not be merged back in); each party bears own attorney's fees; gross-negligence/reckless/intentional carve-out on every release/assumption-of-risk clause. The exact current dispute-resolution sentence is: "Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California." Match this to whatever main currently uses across the other documents.
- Full PDF fidelity: evaluation period, partial-lease shared-use/schedule, per-category cost allocation, three insurance blocks, detailed risk-of-loss with liquidated-damages formula, mutual assumption of risk, mutual indemnification, protective equipment/tack, prohibited activities, termination, notice, assignment.
- No checkboxes anywhere; selections render as filled values.
- Optional sections wrapped in CUT markers: `EVALUATION_PERIOD`, `PARTIAL_LEASE`, `INSURANCE` (wrapping `MORTALITY_INSURANCE`, `MAJOR_MEDICAL_INSURANCE`, `LOSS_OF_USE_INSURANCE`), `COMPETITION`. Markers are balanced and properly nested (verified).
- New token `{{HORSE.FAIR_MARKET_VALUE}}` appears (needs GAP B).
- Signers LESSOR + LESSEE only (`{{SIG.LESSOR.*}}`, `{{SIG.LESSEE.*}}`).

## A.2 Regenerate the loader migration

The bodies are loaded by the generator, not hand-edited into SQL. After replacing the file, re-run:

```
node scripts/build-template-load-migration.mjs
```

This rewrites `supabase/migrations/20260629100000_load_contract_bodies.sql`, loading the new body into `contract_templates.body` for `HORSE_LEASE` and re-deriving that template's `template_tokens` rows (the new TXN/HORSE tokens register automatically here — the generator extracts every `{{NS.FIELD}}` in document order).

IMPORTANT: this repo treats `20260629100000` as a generated migration that re-runs on a fresh DB before the postdated seeds; regenerating it in place is the intended workflow (its own header says "edit the .md source and re-run the generator"). Do not hand-edit the migration.

Because the loader migration timestamp is early, on an existing/production database the body change must ALSO be applied forward. Add a tiny additive migration (new timestamp after `20260705020000`) that re-asserts the lease body from the generated source, so a DB already past `20260629100000` picks up the new text:

```
-- 202607xxxxxxxx_reload_horse_lease_body.sql
-- Re-assert HORSE_LEASE body + tokens forward (the generated loader at
-- 20260629100000 only runs on a fresh DB; production is past it). Body text is
-- the generator's output for HORSE_LEASE; keep this migration in sync if the
-- source .md changes again (or re-run the generator and copy the HORSE_LEASE arm).
UPDATE contract_templates SET body = $body$<PASTE THE NEW HORSE_LEASE.md BODY VERBATIM>$body$,
       updated_at = now()
 WHERE template_key = 'HORSE_LEASE';

DELETE FROM template_tokens
 WHERE template_id = (SELECT id FROM contract_templates WHERE template_key = 'HORSE_LEASE');
INSERT INTO template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
  SELECT (SELECT id FROM contract_templates WHERE template_key='HORSE_LEASE'),
         split_part(trim(both '{}' from tok), '.', 1) AS namespace,
         substr(trim(both '{}' from tok), position('.' in trim(both '{}' from tok)) + 1) AS field,
         tok,
         CASE split_part(trim(both '{}' from tok), '.', 1)
           WHEN 'SIG' THEN 'signature' WHEN 'DOC' THEN 'system' ELSE 'field' END,
         false, false
    FROM (SELECT DISTINCT unnest(regexp_matches(
            (SELECT body FROM contract_templates WHERE template_key='HORSE_LEASE'),
            '\{\{[A-Z0-9_.]+\}\}', 'g')) AS tok) t;
```

(If Claude Code prefers, generate this forward migration mechanically from the generator output rather than pasting — the requirement is only that production `contract_templates.body` and `template_tokens` for `HORSE_LEASE` end up matching the new source.)

## A.3 Purchase template check (no rewrite expected)

`supabase/contract_templates/HORSE_PURCHASE_SALE.md` already exists with the house-standard arbitration/own-fees/carve-out language and BUYER/SELLER neutrality. SETTLED: the purchase agreement reaches full parity with the standardized lease, so it DROPS its COMPANY-not-a-party section (section 10, "Third-Party Assistance") for consistency with the lease, which removed its equivalent. However, the purchase template body itself is being rebuilt to full parity from an owner-provided same-source reference document (see HANDOFF §6) — do NOT hand-edit the current purchase body in isolation; the parity rebuild (a later, separate effort blocked on that reference) will produce the corrected purchase template, at which point the COMPANY clause is dropped and the loader + forward re-assert migration are run exactly as A.2. Until the reference arrives, leave the purchase body as-is and note the pending rebuild.
- Token set: the purchase seed in GAP E targets existing tokens; unchanged until the parity rebuild.

## A.4 Acceptance
- `contract_templates.body` for `HORSE_LEASE` equals the new source; `template_tokens` for it include all new `{{TXN.*}}`/`{{HORSE.FAIR_MARKET_VALUE}}` tokens.
- Generating a lease (`start_lease_contract`) yields a `merged_body` containing the CUT comment markers still (they are stripped later at re-merge, GAP C) OR, if generation runs the current v9 CUT pass, the MINOR/JUMPER pass leaves the lease's markers intact because none match MINOR%/JUMPER% — confirm the lease markers survive generation so GAP C can evaluate them at lock.
