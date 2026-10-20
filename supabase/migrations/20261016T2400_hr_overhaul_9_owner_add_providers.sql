-- The intake form is the owner's only way to give us a horse's providers (owners
-- can't edit records afterward). So a horse's OWNER may add providers and emergency
-- contacts to their own horse, as well as staff. Linking by contact id and ending a
-- provider stay staff-only (those act across the roster). The emergency-contact
-- create-a-contact path is still gated to staff OR the horse's owner.

CREATE OR REPLACE FUNCTION public.add_horse_provider(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid; v_id uuid; v_horse uuid := (p ->> 'horse_id')::uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(v_horse)) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
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

CREATE OR REPLACE FUNCTION public.add_horse_emergency_contact(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid; v_horse uuid := (p ->> 'horse_id')::uuid; v_contact uuid; v_id uuid; v_email text := nullif(btrim(p ->> 'email'),'');
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = v_horse AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(v_horse)) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

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
