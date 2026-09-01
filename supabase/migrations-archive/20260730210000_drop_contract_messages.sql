-- ─────────────────────────────────────────────────────────────────────────────
-- REMOVE contract_messages ENTIRELY (2026-07-30, owner directive)
--
-- WHAT IT WAS. Created 2026-07-11 (20260711130000_contract_controls_messages.sql)
-- for: "parties and staff can message on a contract ('why I won't sign'
-- included); staff see all contract messages regardless of side — deal-
-- conversation oversight."
--
-- WHY IT GOES. That is exactly what the Notes drawer now does
-- (contract_notes + contract_note_messages, 20260730180000), and Notes has the
-- structure this never had: titled threads rather than one flat list per
-- document. contract_messages was built, wired as far as two RPCs and two client
-- wrappers, and then never given a UI — 0 rows in 19 days, zero callers. Keeping
-- it means two answers to one question, which is the drift this cleanup exists
-- to remove.
--
-- DEPENDENCY CHECK before dropping: 0 rows, 0 views, 0 foreign keys pointing at
-- it, and 3 functions referencing it — the two dead RPCs (dropped here) and
-- purge_account, whose DELETE line is patched below so the purge routine does not
-- break on a missing table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Patch purge_account BEFORE the table disappears ──────────────────────
-- Surgical: read the live body, remove the single DELETE line, re-execute.
-- Guarded so a re-run is a no-op rather than an error.
DO $do$
DECLARE
  v_def text;
  v_line text := '    DELETE FROM contract_messages     WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'purge_account';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'purge_account not found — resolve before dropping the table';
  END IF;

  IF position('contract_messages' in v_def) = 0 THEN
    RAISE NOTICE 'purge_account no longer references contract_messages — skipping';
  ELSE
    IF position(v_line in v_def) = 0 THEN
      RAISE EXCEPTION 'purge_account body changed shape — re-derive the patch';
    END IF;
    EXECUTE replace(v_def, v_line || E'\n', '');
    RAISE NOTICE 'purge_account: contract_messages cleanup line removed';
  END IF;
END
$do$;

-- ── 2. The two dead RPCs ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.contract_messages_list(uuid);
DROP FUNCTION IF EXISTS public.contract_message_post(uuid, text);

-- ── 3. The table ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.contract_messages;
