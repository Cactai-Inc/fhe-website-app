-- NULL-guard repair, TIER 2 — the remaining writers.
--
-- Same defect, same repair, same proof method as tier 1
-- (20260811T1300_noguard_null_tier1_destructive.sql — read that header first; the
-- reasoning is not repeated here).
--
-- TIER 2 IS NOT COSMETIC EITHER. Demonstrated in the tier-1 dry run, acting as
-- admin@cactai.io against a document the platform owner has no business touching:
--
--     set_recipient_editing  ADMITTED, and wrote recipient_editing = true
--
-- while every repaired tier-1 function refused. These 25 all write; they are second
-- in order of consequence, not second in whether they are live.
--
-- What each guard protects:
--
--   change requests / redlines
--     upsert-side already in tier 1; here: agree_change_request,
--     edit_change_request_entry, reply_to_change_request, request_document_change,
--     submit_change_requests, mark_change_request_seen — accept, edit, answer and
--     submit proposed changes to a contract's terms
--   comments
--     post_contract_comment, resolve_contract_comment, mark_comment_stale — write and
--     resolve pinned comments on a live contract
--   composition
--     add_contract_composition, add_contract_element — add clauses and fields to a
--     contract; set_field_included, set_field_na, set_field_responsibility,
--     set_field_control_override — change what a field is and who owns it
--   party controls and flow
--     set_party_controls, set_recipient_editing — who may fill, edit, suggest
--   horse section
--     assign_horse_section, confirm_horse_section, reopen_horse_section,
--     capture_horse_record_info — the horse identity block on a lease
--   record-keeping
--     add_booking_note, approve_contract_review, log_contract_change,
--     mark_document_opened — append to the audit and activity trail
--
-- `approve_contract_review` and `add_booking_note` use the POSITIVE form
-- (`IF has_staff_access() AND … THEN`), where NULL already fails closed — the caller
-- misses the staff branch rather than gaining one. They are repaired anyway so the
-- value is deterministic and the idiom is uniform; behaviour does not change.
--
-- REPLAY CAVEAT: rewrites live bodies in place; not replayable on a fresh database.
-- Same pre-existing property as tier 1 and the ~31 existing rewrite migrations.

DO $mig$
DECLARE
  v_names text[] := ARRAY[
    'agree_change_request',
    'edit_change_request_entry',
    'reply_to_change_request',
    'request_document_change',
    'submit_change_requests',
    'mark_change_request_seen',
    'post_contract_comment',
    'resolve_contract_comment',
    'mark_comment_stale',
    'add_contract_composition',
    'add_contract_element',
    'set_field_included',
    'set_field_na',
    'set_field_responsibility',
    'set_field_control_override',
    'set_party_controls',
    'set_recipient_editing',
    'assign_horse_section',
    'confirm_horse_section',
    'reopen_horse_section',
    'capture_horse_record_info',
    'add_booking_note',
    'approve_contract_review',
    'log_contract_change',
    'mark_document_opened'
  ];
  c_find text := 'has_staff_access\(\)\s+AND\s+([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*current_org\(\)';
  c_repl text := 'coalesce(has_staff_access() AND \1 = current_org(), false)';
  c_back text := 'coalesce\(has_staff_access\(\) AND ([A-Za-z_][A-Za-z0-9_.]*) = current_org\(\), false\)';
  c_orig text := 'has_staff_access() AND \1 = current_org()';
  v_name text; v_oid oid; v_def text; v_new text; v_rt text;
  v_hits int; v_wraps int; v_done int := 0; v_skipped int := 0;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR v_oid IN
      SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name AND p.prokind = 'f'
    LOOP
      v_def := pg_get_functiondef(v_oid);

      IF v_def ~ 'coalesce\(has_staff_access' THEN
        v_skipped := v_skipped + 1;
        RAISE NOTICE 'SKIP % — already repaired', v_name;
        CONTINUE;
      END IF;

      SELECT count(*) INTO v_hits FROM regexp_matches(v_def, c_find, 'g');
      IF v_hits = 0 THEN
        RAISE EXCEPTION 'no guard found in % — refusing to touch it', v_name;
      END IF;

      v_new := regexp_replace(v_def, c_find, c_repl, 'g');

      SELECT count(*) INTO v_wraps FROM regexp_matches(v_new, c_back, 'g');
      IF v_wraps <> v_hits THEN
        RAISE EXCEPTION 'rewrite count mismatch in %: % found, % wrapped', v_name, v_hits, v_wraps;
      END IF;

      v_rt := regexp_replace(v_new, c_back, c_orig, 'g');
      IF v_rt <> v_def THEN
        RAISE EXCEPTION 'rewrite is not a pure wrap in % — aborting', v_name;
      END IF;

      EXECUTE v_new;
      v_done := v_done + 1;
      RAISE NOTICE 'REPAIRED % (% guard(s))', v_name, v_hits;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'tier 2: % repaired, % already done', v_done, v_skipped;
  IF v_done + v_skipped <> array_length(v_names, 1) THEN
    RAISE EXCEPTION 'expected % functions, handled %', array_length(v_names, 1), v_done + v_skipped;
  END IF;
END $mig$;
