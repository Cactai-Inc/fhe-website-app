-- ─────────────────────────────────────────────────────────────────────────────
-- CHANGE-REQUEST / CHANGE-HISTORY / VOID — Part 2 of 4: the RPC layer.
--
-- Re-points every function that referenced the retired `document_change_requests`
-- at the surviving `contract_change_requests`, and adds the threaded
-- "chat thread, locked on send" verbs.
--
-- DISPOSITION of the 8 functions that referenced document_change_requests:
--   1. contract_document_detail   → RE-POINTED. `open_change_requests` now reads
--                                   root+submitted+unresolved rows from the survivor.
--   2. contract_lock_blockers     → RE-POINTED. Same 'open_change_requests' blocker
--                                   code + message; an unresolved SUBMITTED thread blocks.
--   3. lock_and_sign_contract     → RE-POINTED. Same refusal on open requests.
--   4. my_contract_documents      → RE-POINTED. open_change_requests count per doc.
--   5. request_document_change    → REWRITTEN as the draft/autosave entry point
--                                   (upsert_change_request below wraps it); the old
--                                   4-arg signature is kept so nothing dangles.
--   6. resolve_change_request     → RE-POINTED, name+arity preserved (ContractPage
--                                   calls it). Resolving = closing the thread.
--   7. hard_delete_contract       → RE-POINTED (delete survivor rows, not the
--                                   retired table).
--   8. purge_account              → RE-POINTED (single delete against the survivor;
--                                   the old body deleted from BOTH tables).
--
-- Also re-pointed (referenced contract_comments, which was renamed):
--   contract_comments_list, post_contract_comment, edit_contract_comment,
--   delete_contract_comment, resolve_contract_comment, mark_comment_review,
--   mark_comment_stale, snapshot_execution_audit.
--
-- IMPACT RANKING RULE (documented, used for the "five highest-impact requests"
-- in the submit notification + email):
--   Requests are ranked by the MONEY / TERM / LIABILITY weight of the section
--   they target — what a counterparty most needs to see first. Ties break on the
--   lower annotation_number (the earlier request wins), so the ordering is stable.
--     100  LEASE_FEE, PAYMENT_TERMS, PAYMENT_METHOD   — money changing hands
--      90  INSURANCE_RISK                              — liability / risk of loss
--      80  TERM, TERMINATION, EVALUATION               — how long, and how it ends
--      70  CARE                                        — ongoing cost + duty of care
--      60  PERMITTED_USE, SCHEDULE                     — what the Lessee may do
--      50  HORSE, LOCATION, PARTIES                    — the subject and the sides
--      40  ASSIGNMENT, LESSEE_REPS                     — transferability/warranties
--      30  GOVERNING_LAW, ATTORNEYS_FEES               — dispute mechanics
--      20  NOTICE, DEFINITIONS, ENTIRE_AGREEMENT,
--          SEVERABILITY, SIGNATURES                    — administrative/boilerplate
--      10  anything else / whole-document              — unclassified
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── impact ranking ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.change_request_impact_rank(p_section text)
RETURNS int
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE upper(coalesce(nullif(trim(p_section), ''), '~'))
    WHEN 'LEASE_FEE'        THEN 100
    WHEN 'PAYMENT_TERMS'    THEN 100
    WHEN 'PAYMENT_METHOD'   THEN 100
    WHEN 'INSURANCE_RISK'   THEN 90
    WHEN 'TERM'             THEN 80
    WHEN 'TERMINATION'      THEN 80
    WHEN 'EVALUATION'       THEN 80
    WHEN 'CARE'             THEN 70
    WHEN 'PERMITTED_USE'    THEN 60
    WHEN 'SCHEDULE'         THEN 60
    WHEN 'HORSE'            THEN 50
    WHEN 'LOCATION'         THEN 50
    WHEN 'PARTIES'          THEN 50
    WHEN 'ASSIGNMENT'       THEN 40
    WHEN 'LESSEE_REPS'      THEN 40
    WHEN 'GOVERNING_LAW'    THEN 30
    WHEN 'ATTORNEYS_FEES'   THEN 30
    WHEN 'NOTICE'           THEN 20
    WHEN 'DEFINITIONS'      THEN 20
    WHEN 'ENTIRE_AGREEMENT' THEN 20
    WHEN 'SEVERABILITY'     THEN 20
    WHEN 'SIGNATURES'       THEN 20
    ELSE 10
  END;
