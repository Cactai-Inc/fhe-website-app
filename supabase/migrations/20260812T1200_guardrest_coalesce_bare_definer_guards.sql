-- GUARDREST — coalesce the last bare NULL-able guards in SECURITY DEFINER functions.
--
-- WHY. `IF NOT (<cond>)` does NOT run its body when <cond> is NULL, so a guard whose
-- condition can go NULL is skipped and execution falls through to the operation it was
-- protecting. The reachable shape in this database is
--     has_staff_access() AND <row>.org_id = current_org()
-- which is NULL — not false — for a caller who IS staff but whose org_id is NULL. That
-- is exactly admin@cactai.io, the platform owner (D1a: org_id NULL by design). Proven in
-- production: the platform owner attached a horse it does not own to an FHE tenant
-- document it is not a party to, and the write landed.
--
-- NOT the anon caller. has_staff_access()/is_admin() already COALESCE internally, so they
-- return false (never NULL) with no JWT. The remaining entries below are hardened for
-- defence in depth and are behaviour-preserving no-ops today; the ones marked LIVE HOLE
-- change behaviour, and per D1a that change (denial) is the correct outcome.
--
-- METHOD. Guard-only, exact-substring rewrite of the existing body — never a re-typed
-- body — so it is structurally impossible for this migration to alter any logic. Every
-- replacement asserts its expected occurrence count first and re-checks afterwards, so a
-- silent no-op cannot pass as success.

DO $migration$
DECLARE
  -- fn signature | old fragment | new fragment | expected occurrences
  v_edits text[][] := ARRAY[
    -- ── LIVE HOLE: staff-with-NULL-org falls through to the write ──────────────
    ['public.attach_horse_to_document(uuid,uuid)',
     'IF NOT (v_staff AND v_org = current_org()) THEN',
     'IF NOT coalesce(v_staff AND v_org = current_org(), false) THEN', '2'],
    ['public.set_horse_locations(uuid,jsonb)',
     'IF NOT (v_staff AND v_org = current_org()) THEN',
     'IF NOT coalesce(v_staff AND v_org = current_org(), false) THEN', '1'],
    ['public.set_horse_medications(uuid,jsonb)',
     'IF NOT (v_staff AND v_org = current_org()) THEN',
     'IF NOT coalesce(v_staff AND v_org = current_org(), false) THEN', '1'],
    ['public.mark_comment_review(uuid,boolean)',
     'IF NOT ((has_staff_access() AND (SELECT org_id FROM documents WHERE id=v_doc) = current_org())',
     'IF NOT ((coalesce(has_staff_access() AND (SELECT org_id FROM documents WHERE id=v_doc) = current_org(), false))', '1'],
    ['public.request_contract_termination(uuid,text)',
     'IF NOT ((v_staff AND v_org = current_org())',
     'IF NOT ((coalesce(v_staff AND v_org = current_org(), false))', '1'],

    -- ── LIVE HOLE: a member passes the guard on any booking with client_id NULL ─
    ['public.request_booking_change(uuid,text,timestamptz,timestamptz,text,text)',
     'IF NOT (has_staff_access() OR (v_client IS NOT NULL AND v_b.client_id = v_client)) THEN',
     'IF NOT coalesce(has_staff_access() OR (v_client IS NOT NULL AND v_b.client_id = v_client), false) THEN', '1'],

    -- ── LIVE HOLE: proof-domain email + unset flag makes the purge gate NULL ────
    ['public.purge_account(uuid,text)',
     E'IF NOT (\n       v_email = ANY(c_allowed_emails)',
     E'IF NOT coalesce(\n       v_email = ANY(c_allowed_emails)', '1'],
    ['public.purge_account(uuid,text)',
     E'AND current_setting(''app.purge_proof'', true) = ''1'')\n     ) THEN',
     E'AND current_setting(''app.purge_proof'', true) = ''1'')\n     , false) THEN', '1'],

    -- ── Defence in depth: already NULL-safe today, hardened so they stay that way ─
    ['public.add_contact_location(uuid,text,text)',
     'IF NOT (has_staff_access() AND v_org IS NOT NULL) THEN',
     'IF NOT coalesce(has_staff_access() AND v_org IS NOT NULL, false) THEN', '1'],
    ['public.admin_account_action(uuid,text)',
     'IF NOT (has_staff_access() AND is_admin()) THEN',
     'IF NOT coalesce(has_staff_access() AND is_admin(), false) THEN', '1'],
    ['public.admin_delete_invitation(uuid)',
     'IF NOT (has_staff_access() AND is_admin()) THEN',
     'IF NOT coalesce(has_staff_access() AND is_admin(), false) THEN', '1'],
    ['public.admin_expire_invitation(uuid)',
     'IF NOT (has_staff_access() AND is_admin()) THEN',
     'IF NOT coalesce(has_staff_access() AND is_admin(), false) THEN', '1'],
    ['public.set_form_required(text,jsonb)',
     'IF NOT (has_staff_access() AND is_admin()) THEN',
     'IF NOT coalesce(has_staff_access() AND is_admin(), false) THEN', '1'],
    ['public.attach_booking_horse(uuid,uuid)',
     'IF NOT (v_gate->>''eligible'')::boolean THEN',
     'IF NOT coalesce((v_gate->>''eligible'')::boolean, false) THEN', '1'],
    ['public.clone_contract_template(text,text,text)',
     'IF NOT (is_admin() OR session_user IN (''postgres'', ''supabase_admin'')) THEN',
     'IF NOT coalesce(is_admin() OR session_user IN (''postgres'', ''supabase_admin''), false) THEN', '1'],
    ['public.deal_autocomplete_on_execution()',
     'IF NOT (NEW.workflow_state = ''executed'' AND OLD.workflow_state IS DISTINCT FROM ''executed'') THEN',
     'IF NOT coalesce(NEW.workflow_state = ''executed'' AND OLD.workflow_state IS DISTINCT FROM ''executed'', false) THEN', '1'],
    ['public.lease_edit_guard(uuid)',
     'IF NOT (has_staff_access() OR caller_is_document_party(p_document_id)) THEN',
     'IF NOT coalesce(has_staff_access() OR caller_is_document_party(p_document_id), false) THEN', '1'],
    ['public.propose_community_event(text,timestamptz,timestamptz,text,text)',
     'IF NOT (''riding'' = ANY(v_cats)) AND NOT has_staff_access() THEN',
     'IF NOT coalesce(''riding'' = ANY(v_cats), false) AND NOT coalesce(has_staff_access(), false) THEN', '1'],
    ['public.resend_executed_document_email(uuid)',
     E'IF NOT (has_staff_access() OR EXISTS (\n        SELECT 1 FROM document_parties dp\n         WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id()))\n  THEN',
     E'IF NOT coalesce(has_staff_access() OR EXISTS (\n        SELECT 1 FROM document_parties dp\n         WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id()), false)\n  THEN', '1'],
    ['public.update_contact_record(uuid,jsonb)',
     'IF NOT has_staff_access() THEN RAISE EXCEPTION ''staff access required''; END IF;',
     'IF NOT coalesce(has_staff_access(), false) THEN RAISE EXCEPTION ''staff access required''; END IF;', '1'],
    ['public.update_contact_record(uuid,jsonb)',
     'IF NOT (k = ANY(v_allowed)) THEN',
     'IF NOT coalesce(k = ANY(v_allowed), false) THEN', '1']
  ];
  v_sig text; v_old text; v_new text; v_want int;
  v_oid oid; v_def text; v_after text; v_seen int;
  i int;
