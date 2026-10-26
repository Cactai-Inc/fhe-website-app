-- disc_48 (fix round item 5a): horse_page_detail returns the location's
-- sub_location, and the owner's phone + email (so the record's Location card can
-- show Name + Owner + owner phone/email + location by name + sub-location). In-place
-- rewrite of two expressions with found-checks; single transaction.

BEGIN;

DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.horse_page_detail(uuid)'::regprocedure);
  -- 1) add sub_location to the current_location object
  v_loc_old text := '''keeping_spots'', hl.keeping_spots, ''notes'', hl.notes, ''start_on'', hl.start_on)';
  v_loc_new text := '''keeping_spots'', hl.keeping_spots, ''notes'', hl.notes, ''sub_location'', hl.sub_location, ''start_on'', hl.start_on)';
  -- 2) add owner_email + owner_phone right after owner_name
  v_own_old text := '''owner_name'', coalesce((SELECT nullif(btrim(coalesce(first_name,'''') || '' '' || coalesce(last_name,'''')),'''') FROM contacts WHERE id = v_h.current_owner_contact_id), v_h.owner_name_text),';
  v_own_new text := v_own_old
    || E'\n      ''owner_email'', (SELECT email FROM contacts WHERE id = v_h.current_owner_contact_id),'
    || E'\n      ''owner_phone'', (SELECT phone FROM contacts WHERE id = v_h.current_owner_contact_id),';
BEGIN
  IF position(v_loc_old in v_src) = 0 THEN
    RAISE EXCEPTION 'horse_page_detail current_location expression not found — body drifted';
  END IF;
  IF position(v_own_old in v_src) = 0 THEN
    RAISE EXCEPTION 'horse_page_detail owner_name expression not found — body drifted';
  END IF;
  v_src := replace(v_src, v_loc_old, v_loc_new);
  v_src := replace(v_src, v_own_old, v_own_new);
  EXECUTE v_src;
END $mig$;

COMMIT;
