-- NULL-guard repair, TIER 1 — the destructive paths.
--
-- Owner ruling 2026-08-11: D1a says these repairs are safe and that stands, but the
-- implication that they were cosmetic was wrong. can_cleanup_document proved it: the
-- guard returned NULL, `IF NOT can_cleanup_document(...)` never fired, and the
-- platform owner removed an FHE tenant document in a rolled-back probe. Safe-to-repair
-- and low-priority are different claims. Work them in order of consequence,
-- destructive first, and apply as you go.
--
-- THE DEFECT. The house idiom is
--
--     has_staff_access() AND <row>.org_id = current_org()
--
-- For a caller who is staff with a NULL org, that is `true AND NULL` = NULL, not
-- false. `documents.org_id` is NOT NULL, so only current_org() can be NULL, and only
-- one account is in that shape: admin@cactai.io (SUPER_ADMIN, org_id NULL). For a
-- non-staff caller the expression short-circuits to `false AND NULL` = false, which is
-- why this class never exposed an ordinary user. See NOGUARD3's central negative
-- result — it was right that the 48 do not expose the contactless attacker, and the
-- one thing it did not carry through is that they DO admit the platform owner into
-- destructive paths.
--
-- WHY NULL ADMITS. Every one of these guards is read as `IF NOT (<expr>) THEN RAISE`,
-- or as a variable assigned from <expr> and then read the same way. `NOT NULL` is
-- NULL, which is not TRUE, so the RAISE is skipped and execution falls through to the
-- action. That is precisely the shape that let cleanup_document delete a document.
--
-- THE REPAIR is a pure local wrap of the staff term:
--
--     coalesce(has_staff_access() AND <row>.org_id = current_org(), false)
--
-- It is applied to the comparison itself rather than to the enclosing IF, so it is
-- correct in every shape the idiom appears in — `IF NOT (staff OR party)`,
-- `v_is_staff := staff`, `IF staff THEN`, and inside EXISTS (where it is a harmless
-- no-op, because EXISTS already yields false rather than NULL).
--
-- The other disjunct is safe: caller_is_document_party() is
-- `current_contact_id() IS NOT NULL AND EXISTS (…)`, a real boolean, never NULL —
-- verified against production. So `false OR party` is a real boolean once the staff
-- term is coalesced.
--
-- BEHAVIOUR CHANGE IS LIMITED TO ONE CALLER. Tenant staff have a real org, so the
-- comparison is already a real boolean and coalesce is the identity. Non-staff already
-- short-circuit to false. Only the NULL becomes false — the platform owner is denied.
-- Per docs/reference/D1a-PLATFORM-OWNER-IS-NOT-A-TENANT.md that denial is the intended
-- end state, not a regression, and setting org_id on admin@cactai.io is refused on the
-- record. Neither is re-opened here.
--
-- TIER 1 — what each guard protects. All 19 guard a write; the RAISE that NULL skips
-- is the only thing standing between the caller and the action named.
--
--   hard_delete_contract          DELETE from documents AND contracts, plus 8 child
--                                 tables. The most destructive function in the schema.
--   advance_document_workflow     drives workflow_state — execution, void, termination
--   can_void_document             the predicate that gates voiding a contract
--   archive_contract              archives / unarchives a contract
--   remove_contract_composition   DELETE of a clause/field from a live contract
--   upsert_change_request         DELETE + UPDATE + INSERT over change requests
--   set_document_party_hidden     DELETE + INSERT — hides a document from a party
--   remerge_contract_from_fields  rewrites merged_body: the contract's own text
--   reassign_document_party       changes WHO is a legal party to a document
--   send_contract_to_party        sends a contract out for signature
--   invite_contract_counterparty  creates an account invitation for a counterparty
--   share_document                grants another contact access to a document
--   set_contract_field            writes contract field values, including money terms
--   set_field_structured          same, structured values
--   seed_contract_fields          bulk INSERT of a document's fields
--   claim_document_origination    changes the document's originator
--   resolve_change_request        accepts/rejects a requested contract change
--   resolve_clause                accepts/rejects a proposed clause
--   resolve_field_edit            accepts/rejects a proposed field edit
--
-- REPLAY CAVEAT. This rewrites live function bodies in place (read
-- pg_get_functiondef, substitute, re-execute) — the convention CLAUDE.md documents for
-- ~31 existing migrations. Like those, it is not safe to replay against a fresh
-- database: it would find nothing to rewrite and no-op. Pre-existing property of the
-- repo's migration style, stated rather than hidden.

DO $mig$
DECLARE
  v_names text[] := ARRAY[
    'hard_delete_contract',
    'advance_document_workflow',
    'can_void_document',
    'archive_contract',
    'remove_contract_composition',
    'upsert_change_request',
    'set_document_party_hidden',
    'remerge_contract_from_fields',
    'reassign_document_party',
    'send_contract_to_party',
    'invite_contract_counterparty',
    'share_document',
    'set_contract_field',
    'set_field_structured',
    'seed_contract_fields',
    'claim_document_origination',
    'resolve_change_request',
    'resolve_clause',
    'resolve_field_edit'
  ];
  -- the bare, NULL-capable staff term
  c_find text := 'has_staff_access\(\)\s+AND\s+([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*current_org\(\)';
  c_repl text := 'coalesce(has_staff_access() AND \1 = current_org(), false)';
  -- the inverse, used to prove the rewrite is a PURE WRAP and nothing else
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

      -- PURE-WRAP PROOF: unwrapping the result must reproduce the original body
      -- byte for byte. If the substitution touched anything else, this fails and the
      -- whole migration aborts before a single function is replaced.
      v_rt := regexp_replace(v_new, c_back, c_orig, 'g');
      IF v_rt <> v_def THEN
        RAISE EXCEPTION 'rewrite is not a pure wrap in % — aborting', v_name;
      END IF;

      EXECUTE v_new;
      v_done := v_done + 1;
      RAISE NOTICE 'REPAIRED % (% guard(s))', v_name, v_hits;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'tier 1: % repaired, % already done', v_done, v_skipped;
  IF v_done + v_skipped <> array_length(v_names, 1) THEN
    RAISE EXCEPTION 'expected % functions, handled %', array_length(v_names, 1), v_done + v_skipped;
  END IF;
END $mig$;
