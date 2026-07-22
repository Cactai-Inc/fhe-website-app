-- Remove the redundant "recipient_editing" document-wide edit switch from the
-- field-write auth path. Deal-term editing by a party is now driven ONLY by that
-- party's per-party control (can_edit_deal) — the single source of truth — plus
-- staff / originator. This removes the confusing second toggle that duplicated
-- the per-party "Edit deal terms" control.
--
-- Both set_contract_field and set_field_structured contain the identical clause:
--   OR (v_owner_role = 'DEAL' AND (v_is_orig OR v_recip_edit OR v_can_deal))
-- Rewrite each to drop the v_recip_edit term. (The recipient_editing column and
-- its read-only references elsewhere are left in place; nothing depends on the
-- write path honoring it once the UI toggle is gone.)
DO $do$
DECLARE fn text; v_def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['set_contract_field', 'set_field_structured'] LOOP
    v_def := pg_get_functiondef(fn::regproc);
    v_def := replace(v_def,
      'OR (v_owner_role = ''DEAL'' AND (v_is_orig OR v_recip_edit OR v_can_deal))',
      'OR (v_owner_role = ''DEAL'' AND (v_is_orig OR v_can_deal))');
    EXECUTE v_def;
  END LOOP;
END $do$;
