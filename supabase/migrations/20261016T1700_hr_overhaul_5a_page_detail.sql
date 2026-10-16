-- Horse records overhaul, phase 5a: horse_page_detail reads current location from
-- horse_locations, providers from horse_relationships, and the narrative lists. It
-- also returns current providers, provider history, and location history for the
-- record view and its history panels, plus pending_fields.

CREATE OR REPLACE FUNCTION public.horse_page_detail(p_horse_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_h horses%ROWTYPE; v_out jsonb; v_lease jsonb; v_curr jsonb;
BEGIN
  SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND org_id = current_org() AND deleted_at IS NULL;
  IF v_h.id IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(p_horse_id)) THEN
    RAISE EXCEPTION 'not authorized for this horse';
  END IF;

  IF v_h.lease_start IS NOT NULL AND v_h.lease_start <= current_date
     AND (v_h.lease_end IS NULL OR v_h.lease_end >= current_date) THEN
    SELECT jsonb_build_object(
        'lessee_name', coalesce((SELECT nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),'') FROM contacts WHERE id = v_h.lessee_contact_id), v_h.lessee_name_text),
        'lease_start', v_h.lease_start, 'lease_end', v_h.lease_end,
        'lease_type', nullif(cf.lease_type, ''), 'days_used', nullif(cf.days_used, ''),
        'schedule_terms', nullif(cf.schedule_terms, ''), 'source_document_id', d.id
      ) INTO v_lease
      FROM documents d
      JOIN contract_templates ct ON ct.id = d.template_id
      CROSS JOIN LATERAL (
        SELECT max(value) FILTER (WHERE field_key = 'TXN.LEASE_TYPE') AS lease_type,
               max(value) FILTER (WHERE field_key = 'TXN.DAYS_USED') AS days_used,
               max(value) FILTER (WHERE field_key = 'TXN.SCHEDULE_TERMS') AS schedule_terms
          FROM contract_fields WHERE document_id = d.id
      ) cf
      WHERE d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.workflow_state = 'executed' AND is_horse_lease_template(ct.template_key)
      ORDER BY d.effective_date DESC NULLS LAST, d.created_at DESC
      LIMIT 1;
  END IF;

  -- The current (open) location row.
  SELECT jsonb_build_object('name', hl.name, 'address_line1', hl.address_line1,
      'city', hl.city, 'state', hl.state, 'postal', hl.postal,
      'keeping_spots', hl.keeping_spots, 'notes', hl.notes, 'start_on', hl.start_on)
    INTO v_curr
    FROM horse_locations hl WHERE hl.horse_id = p_horse_id AND hl.end_on IS NULL
    ORDER BY hl.created_at DESC LIMIT 1;

  v_out := jsonb_build_object(
    'record', jsonb_build_object(
      'id', v_h.id, 'registered_name', v_h.registered_name, 'nickname', v_h.nickname,
      'breed', coalesce((SELECT display_name FROM horse_breeds WHERE code = v_h.breed), v_h.breed),
      'color', coalesce((SELECT display_name FROM horse_colors WHERE code = v_h.color), v_h.color),
      'markings', v_h.markings, 'sex', v_h.sex, 'date_of_birth', v_h.date_of_birth,
      'height', v_h.height, 'registration_number', v_h.registration_number,
      'registration_org', v_h.registration_org, 'microchip_id', v_h.microchip_id,
      'passport_number', v_h.passport_number, 'passport_country', v_h.passport_country,
      'fair_market_value', v_h.fair_market_value,
      'current_location', v_curr,
      'medical_history_list', v_h.medical_history_list,
      'behavioral_history_list', v_h.behavioral_history_list,
      'known_conditions_list', v_h.known_conditions_list,
      'training_history_list', v_h.training_history_list,
      'competition_history_list', v_h.competition_history_list,
      'injuries_to_humans', v_h.injuries_to_humans,
      'pending_fields', v_h.pending_fields,
      'euthanasia_authorization', v_h.euthanasia_authorization,
      'owner_name', coalesce((SELECT nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),'') FROM contacts WHERE id = v_h.current_owner_contact_id), v_h.owner_name_text),
      'lessee_name', coalesce((SELECT nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),'') FROM contacts WHERE id = v_h.lessee_contact_id), v_h.lessee_name_text),
      'lease_start', v_h.lease_start, 'lease_end', v_h.lease_end
    ),
    'viewer_is_lessee', (v_h.lessee_contact_id IS NOT NULL AND v_h.lessee_contact_id = current_contact_id()),
    'lease', v_lease,
    -- current active care providers
    'providers', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'type', r.relationship, 'role', r.provider_role, 'role_label', r.role_label,
        'name', coalesce(nullif(btrim(r.party_name_text),''),
                 (SELECT nullif(btrim(c.first_name||' '||c.last_name),'') FROM contacts c WHERE c.id = r.party_contact_id)),
        'business_name', r.business_name, 'phone', r.phone, 'email', r.email,
        'address_line1', r.address_line1, 'city', r.city, 'state', r.state, 'postal', r.postal,
        'linked', (r.party_contact_id IS NOT NULL))
        ORDER BY r.relationship, (r.provider_role='primary') DESC, r.created_at)
      FROM horse_relationships r
      WHERE r.horse_id = p_horse_id AND r.active
        AND r.relationship IN ('VET','FARRIER','TRAINER','GROOM','CARE_GIVER','EMERGENCY_CONTACT','OTHER')), '[]'::jsonb),
    -- provider history: ended providers, newest end first
    'provider_history', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'type', r.relationship, 'role', r.provider_role, 'role_label', r.role_label,
        'name', coalesce(nullif(btrim(r.party_name_text),''),
                 (SELECT nullif(btrim(c.first_name||' '||c.last_name),'') FROM contacts c WHERE c.id = r.party_contact_id)),
        'business_name', r.business_name, 'phone', r.phone,
        'created_at', r.created_at, 'ended_at', r.ended_at)
        ORDER BY r.ended_at DESC NULLS LAST)
      FROM horse_relationships r
      WHERE r.horse_id = p_horse_id AND NOT r.active
        AND r.relationship IN ('VET','FARRIER','TRAINER','GROOM','CARE_GIVER','EMERGENCY_CONTACT','OTHER')), '[]'::jsonb),
    -- location history: ended location rows, newest end first
    'location_history', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', hl.id, 'name', hl.name, 'address_line1', hl.address_line1, 'city', hl.city,
        'state', hl.state, 'postal', hl.postal, 'start_on', hl.start_on, 'end_on', hl.end_on)
        ORDER BY hl.end_on DESC NULLS LAST)
      FROM horse_locations hl WHERE hl.horse_id = p_horse_id AND hl.end_on IS NOT NULL), '[]'::jsonb),
    'medications', horse_medications_list(p_horse_id),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'display_code', d.display_code, 'status', d.status,
        'workflow_state', d.workflow_state, 'effective_date', d.effective_date, 'created_at', d.created_at)
        ORDER BY d.created_at DESC)
      FROM documents d WHERE d.horse_id = p_horse_id AND d.deleted_at IS NULL), '[]'::jsonb),
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'status', b.status, 'location', coalesce(b.location, (SELECT name FROM locations WHERE id = b.location_id)),
        'notes', b.notes) ORDER BY b.starts_at DESC)
      FROM bookings b WHERE b.horse_id = p_horse_id), '[]'::jsonb),
    'sessions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'offering', (SELECT name FROM offerings WHERE id = b.offering_id),
        'starts_at', b.starts_at, 'status', b.status,
        'location', coalesce(b.location, (SELECT name FROM locations WHERE id = b.location_id)),
        'activities', b.activity_log -> 'activities', 'report', coalesce(b.activity_log ->> 'text', b.notes))
        ORDER BY b.starts_at DESC)
      FROM bookings b WHERE b.horse_id = p_horse_id
        AND (b.activity_log IS NOT NULL OR coalesce(btrim(b.notes),'') <> '')), '[]'::jsonb),
    'purchases', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', pu.id, 'display_code', pu.display_code, 'amount', pu.amount,
        'status', pu.status, 'payment_status', pu.payment_status,
        'notes', pu.notes, 'paid_at', pu.paid_at, 'created_at', pu.created_at)
        ORDER BY pu.created_at DESC)
      FROM purchases pu WHERE pu.horse_id = p_horse_id AND pu.deleted_at IS NULL), '[]'::jsonb)
  );
  RETURN v_out;
END;
$function$;
