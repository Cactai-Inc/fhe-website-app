-- NOGUARD2 item 1 — DROP public.void_signatures_on_edit(uuid).
--
-- WHAT IT WAS. A SECURITY DEFINER function taking only a document id. It
-- soft-deleted every live signature on that document, stamped
-- signatures_voided_at / signatures_voided_roles, and reset status to
-- AWAITING_SIGNATURE unless the document was already EXECUTED — in which case
-- the status was left as EXECUTED while the signatures were voided anyway. That
-- is the worst combination available: a contract that still reads as executed
-- with nothing signing it.
--
-- WHY IT IS BEING DROPPED RATHER THAN GUARDED. It has no identity check of any
-- kind, and anon, authenticated and PUBLIC all hold EXECUTE. Verified against
-- production 2026-08-10:
--
--   proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,
--            authenticated=X/postgres,service_role=X/postgres}
--   documents with live signatures : 61
--   live signature rows            : 62
--   documents.signatures_voided_at IS NOT NULL : 0 of 81
--
-- Every executed document in the system was in range of one anonymous call, and
-- the function has never once fired in production.
--
-- It also has no caller. Verified four ways: no hit in src/, no hit in api/, no
-- other pg_proc body references it, and pg_depend reports zero non-normal
-- dependencies (no trigger, no view, no default, no RLS policy).
--
-- It is not merely dead code. assert_not_signature_locked() is the LIVE policy —
-- a document carrying a signature is read-only, enforced by set_contract_field,
-- set_field_structured, set_document_co_buyer and remove_document_co_buyer.
-- void_signatures_on_edit is the opposing policy (edit freely, signatures
-- silently void) that lost. Keeping it keeps an unauthenticated switch into the
-- model that lost.
--
-- REVERSIBILITY. The full body is recorded verbatim below, and in six historical
-- migrations (20260731160000, 20260801000000, 20260802010001, 20260802030000,
-- 20260802090001, 20260803140000). If the auto-void model is ever wanted it gets
-- rebuilt deliberately, with a guard and without a PUBLIC grant.
--
-- Dropping also moots the three-grant revoke trap: PUBLIC (=X/postgres), anon
-- and authenticated all held EXECUTE here, and a REVOKE naming only one of them
-- reports success while changing nothing. There is no grant left to get wrong.
--
--   CREATE OR REPLACE FUNCTION public.void_signatures_on_edit(p_document_id uuid)
--    RETURNS void
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   DECLARE
--     v_roles text[];
--   BEGIN
--     SELECT array_agg(DISTINCT s.party_role) INTO v_roles
--       FROM signatures s
--      WHERE s.document_id = p_document_id AND s.deleted_at IS NULL;
--
--     IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN RETURN; END IF;
--
--     -- Soft-delete: the signature is no longer in force, but the RECORD that it was
--     -- given, and when, is evidence and is never destroyed.
--     UPDATE signatures SET deleted_at = now()
--      WHERE document_id = p_document_id AND deleted_at IS NULL;
--
--     UPDATE documents
--        SET signatures_voided_at = now(),
--            signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
--            status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END
--      WHERE id = p_document_id;
--   END
--   $function$
--
-- The columns it wrote (documents.signatures_voided_at / _roles) are NOT dropped.
-- They are inert with no writer, and dropping columns is a separate decision.

BEGIN;

-- Refuse to run blind: assert the exact pre-state this migration was written for.
DO $pre$
DECLARE
  v_oid oid;
  v_refs int;
  v_deps int;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'void_signatures_on_edit';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'NOGUARD2: void_signatures_on_edit not found — nothing to drop, refusing to report a no-op as success';
  END IF;

  -- Exactly one overload, or the DROP below targets the wrong thing.
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'void_signatures_on_edit') <> 1 THEN
    RAISE EXCEPTION 'NOGUARD2: unexpected overloads of void_signatures_on_edit';
  END IF;

  -- No in-database caller.
  SELECT count(*) INTO v_refs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.oid <> v_oid
     AND p.prosrc ~* 'void_signatures_on_edit';
  IF v_refs > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % in-database caller(s) reference void_signatures_on_edit — do not drop', v_refs;
  END IF;

  -- No trigger / view / default / policy dependency.
  SELECT count(*) INTO v_deps
    FROM pg_depend d WHERE d.refobjid = v_oid AND d.deptype <> 'n';
  IF v_deps > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % dependency(ies) on void_signatures_on_edit — do not drop', v_deps;
  END IF;
END
$pre$;

-- No CASCADE, deliberately: if anything at all depends on it, this must fail.
DROP FUNCTION public.void_signatures_on_edit(uuid);

-- Prove it is gone, in the same transaction.
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'void_signatures_on_edit') THEN
    RAISE EXCEPTION 'NOGUARD2: void_signatures_on_edit still present after DROP';
  END IF;
  RAISE NOTICE 'NOGUARD2: void_signatures_on_edit dropped';
END
$post$;

COMMIT;
