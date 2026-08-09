/*
  # LEASEFIX 2g — sync must not blank imported horse values

  REGRESSION I CAUSED, and the guard so it cannot recur.

  sync_contract_fields_from_defs() resets any select/buttons/yesno field whose
  stored value is not one of its option VALUES. That rule is right for a field the
  author picks in the document: an option that no longer exists must not linger.

  It is wrong for HORSE.* fields. Those are IMPORTS from the horse record, written
  by attach_horse_to_document via horse_field_token_value(), which returns the
  human-readable LABEL — 'Bay', 'Selle Français' — because that is what belongs in
  the sentence of a contract. The option lists store CODES ('BAY',
  'SELLE_FRANCAIS'), so an imported value can never match, and every sync silently
  emptied HORSE.COLOR and HORSE.BREED. The document then rendered the muted
  "from horse record" placeholder in place of the horse's actual colour and breed.

  I ran that sync four times over the three live non-executed leases while applying
  the insurance work, which is what put the placeholder back on the owner's screen.
  (DOC-U4PZP54FP5, which I did not sync, still holds 'Bay' / 'Thoroughbred' — that
  is the control. DOC-RXW6U9M3BF was already empty before today from an earlier
  cause and is EXECUTED, so it is deliberately left untouched here.)

  Fix: the reset rule now skips HORSE.% entirely. For an imported field the horse
  record is the source of truth, not the picker, so a value the picker cannot
  render is a reason to fix the option list — never to erase the horse's data.

  Then re-import colour and breed on the live non-executed leases, from the record,
  through the same horse_field_token_value() the attach path uses.

  Requires PGCLIENTENCODING=UTF8.
*/

-- ── 1. the guard ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_contract_fields_from_defs(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_tkey text;
BEGIN
  SELECT d.org_id, t.template_key INTO v_org, v_tkey
    FROM documents d JOIN contract_templates t ON t.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_tkey IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key = v_tkey) THEN
    RETURN;  -- flat templates manage their own fields
  END IF;

  -- new defs → new blank rows
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_org, p_document_id, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = v_tkey
     AND NOT EXISTS (
       SELECT 1 FROM contract_fields cf
        WHERE cf.document_id = p_document_id AND cf.field_key = d.field_key);

  -- existing rows → refresh def-owned columns (value is preserved)
  UPDATE contract_fields cf SET
      label = d.label, section = d.section, clause_key = d.clause_key,
      owner_role = d.owner_role, value_type = d.value_type,
      input_kind = nullif(d.input_kind,''), format_type = d.format_type,
      options = d.options, conditional_on = d.conditional_on, guidance = d.guidance,
      required = d.required, is_optional = d.is_optional, sort_order = d.sort_order,
      parent_field_key = d.parent_field_key, responsibility_kind = d.responsibility_kind,
      updated_at = now()
    FROM contract_field_defs d
   WHERE d.template_key = v_tkey
     AND cf.document_id = p_document_id AND cf.field_key = d.field_key;

  -- selected option no longer offered → reset the field. Only for single-select
  -- controls (select / buttons / yesno) with a non-empty value that is NOT present
  -- in the (now-refreshed) options list. Multi-select values (which are stored as
  -- CSV and may legitimately combine several codes) and free-text are left alone.
  --
  -- HORSE.% is EXCLUDED (2026-08-09). Those values are imported from the horse
  -- record by horse_field_token_value(), which returns the display LABEL ('Bay')
  -- while the options carry CODES ('BAY') — so they never matched and every sync
  -- silently erased the horse's colour and breed. For an imported field the record
  -- is the source of truth, not the picker; a value the picker cannot render means
  -- the option list needs fixing, not that the horse's data should be destroyed.
  UPDATE contract_fields cf SET value = '', updated_at = now()
   WHERE cf.document_id = p_document_id
     AND cf.owner_role <> 'SYSTEM'
     AND cf.field_key NOT LIKE 'HORSE.%'
     AND coalesce(cf.value,'') <> ''
     AND cf.input_kind IN ('select','buttons','yesno')
     AND cf.value NOT LIKE '%,%'                       -- skip multi-select CSVs
     AND jsonb_typeof(cf.options) = 'array'
     AND jsonb_array_length(cf.options) > 0
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(cf.options) o
        WHERE o->>'value' = cf.value);

  -- rows whose def is gone → remove (but never remove SYSTEM party auto-fill rows,
  -- which are inserted by fill_party_fields_from_contacts and have no def)
  DELETE FROM contract_fields cf
   WHERE cf.document_id = p_document_id
     AND cf.owner_role <> 'SYSTEM'
     AND NOT EXISTS (
       SELECT 1 FROM contract_field_defs d
        WHERE d.template_key = v_tkey AND d.field_key = cf.field_key);
END;
$function$;


-- ── 2. re-import what the sync erased ────────────────────────────────────────
-- Same source and same function the attach path uses, so the restored value is
-- byte-identical to what a fresh attach would write. EXECUTED and VOID documents
-- are excluded: an executed instrument is never rewritten.
UPDATE contract_fields cf
   SET value = horse_field_token_value(h, upper(split_part(cf.field_key, '.', 2))),
       updated_at = now()
  FROM documents d
  JOIN horses h ON h.id = d.horse_id
 WHERE cf.document_id = d.id
   AND d.deleted_at IS NULL
   AND d.workflow_state NOT IN ('executed','void')
   AND cf.field_key LIKE 'HORSE.%'
   AND coalesce(cf.value,'') = ''
   AND coalesce(horse_field_token_value(h, upper(split_part(cf.field_key, '.', 2))), '') <> '';
