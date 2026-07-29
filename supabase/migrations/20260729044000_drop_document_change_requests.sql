-- ─────────────────────────────────────────────────────────────────────────────
-- Retire `document_change_requests`.
--
-- Its semantics moved to `contract_change_requests` (the renamed contract_comments)
-- in 20260729040000 + 20260729041000. Verified before dropping:
--   • 0 rows in the table (it never held any),
--   • 0 functions reference it (all 8 re-pointed),
--   • 0 foreign keys point at it,
--   • 0 views reference it.
-- Guarded so it cannot silently destroy data if any of that stops being true.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $do$
DECLARE v_rows bigint; v_fns int; v_fks int;
BEGIN
  IF to_regclass('public.document_change_requests') IS NULL THEN
    RAISE NOTICE 'document_change_requests already dropped — nothing to do';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.document_change_requests' INTO v_rows;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'refusing to drop document_change_requests: % row(s) present', v_rows;
  END IF;

  SELECT count(*) INTO v_fns
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prokind = 'f'
     AND p.prosrc ILIKE '%document_change_requests%';
  IF v_fns > 0 THEN
    RAISE EXCEPTION 'refusing to drop document_change_requests: % function(s) still reference it', v_fns;
  END IF;

  SELECT count(*) INTO v_fks
    FROM pg_constraint WHERE confrelid = 'public.document_change_requests'::regclass;
  IF v_fks > 0 THEN
    RAISE EXCEPTION 'refusing to drop document_change_requests: % foreign key(s) point at it', v_fks;
  END IF;

  EXECUTE 'DROP TABLE public.document_change_requests';
END
$do$;

COMMIT;
