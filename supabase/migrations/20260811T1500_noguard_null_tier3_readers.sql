-- NULL-guard repair, TIER 3 — the readers.
--
-- Same defect, same repair, same proof method as tiers 1 and 2
-- (see 20260811T1300_noguard_null_tier1_destructive.sql for the reasoning).
--
-- These 18 do not write. They are last in order of consequence, and they are the
-- tier where "cosmetic" is closest to true — but not true. A NULL guard on a reader
-- still hands the platform owner the contents of tenant contracts: the parties, the
-- redline state, the signing set, the deal record, the change log. D1 says the
-- platform owner holds zero FHE tenant rows; reading them is the same violation as
-- writing them, minus the damage.
--
-- Three shapes are present, and only the first was ever exposed:
--
--   plpgsql `IF NOT (…) THEN RAISE`   — NULL skips the RAISE and returns the data.
--     booking_report, contract_change_log_list, contract_document_detail,
--     contract_redline_state, contract_section_tree, contract_signing_set,
--     deal_activity, deal_detail, deal_record_export, document_parties_summary,
--     pending_notify_summary, comment_author_identity, caller_may_propose
--
--   SQL functions with the term in a WHERE clause — NULL filters the row out, so
--     they already fail closed and return an empty set. Repaired for uniformity;
--     behaviour unchanged.
--     entity_status_log, horse_deals, list_deals, status_feed
--
--   inside EXISTS — already yields false, never NULL. The wrap is a no-op.
--     caller_is_document_party_or_staff
--
-- caller_is_document_party_or_staff deserves a note: NOGUARD3 found it already
-- denies the platform owner today, precisely because its EXISTS form cannot produce
-- NULL. That is the behaviour every function in this sweep now has. It was not a bug
-- there and it is not a bug here — it is the intended end state, arrived at by
-- accident in one function and by repair in the other 61.
--
-- REPLAY CAVEAT: rewrites live bodies in place; not replayable on a fresh database.

DO $mig$
DECLARE
  v_names text[] := ARRAY[
    'booking_report',
    'contract_change_log_list',
    'contract_document_detail',
    'contract_redline_state',
    'contract_section_tree',
    'contract_signing_set',
    'deal_activity',
    'deal_detail',
    'deal_record_export',
    'document_parties_summary',
    'pending_notify_summary',
    'comment_author_identity',
    'caller_may_propose',
    'entity_status_log',
    'horse_deals',
    'list_deals',
    'status_feed',
    'caller_is_document_party_or_staff'
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

  RAISE NOTICE 'tier 3: % repaired, % already done', v_done, v_skipped;
  IF v_done + v_skipped <> array_length(v_names, 1) THEN
    RAISE EXCEPTION 'expected % functions, handled %', array_length(v_names, 1), v_done + v_skipped;
  END IF;
END $mig$;