$$;

COMMENT ON FUNCTION public.change_request_impact_rank(text) IS
  'Money/term/liability weight of a change request by target section. Higher = '
  'more impactful. Drives the "five highest-impact requests" listed in the '
  'submit-for-review notification and email. Ties break on annotation_number.';

-- ── author identity (renamed table) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comment_author_identity(p_document_id uuid)
RETURNS TABLE(contact_id uuid, role text, label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_cid uuid; v_role text; v_label text; v_staff boolean; v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  v_cid   := current_contact_id();
  v_staff := has_staff_access() AND v_org = current_org();
  SELECT r INTO v_role FROM caller_party_roles(p_document_id) r LIMIT 1;
  IF v_role IS NULL AND v_staff THEN v_role := 'STAFF'; END IF;
  SELECT nullif(trim(concat_ws(' ', first_name, last_name)), '')
    INTO v_label FROM contacts WHERE id = v_cid;
  v_label := coalesce(v_label, CASE WHEN v_staff THEN 'Staff' ELSE 'A party' END);
  RETURN QUERY SELECT v_cid, v_role, v_label;
END;
$function$;

-- ═════════════════════════════════════════════════════════════════════════════
-- THE THREADED CHANGE-REQUEST VERBS
-- ═════════════════════════════════════════════════════════════════════════════

-- ── upsert_change_request — the AUTOSAVE entry point ─────────────────────────
-- One draft per (document, author, target_section). Called on blur. An empty
-- body REMOVES the draft (the spec's "add or remove content" autosave). Refuses
-- once the thread is submitted (locked on send) or the document is past editing.
CREATE OR REPLACE FUNCTION public.upsert_change_request(
  p_document_id uuid, p_target_section text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_cid uuid; v_role text; v_label text;
  v_id uuid; v_sub timestamptz; v_body text := coalesce(trim(p_body), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, workflow_state INTO v_org, v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  -- a locked / executed / void / terminated document takes no new requests
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  SELECT contact_id, role, label INTO v_cid, v_role, v_label
    FROM comment_author_identity(p_document_id);
  IF v_cid IS NULL THEN RAISE EXCEPTION 'no contact identity for the caller'; END IF;

  SELECT id, submitted_at INTO v_id, v_sub
    FROM contract_change_requests
   WHERE document_id = p_document_id
     AND parent_request_id IS NULL
     AND author_contact_id = v_cid
     AND coalesce(target_section,'') = coalesce(nullif(trim(p_target_section),''), '')
   LIMIT 1;

  IF v_id IS NOT NULL AND v_sub IS NOT NULL THEN
    RAISE EXCEPTION 'this request was submitted for review and can no longer be edited';
  END IF;

  -- empty body → remove the draft entirely
  IF v_body = '' THEN
    IF v_id IS NOT NULL THEN
      DELETE FROM contract_change_requests WHERE id = v_id;
    END IF;
    RETURN jsonb_build_object('id', NULL, 'removed', true);
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO contract_change_requests (
      org_id, document_id, parent_request_id, anchor_kind, anchor_ref,
      target_section, body, author_contact_id, author_role, author_label, impact_rank)
    VALUES (
      v_org, p_document_id, NULL,
      CASE WHEN nullif(trim(p_target_section),'') IS NULL THEN 'document' ELSE 'field' END,
      nullif(trim(p_target_section), ''),
      nullif(trim(p_target_section), ''),
      v_body, v_cid, v_role, v_label,
      change_request_impact_rank(p_target_section))
    RETURNING id INTO v_id;
  ELSE
    UPDATE contract_change_requests
       SET body = v_body, edited_at = now(), updated_at = now()
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'removed', false);
END;
$function$;

-- ── submit_change_requests — LOCK the threads, notify + email the other party ──
-- Assigns annotation numbers, stamps submitted_at (the thread is now locked from
-- editing), and notifies every OTHER party with the FIVE highest-impact requests.
CREATE OR REPLACE FUNCTION public.submit_change_requests(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_title text; v_cid uuid;
  v_next int; v_n int := 0; r record;
  v_top jsonb; v_body text; v_ids uuid[] := '{}';
  v_party record; v_me_label text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, workflow_state, coalesce(title,'A contract')
    INTO v_org, v_state, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  SELECT contact_id, label INTO v_cid, v_me_label FROM comment_author_identity(p_document_id);

  SELECT coalesce(max(annotation_number), 0) INTO v_next
    FROM contract_change_requests WHERE document_id = p_document_id;

  -- lock every unsubmitted draft this caller authored
  FOR r IN
    SELECT id FROM contract_change_requests
     WHERE document_id = p_document_id AND parent_request_id IS NULL
       AND author_contact_id = v_cid AND submitted_at IS NULL
     ORDER BY created_at
  LOOP
    v_next := v_next + 1; v_n := v_n + 1;
    UPDATE contract_change_requests
       SET submitted_at = now(), annotation_number = v_next, updated_at = now()
     WHERE id = r.id;
    v_ids := v_ids || r.id;
  END LOOP;

  IF v_n = 0 THEN
    RETURN jsonb_build_object('submitted', 0, 'notified', 0);
  END IF;

  -- the FIVE highest-impact requests just submitted (impact desc, then earliest)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'annotation_number', t.annotation_number,
           'target_section', t.target_section,
           'heading', t.heading,
           'impact_rank', t.impact_rank,
           'body', t.body) ORDER BY t.impact_rank DESC, t.annotation_number), '[]'::jsonb)
    INTO v_top
    FROM (
      SELECT cr.annotation_number, cr.target_section, cr.impact_rank, cr.body,
             coalesce(sd.heading, 'The whole document') AS heading
        FROM contract_change_requests cr
        LEFT JOIN documents d ON d.id = cr.document_id
        LEFT JOIN contract_templates ct ON ct.id = d.template_id
        LEFT JOIN contract_section_defs sd
               ON sd.template_key = ct.template_key AND sd.section_key = cr.target_section
       WHERE cr.id = ANY(v_ids)
       ORDER BY cr.impact_rank DESC, cr.annotation_number
       LIMIT 5
    ) t;

  SELECT string_agg('#' || (e->>'annotation_number') || ' ' || (e->>'heading') || ' — ' ||
                    left(e->>'body', 160), E'\n' ORDER BY ord)
    INTO v_body
    FROM jsonb_array_elements(v_top) WITH ORDINALITY AS x(e, ord);

  -- notify every OTHER party (dashboard notification via contract_notify, which
  -- resolves the contact's app user and links back to this document).
  FOR v_party IN
    SELECT DISTINCT dp.contact_id
      FROM document_parties dp
     WHERE dp.document_id = p_document_id
       AND dp.contact_id IS DISTINCT FROM v_cid
  LOOP
    PERFORM contract_notify(p_document_id, v_party.contact_id,
      'contract_change_requested',
      coalesce(v_me_label,'A party') || ' submitted ' || v_n || ' change request'
        || CASE WHEN v_n = 1 THEN '' ELSE 's' END || ' on ' || v_title,
      v_body);
  END LOOP;

  RETURN jsonb_build_object(
    'submitted', v_n,
    'top', v_top,
    'notify_parties', coalesce((
      SELECT jsonb_agg(DISTINCT dp.contact_id)
        FROM document_parties dp
       WHERE dp.document_id = p_document_id
         AND dp.contact_id IS DISTINCT FROM v_cid), '[]'::jsonb));
END;
$function$;

-- ── reply_to_change_request — a thread entry after submit ────────────────────
-- Either party may add entries once the thread is submitted; each entry is
-- stamped date+time+party through author_role/author_label/created_at.
CREATE OR REPLACE FUNCTION public.reply_to_change_request(p_request_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc uuid; v_org uuid; v_sub timestamptz; v_res timestamptz; v_parent uuid;
  v_state text; v_cid uuid; v_role text; v_label text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'a reply body is required'; END IF;

  SELECT document_id, org_id, submitted_at, resolved_at, parent_request_id
    INTO v_doc, v_org, v_sub, v_res, v_parent
    FROM contract_change_requests WHERE id = p_request_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown change request'; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'reply on the thread''s first entry'; END IF;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'this request has not been submitted for review yet'; END IF;
  IF v_res IS NOT NULL THEN RAISE EXCEPTION 'this thread is closed'; END IF;

  SELECT workflow_state INTO v_state FROM documents WHERE id = v_doc AND deleted_at IS NULL;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  SELECT contact_id, role, label INTO v_cid, v_role, v_label FROM comment_author_identity(v_doc);

  INSERT INTO contract_change_requests (
    org_id, document_id, parent_request_id, anchor_kind, body,
    author_contact_id, author_role, author_label, submitted_at)
  VALUES (v_org, v_doc, p_request_id, 'document', trim(p_body),
          v_cid, v_role, v_label, now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- ── agree_change_request — the explicit Agreed/Accepted close ────────────────
CREATE OR REPLACE FUNCTION public.agree_change_request(p_request_id uuid, p_agreed boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_org uuid; v_parent uuid; v_sub timestamptz; v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, org_id, parent_request_id, submitted_at
    INTO v_doc, v_org, v_parent, v_sub
    FROM contract_change_requests WHERE id = p_request_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown change request'; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'close the thread on its first entry'; END IF;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'this request has not been submitted for review yet'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  v_cid := current_contact_id();
  UPDATE contract_change_requests
     SET resolved_at            = CASE WHEN p_agreed THEN now() ELSE NULL END,
         resolved_by_contact_id = CASE WHEN p_agreed THEN v_cid ELSE NULL END,
         agreed_at              = CASE WHEN p_agreed THEN now() ELSE NULL END,
         agreed_by_contact_id   = CASE WHEN p_agreed THEN v_cid ELSE NULL END,
         updated_at             = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('id', p_request_id, 'agreed', coalesce(p_agreed,true));
END;
$function$;

-- ── the read model ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_change_requests_list(p_document_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb)
  FROM (
    SELECT cr.id, cr.parent_request_id, cr.anchor_kind, cr.anchor_ref,
           cr.target_section, cr.annotation_number, cr.impact_rank,
           cr.quote, cr.quote_prefix, cr.is_stale, cr.needs_review, cr.body,
           cr.author_label, cr.author_role, cr.author_contact_id,
           cr.submitted_at, cr.agreed_at, cr.resolved_at, cr.edited_at, cr.created_at,
           coalesce(sd.heading, 'The whole document') AS section_heading
      FROM contract_change_requests cr
      LEFT JOIN documents d ON d.id = cr.document_id
      LEFT JOIN contract_templates ct ON ct.id = d.template_id
      LEFT JOIN contract_section_defs sd
             ON sd.template_key = ct.template_key AND sd.section_key = cr.target_section
     WHERE cr.document_id = p_document_id
       AND ((cr.org_id = current_org() AND has_staff_access())
            OR caller_is_document_party(p_document_id))
  ) t;
$function$;

-- back-compat alias: the old name keeps working (nothing dangles mid-deploy)
CREATE OR REPLACE FUNCTION public.contract_comments_list(p_document_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$ SELECT contract_change_requests_list(p_document_id); $function$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RE-POINTED LEGACY FUNCTIONS
-- ═════════════════════════════════════════════════════════════════════════════

-- (5) request_document_change — kept at its original 4-arg signature. Now writes
--     a SUBMITTED root request on the survivor (its historical behaviour: the old
--     table had no draft state, so a request was open the moment it was made).
CREATE OR REPLACE FUNCTION public.request_document_change(
  p_document_id uuid, p_field_key text, p_target_section text, p_requested_change text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_title text; v_orig uuid;
  v_cid uuid; v_role text; v_label text; v_next int; v_id uuid; v_section text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_requested_change), '') = '' THEN
    RAISE EXCEPTION 'a requested change is required';
  END IF;

  SELECT org_id, workflow_state, coalesce(title,'A contract'), originator_contact_id
    INTO v_org, v_state, v_title, v_orig
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to request changes on document %', p_document_id;
  END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  v_section := coalesce(nullif(trim(p_target_section),''), nullif(trim(p_field_key),''));
  SELECT contact_id, role, label INTO v_cid, v_role, v_label
    FROM comment_author_identity(p_document_id);
  SELECT coalesce(max(annotation_number),0) + 1 INTO v_next
    FROM contract_change_requests WHERE document_id = p_document_id;

  INSERT INTO contract_change_requests (
    org_id, document_id, parent_request_id, anchor_kind, anchor_ref, target_section,
    annotation_number, submitted_at, body, author_contact_id, author_role, author_label,
    impact_rank)
  VALUES (
    v_org, p_document_id, NULL,
    CASE WHEN nullif(trim(p_field_key),'') IS NOT NULL THEN 'field' ELSE 'document' END,
    nullif(trim(p_field_key),''), v_section,
    v_next, now(), trim(p_requested_change), v_cid, v_role, v_label,
    change_request_impact_rank(v_section))
  RETURNING id INTO v_id;

  PERFORM contract_notify(p_document_id, v_orig, 'contract_change_requested',
    'Change requested on ' || v_title,
    'Change #' || v_next || ': ' || trim(p_requested_change));

  RETURN jsonb_build_object(
    'id', v_id, 'document_id', p_document_id, 'annotation_number', v_next,
    'target_field_key', nullif(trim(p_field_key),''), 'target_section', v_section,
    'requested_change', trim(p_requested_change), 'status', 'open');
END;
$function$;

-- (6) resolve_change_request — name + arity preserved. Resolving CLOSES the thread
--     on the survivor. Accepting may still apply a value to the targeted field.
CREATE OR REPLACE FUNCTION public.resolve_change_request(
  p_change_id uuid, p_accept boolean, p_new_value text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc uuid; v_org uuid; v_state text; v_owner text; v_field text;
  v_ann int; v_author uuid; v_res timestamptz; v_parent uuid;
  v_by uuid := current_contact_id(); v_title text; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT document_id, org_id, anchor_ref, annotation_number,
         author_contact_id, resolved_at, parent_request_id
    INTO v_doc, v_org, v_field, v_ann, v_author, v_res, v_parent
    FROM contract_change_requests WHERE id = p_change_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown change request: %', p_change_id; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'resolve the thread on its first entry'; END IF;
  IF v_res IS NOT NULL THEN RAISE EXCEPTION 'change request % is already resolved', p_change_id; END IF;

  SELECT workflow_state, coalesce(title,'A contract') INTO v_state, v_title
    FROM documents WHERE id = v_doc AND deleted_at IS NULL;

  -- unchanged authority: only staff of the org resolve change requests
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    RAISE EXCEPTION 'not authorized to resolve changes on document %', v_doc;
  END IF;

  IF coalesce(p_accept, false) THEN
    IF nullif(p_new_value,'') IS NOT NULL AND nullif(v_field,'') IS NOT NULL THEN
      IF v_state NOT IN ('editable','editing') THEN
        RAISE EXCEPTION 'document is locked (workflow_state=%): cannot apply the change', v_state;
      END IF;
      SELECT owner_role INTO v_owner FROM contract_fields
        WHERE document_id = v_doc AND field_key = v_field;
      IF v_owner IS NULL THEN
        RAISE EXCEPTION 'targeted field % no longer exists', v_field;
      END IF;
      IF v_owner = 'DEAL' OR (has_staff_access() AND v_org = current_org()) THEN
        UPDATE contract_fields
           SET value = p_new_value, entered_by_contact_id = v_by, entered_at = now()
         WHERE document_id = v_doc AND field_key = v_field;
      ELSE
        RAISE EXCEPTION 'cannot apply a value to a % field via a change request (owner must edit it)', v_owner;
      END IF;
    END IF;
    v_status := 'accepted';
  ELSE
    v_status := 'rejected';
  END IF;

  -- both outcomes CLOSE the thread (it stops blocking the lock)
  UPDATE contract_change_requests
     SET resolved_at = now(), resolved_by_contact_id = v_by,
         agreed_at = CASE WHEN v_status = 'accepted' THEN now() ELSE NULL END,
         agreed_by_contact_id = CASE WHEN v_status = 'accepted' THEN v_by ELSE NULL END,
         updated_at = now()
   WHERE id = p_change_id;

  PERFORM contract_notify(v_doc, v_author, 'contract_change_resolved',
    'Change #' || coalesce(v_ann::text,'?') || ' on ' || v_title || ' was ' || v_status);

  RETURN jsonb_build_object(
    'id', p_change_id, 'document_id', v_doc, 'annotation_number', v_ann,
    'status', v_status, 'resolved_by_contact_id', v_by, 'resolved_at', now());
END;
$function$;

-- (2) contract_lock_blockers — an unresolved SUBMITTED root thread blocks locking.
CREATE OR REPLACE FUNCTION public.contract_lock_blockers(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  v_open int;
  v_vals jsonb := '{}'::jsonb;
  r record;
  v_missing text[];
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
BEGIN
  SELECT horse_section_confirmed_at INTO v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  SELECT count(*) INTO v_open FROM contract_change_requests
   WHERE document_id = p_document_id
     AND parent_request_id IS NULL AND submitted_at IS NOT NULL AND resolved_at IS NULL;
  IF v_open > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_change_requests',
      'message', v_open || ' open change request(s) must be resolved'));
  END IF;

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_vals := v_vals || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT array_agg(coalesce(cf.label, cf.field_key) ORDER BY cf.sort_order, cf.field_key)
    INTO v_missing
    FROM contract_fields cf
    LEFT JOIN contract_clause_defs cd
      ON cd.template_key = (SELECT ct.template_key FROM documents d
                             JOIN contract_templates ct ON ct.id = d.template_id
                            WHERE d.id = p_document_id)
     AND cd.clause_key = cf.clause_key
   WHERE cf.document_id = p_document_id AND cf.required
     AND coalesce(cf.included, true) AND NOT coalesce(cf.is_na, false)
     AND nullif(trim(coalesce(cf.value, '')), '') IS NULL
     AND clause_condition_met(cd.conditional_on, v_vals)
     AND clause_condition_met(cf.conditional_on, v_vals);
  IF v_missing IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'required_fields',
      'message', 'Required field(s) still empty: ' || array_to_string(v_missing, ', ')));
  END IF;

  IF EXISTS (
    SELECT 1 FROM contract_fields cf
      JOIN documents d2 ON d2.id = cf.document_id
      JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
      JOIN contacts c2 ON c2.id = cp2.contact_id
     WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
       AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
         OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
  ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'party_type_mismatch',
      'message', 'LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record'));
  END IF;

  v_needs_horse := EXISTS (
    SELECT 1 FROM contract_fields
    WHERE document_id = p_document_id
      AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
  IF v_needs_horse AND v_horse_confirmed IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'horse_unconfirmed',
      'message', 'The horse information has not been confirmed by the Lessor'));
  END IF;

  RETURN v_blockers;
END;
$function$;

-- (3) lock_and_sign_contract — same refusal, sourced from the survivor.
CREATE OR REPLACE FUNCTION public.lock_and_sign_contract(
  p_document_id uuid, p_party_role text, p_typed_name text, p_esign_consent boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_state text; v_open int; v_missing int;
  v_horse_confirmed timestamptz; v_needs_horse boolean; v_signed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT workflow_state, horse_section_confirmed_at INTO v_state, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF v_state NOT IN ('locked','editable','executed') THEN
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;
  IF v_state IN ('editable') THEN
    SELECT count(*) INTO v_open FROM contract_change_requests
      WHERE document_id = p_document_id
        AND parent_request_id IS NULL AND submitted_at IS NOT NULL AND resolved_at IS NULL;
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot sign: % open change request(s) remain; resolve or lock first', v_open;
    END IF;
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot sign: % required field(s) still empty', v_missing;
    END IF;
    IF EXISTS (
      SELECT 1 FROM contract_fields cf
        JOIN documents d2 ON d2.id = cf.document_id
        JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
        JOIN contacts c2 ON c2.id = cp2.contact_id
       WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
         AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
           OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
    ) THEN
      RAISE EXCEPTION 'cannot sign: LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record';
    END IF;
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot sign: the horse information has not been confirmed by the Lessor';
    END IF;
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
  END IF;

  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$function$;

-- (7) hard_delete_contract — delete survivor rows.
CREATE OR REPLACE FUNCTION public.hard_delete_contract(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_contract uuid;
BEGIN
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_state = 'executed' THEN RAISE EXCEPTION 'an executed document cannot be deleted'; END IF;

  DELETE FROM notifications WHERE link = '/app/contracts/' || p_document_id::text;

  DELETE FROM signatures          WHERE document_id = p_document_id;
  DELETE FROM esign_consents      WHERE document_id = p_document_id;
  DELETE FROM document_deliveries WHERE document_id = p_document_id;
  DELETE FROM invitations         WHERE document_id = p_document_id;
  UPDATE horse_relationships SET source_document_id = NULL WHERE source_document_id = p_document_id;
  UPDATE horse_reconciliation SET evidence_document_id = NULL WHERE evidence_document_id = p_document_id;

  DELETE FROM contract_fields   WHERE document_id = p_document_id;
  DELETE FROM document_parties  WHERE document_id = p_document_id;
  DELETE FROM contract_change_requests WHERE document_id = p_document_id;
  DELETE FROM contract_addenda  WHERE document_id = p_document_id;

  DELETE FROM documents WHERE id = p_document_id;

  IF v_contract IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM documents WHERE contract_id = v_contract) THEN
    DELETE FROM contract_parties WHERE contract_id = v_contract;
    DELETE FROM contracts WHERE id = v_contract;
  END IF;
END;
$function$;

-- ── the comment-era verbs, re-pointed at the renamed table ───────────────────
CREATE OR REPLACE FUNCTION public.post_contract_comment(
  p_document_id uuid, p_body text, p_anchor_kind text DEFAULT 'document'::text,
  p_anchor_ref text DEFAULT NULL::text, p_quote text DEFAULT NULL::text,
  p_quote_prefix text DEFAULT NULL::text, p_parent_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_id uuid; v_cid uuid; v_role text; v_label text;
  v_parent_doc uuid; v_parent_resolved timestamptz; v_section text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'comment body required'; END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT document_id, resolved_at INTO v_parent_doc, v_parent_resolved
      FROM contract_change_requests WHERE id = p_parent_id;
    IF v_parent_doc IS NULL OR v_parent_doc <> p_document_id THEN
      RAISE EXCEPTION 'reply target not on this document';
    END IF;
    IF v_parent_resolved IS NOT NULL THEN
      RAISE EXCEPTION 'this thread is resolved and closed to replies';
    END IF;
  END IF;

  SELECT contact_id, role, label INTO v_cid, v_role, v_label
    FROM comment_author_identity(p_document_id);

  v_section := CASE WHEN p_parent_id IS NULL THEN nullif(trim(p_anchor_ref),'') END;

  INSERT INTO contract_change_requests (
    org_id, document_id, parent_request_id, anchor_kind, anchor_ref, quote, quote_prefix,
    target_section, body, author_contact_id, author_role, author_label,
    submitted_at, impact_rank)
  VALUES (
    v_org, p_document_id, p_parent_id,
    CASE WHEN p_parent_id IS NOT NULL THEN 'document' ELSE coalesce(p_anchor_kind,'document') END,
    p_anchor_ref, p_quote, p_quote_prefix,
    v_section, trim(p_body), v_cid, v_role, v_label,
    now(), change_request_impact_rank(v_section))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.edit_contract_comment(p_comment_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_author uuid; v_me uuid; v_sub timestamptz; v_parent uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'comment body required'; END IF;
  SELECT document_id, author_contact_id, submitted_at, parent_request_id
    INTO v_doc, v_author, v_sub, v_parent
    FROM contract_change_requests WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  SELECT contact_id INTO v_me FROM comment_author_identity(v_doc);
  IF v_me IS NULL OR v_me <> v_author THEN RAISE EXCEPTION 'only the author may edit this comment'; END IF;
  -- "locked on send": a submitted ROOT request is frozen
  IF v_parent IS NULL AND v_sub IS NOT NULL THEN
    RAISE EXCEPTION 'this request was submitted for review and can no longer be edited';
  END IF;
  UPDATE contract_change_requests SET body = trim(p_body), edited_at = now(), updated_at = now()
   WHERE id = p_comment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_contract_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_author uuid; v_me uuid; v_sub timestamptz; v_parent uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, author_contact_id, submitted_at, parent_request_id
    INTO v_doc, v_author, v_sub, v_parent
    FROM contract_change_requests WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  SELECT contact_id INTO v_me FROM comment_author_identity(v_doc);
  IF v_me IS NULL OR v_me <> v_author THEN RAISE EXCEPTION 'only the author may delete this comment'; END IF;
  IF v_parent IS NULL AND v_sub IS NOT NULL THEN
    RAISE EXCEPTION 'this request was submitted for review and can no longer be withdrawn';
  END IF;
  DELETE FROM contract_change_requests WHERE id = p_comment_id OR parent_request_id = p_comment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_contract_comment(p_comment_id uuid, p_resolved boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_org uuid; v_parent uuid; v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, org_id, parent_request_id INTO v_doc, v_org, v_parent
    FROM contract_change_requests WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'resolve the thread on its first comment'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  v_cid := current_contact_id();
  UPDATE contract_change_requests
     SET resolved_at = CASE WHEN p_resolved THEN now() ELSE NULL END,
         resolved_by_contact_id = CASE WHEN p_resolved THEN v_cid ELSE NULL END,
         agreed_at = CASE WHEN p_resolved THEN now() ELSE NULL END,
         agreed_by_contact_id = CASE WHEN p_resolved THEN v_cid ELSE NULL END,
         updated_at = now()
   WHERE id = p_comment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_comment_review(p_comment_id uuid, p_on boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id INTO v_doc FROM contract_change_requests WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;
  IF NOT ((has_staff_access() AND (SELECT org_id FROM documents WHERE id=v_doc) = current_org())
          OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  UPDATE contract_change_requests SET needs_review = coalesce(p_on,true), updated_at = now()
   WHERE id = p_comment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_comment_stale(p_comment_id uuid, p_stale boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_org uuid;
BEGIN
  SELECT document_id, org_id INTO v_doc, v_org FROM contract_change_requests WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RETURN; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  UPDATE contract_change_requests SET is_stale = p_stale, updated_at = now() WHERE id = p_comment_id;
END;
$function$;

-- the execution-time audit snapshot
CREATE OR REPLACE FUNCTION public.snapshot_execution_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_log jsonb; v_cmt jsonb; v_nlog int; v_ncmt int;
BEGIN
  IF NOT (NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(cl) ORDER BY cl.created_at), '[]'::jsonb), count(*)
    INTO v_log, v_nlog
    FROM contract_change_log cl WHERE cl.document_id = NEW.id;

  SELECT coalesce(jsonb_agg(to_jsonb(cc) ORDER BY cc.created_at), '[]'::jsonb), count(*)
    INTO v_cmt, v_ncmt
    FROM contract_change_requests cc WHERE cc.document_id = NEW.id;

  INSERT INTO contract_execution_audit (
    org_id, document_id, executed_at, execution_hash, merged_body,
    change_log, comments, change_count, comment_count)
  VALUES (
    NEW.org_id, NEW.id, now(), NEW.execution_hash, NEW.merged_body,
    coalesce(v_log,'[]'::jsonb), coalesce(v_cmt,'[]'::jsonb),
    coalesce(v_nlog,0), coalesce(v_ncmt,0))
  ON CONFLICT (document_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- (8) purge_account — one delete against the survivor (the old body deleted from
--     both document_change_requests and contract_comments).
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'purge_account';
  IF v_def IS NULL THEN RAISE EXCEPTION 'purge_account not found'; END IF;

  -- drop the retired table's delete line; re-point the comments delete line.
  v_def := replace(v_def,
    '    DELETE FROM document_change_requests WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);' || E'\n',
    '');
  v_def := replace(v_def,
    'DELETE FROM contract_comments     WHERE document_id IN',
    'DELETE FROM contract_change_requests WHERE document_id IN');

  IF v_def LIKE '%document_change_requests%' OR v_def LIKE '%FROM contract_comments%' THEN
    RAISE EXCEPTION 'purge_account rewrite did not fully re-point (still references a retired table)';
  END IF;
  EXECUTE v_def;
END
$do$;

COMMIT;
