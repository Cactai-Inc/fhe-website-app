-- "OTHER — ENTER MANUALLY" IS HOW A MENU GROWS (owner, 2026-08-25).
--
-- > *"we should use this as a proxy for adding an item to the menu list for that
-- >  menu (only apply this to horse intake for now) … we need to treat 'other -
-- >  enter manually' as a method for recording the value in the db as written so it
-- >  will show up in the contract in the appropriate imported field."*
--
-- ⚠️ THE REASON FREE TEXT NEVER PRINTED IS NOT THE CONTRACT. It is a FOREIGN KEY.
--   horses.breed → horse_breeds(code)      ON UPDATE CASCADE
--   horses.color → horse_colors(code)      ON UPDATE CASCADE
-- Typing "Haflinger" into breed writes a value with no matching code, the FK
-- rejects the whole patch, and nothing is stored — so there is nothing for the
-- document to import. `horse_field_token_value` was never the problem: it already
-- does `coalesce((SELECT display_name … WHERE code = …), v_horse.breed)`, so it
-- would happily print a raw value if one could ever be saved. Farrier and vet are
-- plain text columns with no foreign key, which is exactly why free text works
-- there and only there.
--
-- So the fix is to make the typed value a REAL MENU ENTRY at the moment it is
-- typed. Then the FK is satisfied, the record saves, and the contract imports it.
--
-- ⚠️ CASE-INSENSITIVE DEDUPE IS THE POINT, NOT A NICETY. `lookup_suggestions`
-- currently holds `horse_breeds/Haflinger` seen THREE TIMES and dismissed, beside
-- `horse_breeds/Halfinger` seen once and promoted — the typo became the official
-- breed while the correct spelling was thrown away three times. Matching on the
-- display name means typing an existing value returns the existing code instead of
-- minting a near-duplicate.

BEGIN;

/**
 * Add (or find) a value in a menu vocabulary and return the CODE to store.
 *
 * Callable by any signed-in user, which is deliberate: the person filling in a
 * horse intake is often a client, not an admin, and the alternative to letting
 * them name their own horse's breed is a save that fails with nothing on screen
 * to fix. The blast radius is bounded three ways instead:
 *   · an ALLOWLIST of keys — the horse-intake vocabularies and nothing else, which
 *     is what "only apply this to horse intake for now" means in code rather than
 *     in a comment;
 *   · an exact-or-case-insensitive match returns the EXISTING row, so the common
 *     case adds nothing at all;
 *   · everything added is ordinary menu data the owner can rename or switch off
 *     in the Menus editor.
 */
CREATE OR REPLACE FUNCTION public.add_lookup_value(p_lookup_key text, p_raw_value text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_key  text := btrim(coalesce(p_lookup_key, ''));
  v_val  text := btrim(coalesce(p_raw_value, ''));
  v_code text;
  v_hit  text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_val = '' THEN RAISE EXCEPTION 'a value is required'; END IF;

  -- Horse intake's vocabularies, and only those.
  IF v_key NOT IN ('horse_breeds', 'horse_colors', 'horse_markings',
                   'horse_registration_org', 'horse_passport_country') THEN
    RAISE EXCEPTION 'lookup % is not open to additions from a form', v_key;
  END IF;

  -- Already there, however it was capitalised? Use it.
  IF v_key = 'horse_breeds' THEN
    SELECT code INTO v_hit FROM horse_breeds
     WHERE lower(display_name) = lower(v_val) OR lower(code) = lower(v_val) LIMIT 1;
  ELSIF v_key = 'horse_colors' THEN
    SELECT code INTO v_hit FROM horse_colors
     WHERE lower(display_name) = lower(v_val) OR lower(code) = lower(v_val) LIMIT 1;
  ELSE
    SELECT code INTO v_hit FROM lookup_options
     WHERE lookup_key = v_key
       AND (lower(display_name) = lower(v_val) OR lower(code) = lower(v_val)) LIMIT 1;
  END IF;

  IF v_hit IS NOT NULL THEN
    -- A value switched off earlier is switched back on by someone needing it.
    IF v_key = 'horse_breeds' THEN
      UPDATE horse_breeds SET active = true WHERE code = v_hit AND NOT active;
    ELSIF v_key = 'horse_colors' THEN
      UPDATE horse_colors SET active = true WHERE code = v_hit AND NOT active;
    ELSE
      UPDATE lookup_options SET active = true
       WHERE lookup_key = v_key AND code = v_hit AND NOT active;
    END IF;
    RETURN jsonb_build_object('code', v_hit, 'display_name', v_val, 'created', false);
  END IF;

  -- Same code shape promote_lookup_suggestion mints, so the two paths cannot
  -- produce two different codes for one word.
  v_code := upper(regexp_replace(v_val, '[^a-zA-Z0-9]+', '_', 'g'));

  IF v_key = 'horse_breeds' THEN
    INSERT INTO horse_breeds (code, display_name, active, sort_order)
    VALUES (v_code, v_val, true, 900) ON CONFLICT (code) DO UPDATE SET active = true;
  ELSIF v_key = 'horse_colors' THEN
    INSERT INTO horse_colors (code, display_name, active, sort_order)
    VALUES (v_code, v_val, true, 900) ON CONFLICT (code) DO UPDATE SET active = true;
  ELSE
    INSERT INTO lookup_options (lookup_key, code, display_name, active, sort_order)
    VALUES (v_key, v_code, v_val, true, 900)
    ON CONFLICT (lookup_key, code) DO UPDATE SET active = true;
  END IF;

  -- The review queue exists to catch values worth adding. This one has BEEN added,
  -- so it is recorded as settled rather than left for the owner to rule on twice.
  INSERT INTO lookup_suggestions (lookup_key, raw_value, norm_value, status, org_id)
  VALUES (v_key, v_val, lower(v_val), 'promoted', current_org())
  ON CONFLICT (lookup_key, norm_value) DO UPDATE
    SET status = 'promoted', count = lookup_suggestions.count + 1, last_seen = now();

  RETURN jsonb_build_object('code', v_code, 'display_name', v_val, 'created', true);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_lookup_value(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_lookup_value(text, text) TO authenticated, service_role;

-- ── the duplicate "Other" in the breed list ─────────────────────────────────
-- Owner: *"the breed list shows the option for 'other' twice, the only one that
-- matters is the 'other - enter manually', remove the other version of 'other'."*
-- `OTHER / "Other / Crossbred"` is a stored breed that sits in the list beside the
-- control's own "Other (enter manually)…" escape. Switched OFF rather than deleted:
-- it is a foreign-key target, and deactivating is how every other retired menu
-- value is handled here. Zero horses reference it (checked).
UPDATE horse_breeds SET active = false WHERE code = 'OTHER';

-- "Pony (other)" is left alone — a real breed classification, not a duplicate escape.

COMMIT;
