-- disc_44 (fix round item 4): a staff action to correct a document's effective
-- date — the date it is in force on. D19: it states itself, REQUIRES a reason,
-- and is recorded with the actor and timestamp.
--
-- The documents audit trigger (audit_documents → audit_row_change) already writes
-- an old/new row for the UPDATE, but that generic row does not carry WHY. This RPC
-- writes an explicit EFFECTIVE_DATE_CORRECTED audit row holding the old date, new
-- date, and the required reason, so the correction is answerable later.

CREATE OR REPLACE FUNCTION public.set_document_effective_date(
  p_document_id uuid,
  p_effective_date date,
  p_reason text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_old    date;
  v_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to correct the effective date';
  END IF;
  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'an effective date is required';
  END IF;

  SELECT effective_date, status INTO v_old, v_status
    FROM documents
   WHERE id = p_document_id AND org_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document not found in this organisation';
  END IF;

  UPDATE documents SET effective_date = p_effective_date, updated_at = now()
   WHERE id = p_document_id;

  -- D19: the reason, the old and new value, the actor and the time, kept. The
  -- audit_logs.action CHECK allows only INSERT/UPDATE/DELETE, so the correction is
  -- an UPDATE whose new_value carries the reason and the field changed, which is
  -- what makes it answerable later (the generic trigger row has no reason).
  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'documents', p_document_id,
          jsonb_build_object('effective_date', v_old),
          jsonb_build_object('effective_date', p_effective_date, 'reason', v_reason,
                             'change', 'effective_date_corrected'));

  RETURN jsonb_build_object('document_id', p_document_id,
                            'effective_date', p_effective_date,
                            'previous', v_old);
END
$function$;

GRANT EXECUTE ON FUNCTION public.set_document_effective_date(uuid, date, text) TO authenticated;
