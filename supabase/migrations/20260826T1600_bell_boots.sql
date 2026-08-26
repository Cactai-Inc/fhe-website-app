-- BELL BOOTS JOIN THE LESSOR-SUPPLIED EQUIPMENT LIST.
--
-- Owner, 2026-08-26: "add bell boots to the list of lessor supplied equipment for
-- the horse".
--
-- That list is `TXN.PROTECTIVE_EQUIPMENT`, whose clause reads:
--   "Lessor will provide the following equipment for the Horse: {{TXN.PROTECTIVE_EQUIPMENT}}"
--
-- Placed after "Front boots / wraps", because bell boots are front-hoof
-- protection and the list reads down the horse. "Other" stays last.
--
-- ⚠️ THE OPTIONS ARE STORED IN TWO PLACES, which is how this repo keeps losing
-- changes. `contract_field_defs.options` is the template's copy; every document
-- ALSO carries its own `contract_fields.options`, snapshotted when it was
-- generated. Updating only the template would add bell boots to leases written in
-- future and leave the live one without them.
--
-- ⚠️ EXECUTED DOCUMENTS ARE NOT TOUCHED. A signed lease says what it said when it
-- was signed; adding an option to it after the fact would alter evidence.

BEGIN;

-- 1. the template copy — all four lease templates carry the same list
UPDATE contract_field_defs
   SET options = '[{"label": "Front boots / wraps", "value": "FRONT_BOOTS"},
                   {"label": "Bell boots", "value": "BELL_BOOTS"},
                   {"label": "Hind boots / wraps", "value": "HIND_BOOTS"},
                   {"label": "Other", "value": "OTHER"}]'::jsonb
 WHERE field_key = 'TXN.PROTECTIVE_EQUIPMENT'
   AND options @> '[{"value": "FRONT_BOOTS"}]'::jsonb
   AND NOT (options @> '[{"value": "BELL_BOOTS"}]'::jsonb);

-- 2. the per-document copy, on anything not yet executed
UPDATE contract_fields cf
   SET options = '[{"label": "Front boots / wraps", "value": "FRONT_BOOTS"},
                   {"label": "Bell boots", "value": "BELL_BOOTS"},
                   {"label": "Hind boots / wraps", "value": "HIND_BOOTS"},
                   {"label": "Other", "value": "OTHER"}]'::jsonb,
       updated_at = now()
  FROM documents d
 WHERE d.id = cf.document_id
   AND d.deleted_at IS NULL
   AND coalesce(d.workflow_state, '') <> 'executed'
   AND cf.field_key = 'TXN.PROTECTIVE_EQUIPMENT'
   AND cf.options @> '[{"value": "FRONT_BOOTS"}]'::jsonb
   AND NOT (cf.options @> '[{"value": "BELL_BOOTS"}]'::jsonb);

COMMIT;
