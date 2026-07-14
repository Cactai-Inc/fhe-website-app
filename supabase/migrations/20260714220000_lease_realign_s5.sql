/*
  # Lease realign · Slice 5 — partial-lease participants + payment options

  A lease can have additional PARTIAL-LEASE participants beyond the primary
  lessee. Each participant (a contact + a contract party) may carry usage terms —
  days of the week, hours of the day, and/or a usage percentage — all OPTIONAL
  (a blank % is computed later from everyone's chosen days/times).

  Payment options ($ amount + free-text sub-terms) can be added by any party or
  staff; each participant carries a payment allocation (percentage) of the total.

  Both are editable by staff OR any party while the lease is not yet executed.

  A. lease_participants (per-doc, per-contact usage + payment allocation).
  B. lease_payment_options (per-doc $ + describe).
  C. add/remove RPCs + readers.
*/

-- ── A. participants ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_participants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  days_used   text,            -- e.g. "Mon,Wed"
  hours       text,            -- e.g. "9am–12pm"
  usage_pct   numeric(5,2),    -- optional; computed from days/times if null
  payment_pct numeric(5,2),    -- optional; this participant's share of payment
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, contact_id)
);
ALTER TABLE lease_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lease_participants_read ON lease_participants;
CREATE POLICY lease_participants_read ON lease_participants
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));

-- ── B. payment options ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_payment_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  amount      numeric(10,2),
  describe    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lease_payment_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lease_payment_options_read ON lease_payment_options;
CREATE POLICY lease_payment_options_read ON lease_payment_options
  FOR SELECT TO authenticated
  USING ((org_id = current_org() AND has_staff_access()) OR caller_is_document_party(document_id));

-- ── shared gate: staff or a party, and the lease not yet executed ────────────
CREATE OR REPLACE FUNCTION lease_edit_guard(p_document_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_ws text;
BEGIN
  SELECT org_id, workflow_state INTO v_org, v_ws FROM documents WHERE id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;
  IF NOT (has_staff_access() OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to edit this lease';
  END IF;
  IF v_ws = 'executed' THEN RAISE EXCEPTION 'the lease is executed and cannot be changed'; END IF;
  RETURN v_org;
END;
$fn$;

-- ── C. participant RPCs ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_lease_participant(
  p_document_id uuid, p_contact_id uuid,
  p_days text DEFAULT NULL, p_hours text DEFAULT NULL,
  p_usage_pct numeric DEFAULT NULL, p_payment_pct numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_next int;
BEGIN
  v_org := lease_edit_guard(p_document_id);

  -- attach as a PARTICIPANT contract party (signatory) if not already on the doc
  IF NOT EXISTS (SELECT 1 FROM document_parties WHERE document_id = p_document_id AND contact_id = p_contact_id) THEN
    SELECT coalesce(max(signer_order),0) + 1 INTO v_next FROM document_parties WHERE document_id = p_document_id;
    INSERT INTO document_parties (org_id, document_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, p_document_id, p_contact_id, 'PARTICIPANT', true, v_next);
  END IF;

  INSERT INTO lease_participants (org_id, document_id, contact_id, days_used, hours, usage_pct, payment_pct)
    VALUES (v_org, p_document_id, p_contact_id,
            NULLIF(btrim(coalesce(p_days,'')),''), NULLIF(btrim(coalesce(p_hours,'')),''),
            p_usage_pct, p_payment_pct)
  ON CONFLICT (document_id, contact_id) DO UPDATE
    SET days_used = excluded.days_used, hours = excluded.hours,
        usage_pct = excluded.usage_pct, payment_pct = excluded.payment_pct;

  RETURN jsonb_build_object('document_id', p_document_id, 'contact_id', p_contact_id);
END;
$fn$;
REVOKE ALL ON FUNCTION add_lease_participant(uuid, uuid, text, text, numeric, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION add_lease_participant(uuid, uuid, text, text, numeric, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION remove_lease_participant(p_document_id uuid, p_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM lease_edit_guard(p_document_id);
  DELETE FROM lease_participants WHERE document_id = p_document_id AND contact_id = p_contact_id;
  DELETE FROM document_parties WHERE document_id = p_document_id AND contact_id = p_contact_id AND party_role = 'PARTICIPANT';
END;
$fn$;
REVOKE ALL ON FUNCTION remove_lease_participant(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION remove_lease_participant(uuid, uuid) TO authenticated, service_role;

-- ── payment-option RPCs ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_lease_payment_option(p_document_id uuid, p_amount numeric, p_describe text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_id uuid;
BEGIN
  v_org := lease_edit_guard(p_document_id);
  INSERT INTO lease_payment_options (org_id, document_id, amount, describe)
    VALUES (v_org, p_document_id, p_amount, NULLIF(btrim(coalesce(p_describe,'')),''))
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$fn$;
REVOKE ALL ON FUNCTION add_lease_payment_option(uuid, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION add_lease_payment_option(uuid, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION remove_lease_payment_option(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_doc uuid;
BEGIN
  SELECT document_id INTO v_doc FROM lease_payment_options WHERE id = p_id;
  IF v_doc IS NULL THEN RETURN; END IF;
  PERFORM lease_edit_guard(v_doc);
  DELETE FROM lease_payment_options WHERE id = p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION remove_lease_payment_option(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION remove_lease_payment_option(uuid) TO authenticated, service_role;

-- ── readers (party or staff) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lease_participants_for_doc(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT (has_staff_access() OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'contact_id', lp.contact_id,
        'name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
        'days_used', lp.days_used, 'hours', lp.hours,
        'usage_pct', lp.usage_pct, 'payment_pct', lp.payment_pct) ORDER BY lp.created_at), '[]'::jsonb)
    FROM lease_participants lp JOIN contacts c ON c.id = lp.contact_id
    WHERE lp.document_id = p_document_id);
END;
$fn$;
REVOKE ALL ON FUNCTION lease_participants_for_doc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION lease_participants_for_doc(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION lease_payment_options_for_doc(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT (has_staff_access() OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'amount', amount, 'describe', describe) ORDER BY created_at), '[]'::jsonb)
    FROM lease_payment_options WHERE document_id = p_document_id);
END;
$fn$;
REVOKE ALL ON FUNCTION lease_payment_options_for_doc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION lease_payment_options_for_doc(uuid) TO authenticated, service_role;
