/*
  # Per-party document controls, company origination, contract messages, reminders

  Owner's contract model, corrected:
  - The COMPANY always originates. Staff can act on behalf of either party or
    both; the parties are selected (never created) at initiation.
  - Document controls are set per party at creation: can they add their own
    information, can they edit deal terms, can they suggest changes. The
    invitation language derives from these controls.
  - The horse section is either autofilled from a record or ASSIGNED to one of
    the parties to fill in.
  - Parties and staff can message on a contract ("why I won't sign" included);
    staff see all contract messages regardless of side — deal-conversation
    oversight. Messages notify the other side's users + org admins.
  - A daily sweep produces the follow-up notifications: locked-but-unsigned
    contracts, approaching lease starts, approaching lease expirations.
*/

-- ── 1. per-party controls ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_party_controls (
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  party_role   text NOT NULL,
  can_fill     boolean NOT NULL DEFAULT true,   -- add/edit fields their role owns
  can_edit_deal boolean NOT NULL DEFAULT false, -- edit DEAL-owned terms directly
  can_suggest  boolean NOT NULL DEFAULT false,  -- open change requests
  org_id       uuid NOT NULL DEFAULT current_org(),
  PRIMARY KEY (document_id, party_role)
);
ALTER TABLE document_party_controls ENABLE ROW LEVEL SECURITY;
-- definer-RPC access only (no direct policies)

CREATE OR REPLACE FUNCTION set_party_controls(
  p_document_id uuid, p_role text,
  p_can_fill boolean, p_can_edit_deal boolean, p_can_suggest boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, org_id)
  VALUES (p_document_id, upper(p_role), p_can_fill, p_can_edit_deal, p_can_suggest, v_org)
  ON CONFLICT (document_id, party_role)
  DO UPDATE SET can_fill = excluded.can_fill,
                can_edit_deal = excluded.can_edit_deal,
                can_suggest = excluded.can_suggest;
END;
$fn$;

-- ── 2. company origination ────────────────────────────────────────────────────
-- The company (the staff creator) is the document's originator — never a party
-- by assumption. NULL contact (e.g. a pure-admin login) is fine: staff checks
-- already grant the owner side.
CREATE OR REPLACE FUNCTION claim_document_origination(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  UPDATE documents SET originator_contact_id = current_contact_id()
   WHERE id = p_document_id;
END;
$fn$;

-- ── 3. horse section assignment ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_horse_section(p_document_id uuid, p_role text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid; v_state text; v_n integer;
BEGIN
  SELECT org_id, workflow_state INTO v_org, v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked';
  END IF;
  IF EXISTS (SELECT 1 FROM signatures s WHERE s.document_id = p_document_id AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'signatures exist — section ownership is frozen';
  END IF;
  UPDATE contract_fields SET owner_role = upper(p_role)
   WHERE document_id = p_document_id AND field_key LIKE 'HORSE.%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

-- ── 4. set_contract_field v3 — per-party controls in the gate ─────────────────
CREATE OR REPLACE FUNCTION set_contract_field(
  p_document_id uuid,
  p_field_key   text,
  p_value       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_row        contract_fields%ROWTYPE;
  v_confirmed  timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role INTO v_owner_role
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  -- the caller's own-role controls (default: fill yes, deal no)
  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND (v_is_orig OR v_recip_edit OR v_can_deal))
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$fn$;

-- ── 5. contract_document_detail v4 — controls in the read model + can_edit mirror
CREATE OR REPLACE FUNCTION contract_document_detail(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid;
  v_recip boolean;
  v_state text;
  v_orig  uuid;
  v_staff boolean;
  v_roles text[];
  v_can_fill boolean;
  v_can_deal boolean;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, recipient_editing, workflow_state, originator_contact_id
    INTO v_org, v_recip, v_state, v_orig
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT array_agg(r) INTO v_roles FROM caller_party_roles(p_document_id) r;
  v_roles := coalesce(v_roles, ARRAY[]::text[]);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM unnest(v_roles) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  SELECT jsonb_build_object(
    'document', (SELECT jsonb_build_object(
        'document_id', d.id, 'title', d.title, 'status', d.status,
        'workflow_state', d.workflow_state, 'recipient_editing', d.recipient_editing,
        'execution_hash', d.execution_hash, 'merged_body', d.merged_body,
        'is_originator', (d.originator_contact_id = v_me),
        'horse_section_confirmed_at', d.horse_section_confirmed_at,
        'horse_section_confirmed_by', d.horse_section_confirmed_by)
      FROM documents d WHERE d.id = p_document_id),
    'my_roles', to_jsonb(v_roles),
    'party_controls', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', c.party_role, 'can_fill', c.can_fill,
          'can_edit_deal', c.can_edit_deal, 'can_suggest', c.can_suggest))
      FROM document_party_controls c WHERE c.document_id = p_document_id), '[]'::jsonb),
    'fields', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label, 'section', cf.section,
          'owner_role', cf.owner_role, 'value', cf.value, 'value_type', cf.value_type,
          'required', cf.required, 'sort_order', cf.sort_order,
          'can_edit', (
            v_staff
            OR (cf.owner_role = 'DEAL' AND ((v_orig = v_me) OR v_recip OR v_can_deal))
            OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles) AND v_can_fill)
          ) AND v_state IN ('editable','editing'))
        ORDER BY cf.sort_order, cf.field_key)
      FROM contract_fields cf WHERE cf.document_id = p_document_id), '[]'::jsonb),
    'open_change_requests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', cr.id, 'annotation_number', cr.annotation_number,
          'target_field_key', cr.target_field_key, 'target_section', cr.target_section,
          'current_value', cr.current_value, 'requested_change', cr.requested_change,
          'status', cr.status)
        ORDER BY cr.annotation_number)
      FROM document_change_requests cr
      WHERE cr.document_id = p_document_id AND cr.status = 'open'), '[]'::jsonb),
    'shares', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'shared_with_contact_id', s.shared_with_contact_id,
          'recipient_editing', s.recipient_editing, 'notified_at', s.notified_at))
      FROM document_shares s WHERE s.document_id = p_document_id), '[]'::jsonb),
    'signatures', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', sg.party_role, 'typed_name', sg.typed_name,
          'signed_at', sg.signed_at)
        ORDER BY sg.party_role)
      FROM signatures sg WHERE sg.document_id = p_document_id AND sg.deleted_at IS NULL), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

