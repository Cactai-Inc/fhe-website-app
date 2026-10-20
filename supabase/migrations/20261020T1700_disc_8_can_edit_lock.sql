-- Disclosure reciprocity, phase 8: read-only enforcement for record-fed disclosures.
-- (1) The disclosure CONTENT fields (HORSE.* tokens) are imported from the record and
--     are never editable on the contract — edits happen on the record (rule 1).
-- (2) A disclosure GATE (HORSE.*_GATE) is locked to its record-derived value when the
--     horse's matching record section HAS entries (rule 3), and author-editable only
--     when the record section is empty (rule 2).
-- A small helper answers "does the horse on this document have entries in the section
-- this gate governs" so both can_edit and the write guard share one truth.

CREATE OR REPLACE FUNCTION public.disclosure_gate_locked(p_document_id uuid, p_gate_field text)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- p_gate_field like 'HORSE.KNOWN_CONDITIONS_GATE' -> the section's HAS-ENTRIES token
  -- is the same key ('KNOWN_CONDITIONS_GATE'); the resolver returns 'YES' when the
  -- record section is non-empty. Locked exactly when that is 'YES'.
  SELECT CASE WHEN p_gate_field LIKE 'HORSE.%\_GATE' THEN
    coalesce((SELECT horse_field_token_value(h, split_part(p_gate_field,'.',2))='YES'
                FROM documents d JOIN horses h ON h.id = d.horse_id
               WHERE d.id = p_document_id), false)
  ELSE false END;
$function$;
REVOKE EXECUTE ON FUNCTION public.disclosure_gate_locked(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disclosure_gate_locked(uuid, text) TO authenticated, service_role;

-- Extend can_edit in contract_document_detail: content fields never editable; gate
-- fields not editable when the record section has entries.
DO $ce$
DECLARE
  v_def text;
  v_old text := $q$              ELSE
                   v_staff
                OR (cf.owner_role = 'DEAL' AND v_can_deal)
                OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles) AND v_can_fill)
            END
          ) AND v_state IN ('editable','editing','in_review'))$q$;
  v_new text := $q$              -- Disclosure CONTENT is imported from the horse record; never edited here.
              WHEN cf.field_key IN (
                     'HORSE.KNOWN_CONDITIONS','HORSE.MEDICAL_HISTORY','HORSE.BEHAVIORAL_HISTORY',
                     'HORSE.INJURIES_TO_HUMANS','HORSE.INJURIES_TO_HORSE','HORSE.MEDICATIONS','HORSE.SUPPLEMENTS')
                THEN false
              -- A disclosure GATE locks to its record-derived value when the record
              -- section has entries; it is author-answerable only when the record is empty.
              WHEN cf.field_key LIKE 'HORSE.%\_GATE' AND disclosure_gate_locked(p_document_id, cf.field_key)
                THEN false
              ELSE
                   v_staff
                OR (cf.owner_role = 'DEAL' AND v_can_deal)
                OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles) AND v_can_fill)
            END
          ) AND v_state IN ('editable','editing','in_review'))$q$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='contract_document_detail' AND pronamespace='public'::regnamespace;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'contract_document_detail can_edit anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $ce$;

-- Mirror the lock in the write path so a direct set_contract_field can't bypass the UI.
DO $scf$
DECLARE
  v_def text;
  v_old text := $q$  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;$q$;
  v_new text := $q$  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  -- disclosure content is imported from the horse record; refuse contract-side edits.
  IF p_field_key IN ('HORSE.KNOWN_CONDITIONS','HORSE.MEDICAL_HISTORY','HORSE.BEHAVIORAL_HISTORY','HORSE.INJURIES_TO_HUMANS','HORSE.INJURIES_TO_HORSE','HORSE.MEDICATIONS','HORSE.SUPPLEMENTS') THEN
    RAISE EXCEPTION 'this disclosure is imported from the horse record; edit it on the record';
  END IF;
  IF p_field_key LIKE 'HORSE.%\_GATE' AND disclosure_gate_locked(p_document_id, p_field_key) THEN
    RAISE EXCEPTION 'this disclosure gate is set from the horse record and cannot be changed here';
  END IF;$q$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='set_contract_field' AND pronamespace='public'::regnamespace;
  IF position('disclosure content is imported' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'set_contract_field auth anchor not found';
  END IF;
  -- Replace the auth check with: auth check + close its IF + our guards + reopen a
  -- harmless IF so the original "END IF;" that closed the auth block still balances.
  EXECUTE replace(v_def, v_old, v_new);
END $scf$;
