-- Horse records overhaul, phase 4: the write surfaces the record and form call —
-- designations, care providers, locations with history, the emergency-contact
-- email match, and End lease.

-- ── Designations (item 4) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_contact_designation(p_contact uuid, p_designation text, p_on boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff only'; END IF;
  IF p_on THEN
    INSERT INTO staff_designations (org_id, contact_id, designation)
    VALUES (v_org, p_contact, p_designation)
    ON CONFLICT (org_id, contact_id, designation) DO NOTHING;
  ELSE
    DELETE FROM staff_designations WHERE org_id = v_org AND contact_id = p_contact AND designation = p_designation;
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_contact_designation(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_contact_designation(uuid, text, boolean) TO authenticated, service_role;

-- People carrying a designation, for staff pickers (names only).
CREATE OR REPLACE FUNCTION public.people_with_designation(p_designation text)
 RETURNS TABLE(contact_id uuid, display_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT c.id, nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), '')
  FROM staff_designations d
  JOIN contacts c ON c.id = d.contact_id
  WHERE d.org_id = current_org() AND d.designation = p_designation
    AND c.deleted_at IS NULL AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name;
$function$;
REVOKE EXECUTE ON FUNCTION public.people_with_designation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.people_with_designation(text) TO authenticated, service_role;

-- ── Care providers (item 5) ─────────────────────────────────────────────────
-- Add a provider. Links to a contact when p_contact is given, else stores details.
CREATE OR REPLACE FUNCTION public.add_horse_provider(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid; v_id uuid; v_horse uuid := (p ->> 'horse_id')::uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff only'; END IF;
  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, provider_role, role_label,
     party_contact_id, party_name_text, business_name, phone, email,
     address_line1, city, state, postal, active, created_by_contact_id)
  VALUES (v_org, v_horse, p ->> 'relationship',
     nullif(p ->> 'provider_role',''), nullif(p ->> 'role_label',''),
     nullif(p ->> 'party_contact_id','')::uuid, nullif(p ->> 'party_name_text',''),
     nullif(p ->> 'business_name',''), nullif(p ->> 'phone',''), nullif(p ->> 'email',''),
     nullif(p ->> 'address_line1',''), nullif(p ->> 'city',''), nullif(p ->> 'state',''), nullif(p ->> 'postal',''),
     true, current_contact_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_horse_provider(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_horse_provider(jsonb) TO authenticated, service_role;

-- Link a manual (unlinked) provider to an existing contact.
CREATE OR REPLACE FUNCTION public.link_horse_provider(p_id uuid, p_contact uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff only'; END IF;
  UPDATE horse_relationships SET party_contact_id = p_contact
   WHERE id = p_id AND org_id = current_org();
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.link_horse_provider(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_horse_provider(uuid, uuid) TO authenticated, service_role;

-- End a provider (nothing is deleted; the end date is set and active cleared).
CREATE OR REPLACE FUNCTION public.end_horse_provider(p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff only'; END IF;
  UPDATE horse_relationships SET active = false, ended_at = now(), term_end = coalesce(term_end, current_date)
   WHERE id = p_id AND org_id = current_org();
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.end_horse_provider(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_horse_provider(uuid) TO authenticated, service_role;

-- ── Locations with history (item 6) ─────────────────────────────────────────
-- Set the horse's current location. Ends the open row and opens a new one, so the
-- previous location becomes dated history. p_update_known optionally writes the
-- edited address back to the shared locations option list.
CREATE OR REPLACE FUNCTION public.set_horse_current_location(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid; v_horse uuid := (p ->> 'horse_id')::uuid; v_id uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(v_horse)) THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE horse_locations SET end_on = coalesce((nullif(p ->> 'start_on',''))::date, current_date)
   WHERE horse_id = v_horse AND end_on IS NULL;

  INSERT INTO horse_locations
    (org_id, horse_id, name, address_line1, city, state, postal, keeping_spots, notes, start_on, end_on)
  VALUES (v_org, v_horse, nullif(p ->> 'name',''), nullif(p ->> 'address_line1',''),
          nullif(p ->> 'city',''), nullif(p ->> 'state',''), nullif(p ->> 'postal',''),
          coalesce(p -> 'keeping_spots', '[]'::jsonb), nullif(p ->> 'notes',''),
          (nullif(p ->> 'start_on',''))::date, NULL)
  RETURNING id INTO v_id;

  IF coalesce((p ->> 'update_known')::boolean, false) AND nullif(p ->> 'name','') IS NOT NULL THEN
    UPDATE locations SET address_line1 = nullif(p ->> 'address_line1',''),
           city = nullif(p ->> 'city',''), state = nullif(p ->> 'state',''), postal = nullif(p ->> 'postal','')
     WHERE org_id = v_org AND lower(name) = lower(p ->> 'name');
  END IF;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_horse_current_location(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_horse_current_location(jsonb) TO authenticated, service_role;

-- ── Emergency-contact email match (item 5) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_lookup_attempts (
  user_id    uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_lookup_attempts_user ON public.email_lookup_attempts (user_id, attempted_at);

-- Returns only {matched, display_name}; never the contact id. Rate-limited to 10
-- lookups per user per 10 minutes so a list of emails can't be probed.
CREATE OR REPLACE FUNCTION public.match_account_by_email(p_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_count int; v_name text; v_org uuid := current_org();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  DELETE FROM email_lookup_attempts WHERE attempted_at < now() - interval '10 minutes';
  SELECT count(*) INTO v_count FROM email_lookup_attempts WHERE user_id = auth.uid();
  IF v_count >= 10 THEN RETURN jsonb_build_object('rate_limited', true); END IF;
  INSERT INTO email_lookup_attempts (user_id) VALUES (auth.uid());

  SELECT nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')),'')
    INTO v_name
    FROM contacts c JOIN profiles pr ON pr.contact_id = c.id
   WHERE c.org_id = v_org AND c.deleted_at IS NULL
     AND lower(c.email) = lower(btrim(p_email))
   LIMIT 1;
  IF v_name IS NULL THEN RETURN jsonb_build_object('matched', false); END IF;
  RETURN jsonb_build_object('matched', true, 'display_name', v_name);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.match_account_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_account_by_email(text) TO authenticated, service_role;

-- Add an emergency contact. If p_email matches an account, link server-side to that
-- contact; otherwise create a new contact from name + phone.
CREATE OR REPLACE FUNCTION public.add_horse_emergency_contact(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid; v_horse uuid := (p ->> 'horse_id')::uuid; v_contact uuid; v_id uuid; v_email text := nullif(btrim(p ->> 'email'),'');
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff only'; END IF;

  IF v_email IS NOT NULL THEN
    SELECT c.id INTO v_contact FROM contacts c JOIN profiles pr ON pr.contact_id = c.id
     WHERE c.org_id = v_org AND c.deleted_at IS NULL AND lower(c.email) = lower(v_email) LIMIT 1;
  END IF;
  IF v_contact IS NULL AND nullif(btrim(p ->> 'name'),'') IS NOT NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, phone)
    VALUES (v_org, split_part(btrim(p ->> 'name'),' ',1),
            nullif(btrim(substr(btrim(p ->> 'name'), length(split_part(btrim(p ->> 'name'),' ',1))+1)),''),
            nullif(btrim(p ->> 'phone'),''))
    RETURNING id INTO v_contact;
  END IF;

  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, party_contact_id, party_name_text, phone, active, created_by_contact_id)
  VALUES (v_org, v_horse, 'EMERGENCY_CONTACT', v_contact, nullif(btrim(p ->> 'name'),''),
          nullif(btrim(p ->> 'phone'),''), true, current_contact_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_horse_emergency_contact(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_horse_emergency_contact(jsonb) TO authenticated, service_role;

-- ── End lease (item 8) ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_horse_lease(p_horse uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff only'; END IF;
  UPDATE horse_relationships SET active = false, ended_at = now(), term_end = coalesce(term_end, current_date)
   WHERE horse_id = p_horse AND relationship = 'LESSEE' AND active;
  UPDATE horses SET lessee_contact_id = NULL, lessee_name_text = NULL,
         lease_start = NULL, lease_end = NULL, updated_at = now()
   WHERE id = p_horse;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.end_horse_lease(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_horse_lease(uuid) TO authenticated, service_role;