-- ── 6. contract messages (parties + staff oversight) ─────────────────────────
CREATE TABLE IF NOT EXISTS contract_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT current_org(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sender_contact_id uuid REFERENCES contacts(id),
  sender_user_id    uuid,
  sender_label text NOT NULL,        -- display name resolved at post time
  body        text NOT NULL CHECK (length(trim(body)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contract_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS contract_messages_doc_idx ON contract_messages (document_id, created_at);

CREATE OR REPLACE FUNCTION contract_message_post(p_document_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid; v_eng uuid; v_title text;
  v_staff boolean; v_label text; v_row contract_messages%ROWTYPE;
  v_party record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, engagement_id, title INTO v_org, v_eng, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;

  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this contract';
  END IF;

  SELECT coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''), pr.email, 'Member')
    INTO v_label
  FROM profiles pr LEFT JOIN contacts c ON c.id = pr.contact_id
  WHERE pr.user_id = auth.uid();

  INSERT INTO contract_messages (org_id, document_id, sender_contact_id, sender_user_id, sender_label, body)
  VALUES (v_org, p_document_id, current_contact_id(), auth.uid(), coalesce(v_label, 'Member'), trim(p_body))
  RETURNING * INTO v_row;

  -- notify every OTHER party's linked user + the org's admins (deal oversight)
  FOR v_party IN
    SELECT DISTINCT pr.user_id
    FROM engagement_parties ep
    JOIN profiles pr ON pr.contact_id = ep.contact_id
    WHERE ep.engagement_id = v_eng AND pr.user_id <> auth.uid()
    UNION
    SELECT pr.user_id FROM profiles pr
    WHERE pr.org_id = v_org AND pr.role IN ('ADMIN') AND pr.user_id <> auth.uid()
  LOOP
    PERFORM notify_user(v_party.user_id, 'contract_message',
      'New message on ' || coalesce(v_title, 'a contract'),
      left(trim(p_body), 200),
      '/app/contracts/' || p_document_id);
  END LOOP;

  RETURN jsonb_build_object('id', v_row.id, 'created_at', v_row.created_at);
END;
$fn$;

CREATE OR REPLACE FUNCTION contract_messages_list(p_document_id uuid)
RETURNS TABLE (id uuid, sender_label text, sender_user_id uuid, body text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
DECLARE v_org uuid; v_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT d.org_id INTO v_org FROM documents d WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this contract';
  END IF;
  RETURN QUERY
    SELECT m.id, m.sender_label, m.sender_user_id, m.body, m.created_at
    FROM contract_messages m
    WHERE m.document_id = p_document_id
    ORDER BY m.created_at;
END;
$fn$;

-- ── 7. reminder sweep (daily, via the notifications cron) ─────────────────────
-- Produces at most one notification per (user, kind, link) per 3 days.
CREATE OR REPLACE FUNCTION contract_reminder_sweep()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_n integer := 0;
  r record;
  admin_user uuid;
BEGIN
  -- a) locked but unsigned for 3+ days → nudge org admins to follow up
  FOR r IN
    SELECT d.id, d.org_id, d.title
    FROM documents d
    WHERE d.workflow_state = 'locked' AND d.status <> 'EXECUTED'
      AND d.deleted_at IS NULL
      AND d.updated_at < now() - interval '3 days'
  LOOP
    FOR admin_user IN
      SELECT pr.user_id FROM profiles pr WHERE pr.org_id = r.org_id AND pr.role = 'ADMIN'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = admin_user AND n.kind = 'contract_followup'
          AND n.link = '/app/contracts/' || r.id
          AND n.created_at > now() - interval '3 days'
      ) THEN
        PERFORM notify_user(admin_user, 'contract_followup',
          'Unsigned contract needs a follow-up',
          coalesce(r.title, 'A contract') || ' has been locked for 3+ days without all signatures.',
          '/app/contracts/' || r.id);
        v_n := v_n + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- b) lease starting within 7 days → admins + the lessee's user
  FOR r IN
    SELECT h.id, h.org_id, coalesce(h.barn_name, h.registered_name) AS hname,
           h.lease_start, pr.user_id AS lessee_user
    FROM horses h
    LEFT JOIN profiles pr ON pr.contact_id = h.lessee_contact_id
    WHERE h.deleted_at IS NULL AND h.lease_start IS NOT NULL
      AND h.lease_start BETWEEN current_date AND current_date + 7
  LOOP
    FOR admin_user IN
      SELECT pr2.user_id FROM profiles pr2 WHERE pr2.org_id = r.org_id AND pr2.role = 'ADMIN'
      UNION SELECT r.lessee_user WHERE r.lessee_user IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = admin_user AND n.kind = 'lease_start'
          AND n.link = '/app/ops/horse-records'
          AND n.body LIKE '%' || r.hname || '%'
          AND n.created_at > now() - interval '3 days'
      ) THEN
        PERFORM notify_user(admin_user, 'lease_start',
          'Lease start approaching',
          r.hname || ' — lease starts ' || to_char(r.lease_start, 'FMMonth FMDD') || '.',
          '/app/ops/horse-records');
        v_n := v_n + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- c) lease expiring within 30 days → admins + the lessee's user
  FOR r IN
    SELECT h.id, h.org_id, coalesce(h.barn_name, h.registered_name) AS hname,
           h.lease_end, pr.user_id AS lessee_user
    FROM horses h
    LEFT JOIN profiles pr ON pr.contact_id = h.lessee_contact_id
    WHERE h.deleted_at IS NULL AND h.lease_end IS NOT NULL
      AND h.lease_end BETWEEN current_date AND current_date + 30
  LOOP
    FOR admin_user IN
      SELECT pr2.user_id FROM profiles pr2 WHERE pr2.org_id = r.org_id AND pr2.role = 'ADMIN'
      UNION SELECT r.lessee_user WHERE r.lessee_user IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = admin_user AND n.kind = 'lease_expiry'
          AND n.body LIKE '%' || r.hname || '%'
          AND n.created_at > now() - interval '7 days'
      ) THEN
        PERFORM notify_user(admin_user, 'lease_expiry',
          'Lease expiring soon',
          r.hname || ' — lease ends ' || to_char(r.lease_end, 'FMMonth FMDD, YYYY') || '.',
          '/app/ops/horse-records');
        v_n := v_n + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('notifications_created', v_n);
END;
$fn$;

GRANT EXECUTE ON FUNCTION set_party_controls(uuid, text, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_document_origination(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_horse_section(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION contract_message_post(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION contract_messages_list(uuid) TO authenticated;
REVOKE ALL ON FUNCTION contract_reminder_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION contract_reminder_sweep() TO service_role;
