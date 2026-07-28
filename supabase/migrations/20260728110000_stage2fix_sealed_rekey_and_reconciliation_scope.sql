-- Stage 2 verification fixes (owner-authorized, 2026-07-28):
--
-- 1. Sealed-signature merge (S2.3): promote_contact_to_account's identity
--    merge must re-key signer_contact_id on SEALED signatures, which the seal
--    trigger rightly blocks. Authorized fix: a transaction-local guarded
--    bypass (app.allow_signature_rekey — same pattern as
--    app.allow_profile_link), set ONLY inside promote_contact_to_account and
--    honored by block_signed_signature_update SOLELY for signer_contact_id
--    re-keys; every re-key is audit-logged (old contact, new contact,
--    document id, reason identity_merge). Signing evidence is never
--    destroyed — NOT void-and-reissue.
--
-- 2. affiliation_reconciliation scope: the deleted_at filter that hid the
--    d268330c drift from the backfill ALSO hides such contacts from the
--    drift monitor itself (and from verification queries). The view-function
--    now includes soft-deleted contacts that still carry a document trail or
--    group rows, marked by a new is_deleted column, so monitoring covers the
--    whole derivation surface.

-- ── 1a. The seal honors the guarded re-key ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_signed_signature_update()
RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  -- Guarded identity-merge re-key: ONLY the signer_contact_id may change,
  -- ONLY under the transaction-local flag (set inside
  -- promote_contact_to_account), and every re-key leaves an audit row.
  IF OLD.signed_at IS NOT NULL
     AND current_setting('app.allow_signature_rekey', true) = '1'
     AND NEW.signer_contact_id IS DISTINCT FROM OLD.signer_contact_id
     AND NEW.typed_name  IS NOT DISTINCT FROM OLD.typed_name
     AND NEW.signed_at   IS NOT DISTINCT FROM OLD.signed_at
     AND NEW.ip_address  IS NOT DISTINCT FROM OLD.ip_address
     AND NEW.user_agent  IS NOT DISTINCT FROM OLD.user_agent
     AND NEW.method      IS NOT DISTINCT FROM OLD.method
     AND NEW.party_role  IS NOT DISTINCT FROM OLD.party_role
     AND NEW.document_id IS NOT DISTINCT FROM OLD.document_id THEN
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
    VALUES (auth.uid(), 'UPDATE', 'signatures', OLD.id,
            jsonb_build_object('reason', 'identity_merge',
                               'signer_contact_id', OLD.signer_contact_id,
                               'document_id', OLD.document_id),
            jsonb_build_object('reason', 'identity_merge',
                               'signer_contact_id', NEW.signer_contact_id,
                               'document_id', NEW.document_id));
    RETURN NEW;
  END IF;

  IF OLD.signed_at IS NOT NULL AND (
       NEW.typed_name        IS DISTINCT FROM OLD.typed_name
    OR NEW.signed_at         IS DISTINCT FROM OLD.signed_at
    OR NEW.ip_address        IS DISTINCT FROM OLD.ip_address
    OR NEW.user_agent        IS DISTINCT FROM OLD.user_agent
    OR NEW.method            IS DISTINCT FROM OLD.method
    OR NEW.party_role        IS DISTINCT FROM OLD.party_role
    OR NEW.signer_contact_id IS DISTINCT FROM OLD.signer_contact_id
    OR NEW.document_id       IS DISTINCT FROM OLD.document_id
  ) THEN
    RAISE EXCEPTION 'signature % is sealed (signed_at set); use void-and-reissue, not a direct update', OLD.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 1b. promote_contact_to_account arms the flag around its re-key ──────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='promote_contact_to_account';
  v_src := replace(v_src,
    'UPDATE signatures        SET signer_contact_id = v_survivor WHERE signer_contact_id = v_dissolved;',
    'PERFORM set_config(''app.allow_signature_rekey'', ''1'', true);
    UPDATE signatures        SET signer_contact_id = v_survivor WHERE signer_contact_id = v_dissolved;
    PERFORM set_config(''app.allow_signature_rekey'', ''0'', true);');
  IF v_src NOT ILIKE '%allow_signature_rekey%' THEN
    RAISE EXCEPTION 'promote_contact_to_account re-key arming incomplete';
  END IF;
  EXECUTE v_src;
END $$;

-- ── 2. Reconciliation sees the whole derivation surface ─────────────────────
DROP FUNCTION IF EXISTS affiliation_reconciliation();  -- OUT columns change
CREATE OR REPLACE FUNCTION public.affiliation_reconciliation()
RETURNS TABLE(contact_id uuid, display_code text, name text, has_account boolean, is_deleted boolean, derived_groups text[], current_groups text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code,
         nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), ''),
         (p.user_id IS NOT NULL),
         (c.deleted_at IS NOT NULL),
         coalesce(derive_affiliations(c.id), ARRAY[]::text[]),
         coalesce((SELECT array_agg(DISTINCT g.group_type ORDER BY g.group_type)
                     FROM groups g WHERE g.contact_id = c.id),
                  ARRAY[]::text[])
    FROM contacts c
    LEFT JOIN profiles p ON p.contact_id = c.id
   WHERE c.deleted_at IS NULL
      OR EXISTS (SELECT 1 FROM groups g WHERE g.contact_id = c.id)
      OR EXISTS (SELECT 1 FROM documents d WHERE d.contact_id = c.id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL)
   ORDER BY nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), '');
$function$;
