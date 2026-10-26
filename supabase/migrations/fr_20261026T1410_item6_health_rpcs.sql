-- Fix round 3, item 6 — the health-log RPCs.
--
--  · add_horse_provider: adds person phone/email, and the active lessee may add a
--    provider too (not only owner/staff) — caller_owns_horse covers both.
--  · add_health_event / update_health_event: owner, active lessee, or staff may
--    log/edit an event with its structured type-specific fields, provider company +
--    person, next_due_date, created_by.
--  · delete_health_event: staff only.
--  · horse_health_log(horse): the record's health section — events (newest first)
--    with provider labels + attachment count, and the provider roster grouped by
--    company/person. Visible to staff, owner, active lessee.

BEGIN;

-- add_horse_provider: person phone/email + lessee access
CREATE OR REPLACE FUNCTION public.add_horse_provider(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_id uuid; v_horse uuid := (p ->> 'horse_id')::uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(v_horse)) THEN
    RAISE EXCEPTION 'only the horse owner, its lessee, or staff may add a provider';
  END IF;
  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, provider_role, role_label,
     party_contact_id, party_name_text, business_name, phone, email,
     person_phone, person_email,
     address_line1, city, state, postal, active, created_by_contact_id)
  VALUES (v_org, v_horse, p ->> 'relationship',
     nullif(p ->> 'provider_role',''), nullif(p ->> 'role_label',''),
     nullif(p ->> 'party_contact_id','')::uuid, nullif(p ->> 'party_name_text',''),
     nullif(p ->> 'business_name',''), nullif(p ->> 'phone',''), nullif(p ->> 'email',''),
     nullif(p ->> 'person_phone',''), nullif(p ->> 'person_email',''),
     nullif(p ->> 'address_line1',''), nullif(p ->> 'city',''), nullif(p ->> 'state',''), nullif(p ->> 'postal',''),
     true, current_contact_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- add_health_event
CREATE OR REPLACE FUNCTION public.add_health_event(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_id uuid; v_horse uuid := (p ->> 'horse_id')::uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(v_horse)) THEN
    RAISE EXCEPTION 'only the horse owner, its lessee, or staff may log a health event';
  END IF;
  INSERT INTO horse_health_events
    (org_id, horse_id, event_type, event_date, occurred_at, next_due,
     provider_company_id, provider_person_id, provider_contact_id,
     notes, structured, created_by)
  VALUES (v_org, v_horse, p ->> 'event_type',
     coalesce(nullif(p ->> 'event_date','')::date, current_date),
     coalesce(nullif(p ->> 'event_date','')::date, current_date)::timestamptz,
     nullif(p ->> 'next_due_date','')::date,
     nullif(p ->> 'provider_company_id','')::uuid,
     nullif(p ->> 'provider_person_id','')::uuid,
     nullif(p ->> 'provider_contact_id','')::uuid,
     nullif(p ->> 'notes',''),
     coalesce(p -> 'structured', '{}'::jsonb),
     current_contact_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- update_health_event (owner/lessee/staff) — NEVER locked, always logged via
-- updated_at; a real delete is staff-only (delete_health_event).
CREATE OR REPLACE FUNCTION public.update_health_event(p_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_horse uuid;
BEGIN
  SELECT horse_id INTO v_horse FROM horse_health_events WHERE id = p_id AND deleted_at IS NULL;
  IF v_horse IS NULL THEN RAISE EXCEPTION 'unknown health event'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(v_horse)) THEN
    RAISE EXCEPTION 'not authorized to edit this health event';
  END IF;
  UPDATE horse_health_events SET
    event_type   = coalesce(nullif(p ->> 'event_type',''), event_type),
    event_date   = coalesce(nullif(p ->> 'event_date','')::date, event_date),
    occurred_at  = coalesce(nullif(p ->> 'event_date','')::date::timestamptz, occurred_at),
    next_due     = CASE WHEN p ? 'next_due_date' THEN nullif(p ->> 'next_due_date','')::date ELSE next_due END,
    provider_company_id = CASE WHEN p ? 'provider_company_id' THEN nullif(p ->> 'provider_company_id','')::uuid ELSE provider_company_id END,
    provider_person_id  = CASE WHEN p ? 'provider_person_id'  THEN nullif(p ->> 'provider_person_id','')::uuid  ELSE provider_person_id END,
    notes        = CASE WHEN p ? 'notes' THEN nullif(p ->> 'notes','') ELSE notes END,
    structured   = CASE WHEN p ? 'structured' THEN coalesce(p -> 'structured','{}'::jsonb) ELSE structured END,
    updated_at   = now()
  WHERE id = p_id;
END;
$function$;

-- delete_health_event — staff only (D27: real deletion is staff/DB-level)
CREATE OR REPLACE FUNCTION public.delete_health_event(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'only staff may delete a health event'; END IF;
  UPDATE horse_health_events SET deleted_at = now(), deleted_by = current_contact_id()
   WHERE id = p_id AND deleted_at IS NULL;
  UPDATE horse_health_event_files SET deleted_at = now() WHERE event_id = p_id AND deleted_at IS NULL;
END;
$function$;

-- horse_health_log(horse) — the record section payload
CREATE OR REPLACE FUNCTION public.horse_health_log(p_horse_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(p_horse_id)) THEN
    RAISE EXCEPTION 'not authorized for this horse''s health log';
  END IF;

  RETURN jsonb_build_object(
    'org_id', v_org,
    'can_edit', (has_staff_access() OR caller_owns_horse(p_horse_id)),
    'is_staff', has_staff_access(),
    'providers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', hr.id, 'role', hr.relationship, 'role_label', hr.role_label,
          'business_name', hr.business_name, 'company_phone', hr.phone, 'company_email', hr.email,
          'person_name', coalesce(nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')),''), hr.party_name_text),
          'person_phone', hr.person_phone, 'person_email', hr.person_email,
          'party_contact_id', hr.party_contact_id)
        ORDER BY hr.relationship, hr.business_name NULLS LAST, hr.created_at)
      FROM horse_relationships hr
      LEFT JOIN contacts c ON c.id = hr.party_contact_id
      WHERE hr.horse_id = p_horse_id AND hr.active
        AND hr.relationship IN ('VET','FARRIER','DENTIST','BODYWORK','ACUPUNCTURE','MASSAGE','CHIROPRACTIC','OTHER')
    ), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', e.id, 'event_type', e.event_type, 'event_date', e.event_date,
          'next_due_date', e.next_due, 'notes', e.notes, 'structured', e.structured,
          'provider_company_id', e.provider_company_id, 'provider_person_id', e.provider_person_id,
          'company_name', (SELECT business_name FROM horse_relationships WHERE id = e.provider_company_id),
          'person_name', (SELECT coalesce(nullif(btrim(coalesce(cc.first_name,'')||' '||coalesce(cc.last_name,'')),''), hp.party_name_text)
                            FROM horse_relationships hp LEFT JOIN contacts cc ON cc.id = hp.party_contact_id
                           WHERE hp.id = e.provider_person_id),
          'file_count', (SELECT count(*) FROM horse_health_event_files f WHERE f.event_id = e.id AND f.deleted_at IS NULL),
          'files', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'name', f.file_name, 'path', f.storage_path) ORDER BY f.created_at)
                               FROM horse_health_event_files f WHERE f.event_id = e.id AND f.deleted_at IS NULL), '[]'::jsonb))
        ORDER BY e.event_date DESC, e.created_at DESC)
      FROM horse_health_events e
      WHERE e.horse_id = p_horse_id AND e.deleted_at IS NULL
    ), '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_health_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_health_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_health_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.horse_health_log(uuid) TO authenticated;

COMMIT;
