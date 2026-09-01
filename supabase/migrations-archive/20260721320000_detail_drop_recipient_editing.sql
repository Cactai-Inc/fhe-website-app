-- Consistency fix: contract_document_detail computed per-field `can_edit` using
-- the recipient_editing flag (v_recip), but that flag no longer has a UI toggle
-- and was removed from the write path (set_contract_field / set_field_structured
-- in 20260721300000). Left as-is, the UI could show a DEAL field as editable while
-- the write RPC rejects it. Drop v_recip from can_edit so the detail RPC matches
-- the write path: a DEAL field is editable by staff, the originator, or a party
-- with can_edit_deal.
DO $do$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('contract_document_detail'::regproc);
  v_def := replace(v_def,
    'OR (cf.owner_role = ''DEAL'' AND ((v_orig = v_me) OR v_recip OR v_can_deal))',
    'OR (cf.owner_role = ''DEAL'' AND ((v_orig = v_me) OR v_can_deal))');
  EXECUTE v_def;
END $do$;
