-- One read for the client horse page: the record, its parties/lease, documents,
-- schedule (bookings), and history (health events + relationship timeline). Gated to
-- the horse's owner/lessee or staff.
CREATE OR REPLACE FUNCTION public.horse_page_detail(p_horse_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_h horses%ROWTYPE; v_out jsonb;
BEGIN
  SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_h.id IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(p_horse_id)) THEN
    RAISE EXCEPTION 'not authorized for this horse';
  END IF;

  v_out := jsonb_build_object(
    -- the record (identity + location + care), display names resolved from lookups
    'record', jsonb_build_object(
      'id', v_h.id, 'registered_name', v_h.registered_name, 'nickname', v_h.nickname,
      'breed', coalesce((SELECT display_name FROM horse_breeds WHERE code = v_h.breed), v_h.breed),
      'color', coalesce((SELECT display_name FROM horse_colors WHERE code = v_h.color), v_h.color),
      'markings', v_h.markings, 'sex', v_h.sex, 'date_of_birth', v_h.date_of_birth,
      'height', v_h.height, 'registration_number', v_h.registration_number,
      'registration_org', v_h.registration_org, 'microchip_id', v_h.microchip_id,
      'passport_number', v_h.passport_number, 'passport_country', v_h.passport_country,
      'fair_market_value', v_h.fair_market_value,
      'home_location', (SELECT jsonb_build_object('name', l.name, 'address_line1', l.address_line1,
          'city', l.city, 'state', l.state, 'postal', l.postal) FROM locations l WHERE l.id = v_h.home_location_id),
      'home_barn', v_h.home_barn, 'home_stall', v_h.home_stall, 'home_notes', v_h.home_location_notes,
      'home_trainer', v_h.home_trainer, 'home_care_giver', v_h.home_care_giver,
      'home_groom', v_h.home_groom, 'home_other', v_h.home_other_person,
      'current_location', (SELECT jsonb_build_object('name', l.name, 'address_line1', l.address_line1,
          'city', l.city, 'state', l.state, 'postal', l.postal) FROM locations l WHERE l.id = v_h.current_location_id),
      'current_barn', v_h.current_barn, 'current_stall', v_h.current_stall,
      'vet_name', v_h.vet_name, 'vet_phone', v_h.vet_phone, 'vet_business_name', v_h.vet_business_name,
      'farrier_name', v_h.farrier_name, 'farrier_phone', v_h.farrier_phone,
      'medical_history', v_h.medical_history, 'behavioral_history', v_h.behavioral_history,
      'known_conditions', v_h.known_conditions, 'training_history', v_h.training_history,
      'competition_history', v_h.competition_history, 'euthanasia_authorization', v_h.euthanasia_authorization,
      'owner_name', coalesce((SELECT nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),'') FROM contacts WHERE id = v_h.current_owner_contact_id), v_h.owner_name_text),
      'lessee_name', coalesce((SELECT nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),'') FROM contacts WHERE id = v_h.lessee_contact_id), v_h.lessee_name_text),
      'lease_start', v_h.lease_start, 'lease_end', v_h.lease_end
    ),
    -- medications + supplements
    'medications', horse_medications_list(p_horse_id),
    -- documents tied to the horse
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'display_code', d.display_code, 'status', d.status,
        'workflow_state', d.workflow_state, 'effective_date', d.effective_date, 'created_at', d.created_at)
        ORDER BY d.created_at DESC)
      FROM documents d WHERE d.horse_id = p_horse_id AND d.deleted_at IS NULL), '[]'::jsonb),
    -- schedule (bookings/appointments)
    'schedule', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'status', b.status, 'location', coalesce(b.location, (SELECT name FROM locations WHERE id = b.location_id)),
        'notes', b.notes) ORDER BY b.starts_at DESC)
      FROM bookings b WHERE b.horse_id = p_horse_id), '[]'::jsonb),
    -- activity: session/lesson/training REPORTS (bookings with an activity log or
    -- write-up), newest first. The report is the logged activities + free-text.
    'sessions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind,
        'offering', (SELECT name FROM offerings WHERE id = b.offering_id),
        'starts_at', b.starts_at, 'status', b.status,
        'location', coalesce(b.location, (SELECT name FROM locations WHERE id = b.location_id)),
        'activities', b.activity_log -> 'activities',
        'report', coalesce(b.activity_log ->> 'text', b.notes))
        ORDER BY b.starts_at DESC)
      FROM bookings b
      WHERE b.horse_id = p_horse_id
        AND (b.activity_log IS NOT NULL OR coalesce(btrim(b.notes),'') <> '')), '[]'::jsonb),
    -- purchases tied to the horse
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
GRANT EXECUTE ON FUNCTION public.horse_page_detail(uuid) TO authenticated;
