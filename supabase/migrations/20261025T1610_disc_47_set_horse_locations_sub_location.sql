-- disc_47 (fix round item 5a): set_horse_locations reads sub_location (free text —
-- a paddock/area note that complements the structured keeping_spots), on both the
-- update-open-location and insert-new-location branches. Single transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_horse_locations(p_horse_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_me uuid := current_contact_id(); v_staff boolean := has_staff_access();
  v_curr jsonb := coalesce(p_payload -> 'current', p_payload -> 'home');
  v_vacc jsonb := p_payload -> 'vaccinations';
  v_name text := nullif(btrim(v_curr ->> 'name'), '');
  v_update_known boolean := coalesce((p_payload ->> 'update_known')::boolean, false);
  v_open horse_locations%ROWTYPE;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT coalesce(v_staff AND v_org = current_org(), false) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
  END IF;

  IF v_name IS NOT NULL THEN
    SELECT * INTO v_open FROM horse_locations
     WHERE horse_id = p_horse_id AND end_on IS NULL ORDER BY created_at DESC LIMIT 1;
    IF v_open.id IS NOT NULL THEN
      UPDATE horse_locations SET
        name = v_name,
        address_line1 = nullif(btrim(v_curr ->> 'address_line1'),''),
        city = nullif(btrim(v_curr ->> 'city'),''),
        state = nullif(btrim(v_curr ->> 'state'),''),
        postal = nullif(btrim(v_curr ->> 'postal'),''),
        sub_location = nullif(btrim(v_curr ->> 'sub_location'),''),
        keeping_spots = coalesce(v_curr -> 'keeping_spots', '[]'::jsonb),
        notes = nullif(btrim(v_curr ->> 'notes'),'')
      WHERE id = v_open.id;
    ELSE
      INSERT INTO horse_locations
        (org_id, horse_id, name, address_line1, city, state, postal, sub_location, keeping_spots, notes, start_on, end_on)
      VALUES (v_org, p_horse_id, v_name, nullif(btrim(v_curr ->> 'address_line1'),''),
              nullif(btrim(v_curr ->> 'city'),''), nullif(btrim(v_curr ->> 'state'),''),
              nullif(btrim(v_curr ->> 'postal'),''), nullif(btrim(v_curr ->> 'sub_location'),''),
              coalesce(v_curr -> 'keeping_spots','[]'::jsonb),
              nullif(btrim(v_curr ->> 'notes'),''), NULL, NULL);
    END IF;

    IF v_update_known THEN
      UPDATE locations SET
          address_line1 = nullif(btrim(v_curr ->> 'address_line1'),''),
          city  = nullif(btrim(v_curr ->> 'city'),''),
          state = nullif(btrim(v_curr ->> 'state'),''),
          postal= nullif(btrim(v_curr ->> 'postal'),'')
       WHERE org_id = v_org AND lower(name) = lower(v_name);
    END IF;
  END IF;

  UPDATE horses SET
      vaccinations = CASE WHEN v_vacc IS NOT NULL THEN v_vacc ELSE vaccinations END,
      updated_at = now()
   WHERE id = p_horse_id;
END;
$function$;

COMMIT;