BEGIN
  FOR i IN 1 .. array_length(v_edits, 1) LOOP
    v_sig  := v_edits[i][1];
    v_old  := v_edits[i][2];
    v_new  := v_edits[i][3];
    v_want := v_edits[i][4]::int;

    v_oid := v_sig::regprocedure::oid;
    v_def := pg_get_functiondef(v_oid);

    -- the fragment must be there, exactly as many times as we expect
    v_seen := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    IF v_seen <> v_want THEN
      RAISE EXCEPTION 'GUARDREST %: expected % occurrence(s) of the guard fragment, found %. Refusing.',
        v_sig, v_want, v_seen;
    END IF;

    v_after := replace(v_def, v_old, v_new);
    IF v_after = v_def THEN
      RAISE EXCEPTION 'GUARDREST %: replacement changed nothing. Refusing.', v_sig;
    END IF;

    EXECUTE v_after;

    -- re-read from the catalog: prove the new text actually landed
    v_def := pg_get_functiondef(v_sig::regprocedure::oid);
    IF position(v_new in v_def) = 0 THEN
      RAISE EXCEPTION 'GUARDREST %: post-write verify failed, new guard not present.', v_sig;
    END IF;
    IF position(v_old in v_def) > 0 THEN
      RAISE EXCEPTION 'GUARDREST %: post-write verify failed, old guard still present.', v_sig;
    END IF;

    RAISE NOTICE 'GUARDREST ok: % (% guard(s))', v_sig, v_want;
  END LOOP;
END
$migration$;

-- ── anon should not hold EXECUTE on the composition RPCs (ADDITEM finding) ──────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and a direct grant to a role
-- SURVIVES `REVOKE ... FROM PUBLIC`. Both have to go, and the revoke reporting success
-- is not evidence — see the verification block below.
REVOKE EXECUTE ON FUNCTION public.add_contract_composition(uuid,jsonb)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_contract_composition(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text) FROM PUBLIC, anon;

DO $verify$
DECLARE r record; v_bad int := 0;
BEGIN
  FOR r IN
    SELECT f.sig, g.grantee,
           has_function_privilege(g.grantee, f.sig::regprocedure, 'EXECUTE') AS can_exec
      FROM (VALUES
              ('public.add_contract_composition(uuid,jsonb)'),
              ('public.remove_contract_composition(uuid,text)'),
              ('public.add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text)')
           ) f(sig)
      CROSS JOIN (VALUES ('anon'), ('public')) g(grantee)
  LOOP
    IF r.can_exec THEN
      v_bad := v_bad + 1;
      RAISE WARNING 'GUARDREST: % still EXECUTE-able by %', r.sig, r.grantee;
    END IF;
  END LOOP;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'GUARDREST: % anon/PUBLIC EXECUTE grant(s) survived the revoke.', v_bad;
  END IF;
  RAISE NOTICE 'GUARDREST ok: anon and PUBLIC hold no EXECUTE on the 3 composition RPCs';
END
$verify$;
